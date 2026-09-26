# Plan PWA — Educar para Transformar

Iván Sánchez y Juan Manuel Cantero · iniciado el 26/09/2026

> **Este archivo es la fuente del plan y el tablero de tareas.** Al terminar una
> tarea, actualizar en el mismo PR su fila en [Reparto del trabajo](#reparto-del-trabajo)
> y agregar una entrada en [Entregas](#entregas).

Sí, se puede: la app ya es una SPA de Vite servida desde un solo dominio, así que
hacerla instalable lleva un par de días. El trabajo grande es que la interfaz
funcione en un celular, porque hoy los dos paneles tienen barra lateral fija y 23
pantallas usan tablas anchas.

## Diagnóstico

La base técnica ya sirve para una PWA; lo que falta es el manifest, el service
worker y una interfaz que se adapte a pantallas chicas.

| Aspecto | Estado inicial | Qué falta |
| --- | --- | --- |
| Build y hosting | Vite 8 + React 19; un solo contenedor en Coolify sirve `/api`, `/uploads` y el frontend desde el mismo dominio | Nada: un mismo origen simplifica el service worker y la sesión |
| HTTPS | Confirmado: el dominio de producción tiene HTTPS | Nada. El service worker exige HTTPS (salvo `localhost`) |
| Ruteo | `BrowserRouter` con `/`, `/login`, `/admin`, `/portal`, `/noticias/:id`; `Login` ya redirige según el rol | Nada: sirve como `start_url` |
| Sesión | Token JWT en `localStorage` (`ept_token`), cierre automático ante 401 | Nada en Android; en iPhone la app instalada tiene almacenamiento propio y pide login una vez |
| Manifest e íconos | No había; solo `favicon.svg` y `logo.png` de 202×202 | Hecho en T1 con íconos provisorios; íconos definitivos en T2 |
| `index.html` | `lang="en"`, título `educar-para-transformar`, sin `theme-color` | Hecho en T1 |
| Service worker | No había | Hecho en T1 (`vite-plugin-pwa`, Workbox) |
| Caché del servidor | `index.html` con `no-cache`, `/assets` inmutable por 1 año | Hecho en T1: `sw.js` y el manifest con `no-cache` |
| Interfaz mobile | `AdminPanel` y `StudentPortal` con barra lateral fija de 220–230 px y cabecera con 4–5 botones; 23 pantallas con `<table>`; casi sin breakpoints (34 usos de `sm:`/`md:`/`lg:` en todo el frontend) | Es el grueso del trabajo: ver *Adaptación mobile* |
| Notificaciones | El backend crea filas en `notificaciones` (`notificarFamilias`); el portal las lee al entrar | Opcional: Web Push para avisar con la app cerrada |

## Roles

Se hace una sola PWA para todos: el login ya manda a cada rol a su pantalla, y el
backend ya controla los permisos (`ROLES_ADMIN`, `ROLES_STAFF`). Lo que cambia por
rol es qué pantallas se optimizan primero para el celular.

| Rol | Pantalla | Uso esperado en el celular | Prioridad mobile | Qué se optimiza |
| --- | --- | --- | --- | --- |
| Padre / Tutor | `/portal` | Principal: ver notas, asistencia y cuotas de cada hijo, y recibir avisos | Alta | Las 8 secciones del portal, selector de hijo, campana de notificaciones |
| Alumno | `/portal` | Principal: horario del día, notas, actividades | Alta | Las mismas 8 secciones (sin selector de hijo) |
| Docente | `/admin` (menú docente) | Frecuente en el aula: tomar asistencia, cargar notas, amonestaciones | Alta | Tomar asistencia, Calificaciones, Amonestaciones; Legajos y Reservas después |
| Admin / Directivo | `/admin` (21 módulos) | Ocasional: consultas rápidas (dashboard, pagos, mensajes, inscripciones) | Media | Que todo sea usable (menú desplegable, tablas con scroll); las altas y ediciones complejas siguen pensadas para escritorio |

La seguridad no cambia con la PWA: un usuario instalado sigue viendo solo lo que
su rol y el backend le permiten.

## Decisiones técnicas

La regla central: se guardan en caché la aplicación y las imágenes públicas, nunca
los datos de la API. Así un celular compartido no deja notas ni cuotas de otra
familia guardadas.

| Tema | Decisión | Motivo |
| --- | --- | --- |
| Herramienta | `vite-plugin-pwa` en modo `generateSW` (Workbox) | Genera el service worker y el manifest desde `vite.config.ts`, sin código propio |
| Manifest | `name` "Educar para Transformar", `short_name` "Educar", `lang` es, `display` standalone, `start_url` `/login`, `scope` `/`, `theme_color` `#5B35C5`, `background_color` `#F5F4FB` | `/login` redirige solo a `/admin` o `/portal` si hay sesión, así que cada rol abre en su panel |
| Accesos directos | `shortcuts` al portal y al panel | Mantener presionado el ícono lleva directo a la sección |
| Precaché | `index.html`, JS, CSS e íconos del manifest | La app abre al instante y sin señal muestra su interfaz |
| Navegación | `navigateFallback` a `index.html`, excluyendo `/api` y `/uploads` | Las rutas de React funcionan sin conexión; la API nunca recibe el HTML |
| `/api/*` | Sin caché | Datos personales y con sesión; sin señal, `api.ts` ya devuelve "No se pudo conectar con el servidor" |
| `/uploads/noticias` y `/uploads/galeria` | `CacheFirst`, máximo 60 archivos y 30 días | Son las únicas carpetas de subida y solo guardan imágenes públicas |
| Fuentes de Google | `StaleWhileRevalidate` (CSS) y `CacheFirst` (archivos) | La tipografía Nunito se ve igual sin conexión |
| Actualizaciones | `registerType: 'prompt'` + aviso "Hay una versión nueva — Actualizar" (`src/pwa/ActualizarApp.tsx`) | Tras cada deploy nadie queda con una versión vieja, y el usuario no pierde un formulario a medio cargar |
| Servidor (Express) | `Cache-Control: no-cache` para `sw.js` y `manifest.webmanifest` | El navegador detecta enseguida el service worker nuevo |
| Sesión | Se mantiene el token en `localStorage`; al cerrar sesión no hay nada más que borrar porque la API no se cachea | Funciona igual instalada que en el navegador |
| Instalación | Botón "Instalar app" con `beforeinstallprompt` en Android; en iPhone, instrucciones de "Compartir → Agregar a inicio" | iOS no tiene aviso automático de instalación |
| Desarrollo | Service worker apagado en `pnpm dev`; se prueba con `pnpm build && pnpm preview` | Evita que la caché moleste mientras se programa |

## Adaptación mobile

Por debajo de 768 px (`md`), la barra lateral se convierte en navegación inferior
o menú desplegable según el rol. Primero se adaptan los dos "shells"
(`AdminPanel.tsx` y `StudentPortal.tsx`), porque cambian la experiencia de todas
las pantallas a la vez.

**Navegación por rol**

| Rol | En el celular | Detalle |
| --- | --- | --- |
| Padre / Alumno | Barra inferior con 5 botones | Inicio, Asistencias, Calificaciones, Cuotas y "Más" (Horario, Extracurriculares, Transporte y comedor, Notificaciones) |
| Docente | Barra inferior con 5 botones | Inicio, Asistencia, Notas, Amonestaciones y "Más" (Legajos, Reservas) |
| Admin / Directivo | Botón de menú (☰) que abre la barra lateral como panel deslizable | 21 módulos no entran en una barra inferior |

**Cambios generales**

- **Cabecera:** logo y avatar; "Mi contraseña", "Inicio" y "Salir" pasan a un menú del avatar. En el portal, el selector de hijo queda visible debajo de la cabecera.
- **Estilos del shell:** `AdminPanel.tsx` y `StudentPortal.tsx` tienen unos 20 bloques `style={{...}}` cada uno. Los estilos en línea no admiten breakpoints, así que esos bloques pasan a clases de Tailwind.
- **Tablas (23 pantallas):** como base, todas se envuelven en un contenedor con scroll horizontal. En las pantallas de uso diario (Tomar asistencia, Calificaciones y las tablas del portal) cada fila pasa a ser una tarjeta en el celular.
- **Formularios:** `formGrid4` pasa a 1 columna en celular y 2 en tablet.
- **Tacto:** botones y filas de al menos 44 px de alto; `font-size` de 16 px en los campos para que iPhone no haga zoom al tocarlos.
- **Bordes del teléfono:** `viewport-fit=cover` (ya está en `index.html`) y `env(safe-area-inset-*)` para que la barra inferior no quede bajo el gesto de inicio del iPhone.
- **Sitio público:** `Home.tsx` (1576 líneas) ya tiene algunos breakpoints; se revisa aparte, sin prioridad alta.

Para no duplicar código, se agregan a `ui/components.tsx` dos piezas compartidas:
`BottomNav` (recibe los ítems del rol) y `ResponsiveTable` (tabla en escritorio,
tarjetas en celular).

## Plan por fases

| Fase | Contenido | Entregable | Criterio de aceptación | Estimación |
| --- | --- | --- | --- | --- |
| 0. PWA instalable | `vite-plugin-pwa`, manifest, íconos, metas en `index.html`, reglas de caché, aviso de actualización, `no-cache` para `sw.js` en Express | La app se instala y abre en pantalla completa | Chrome la marca como instalable; se instala en Android (Chrome) y iPhone (Safari); tras un deploy aparece "Actualizar" | 1–2 días |
| 1. Shells responsive | Cabecera compacta, `BottomNav` para portal y docente, menú desplegable para admin, estilos del shell a Tailwind, safe areas | Se puede navegar todo el sistema con una mano | A 375 px de ancho no hay scroll horizontal en ningún shell; cada rol ve solo su menú | 3–4 días |
| 2. Pantallas prioritarias | Las 8 secciones del portal; Tomar asistencia, Calificaciones y Amonestaciones del docente; `ResponsiveTable` | Padres, alumnos y docentes usan su día a día desde el celular | Un docente toma asistencia de un curso completo en el celular sin hacer zoom | 4–5 días |
| 3. Sin conexión | Aviso "Sin conexión" (evento `offline` + errores con `status: 0`), botones de guardado deshabilitados mientras no hay señal | La app no falla en silencio sin señal | En modo avión la app abre, muestra el aviso y no pierde lo tipeado | 1–2 días |
| 4. Avisos push (opcional) | Tabla `push_subscriptions`, claves VAPID, `POST /api/push/suscribir`, envío con `web-push` dentro de `notificarFamilias`, botón "Activar avisos" en el portal | Las familias reciben las notificaciones con la app cerrada | Al cargar una nota o una amonestación, el padre recibe el aviso en el teléfono; tocarlo abre Notificaciones | 3–4 días |
| 5. Admin en celular | Scroll horizontal en todas las tablas restantes, formularios en 1 columna, repaso de los 21 módulos | Todo el panel admin se puede usar, aunque no esté optimizado | Ninguna pantalla admin se corta ni desborda a 375 px | 2–3 días |

Orden sugerido: 0 → 1 → 2 → 3, y después 5 o 4 según lo que pida la cátedra o la
escuela.

## Reparto del trabajo

Se reparte por archivos, no por fases, para que los dos trabajen en paralelo sin
pisarse: Iván se queda con el panel (`AdminPanel.tsx`, pantallas del docente,
configuración y backend) y Juan Manuel con el portal (`StudentPortal.tsx`,
componentes compartidos e íconos). Son 3 sprints de una semana (más uno opcional).

Estados: Pendiente · En curso · En revisión · Hecho.

| Tarea | Fase | Sprint | Responsable | Depende de | Estimación | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| T1. Base PWA: `vite-plugin-pwa`, manifest, metas de `index.html`, reglas de caché, aviso "Actualizar", `no-cache` de `sw.js` en Express | 0 | 1 | Iván | — | 1–2 días | Hecho (PR #7) |
| T2. Íconos definitivos y generación de tamaños (64, 192, 512, maskable, 180) con `@vite-pwa/assets-generator`; reemplazar `favicon.svg`; pedir el logo original a la escuela | 0 | 1 | Juan Manuel | — | 0,5 días | Hecho (PR #8) |
| T3. Componentes compartidos en `ui/components.tsx`: `BottomNav`, `ResponsiveTable`, menú del avatar, clases de safe area | 1 | 1 | Iván (era de Juan Manuel) | — | 1–1,5 días | Hecho (PR #9) |
| T4. Shell del panel: cabecera compacta, menú desplegable de admin, `BottomNav` del docente, estilos a Tailwind | 1 | 2 | Juan Manuel (era de Iván) | T3 (o el contrato de `BottomNav`) | 2 días | Hecho (PR #9) |
| T5. Shell del portal: cabecera, selector de hijo, `BottomNav` de padre y alumno | 1 | 2 | Iván (era de Juan Manuel) | T3 | 1,5–2 días | Hecho (PR #10) |
| T6. Pantallas del docente en celular: Tomar asistencia, Calificaciones, Amonestaciones | 2 | 2 | Iván | T4 | 2–3 días | Hecho (PR #12) |
| T7. Las 8 secciones del portal en celular | 2 | 2 | Juan Manuel | T5 | 2–3 días | Hecho (PR #13) |
| T8. Aviso "Sin conexión" y guardado deshabilitado sin señal | 3 | 3 | Juan Manuel | T1 | 1–2 días | Pendiente |
| T9. Admin en celular, parte académica: usuarios, alumnos, docentes, cursos, materias, asignaciones, inscripciones, mensajes, actividades, reservas, legajos | 5 | 3 | Iván | T4 | 1–1,5 días | Hecho (PR #14) |
| T10. Admin en celular, parte de gestión y sitio: cuotas, pagos, becas, sueldos, compras, servicios, reportes, noticias, empleos, postulaciones, galería | 5 | 3 | Juan Manuel | T4 | 1–1,5 días | En revisión |
| T11. (Opcional) Push, backend: tabla `push_subscriptions`, claves VAPID, `POST /api/push/suscribir`, envío en `notificarFamilias` | 4 | 4 | Iván | T1 | 2 días | Pendiente |
| T12. (Opcional) Push, frontend: botón "Activar avisos" y manejo del aviso en el service worker (`importScripts` en la config de Workbox) | 4 | 4 | Juan Manuel | T11 | 1–2 días | Pendiente |

**Ícono provisorio.** El texto del logo no se lee a tamaño de ícono, así que el
ícono definitivo usa solo las figuras de colores del centro, sobre fondo blanco.
Como `logo.png` mide 202×202, conviene vectorizar esas figuras (por ejemplo, con
"Trazar mapa de bits" de Inkscape) y guardar un SVG en `public/`. Cuando la
escuela mande el original, se reemplaza ese archivo y se regeneran los tamaños,
sin tocar código.

**Contrato de `BottomNav`.** Iván puede arrancar T4 antes de que T3 esté
mergeada si los dos respetan esta firma. Usa el mismo formato que los menús que
ya están en `constants/index.ts`:

```tsx
interface NavItem { key: string; icon: string; label: string }

<BottomNav items={NavItem[]} activo={string} onSelect={(key: string) => void} maxVisibles={4} contadores={{ notificaciones: 3 }} />
// Con más de maxVisibles + 1 ítems, los primeros maxVisibles quedan en la barra
// y el último botón es "Más", que abre el resto. Con 5 ítems o menos se ven todos.
// `contadores` (opcional) pone un número rojo sobre el ícono de cada ítem.
```

**Reglas para trabajar en paralelo**

- **Archivos con dueño:** Iván edita `AdminPanel.tsx`, `features/` del docente, `vite.config.ts`, `index.html` y `backend/`. Juan Manuel edita `StudentPortal.tsx`, `ui/components.tsx`, `ui/styles.ts` y `public/`. Si uno necesita tocar un archivo del otro, lo avisa y hace un PR chico aparte.
- **Una rama por tarea:** `feat/pwa-t2-iconos`, `feat/pwa-t4-shell-panel`, etc. PR a `main` al terminar cada tarea, no al final del sprint.
- **Revisión cruzada:** cada PR lo revisa y aprueba el otro. Nadie mergea su propio PR sin esa aprobación.
- **Traer `main` seguido:** actualizar la rama cada día con `git pull origin main` para detectar conflictos temprano.
- **Definición de hecho:** cumple el criterio de aceptación de su fase, se probó en un celular a 375 px, Codacy sin issues nuevos, PR aprobado y mergeado. Recién ahí la tarea pasa a *Hecho* en la tabla.
- **Seguimiento:** la tabla de arriba es el tablero. Al empezar una tarea se marca *En curso*; al abrir el PR, *En revisión*.

## Entregas

### T1 — Base PWA (Iván): hecho, mergeado en el PR #7

- **Qué quedó:** `vite-plugin-pwa` con manifest y service worker (`frontend/vite.config.ts`), íconos provisorios en `frontend/public/` generados desde `logo.png`, aviso "Hay una versión nueva" (`frontend/src/pwa/ActualizarApp.tsx`), metas de `index.html` y `no-cache` para `sw.js` y el manifest en Express (`backend/src/app.ts`). El README tiene la sección *App instalable (PWA)*.
- **Verificado:** build, lint y tipado sin errores. En Chromium a 375 px, con el backend sirviendo el build: service worker activo, Chrome no informa errores de instalación, nada de `/api` en caché, `/portal` abre sin conexión y el aviso de actualización aparece tras un deploy simulado.
- **Falta:** probar la instalación en un Android y un iPhone reales después del deploy.

### T2 — Íconos (Juan Manuel): hecho, mergeado en el PR #8

- **Qué quedó:** `frontend/public/logo-icono.svg` con las 5 figuras de colores del
  logo (sin texto ni anillo), sobre fondo blanco. Se obtuvo separando `logo.png`
  por componentes conexas de color (una por figura) y trazando cada una con
  `potrace` a 16x de sobremuestreo — el equivalente en línea de comandos a
  "Trazar mapa de bits" de Inkscape, que era la sugerencia original.
  `@vite-pwa/assets-generator` (`frontend/pwa-assets.config.ts`, preset
  `minimal-2023`) generó desde ese SVG los 5 archivos con los mismos nombres
  que ya usa el manifest — `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`,
  `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png` — más un
  `favicon.ico` que la herramienta generó de regalo (no se referencia todavía).
  También se reemplazó `frontend/public/favicon.svg` por el mismo logo.
  `vite.config.ts` no se tocó.
- **Corrección al paso 5 original:** `favicon.svg` no era el logo de Vite (ese
  quedó sin usar en `src/assets/vite.svg`); tenía ya una marca abstracta propia,
  sin relación con el logo de la escuela. Se reemplazó igual, para que el ícono
  de la pestaña coincida con el de la app instalada.
- **Verificado:** `tsc --noEmit` y `pnpm build` sin errores; `pnpm preview` sirve
  el manifest y los 5 íconos con `Content-Type: image/png` (y el favicon con
  `image/svg+xml`); a 32 px el logo todavía se distingue como las 5 figuras, a
  16 px se pierde el detalle (esperable con 5 formas, no es un defecto del
  trazado). No probado en un Android ni un iPhone reales.
- **Pendiente/decisión para revisar en el PR:** el logo sigue siendo
  provisorio (trazado desde el PNG de 202×202, no un vector original de la
  escuela); cuando llegue el logo real, alcanza con reemplazar
  `logo-icono.svg` y correr `pnpm run generate-pwa-assets` de nuevo.

### T3 — Componentes compartidos (Iván): hecho, mergeado en el PR #9

- **Cambio de responsable:** T3 figuraba a nombre de Juan Manuel; la hizo Iván
  para destrabar T4. Juan Manuel sigue siendo dueño de `ui/components.tsx` y
  `ui/styles.ts`, así que conviene que revise este PR.
- **Qué quedó** (en `frontend/src/ui/`):
  - `BottomNav`: barra inferior fija, solo debajo de `md` (768 px). Respeta el
    contrato de arriba; agrega `contadores` opcional. "Más" abre un panel con el
    resto de las secciones, se resalta si la sección activa está ahí y suma sus
    contadores; se cierra al elegir, al tocar afuera o con Escape. Botones de 64 px de alto.
  - `ResponsiveTable`: recibe `columnas` (`key`, `header`, `render`, `className`,
    `movil`) y `filas`. En escritorio es la tabla de siempre (`thCell`/`tdCell`)
    con scroll horizontal; en el celular, una tarjeta por fila. `movil: 'titulo'`
    va arriba en negrita, `'pie'` abajo sin etiqueta (botones), `'oculta'` no se
    muestra. Renderiza una sola de las dos versiones (con `useEsMovil`), así que
    las celdas pueden tener inputs sin duplicarlos.
  - `TablaScroll`: contenedor con scroll horizontal, para envolver las tablas que
    no pasen a `ResponsiveTable` (fase 5).
  - `AvatarMenu`: avatar con menú desplegable (nombre, detalle y opciones como
    "Mi contraseña", "Inicio", "Salir"). Se cierra al elegir, tocar afuera o con
    Escape; opciones de 44 px de alto.
  - `useEsMovil()` (`ui/useEsMovil.ts`): `true` por debajo de `md`.
  - En `ui/styles.ts`: `safeAreaBottom`, `safeAreaX`, `conBottomNav` (relleno
    inferior del `<main>` para que la barra no tape el contenido) y `touchTarget`.
  - El aviso "Hay una versión nueva" (`src/pwa/ActualizarApp.tsx`) sube en el
    celular para no quedar encima de la barra inferior.
- **Cómo usarlos en T4/T5:** `<main className={`... ${conBottomNav}`}>` y
  `<BottomNav items={NAV_ITEMS} activo={activeNav} onSelect={setActiveNav} />`
  al final del shell; en la cabecera, `<AvatarMenu iniciales=... nombre=... opciones=[...] />`
  en lugar de los botones sueltos (al menos debajo de `md`).
- **Verificado:** `tsc` de la app, lint de los archivos tocados y `pnpm build`
  sin errores (`tsc -b` y `pnpm lint` completos ya fallaban en `main` por
  `Home.tsx` y `pwa-assets.config.ts`, igual que antes). Con una página de
  prueba temporal (no incluida) en Chromium a 375 px: sin scroll horizontal,
  barra con 4 secciones + "Más", el panel abre y cierra, el menú del avatar
  cierra con Escape, y las tarjetas se ven bien; a 1200 px la barra no aparece
  y la tabla es la de siempre. No probado en un teléfono real (todavía no se
  usa en ninguna pantalla).

### T4 — Shell del panel (Juan Manuel): hecho, mergeado en el PR #9

- **Cambio de responsable:** T4 figuraba a nombre de Iván; la hizo Juan Manuel,
  y a cambio Iván tomó T5.
- **Qué quedó** (en `frontend/src/AdminPanel.tsx`): cabecera compacta con
  `AvatarMenu` ("Mi contraseña", "Inicio", "Salir"); en el celular, Admin y
  Directivo abren el menú lateral como panel deslizable con el botón ☰ (se
  cierra al elegir, al tocar afuera o con Escape) y Docente usa `BottomNav`.
  Los estilos en línea del shell pasaron a clases de Tailwind.

### T5 — Shell del portal (Iván): hecho, mergeado en el PR #10

- **Cambio de responsable:** T5 era de Juan Manuel; la hizo Iván, a cambio de T4.
- **Qué quedó** (en `frontend/src/StudentPortal.tsx`):
  - Cabecera compacta: logo, campana de notificaciones (botón de 44 px con el
    número sin leer) y `AvatarMenu` con el nombre y el rol del usuario logueado
    (antes el avatar mostraba las iniciales del alumno, también para el padre).
  - Selector de hijo en el componente `SelectorHijo`: en escritorio sigue en la
    cabecera; en el celular, el padre/tutor lo ve en una franja fija debajo de
    la cabecera, con letra de 16 px para que el iPhone no haga zoom. Se
    renderiza uno solo por pantalla (`useEsMovil`), así no hay dos `<select>`.
  - Barra lateral solo desde `md`; en el celular, `BottomNav` con Inicio,
    Asistencias, Calificaciones, Cuotas y "Más" (Mi Horario, Extracurriculares,
    Transporte y comedor, Notificaciones), con contadores de cuotas pendientes
    y notificaciones sin leer. Los ítems de la barra lateral pasaron a `<button>`.
- **Corrección de T3/T4:** en el celular la cabecera y el contenido de los dos
  shells quedaban pegados al borde, porque `safeAreaX` (`pl-[env(...)]`, que
  vale 0 sin notch) pisaba el `px-4`. Se agregó `conPaddingX` en
  `ui/styles.ts` (16 px o el área segura, lo que sea mayor) y se usa en
  `StudentPortal.tsx` y `AdminPanel.tsx` en lugar de `px-4` + `safeAreaX`.
  Toca archivos de Juan Manuel, así que conviene que lo revise.
- **Verificado:** `tsc` de la app y `pnpm build` sin errores; el lint de
  `StudentPortal.tsx` da los mismos 3 errores que ya había en `main` (carga de
  datos, no el shell). Con `pnpm preview` y la API simulada, en Chromium a
  375 px, con padre de dos hijos y con alumno: sin scroll horizontal, 16 px de
  margen lateral en los dos shells, "Más" abre el resto de las secciones,
  el menú del avatar cierra con Escape y cambiar de hijo recarga el portal;
  a 1280 px, la cabecera y la barra lateral de siempre, sin barra inferior.
  No probado en un teléfono real.
- **Queda para T7:** el contenido de las 8 secciones (las tarjetas de Inicio
  siguen en 4 columnas y las tablas desbordan en el celular).

### T6 — Pantallas del docente (Iván): hecho, mergeado en el PR #12

- **Qué quedó** (en `frontend/src/features/`):
  - **Tomar asistencia:** filtros en una columna en el celular; cada alumno en
    una fila con el botón de estado de 44 px y ancho fijo a la derecha (el
    avatar con iniciales se oculta debajo de 640 px para dejar lugar al nombre);
    la leyenda muestra cuántos hay en cada estado; "Guardar asistencia" ocupa
    todo el ancho.
  - **Calificaciones:** formulario en 1 columna en el celular y 2 en tablet
    (`inputMode='decimal'` en la nota, para el teclado numérico); "Notas
    cargadas" pasó a `ResponsiveTable` (tarjetas en el celular).
  - **Amonestaciones:** formulario en 1 columna, botones de curso de 44 px y
    el historial con `ResponsiveTable`. Se sacaron los `as any`: el tipo
    `Asignacion` ahora declara `cursos.id_curso`, que `/asignaciones/mias` ya
    devolvía.
  - Los estilos en línea de las tres pantallas pasaron a clases de Tailwind, y
    las etiquetas quedaron asociadas a su campo (`<label htmlFor>`).
- **Cambios globales en `ui/styles.ts`** (archivo de Juan Manuel, conviene que
  lo revise): `inputField` usa letra de 16 px debajo de `md`, para que el
  iPhone no haga zoom al tocar un campo (plan, sección *Tacto*), y `card` usa
  `p-4` en el celular en lugar de `p-6`. Alcanza a todas las pantallas, así
  que adelanta parte de T9/T10.
- **Verificado:** `tsc` de la app y `pnpm build` sin errores; el lint de las
  tres pantallas bajó de 7 errores a 2 (los dos que quedan ya estaban: carga
  de datos dentro de un efecto). Con `pnpm preview` y la API simulada, como
  docente con un curso de 30 alumnos, en Chromium a 375 px con modo táctil:
  sin scroll horizontal en las tres pantallas, campos con letra de 16 px,
  botones de estado de 44 px, los toques cambian el estado y el guardado
  envía los estados correctos; a 1280 px se ven como antes. No probado en un
  teléfono real.

### T7 — Las 8 secciones del portal (Juan Manuel): hecho, mergeado en el PR #13

- **Qué quedó** (en `frontend/src/StudentPortal.tsx`):
  - **Inicio:** las 4 tarjetas de estadísticas pasan de 4 a 2 columnas debajo de
    `md`; "Clases de hoy" y "Notificaciones recientes" pasan de 2 columnas a 1;
    "Últimas calificaciones" pasó a `ResponsiveTable`.
  - **Calificaciones** (resumen y completa): las dos tablas pasaron a
    `ResponsiveTable` con las mismas columnas de antes; en el celular, la
    materia queda de título, la nota como un círculo al pie de la tarjeta (igual
    que se veía en la tabla) y el resto como pares etiqueta/valor. Se creó
    `NotaBadge` para no repetir el círculo de la nota entre las dos tablas.
  - **Asistencias:** los 5 contadores pasan a 2 columnas en el celular, 3 en
    tablet chica y 5 desde `md`.
  - **Cuotas:** la tabla pasó a `ResponsiveTable`; el período queda de título y
    el estado (chip de color) al pie de la tarjeta.
  - **Horario:** ya era una lista de filas (no una tabla ancha), no necesitó
    cambios.
  - **Extracurriculares:** las tarjetas de Idiomas/Deportes pasan de 2 columnas
    a 1 en el celular.
  - **Transporte y comedor:** las tarjetas de recorridos pasan de 2 columnas a 1
    en el celular.
  - **Notificaciones:** se agregó `flex-wrap` a las dos cabeceras con botón
    ("Marcar todas como leídas" y "Promedio") para que no corten texto en
    pantallas angostas.
  - Se reutilizó `Badge` de `ui/components.tsx` (ya existía desde T3) en vez de
    repetir el `<span>` con estilo en línea para los chips de tipo/estado.
- **No se tocó:** el shell (cabecera, selector de hijo, `BottomNav`) porque ya
  lo dejó T5; `ui/styles.ts` porque T6 ya adelantó `inputField` a 16 px y
  `card` a `p-4` en el celular, y esta tarea las aprovecha directo.
- **Verificado:** `pnpm build` sin errores; el lint de `StudentPortal.tsx`
  quedó en los mismos 3 errores que ya tenía en `main` antes de esta tarea
  (orden de declaración de `loadAll`/`loadDatosAlumno` y `setState` dentro de
  un efecto), confirmado comparando contra `main` con `git stash`. No probado
  con la API real ni en un teléfono real (no se puede levantar el backend en
  este entorno).

### T9 — Admin en celular, parte académica (Iván): hecho, mergeado en el PR #14

- **Qué quedó** (en `frontend/src/features/`: usuarios, alumnos y legajo del
  alumno, docentes, cursos, materias, asignaciones, inscripciones y su
  detalle, mensajes, actividades, reservas y legajos del docente):
  - Las 12 tablas quedaron dentro de `TablaScroll`: en el celular se deslizan
    de costado en vez de estirar la pantalla. En Actividades, la tabla de
    inscriptos va anidada dentro de una fila, así que se envolvió solo la de
    afuera.
  - Formularios y grillas en 1 columna en el celular (2 en tablet): los
    `gridTemplateColumns` en línea pasaron a clases de Tailwind y
    `grid-cols-2` fijo a `grid-cols-1 sm:grid-cols-2`.
  - Las cabeceras con botón (`justify-between`) ahora bajan de línea si no
    entran. En Mensajes, un email largo corta en vez de desbordar.
- **Cambios globales** (archivos de Juan Manuel, conviene que los revise):
  `formGrid4` en `ui/styles.ts` pasa a 1 columna en el celular, 2 en tablet y
  4 desde `md` (como dice *Adaptación mobile*); por eso el `col-span-2` de
  Materias pasó a `sm:col-span-2`. `SectionHeader` en `ui/components.tsx`
  ahora hace `flex-wrap`. Los dos alcanzan también a las pantallas de T10.
- **Cómo se midió:** el `<main>` del panel tiene `overflow-y-auto`, así que
  también recorta en horizontal y el desborde no se ve en el scroll de la
  página: se mide `main.scrollWidth` contra su ancho visible y se buscan
  elementos que se salgan de `main` fuera de un `TablaScroll`. **Sirve para
  T10.**
- **Verificado:** `tsc` de la app y `pnpm build` sin errores; el lint de estas
  pantallas y de `ui/` da los mismos 12 errores que en `main` (todos
  `setState` dentro de un efecto al cargar datos). Con `pnpm preview` y la API
  simulada (nombres y emails largos), en Chromium a 375 px, como Admin y como
  Docente, con el formulario de alta abierto donde hay: en `main` desbordaban
  10 de 12 pantallas (Usuarios llegaba a 789 px de ancho); en la rama, ninguna.
  A 1280 px sin cambios visibles y sin errores de JS. No probado en un
  teléfono real.
- **Queda como mejora (no hace falta para la fase 5):** en el celular las
  tablas se achican hasta el ancho de la pantalla antes de deslizarse, así
  que los nombres largos ocupan varias líneas. Si molesta, se puede dar un
  ancho mínimo a las tablas dentro de `TablaScroll` o pasar las más usadas a
  `ResponsiveTable`.

### T10 — Admin en celular, parte de gestión y sitio (Juan Manuel): en revisión, rama `feat/pwa-t10-admin-gestion`

- **Qué quedó** (en `frontend/src/features/`: cuotas, pagos, becas, sueldos,
  compras, servicios, reportes, noticias, empleos, postulaciones y galería —
  11 pantallas, 13 tablas en total):
  - Las 13 tablas quedaron dentro de `TablaScroll` (mismo componente que T9),
    incluida la del reporte con formato dinámico (`GestionReportes`, la única
    tabla que se arma según el tipo de reporte elegido) y las dos tablas
    independientes de Registrar pagos (cuotas filtradas + historial).
  - Grillas fijas (`grid-cols-2/3/5`) y dos `gridTemplateColumns` en línea
    (Compras, Galería) pasaron a 1 columna en el celular, siguiendo la misma
    convención que dejó T9: `grid-cols-1 sm:grid-cols-N`.
  - Las cabeceras con botón (Servicios, Empleos) ahora bajan de línea con
    `flex-wrap` si no entran, igual que hizo T9 en Mensajes.
  - `Empleos` no tenía tabla (usa tarjetas de `flex`); ya traía `min-w-0` y
    `shrink-0` bien puestos, así que no necesitó cambios ahí.
- **No se tocó** `ui/styles.ts` ni `ui/components.tsx`: `formGrid4` (1 columna
  en el celular) y el `flex-wrap` de `SectionHeader` ya los dejó T9 hechos
  para las dos partes del admin, así que esta tarea los usa tal cual.
- **Cómo se midió:** mismo método que T9 (`main.scrollWidth` del panel contra
  su ancho visible, buscando elementos fuera de un `TablaScroll`), pero sin
  poder correr `pnpm preview` con la API simulada en este entorno (sin
  backend), así que la medición fue por inspección del código: cada tabla y
  cada grilla fija de las 11 pantallas quedó localizada con `grep` antes y
  después del cambio, sin ninguna sin convertir.
- **Verificado:** `pnpm build` sin errores; el lint de las 11 pantallas da
  los mismos 16 errores que en `main` antes de esta tarea (confirmado con
  `git stash`; todos `setState` dentro de un efecto al cargar datos, igual
  que en T6/T9). **No probado en el navegador ni en un teléfono real** (no
  se pudo levantar el backend en este entorno) — a diferencia de T1-T9, acá
  falta esa verificación visual.

## Pruebas

Cada fase se prueba con los usuarios de `npm run seed:demo` (hay Admin,
Directivo, Docente, Padre y Alumno) y en dos teléfonos reales: un Android con
Chrome y un iPhone con Safari.

- [x] **Build local:** `pnpm build && pnpm preview`; en DevTools → Application, el manifest sin errores y el service worker activo.
- [ ] **Lighthouse** (modo mobile): instalable, sin errores de manifest, accesibilidad sin regresiones.
- [ ] **Instalación:** en Android desde "Instalar app"; en iPhone desde Compartir → Agregar a inicio. Abre en pantalla completa con el ícono correcto.
- [ ] **Por rol:** entrar con cada usuario de prueba desde la app instalada y verificar que abre en su panel y ve solo su menú.
- [ ] **Padre con varios hijos:** cambiar de hijo desde el selector y revisar notas, cuotas y notificaciones.
- [ ] **Docente:** tomar asistencia y cargar notas de un curso completo en un teléfono de 375 px.
- [ ] **Cerrar sesión:** tras salir, en modo avión, no queda ningún dato personal visible.
- [ ] **Actualización:** hacer un deploy nuevo con la app abierta y comprobar que aparece "Actualizar".
- [ ] **Sin conexión:** en modo avión la app abre y muestra el aviso; al volver la señal se recupera sola.
- [ ] **Producción:** repetir la instalación contra el dominio real de Coolify (HTTPS).

## Riesgos y preguntas abiertas

El mayor riesgo no es técnico sino de alcance: la adaptación de la interfaz lleva
más tiempo que la PWA en sí.

| Riesgo | Impacto | Cómo se mitiga |
| --- | --- | --- |
| iPhone limita las PWA: no hay aviso de instalación, push solo desde iOS 16.4 y con la app instalada, y la sesión no se comparte con Safari | Las familias con iPhone necesitan un paso más | Pantalla de ayuda para instalar; el push se ofrece solo dentro de la app instalada |
| Versión vieja en caché después de un deploy | Usuarios con pantallas que no coinciden con el backend | `registerType: 'prompt'` + `no-cache` para `sw.js` |
| Teléfonos compartidos en una familia | Ver datos del otro usuario | La API nunca se cachea; cerrar sesión alcanza |
| Token en `localStorage` (ya pasa hoy) | Si hubiera un XSS, el token quedaría expuesto | Fuera del alcance de la PWA; se puede pasar a cookie `httpOnly` en otro momento |
| Tiempo de adaptar 23 pantallas con tablas | Retrasa la entrega | Fase 2 solo con las pantallas de uso diario; el resto con scroll horizontal (fase 5) |

**Preguntas abiertas**

- [x] ¿El dominio de producción en Coolify tiene HTTPS? Sí.
- [x] ¿Hay un logo en alta resolución? No: se vectoriza uno provisorio en T2 y se pide el original a la escuela.
- [x] ¿Se reparte el trabajo entre Iván y Juan Manuel? Sí: ver *Reparto del trabajo*.
- [ ] ¿Los avisos push (fase 4) entran en el alcance del TP o quedan como mejora?
- [ ] ¿Los administrativos van a usar el panel desde el celular, o alcanza con que sea usable (fase 5)?
