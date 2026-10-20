# Pendientes

Requerimientos del TP1 (Historias de Usuario y Casos de Uso, Grupo 12) que
todavía no están implementados en la aplicación. Los que ya están hechos se
describen en el `README.md`.

## HU 2 — Inscripción a deportes con control de conflictos horarios
**Responsable:** Juan Manuel Cantero · **Prioridad:** alta

El módulo de actividades extracurriculares tiene control de cupo y no acepta
inscripciones duplicadas. Ya están hechos:

- Horario (día y franja horaria) y profesor responsable por cada deporte (T06 de la Parte 3).
- Máximo de 2 deportes simultáneos por alumno, con mensaje descriptivo al
  intentar un tercero.
- Rechazo de la inscripción cuando los horarios se superponen, indicando con
  qué deporte choca y en qué franja (`services/choqueHorarios.ts`). También se
  rechaza cambiar el horario de un deporte si deja a un inscripto con dos clases a
  la vez. Solo se comparan deportes entre sí: los idiomas no entran en el control.
- El reporte "Alumnos por deporte" muestra el profesor a cargo y los horarios, y
  filtra por deporte, nivel, día, hora de inicio y profesor ("Listado de alumnos por
  deporte, nivel, horario y profesor a cargo" de la consigna). La ficha individual
  del alumno muestra el profesor y los horarios de cada actividad.

HU 2 queda completa.

## HU 4 — Gestión de profesores
**Responsable:** Iván Sánchez · **Prioridad:** alta

Hecha. La pantalla *Docentes* del admin tiene:

- Alta y edición de profesores con legajo (`id_docente`), DNI, especialidad,
  título, fecha de ingreso, correo, teléfono y estado. El alta crea el usuario con
  rol Docente y una contraseña inicial; la baja también desactiva el usuario y, si
  tiene materias a cargo, pide confirmar.
- DNI único, con el mensaje "Ya existe un profesor registrado con ese DNI".
- Asignación de materias por curso desde la misma pantalla (botón *Materias*),
  avisando cuando la materia ya tiene profesor en ese curso y permitiendo
  reemplazarlo: los horarios pasan al nuevo profesor y las notas y la asistencia
  quedan con el anterior. También se puede quitar una materia. *Asignaciones* hace
  el mismo aviso.
- Reportes *Docentes por nivel* (nivel, profesor, materias a cargo y cursos) y
  *Ficha del docente* (datos, cursos a cargo por nivel, horarios de cada curso y
  actividades a cargo), en pantalla, PDF y CSV.

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

- **Documentos del legajo:** hecho. Ya no se sirven en `/uploads`: viven en la
  carpeta privada `documentos-alumnos` y se bajan con sesión por la API, con los
  mismos roles que ven el legajo (Admin, Directivo y Docente). La subida acepta solo
  fotos y PDF, por su contenido (un HTML subido podía ejecutarse en el dominio de la
  app). Una migración de datos dejó solo el nombre del archivo en los registros que
  apuntaban a esa carpeta; los enlaces a otros sitios (por ejemplo, de Supabase)
  quedan como estaban y se siguen abriendo con su enlace.
- **Historial de pagos:** la API acepta número de comprobante y observaciones,
  y la pantalla ya los carga, pero no hay forma de editar un pago registrado.
- **Vulnerabilidades reportadas por `npm audit`:** provienen del CLI de Prisma
  (`mysql2`, que no usamos, y `deepmerge-ts`). Se resuelven cuando Prisma
  actualice esas dependencias; bajar a Prisma 6 no es una opción razonable.
