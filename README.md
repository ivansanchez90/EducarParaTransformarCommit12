[![Codacy Badge](https://app.codacy.com/project/badge/Grade/a491351e36c24b36952fd097ebedf593)](https://app.codacy.com/gh/ivansanchez90/EducarParaTransformarCommit12/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)


# Educar para Transformar — Campus Virtual
## Descripción
Aplicación web de campus virtual para la institución educativa "Educar para
Transformar" (nivel Inicial/Primario/Secundario). Permite gestionar alumnos,
docentes, cursos, materias, asistencia, calificaciones, cuotas, comunicados,
mensajería interna y demás procesos administrativos y académicos del centro,
con un panel diferenciado según el rol del usuario (Admin, Docente, Alumno,
Familia).

Frontend en React + TypeScript + Tailwind. Backend en Node.js + Express +
Prisma sobre PostgreSQL (el proyecto usaba Supabase y se migró a un backend
propio).

## Estructura

```
backend/    API REST (Express 5 + Prisma 7) y docker-compose de PostgreSQL
frontend/   SPA React (Vite)
Dockerfile  imagen única de producción (backend + frontend compilado)
```

## Cómo ejecutar el programa

Requisitos: Node.js 20+ y Docker.

### 1. Base de datos y backend

```bash
cd backend
cp .env.example .env          # completar JWT_SECRET con un valor largo y aleatorio
npm install
npm run db:up                 # levanta PostgreSQL con docker compose
npx prisma migrate deploy     # crea las tablas
npx prisma generate           # genera el cliente de Prisma
npm run seed                  # admin inicial, período activo, actividades e instalaciones
                              # (en Prisma 7, `migrate reset` ya no corre el seed solo)
npm run dev                   # API en http://localhost:4000
```

El seed crea el usuario `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` del `.env`
(por defecto `admin@educar.local` / `admin1234`). Cambiá esa contraseña en
producción.

### Datos de prueba

Para trabajar (o mostrar el sistema) con un colegio completo y ya cargado:

```bash
npm run seed:demo
```

Carga doce cursos de los tres niveles, doce docentes, más de cien alumnos con
sus familias, asignaciones y horarios, asistencia de las últimas jornadas,
calificaciones, cuotas con sus pagos, becas, sueldos, compras, servicios de
transporte y comedor, reservas, noticias, galería, empleos con postulaciones,
preinscripciones sin resolver y mensajes de contacto.

Todos los usuarios que crea entran con la contraseña `demo1234`
(configurable con `SEED_DEMO_PASSWORD`); el admin conserva la suya. Al
terminar, imprime un usuario de ejemplo de cada rol para probar.

> ⚠️ **Borra todo lo que haya en la base** antes de cargar los datos. Por eso
> solo corre contra una base local: para usarlo en otra hay que declarar
> `SEED_DEMO_FORCE=true` de forma explícita.

Otros comandos útiles del backend:

| Comando | Qué hace |
|---|---|
| `npm run seed:demo` | Vacía la base y la llena con datos de prueba (ver arriba) |
| `npm run db:sync` | Después de un `git pull`: aplica las migraciones nuevas del repo en tu base local y regenera el cliente de Prisma |
| `npm run prisma:migrate` | Crea una migración nueva después de editar `prisma/schema.prisma` |
| `npm run prisma:studio` | Abre Prisma Studio para ver/editar los datos |
| `npm run db:down` | Detiene el contenedor de PostgreSQL (los datos quedan en el volumen) |
| `npm run build && npm start` | Compila y corre la API en modo producción |

Los archivos subidos (galería, imágenes de noticias y documentos de legajo) se
guardan en `backend/uploads/` y se sirven en `/uploads`.

### 2. Frontend

```bash
cd frontend
pnpm install
pnpm dev                      # http://localhost:5173
```

No hace falta configurar la URL de la API: Vite reenvía `/api` y `/uploads`
al backend en `localhost:4000`, igual que en producción, donde todo comparte
dominio.

Para generar el build de producción: `npm run build`.

## Despliegue (Coolify)

La app se despliega como **un solo contenedor** con el `Dockerfile` de la raíz:
el backend (Express) sirve la API en `/api`, los archivos subidos en
`/uploads` y el frontend compilado en el resto de las rutas. Un solo dominio,
sin CORS. La base es un recurso PostgreSQL de Coolify (el `docker-compose.yml`
de `backend/` es solo para desarrollo local).

En Coolify: Application → Build Pack **Dockerfile**, Base Directory `/`,
puerto **4000**.

| Variable | Valor |
|---|---|
| `DATABASE_URL` | URL interna del Postgres de Coolify (con `?schema=public`) |
| `JWT_SECRET` | valor largo y aleatorio (`openssl rand -hex 32`) |
| `JWT_EXPIRES_IN` | opcional, por defecto `8h` |

Montar un **volumen persistente en `/app/uploads`** (si no, los archivos
subidos se pierden en cada deploy). Seed inicial, una sola vez, desde la
terminal del contenedor: `npx prisma db seed`.

**Migraciones:** el contenedor ejecuta `prisma migrate deploy` al arrancar,
antes de levantar la app. En cada deploy se aplican las migraciones nuevas de
`backend/prisma/migrations/` (si no hay ninguna, no hace nada). Si una
migración falla, el contenedor nuevo no arranca y Coolify mantiene el
anterior. Para cambiar el esquema:

```bash
cd backend
# editar prisma/schema.prisma
npm run prisma:migrate -- --name descripcion_del_cambio   # crea la migración y la aplica en local
git add prisma && git commit && git push                  # Coolify despliega y la aplica
```

> Si en algún momento el frontend se aloja en otro dominio, basta con definir
> `VITE_API_URL` (al compilar el frontend) y `CORS_ORIGIN` / `PUBLIC_URL` en el
> backend.

> Lo que falta implementar del TP1 está listado en [`PENDIENTES.md`](PENDIENTES.md).

## Funcionalidades principales

- **Gestión de usuarios**: alta, edición y desactivación de cuentas
  (Admin, Docente, Alumno, Familia). Cada usuario cambia su propia contraseña
  desde el panel o el portal, y la administración puede asignar una nueva a
  quien la haya olvidado.
- **Gestión académica**: cursos, materias, asignaciones docente-materia,
  planes de estudio.
- **Alumnos**: alta y edición completa (datos personales, curso, tutor, obra
  social y contacto de emergencia), baja y reactivación, legajo,
  inscripciones, calificaciones, asistencia y amonestaciones.
- **Preinscripciones**: las solicitudes enviadas desde la web se revisan una
  por una (todos los datos, observaciones internas y control de
  documentación). Al aprobarlas se da de alta al alumno y, opcionalmente, se
  crean los usuarios de acceso del tutor y del alumno.
- **Comunicación**: noticias, comunicados, mensajería interna y
  notificaciones a las familias.
- **Administración**: cuotas, pagos, becas, sueldos, compras.
- **Bolsa de trabajo**: publicación de empleos y postulaciones.
- **Servicios complementarios**: transporte escolar (recorridos con zona,
  paradas, horarios y cupo) y comedor. La administración inscribe a cualquier
  alumno y las familias gestionan los servicios de sus hijos desde el portal.
- **Reportes**: listados de alumnos por curso, materia, deporte y recorrido de
  transporte, y ficha individual del alumno (materias, profesores, actividades
  y servicios). Se ven en pantalla y se exportan a PDF o CSV.
- **Otros**: reservas de espacios, galería de imágenes.


# Documentación de la refactorización

> Registro histórico: esta refactorización se hizo cuando el proyecto todavía
> usaba Supabase. Las referencias a `supabaseClient.ts` y a las Edge Functions
> ya no aplican; hoy el frontend usa `lib/api.ts` y `lib/auth.ts` contra el
> backend de `backend/`.

**Proyecto:** Educar Para Transformar
**Alcance:** aplicación de 5 mejoras de calidad de código detectadas sobre el frontend
(`frontend/src`) y una Edge Function de Supabase.
**Estado:** completado. La aplicación compila (`npm run build`, 101 módulos) y el
chequeo de tipos pasa limpio (`tsc --noEmit`, exit 0).

---

## Índice de mejoras

| Nº | Problema | Ubicación original | Estado |
|----|----------|--------------------|--------|
| 1 | Código duplicado | General | ✅ Resuelto |
| 2 | Falta de modularización | `frontend/src/AdminPanel.tsx` | ✅ Resuelto |
| 3 | Código comentado | `supabase/functions/crear-usuario/index.ts` | ✅ Resuelto |
| 4 | Inconsistencia de formatos | `AdminPanel.tsx` | ✅ Resuelto |
| 5 | Mezcla de responsabilidades | `AdminPanel.tsx / GestionAlumnos` | ✅ Resuelto |

---

## Infraestructura compartida creada

Como base para resolver las mejoras 1, 4 y 5 se crearon módulos reutilizables:

```
frontend/src/
├── lib/
│   ├── supabaseClient.ts      # Cliente Supabase único
│   └── notificaciones.ts      # Helper notificarFamilias unificado
├── types/
│   └── index.ts               # Todas las interfaces de dominio
├── constants/
│   └── index.ts               # MESES, NAV_*, METODOS_PAGO, colores, etc.
└── ui/
    ├── styles.ts              # Clases de estilo reutilizables (botón, input, tabla…)
    └── components.tsx         # Componentes reutilizables (Card, Field, Badge…)
```

---

## Mejora 1 — Código duplicado

### Problema
El mismo código estaba repetido en varios lugares, lo que dificulta el mantenimiento:
un cambio obligaba a modificar el mismo fragmento en múltiples archivos.

### Casos detectados y solución

**a) Cliente de Supabase duplicado en 5 archivos.**
`const supabase = createClient(...)` con la misma configuración aparecía en
`AdminPanel.tsx`, `Login.tsx`, `Home.tsx`, `StudentPortal.tsx` y `NoticiaDetalle.tsx`.

- Se creó **`frontend/src/lib/supabaseClient.ts`** que exporta una única instancia.
- Los 5 archivos ahora hacen `import { supabase } from './lib/supabaseClient'`.

**b) Helper `notificarFamilias` duplicado.**
La función que inserta notificaciones para las familias se usaba en varias secciones
(cuotas, noticias, asistencia, calificaciones).

