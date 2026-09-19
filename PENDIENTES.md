# Pendientes

Requerimientos del TP1 (Historias de Usuario y Casos de Uso, Grupo 12) que
todavía no están implementados en la aplicación. Los que ya están hechos se
describen en el `README.md`.

## HU 2 — Inscripción a deportes con control de conflictos horarios
**Responsable:** Juan Manuel Cantero · **Prioridad:** alta

Hoy existe el módulo de actividades extracurriculares con control de cupo y
sin inscripciones duplicadas, pero falta:

- Horario (día y franja horaria) y profesor responsable por cada deporte.
- Máximo de 2 deportes simultáneos por alumno, con mensaje descriptivo al
  intentar un tercero.
- Rechazo de la inscripción cuando los horarios se superponen, indicando con
  qué deporte choca y en qué franja.
- El reporte "alumnos por deporte" debería mostrar también esos horarios, y la
  ficha individual del alumno, sus horarios deportivos.

## HU 4 — Gestión de profesores
**Responsable:** Iván Sánchez · **Prioridad:** alta

El módulo de docentes es hoy solo de lectura. Falta:

- Alta y edición de profesores con legajo, DNI, especialidad, título, correo,
  teléfono y estado (las columnas ya existen en la tabla `docentes`).
- DNI único, con el mensaje "Ya existe un profesor registrado con ese DNI".
- Asignación de materias por curso y nivel desde la misma pantalla, avisando
  cuando la materia ya tiene profesor en ese curso y permitiendo reemplazarlo.
- Listado de docentes por nivel educativo con sus materias y cursos.

## Desafío — Módulo de Salud y Enfermería
**Prioridad:** media

Funcionalidad propuesta como desafío, no contemplada en el enunciado original:

- Ficha médica única por alumno y registro de cada atención de enfermería.
- Notificación automática a los tutores ante cada atención registrada.
- Certificado de aptitud física con vencimiento anual, obligatorio para
  inscribirse a un deporte.
- Acceso por rol: enfermería y administración ven la ficha completa, las
  familias solo la de sus hijos, y los docentes una ficha resumida (alergias
  críticas, aptitud física y contacto de emergencia).
- Auditoría de cada modificación con usuario, fecha y hora.

## Mejoras técnicas detectadas

- **Cambio de contraseña:** la aplicación no permite cambiarla, ni al propio
  usuario ni al administrador. Los alumnos creados desde el panel quedan con
  su DNI como contraseña.
- **Documentos del legajo:** se sirven de forma pública para quien tenga el
  enlace, igual que hacía el bucket de Supabase. Convendría exigir sesión.
- **Historial de pagos:** la API acepta número de comprobante y observaciones,
  y la pantalla ya los carga, pero no hay forma de editar un pago registrado.
- **Datos de contacto del alumno:** dirección, teléfono y contacto de
  emergencia, y número de obra social se guardan en la base y la API los
  acepta, pero no hay campos para cargarlos en el frontend.
- **Vulnerabilidades reportadas por `npm audit`:** provienen del CLI de Prisma
  (`mysql2`, que no usamos, y `deepmerge-ts`). Se resuelven cuando Prisma
  actualice esas dependencias; bajar a Prisma 6 no es una opción razonable.
