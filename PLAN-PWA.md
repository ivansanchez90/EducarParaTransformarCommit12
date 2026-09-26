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
| T2. Íconos definitivos y generación de tamaños (64, 192, 512, maskable, 180) con `@vite-pwa/assets-generator`; reemplazar `favicon.svg`; pedir el logo original a la escuela | 0 | 1 | Juan Manuel | — | 0,5 días | En revisión |
| T3. Componentes compartidos en `ui/components.tsx`: `BottomNav`, `ResponsiveTable`, menú del avatar, clases de safe area | 1 | 1 | Juan Manuel | — | 1–1,5 días | Pendiente |
| T4. Shell del panel: cabecera compacta, menú desplegable de admin, `BottomNav` del docente, estilos a Tailwind | 1 | 2 | Iván | T3 (o el contrato de `BottomNav`) | 2 días | Pendiente |
| T5. Shell del portal: cabecera, selector de hijo, `BottomNav` de padre y alumno | 1 | 2 | Juan Manuel | T3 | 1,5–2 días | Pendiente |
| T6. Pantallas del docente en celular: Tomar asistencia, Calificaciones, Amonestaciones | 2 | 2 | Iván | T4 | 2–3 días | Pendiente |
| T7. Las 8 secciones del portal en celular | 2 | 2 | Juan Manuel | T5 | 2–3 días | Pendiente |
| T8. Aviso "Sin conexión" y guardado deshabilitado sin señal | 3 | 3 | Juan Manuel | T1 | 1–2 días | Pendiente |
| T9. Admin en celular, parte académica: usuarios, alumnos, docentes, cursos, materias, asignaciones, inscripciones, mensajes, actividades, reservas, legajos | 5 | 3 | Iván | T4 | 1–1,5 días | Pendiente |
| T10. Admin en celular, parte de gestión y sitio: cuotas, pagos, becas, sueldos, compras, servicios, reportes, noticias, empleos, postulaciones, galería | 5 | 3 | Juan Manuel | T4 | 1–1,5 días | Pendiente |
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

<BottomNav items={NavItem[]} activo={string} onSelect={(key: string) => void} maxVisibles={4} />
// Con más de maxVisibles ítems, el último botón es "Más" y abre el resto.
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

### T2 — Íconos (Juan Manuel): en revisión, rama `feat/pwa-t2-iconos`

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