- Se centralizó en **`frontend/src/lib/notificaciones.ts`**.
- Los consumidores lo importan en lugar de redefinirlo.

**c) Cadenas de clases de estilo repetidas decenas de veces** (ver Mejora 4).

### Resultado

| Elemento duplicado | Antes | Después |
|--------------------|-------|---------|
| `createClient(...)` | 5 archivos | **1** (`lib/supabaseClient.ts`) |
| `notificarFamilias` | varias copias | **1** (`lib/notificaciones.ts`) |

---

## Mejora 2 — Falta de modularización

### Problema
`frontend/src/AdminPanel.tsx` contenía **~7.938 líneas** con cerca de 26 componentes
en un solo archivo: difícil de navegar, propenso a conflictos de merge y complicado
de testear.

### Solución
Se dividió el archivo aplicando una arquitectura por *features* (una carpeta por
dominio funcional). `AdminPanel.tsx` quedó reducido a un **shell**: autenticación,
layout (header + sidebar) y enrutado entre secciones.

Además se eliminó el componente `LoginAdmin`, que estaba definido pero **nunca se
usaba** (código muerto).

### Estructura resultante

```
frontend/src/
├── AdminPanel.tsx             # Shell: auth + layout + routing (~340 líneas)
└── features/
    ├── dashboard/Dashboard.tsx
    ├── usuarios/GestionUsuarios.tsx
    ├── alumnos/
    │   ├── GestionAlumnos.tsx
    │   ├── LegajoAlumno.tsx
    │   └── useAlumnos.ts       # (ver Mejora 5)
    ├── docentes/GestionDocentes.tsx
    ├── cursos/GestionCursos.tsx
    ├── materias/GestionMaterias.tsx
    ├── asignaciones/GestionAsignaciones.tsx
    ├── cuotas/GestionCuotas.tsx
    ├── pagos/RegistrarPagos.tsx
    ├── becas/GestionBecas.tsx
    ├── sueldos/GestionSueldos.tsx
    ├── compras/GestionCompras.tsx
    ├── inscripciones/GestionInscripciones.tsx
    ├── actividades/GestionActividades.tsx
    ├── reservas/GestionReservas.tsx
    ├── mensajes/GestionMensajes.tsx
    ├── noticias/GestionNoticias.tsx
    ├── empleos/GestionEmpleos.tsx
    ├── postulaciones/GestionPostulaciones.tsx
    ├── galeria/GestionGaleria.tsx
    ├── asistencia/TomarAsistencia.tsx
    ├── calificaciones/CargarCalificaciones.tsx
    ├── amonestaciones/GestionAmonestaciones.tsx
    └── legajos-docente/LegajosDocente.tsx
```

