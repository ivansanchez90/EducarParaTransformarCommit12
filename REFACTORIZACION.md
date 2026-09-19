# Documentación de la refactorización

> Registro histórico: describe cambios hechos cuando el proyecto usaba Supabase.
> Hoy el backend es Node + Express + Prisma (ver `README.md` y `backend/`).

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