### Resultado

| Métrica | Antes | Después |
|---------|-------|---------|
| Líneas de `AdminPanel.tsx` | 7.938 | ~340 |
| Componentes por archivo | ~26 | 1 |
| Archivos de features | 0 | 26 |

---

## Mejora 3 — Código comentado

### Problema
`supabase/functions/crear-usuario/index.ts` tenía **todas sus líneas comentadas**. El
código comentado estorba la lectura y es innecesario (el historial ya lo guarda el
control de versiones).

### Análisis importante
La regla general es "lo que no se usa, se borra". Sin embargo, se verificó que esta
función **sí se usa**: se invoca desde el panel al crear usuarios
(`supabase.functions.invoke('crear-usuario', ...)`). Por lo tanto no era código muerto,
sino código **funcional desactivado**.

### Solución
Se **restauró** la función: se quitaron los marcadores de comentario, dejando el
archivo limpio y operativo (crear usuario en Auth, registrarlo en `usuarios` y, si es
Docente, en `docentes`). No quedan líneas comentadas de código.

> Nota: de haberse borrado el archivo (interpretación literal de "borrar lo comentado")
> se habría roto el alta de usuarios desde el panel.

---

## Mejora 4 — Inconsistencia de formatos

### Problema
`AdminPanel.tsx` mezclaba constantemente clases CSS (Tailwind) con estilos en línea
(`style={{...}}`), y repetía las mismas cadenas de clases enormes decenas de veces.
Un código limpio debe mantener una convención única.

### Solución
Se estableció **Tailwind mediante constantes con nombre** como estándar, centralizando
las cadenas repetidas en **`frontend/src/ui/styles.ts`** y creando componentes de
presentación reutilizables en **`frontend/src/ui/components.tsx`**.

Ejemplos de constantes creadas:

```ts
export const btnPrimary  = 'bg-gradient-to-br from-purple-700 ...'
export const inputField  = 'w-full px-[14px] py-[10px] rounded-input ...'
export const fieldLabel  = 'text-[11px] font-extrabold text-textMuted ...'
export const thCell      = 'text-left text-[10px] font-extrabold ...'
export const tdCell      = 'py-[11px] pr-3 text-[13px] border-b ...'
export const card        = 'bg-white rounded-card p-6 shadow-card ...'
export const badge = (color: string) => ({ /* estilo de chip */ })
```

En el código, `className="w-full px-[14px] ..."` pasó a `className={inputField}`, y las
variantes con clases extra usan template literals: `` className={`${card} mb-6`} ``.

### Resultado

| Cadena de clases | Repeticiones antes | Después |
|------------------|--------------------|---------|
| Botón primario | 45 | constante `btnPrimary` |
| Input | 86 | constante `inputField` |
| Etiqueta de campo | 98 | constante `fieldLabel` |
| Cabecera de tabla `<th>` | 112 | constante `thCell` |

---

## Mejora 5 — Mezcla de responsabilidades (GestionAlumnos)

### Problema
`GestionAlumnos` mezclaba en un mismo componente la **lógica de acceso a datos**
(consultas a Supabase) con la **interfaz visual**. Debía separarse.

### Solución
Se aplicó el patrón *custom hook* para aislar el acceso a datos:

- **`frontend/src/features/alumnos/useAlumnos.ts`** concentra toda la interacción con
  Supabase: cargar alumnos y cursos, crear un alumno (resolviendo el tutor por email) y
  cambiar el curso de un alumno.
- **`frontend/src/features/alumnos/GestionAlumnos.tsx`** quedó como componente de pura
  presentación: consume el hook y se ocupa solo del renderizado y del estado de UI.

```tsx
// GestionAlumnos.tsx (presentación)
const { alumnos, cursos, crearAlumno, cambiarCurso } = useAlumnos()
```

```ts
// useAlumnos.ts (acceso a datos)
export function useAlumnos() {
  const load = useCallback(async () => { /* consultas Supabase */ }, [])
  const crearAlumno = useCallback(async (form) => { /* insert */ }, [load])
  const cambiarCurso = useCallback(async (id, curso) => { /* update */ }, [load])
  return { alumnos, cursos, crearAlumno, cambiarCurso }
}
```

Este módulo queda como **patrón ejemplar** para replicar la separación en el resto de
las secciones.

---

## Verificación final

```bash
cd frontend
npx tsc --noEmit -p tsconfig.app.json   # exit 0, sin errores de tipos
npm run build                            # ✓ 101 modules transformed
```

Toda la lógica de negocio se preservó sin cambios; la refactorización fue estructural
(organización, reutilización y separación de responsabilidades).

## Integrantes

- Juan Manuel Cantero
- Iván Sánchez Oliva

*Grupo 12 — Metodología de Sistemas II, TUP, UTN Facultad Regional Resistencia.*


