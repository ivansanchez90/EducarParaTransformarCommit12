/**
 * Reportes para la Dirección: listados de alumnos por curso, materia, deporte
 * y recorrido de transporte, y la ficha individual del alumno.
 *
 * Cada reporte se sirve en tres formatos con el parámetro `?formato=`:
 * `json` (para mostrarlo en pantalla), `pdf` y `csv`.
 */
import { Router } from 'express'
import { HttpError, hora, id, numOrNull } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import type { Documento } from '../lib/documentos.js'
import { responderDocumento as responder } from '../lib/documentos.js'
import { ROLES_ADMIN, requireAuth, requireRole } from '../middleware/auth.js'
import { DIAS_SEMANA, franjaTexto, horariosTexto } from '../services/reportesCobranza.js'

export const reportesRouter = Router()
reportesRouter.use(requireAuth, requireRole(...ROLES_ADMIN))

type Curso = { nivel: string; grado_anio: string; division: string } | null

const nombreCurso = (c: Curso) => (c ? `${c.grado_anio}° ${c.division}` : 'Sin curso')
const nivelDe = (c: Curso) => c?.nivel ?? 'Sin nivel'
const nombreCompleto = (p: { apellido: string; nombre: string }) => `${p.apellido}, ${p.nombre}`
const horaTexto = (d: Date | null) => (d ? d.toISOString().slice(11, 16) : '—')
const fechaTexto = (d: Date) => d.toISOString().slice(0, 10).split('-').reverse().join('/')

const filtroNivel = (req: { query: Record<string, unknown> }) =>
  typeof req.query.nivel === 'string' && req.query.nivel ? req.query.nivel : undefined

/** Profesor y horarios de una actividad, para mostrarlos al lado del deporte. */
const profesorYHorarios = {
  horarios: { select: { dia_semana: true, hora_inicio: true, hora_fin: true } },
  docentes: { select: { usuarios: { select: { nombre: true, apellido: true } } } },
} as const

const profesorDe = (a: { docentes: { usuarios: { nombre: string; apellido: string } | null } | null }) =>
  a.docentes?.usuarios ? nombreCompleto(a.docentes.usuarios) : 'Sin asignar'

/** Opciones para armar los filtros en pantalla. */
reportesRouter.get('/opciones', async (_req, res) => {
  const [cursos, materias, actividades, recorridos, deportes, docentes] = await Promise.all([
    prisma.curso.findMany({
      where: { activo: true },
      select: { id_curso: true, nivel: true, grado_anio: true, division: true },
      orderBy: [{ nivel: 'asc' }, { grado_anio: 'asc' }, { division: 'asc' }],
    }),
    prisma.materia.findMany({ where: { activo: true }, select: { id_materia: true, nombre: true }, orderBy: { nombre: 'asc' } }),
    prisma.actividadExtracurricular.findMany({
      where: { activo: true },
      select: { id_actividad: true, nombre: true, tipo: true },
      orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
    }),
    prisma.recorridoTransporte.findMany({
      where: { activo: true },
      select: { id_recorrido: true, nombre: true, zona: true },
      orderBy: { nombre: 'asc' },
    }),
    // Profesores y horarios de los deportes, para los filtros de "Pagos de deportes" (T22).
    prisma.actividadExtracurricular.findMany({
      where: { tipo: 'Deporte' },
      select: {
        id_docente: true,
        docentes: { select: { usuarios: { select: { nombre: true, apellido: true } } } },
        horarios: { select: { dia_semana: true, hora_inicio: true } },
      },
    }),
    // Todos los docentes, para la ficha del docente.
    prisma.docente.findMany({
      select: { id_docente: true, activo: true, usuarios: { select: { nombre: true, apellido: true } } },
      orderBy: [{ usuarios: { apellido: 'asc' } }, { usuarios: { nombre: 'asc' } }],
    }),
  ])
  const profesores = new Map<number, string>()
  const horarios = new Map<string, { dia_semana: string; hora_inicio: string }>()
  for (const d of deportes) {
    if (d.id_docente && d.docentes?.usuarios) profesores.set(d.id_docente, nombreCompleto(d.docentes.usuarios))
    for (const h of d.horarios) {
      const hora = horaTexto(h.hora_inicio)
      horarios.set(`${h.dia_semana} ${hora}`, { dia_semana: h.dia_semana, hora_inicio: hora })
    }
  }
  res.json({
    niveles: [...new Set(cursos.map((c) => c.nivel))],
    cursos,
    materias,
    actividades,
    recorridos,
    profesores: [...profesores].map(([id_docente, nombre]) => ({ id_docente, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    horariosDeportes: [...horarios.values()].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio)),
    docentes: docentes.map((d) => ({
      id_docente: d.id_docente,
      nombre: d.usuarios ? nombreCompleto(d.usuarios) : `Docente ${d.id_docente}`,
      activo: d.activo,
    })),
  })
})

// ── Alumnos por curso ──────────────────────────────────────────

reportesRouter.get('/alumnos-por-curso', async (req, res) => {
  const nivel = filtroNivel(req)
  const idCurso = numOrNull(req.query.id_curso)
  const alumnos = await prisma.alumno.findMany({
    where: {
      activo: true,
      id_curso: idCurso ?? undefined,
      cursos: nivel ? { nivel } : undefined,
    },
    select: {
      id_alumno: true,
      nombre: true,
      apellido: true,
      dni: true,
      cursos: { select: { nivel: true, grado_anio: true, division: true } },
    },
    orderBy: [{ cursos: { nivel: 'asc' } }, { apellido: 'asc' }, { nombre: 'asc' }],
  })

  const curso = idCurso ? alumnos[0]?.cursos : null
  responder(res, {
    titulo: 'Listado de alumnos por curso',
    subtitulo: idCurso && curso ? `${curso.nivel} · ${nombreCurso(curso)}` : undefined,
    filtros: [`Nivel educativo: ${nivel ?? 'Todos'}`, `Curso: ${idCurso ? nombreCurso(curso ?? null) : 'Todos'}`],
    archivo: 'alumnos-por-curso',
    bloques: [
      {
        tipo: 'tabla',
        columnas: [
          { key: 'nivel', label: 'Nivel', ancho: 1.2 },
          { key: 'curso', label: 'Curso', ancho: 0.8 },
          { key: 'legajo', label: 'Legajo', ancho: 0.7 },
          { key: 'apellido', label: 'Apellido', ancho: 1.3 },
          { key: 'nombre', label: 'Nombre', ancho: 1.3 },
          { key: 'dni', label: 'DNI', ancho: 1 },
        ],
        filas: alumnos.map((a) => ({
          nivel: nivelDe(a.cursos),
          curso: nombreCurso(a.cursos),
          legajo: a.id_alumno,
          apellido: a.apellido,
          nombre: a.nombre,
          dni: a.dni,
        })),
      },
    ],
  }, req.query.formato)
})

// ── Alumnos por materia ────────────────────────────────────────

reportesRouter.get('/alumnos-por-materia', async (req, res) => {
  const nivel = filtroNivel(req)
  const idMateria = numOrNull(req.query.id_materia)
  const asignaciones = await prisma.asignacion.findMany({
    where: {
      activo: true,
      id_materia: idMateria ?? undefined,
      cursos: nivel ? { nivel } : undefined,
    },
    select: {
      materias: { select: { nombre: true } },
      docentes: { select: { usuarios: { select: { nombre: true, apellido: true } } } },
      cursos: {
        select: {
          nivel: true,
          grado_anio: true,
          division: true,
          alumnos: {
            where: { activo: true },
            select: { id_alumno: true, nombre: true, apellido: true },
            orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
          },
        },
      },
    },
    orderBy: [{ id_materia: 'asc' }, { id_curso: 'asc' }],
  })

  const filas = asignaciones.flatMap((a) =>
    a.cursos.alumnos.map((al) => ({
      nivel: a.cursos.nivel,
      curso: nombreCurso(a.cursos),
      materia: a.materias.nombre,
      profesor: a.docentes.usuarios ? nombreCompleto(a.docentes.usuarios) : 'Sin asignar',
      alumno: nombreCompleto(al),
      legajo: al.id_alumno,
    })),
  )

  responder(res, {
    titulo: 'Listado de alumnos por materia',
    filtros: [
      `Nivel educativo: ${nivel ?? 'Todos'}`,
      `Materia: ${idMateria ? (asignaciones[0]?.materias.nombre ?? '—') : 'Todas'}`,
    ],
    archivo: 'alumnos-por-materia',
    orientacion: 'landscape',
    bloques: [
      {
        tipo: 'tabla',
        columnas: [
          { key: 'nivel', label: 'Nivel', ancho: 1 },
          { key: 'curso', label: 'Curso', ancho: 0.7 },
          { key: 'materia', label: 'Materia', ancho: 1.3 },
          { key: 'profesor', label: 'Profesor a cargo', ancho: 1.5 },
          { key: 'alumno', label: 'Alumno', ancho: 1.7 },
          { key: 'legajo', label: 'Legajo', ancho: 0.6 },
        ],
        filas,
      },
    ],
  }, req.query.formato)
})

// ── Alumnos por deporte ────────────────────────────────────────

/**
 * Alumnos por deporte (Parte 2): filtra por deporte (`?id_actividad=`), nivel del alumno
 * (`?nivel=`), horario (`?dia=` y/o `?hora=` de inicio de una franja) y profesor a cargo
 * (`?id_docente=`). Con `?tipo=Idioma`, los talleres de idiomas.
 */
reportesRouter.get('/alumnos-por-deporte', async (req, res) => {
  const nivel = filtroNivel(req)
  const idActividad = numOrNull(req.query.id_actividad)
  const tipo = req.query.tipo === 'Idioma' ? 'Idioma' : 'Deporte'
  const dia = typeof req.query.dia === 'string' && req.query.dia ? req.query.dia : undefined
  if (dia && !DIAS_SEMANA.includes(dia)) throw new HttpError(400, `Día inválido: ${dia}`)
  const horaInicio = req.query.hora ? hora(req.query.hora) : undefined
  const idDocente = req.query.id_docente ? id(req.query.id_docente) : undefined

  const [inscripciones, docente] = await Promise.all([
    prisma.inscripcionActividad.findMany({
      where: {
        id_actividad: idActividad ?? undefined,
        actividades_extracurriculares: {
          tipo: idActividad ? undefined : tipo,
          id_docente: idDocente,
          horarios: dia || horaInicio ? { some: { dia_semana: dia, hora_inicio: horaInicio } } : undefined,
        },
        alumnos: { activo: true, cursos: nivel ? { nivel } : undefined },
      },
      select: {
        fecha_inscripcion: true,
        actividades_extracurriculares: { select: { nombre: true, tipo: true, ...profesorYHorarios } },
        alumnos: {
          select: {
            id_alumno: true,
            nombre: true,
            apellido: true,
            cursos: { select: { nivel: true, grado_anio: true, division: true } },
          },
        },
      },
      orderBy: [
        { actividades_extracurriculares: { nombre: 'asc' } },
        { alumnos: { apellido: 'asc' } },
        { alumnos: { nombre: 'asc' } },
      ],
    }),
    idDocente
      ? prisma.docente.findUnique({ where: { id_docente: idDocente }, select: { usuarios: { select: { nombre: true, apellido: true } } } })
      : null,
  ])

  const horarioPedido = [dia, horaInicio ? horaTexto(horaInicio) : undefined].filter(Boolean).join(' ')
  responder(res, {
    titulo: tipo === 'Idioma' ? 'Listado de alumnos por idioma' : 'Listado de alumnos por deporte',
    filtros: [
      `Nivel educativo: ${nivel ?? 'Todos'}`,
      `Actividad: ${idActividad ? (inscripciones[0]?.actividades_extracurriculares.nombre ?? '—') : `Todas (${tipo.toLowerCase()}s)`}`,
      `Horario: ${horarioPedido || 'Todos'}`,
      `Profesor: ${idDocente ? (docente?.usuarios ? nombreCompleto(docente.usuarios) : '—') : 'Todos'}`,
    ],
    archivo: 'alumnos-por-deporte',
    orientacion: 'landscape',
    bloques: [
      {
        tipo: 'tabla',
        columnas: [
          { key: 'actividad', label: 'Actividad', ancho: 1.1 },
          { key: 'profesor', label: 'Profesor a cargo', ancho: 1.3 },
          { key: 'horario', label: 'Horario', ancho: 2 },
          { key: 'alumno', label: 'Alumno', ancho: 1.6 },
          { key: 'legajo', label: 'Legajo', ancho: 0.6 },
          { key: 'curso', label: 'Curso', ancho: 0.7 },
          { key: 'nivel', label: 'Nivel', ancho: 1 },
        ],
        filas: inscripciones.map((i) => ({
          actividad: i.actividades_extracurriculares.nombre,
          profesor: profesorDe(i.actividades_extracurriculares),
          horario: horariosTexto(i.actividades_extracurriculares.horarios),
          alumno: nombreCompleto(i.alumnos),
          legajo: i.alumnos.id_alumno,
          curso: nombreCurso(i.alumnos.cursos),
          nivel: nivelDe(i.alumnos.cursos),
        })),
      },
    ],
  }, req.query.formato)
})

// ── Docentes por nivel educativo ──────────────────────────────

/** Niveles en el orden de la escuela; uno que no esté en la lista va al final. */
const ORDEN_NIVEL = ['Inicial', 'Primario', 'Secundario']

/** "1° A, 2° A y 3° A" en el orden de la escuela. */
const unir = (items: string[]) => (items.length <= 1 ? (items[0] ?? '—') : `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`)
const ordenCurso = (a: { grado_anio: string; division: string }, b: { grado_anio: string; division: string }) =>
  a.grado_anio.localeCompare(b.grado_anio, 'es', { numeric: true }) || a.division.localeCompare(b.division, 'es')

/**
 * Listado de docentes por nivel educativo (Parte 2): nivel, profesor, materias a cargo y
 * cursos, a partir de las asignaciones activas. Un docente que da clases en dos niveles
 * aparece en los dos. Filtro opcional `?nivel=`.
 */
reportesRouter.get('/docentes-por-nivel', async (req, res) => {
  const nivel = filtroNivel(req)
  const asignaciones = await prisma.asignacion.findMany({
    where: { activo: true, docentes: { activo: true }, cursos: nivel ? { nivel } : undefined },
    select: {
      id_docente: true,
      docentes: { select: { usuarios: { select: { nombre: true, apellido: true } } } },
      materias: { select: { nombre: true } },
      cursos: { select: { nivel: true, grado_anio: true, division: true } },
    },
  })

  const grupos = new Map<string, { nivel: string; profesor: string; legajo: number; materias: Set<string>; cursos: Map<string, { nivel: string; grado_anio: string; division: string }> }>()
  for (const a of asignaciones) {
    const clave = `${a.cursos.nivel}|${a.id_docente}`
    const grupo = grupos.get(clave) ?? {
      nivel: a.cursos.nivel,
      profesor: a.docentes.usuarios ? nombreCompleto(a.docentes.usuarios) : `Docente ${a.id_docente}`,
      legajo: a.id_docente,
      materias: new Set<string>(),
      cursos: new Map(),
    }
    grupo.materias.add(a.materias.nombre)
    grupo.cursos.set(nombreCurso(a.cursos), a.cursos)
    grupos.set(clave, grupo)
  }
  const filas = [...grupos.values()]
    .sort(
      (a, b) =>
        (ORDEN_NIVEL.indexOf(a.nivel) + 1 || 99) - (ORDEN_NIVEL.indexOf(b.nivel) + 1 || 99) ||
        a.nivel.localeCompare(b.nivel, 'es') ||
        a.profesor.localeCompare(b.profesor, 'es'),
    )
    .map((g) => ({
      nivel: g.nivel,
      profesor: g.profesor,
      legajo: g.legajo,
      materias: unir([...g.materias].sort((a, b) => a.localeCompare(b, 'es'))),
      cursos: unir([...g.cursos.values()].sort(ordenCurso).map((c) => nombreCurso(c))),
    }))

  responder(res, {
    titulo: 'Listado de docentes por nivel educativo',
    filtros: [`Nivel educativo: ${nivel ?? 'Todos'}`],
    archivo: 'docentes-por-nivel',
    orientacion: 'landscape',
    bloques: [
      {
        tipo: 'tabla',
        columnas: [
          { key: 'nivel', label: 'Nivel', ancho: 0.9 },
          { key: 'profesor', label: 'Profesor', ancho: 1.5 },
          { key: 'legajo', label: 'Legajo', ancho: 0.6 },
          { key: 'materias', label: 'Materias a cargo', ancho: 2.4 },
          { key: 'cursos', label: 'Cursos', ancho: 1.6 },
        ],
        filas,
      },
    ],
  }, req.query.formato)
})

// ── Alumnos por recorrido de transporte ────────────────────────

reportesRouter.get('/alumnos-por-transporte', async (req, res) => {
  const nivel = filtroNivel(req)
  const idRecorrido = numOrNull(req.query.id_recorrido)
  const inscripciones = await prisma.inscripcionTransporte.findMany({
    where: {
      id_recorrido: idRecorrido ?? undefined,
      alumnos: { activo: true, cursos: nivel ? { nivel } : undefined },
    },
    select: {
      recorridos_transporte: { select: { nombre: true, zona: true, hora_ida: true, hora_vuelta: true } },
      alumnos: {
        select: {
          id_alumno: true,
          nombre: true,
          apellido: true,
          cursos: { select: { nivel: true, grado_anio: true, division: true } },
        },
      },
    },
    orderBy: [{ id_recorrido: 'asc' }, { id_alumno: 'asc' }],
  })

  responder(res, {
    titulo: 'Listado de alumnos por recorrido de transporte',
    filtros: [
      `Nivel educativo: ${nivel ?? 'Todos'}`,
      `Recorrido: ${idRecorrido ? (inscripciones[0]?.recorridos_transporte.nombre ?? '—') : 'Todos'}`,
    ],
    archivo: 'alumnos-por-transporte',
    bloques: [
      {
        tipo: 'tabla',
        columnas: [
          { key: 'recorrido', label: 'Recorrido', ancho: 1.3 },
          { key: 'zona', label: 'Zona', ancho: 1.1 },
          { key: 'horario', label: 'Ida / Vuelta', ancho: 1 },
          { key: 'alumno', label: 'Alumno', ancho: 1.7 },
          { key: 'legajo', label: 'Legajo', ancho: 0.6 },
          { key: 'curso', label: 'Curso', ancho: 0.7 },
          { key: 'nivel', label: 'Nivel', ancho: 1 },
        ],
        filas: inscripciones.map((i) => ({
          recorrido: i.recorridos_transporte.nombre,
          zona: i.recorridos_transporte.zona,
          horario: `${horaTexto(i.recorridos_transporte.hora_ida)} / ${horaTexto(i.recorridos_transporte.hora_vuelta)}`,
          alumno: nombreCompleto(i.alumnos),
          legajo: i.alumnos.id_alumno,
          curso: nombreCurso(i.alumnos.cursos),
          nivel: nivelDe(i.alumnos.cursos),
        })),
      },
    ],
  }, req.query.formato)
})

// ── Ficha individual del alumno ────────────────────────────────

reportesRouter.get('/alumno/:id', async (req, res) => {
  const idAlumno = id(req.params.id)
  const alumno = await prisma.alumno.findUnique({
    where: { id_alumno: idAlumno },
    select: {
      id_alumno: true,
      nombre: true,
      apellido: true,
      dni: true,
      fecha_nacimiento: true,
      activo: true,
      obra_social: true,
      cursos: { select: { id_curso: true, nivel: true, grado_anio: true, division: true } },
      padre: { select: { nombre: true, apellido: true, email: true } },
      inscripciones_actividades: {
        select: { actividades_extracurriculares: { select: { nombre: true, tipo: true, ...profesorYHorarios } } },
        orderBy: { id_actividad: 'asc' },
      },
      transporte: { select: { observaciones: true, recorridos_transporte: true } },
      comedor: { select: { observaciones: true, fecha_inscripcion: true } },
    },
  })
  if (!alumno) throw new HttpError(404, 'Alumno no encontrado')

  const asignaciones = alumno.cursos
    ? await prisma.asignacion.findMany({
        where: { id_curso: alumno.cursos.id_curso, activo: true },
        select: {
          materias: { select: { nombre: true, horas_semanales: true } },
          docentes: { select: { especialidad: true, usuarios: { select: { nombre: true, apellido: true, email: true } } } },
        },
        orderBy: { id_materia: 'asc' },
      })
    : []

  const transporte = alumno.transporte?.recorridos_transporte

  responder(res, {
    titulo: 'Ficha del alumno',
    subtitulo: `${nombreCompleto(alumno)} · Legajo ${alumno.id_alumno}`,
    filtros: [],
    archivo: `ficha-alumno-${alumno.id_alumno}`,
    bloques: [
      {
        tipo: 'datos',
        titulo: 'Datos personales',
        items: [
          ['Apellido y nombre', nombreCompleto(alumno)],
          ['Legajo', String(alumno.id_alumno)],
          ['DNI', alumno.dni],
          ['Fecha de nacimiento', fechaTexto(alumno.fecha_nacimiento)],
          ['Nivel educativo', nivelDe(alumno.cursos)],
          ['Curso', nombreCurso(alumno.cursos)],
          ['Obra social', alumno.obra_social ?? '—'],
          ['Estado', alumno.activo ? 'Activo' : 'Inactivo'],
          ['Padre/tutor', alumno.padre ? nombreCompleto(alumno.padre) : '—'],
          ['Contacto del tutor', alumno.padre?.email ?? '—'],
        ],
      },
      {
        tipo: 'tabla',
        titulo: 'Materias y profesores',
        columnas: [
          { key: 'materia', label: 'Materia', ancho: 1.4 },
          { key: 'horas', label: 'Horas sem.', ancho: 0.7 },
          { key: 'profesor', label: 'Profesor a cargo', ancho: 1.5 },
          { key: 'especialidad', label: 'Especialidad', ancho: 1.2 },
        ],
        filas: asignaciones.map((a) => ({
          materia: a.materias.nombre,
          horas: a.materias.horas_semanales,
          profesor: a.docentes.usuarios ? nombreCompleto(a.docentes.usuarios) : 'Sin asignar',
          especialidad: a.docentes.especialidad,
        })),
      },
      {
        tipo: 'tabla',
        titulo: 'Actividades extracurriculares',
        columnas: [
          { key: 'actividad', label: 'Actividad', ancho: 1.2 },
          { key: 'tipo', label: 'Tipo', ancho: 0.7 },
          { key: 'profesor', label: 'Profesor a cargo', ancho: 1.3 },
          { key: 'horario', label: 'Horario', ancho: 2 },
        ],
        filas: alumno.inscripciones_actividades.map((i) => ({
          actividad: i.actividades_extracurriculares.nombre,
          tipo: i.actividades_extracurriculares.tipo,
          profesor: profesorDe(i.actividades_extracurriculares),
          horario: horariosTexto(i.actividades_extracurriculares.horarios),
        })),
      },
      {
        tipo: 'datos',
        titulo: 'Servicios complementarios',
        items: [
          ['Transporte', transporte ? transporte.nombre : 'No utiliza'],
          ['Zona / paradas', transporte ? (transporte.zona ?? '—') : '—'],
          ['Horario de transporte', transporte ? `${horaTexto(transporte.hora_ida)} / ${horaTexto(transporte.hora_vuelta)}` : '—'],
          ['Comedor', alumno.comedor ? 'Utiliza el servicio' : 'No utiliza'],
          ['Observaciones transporte', alumno.transporte?.observaciones ?? '—'],
          ['Observaciones comedor', alumno.comedor?.observaciones ?? '—'],
        ],
      },
    ],
  }, req.query.formato)
})

// ── Ficha del docente ─────────────────────────────────────────

/**
 * Reporte por docente (Parte 2): sus datos, los cursos a cargo por nivel y los horarios
 * de cada curso, más los deportes de los que es responsable.
 */
reportesRouter.get('/docente/:id', async (req, res) => {
  const idDocente = id(req.params.id)
  const docente = await prisma.docente.findUnique({
    where: { id_docente: idDocente },
    select: {
      id_docente: true,
      dni: true,
      especialidad: true,
      titulo: true,
      fecha_ingreso: true,
      activo: true,
      usuarios: { select: { nombre: true, apellido: true, email: true, telefono: true } },
      asignaciones: {
        where: { activo: true },
        select: {
          materias: { select: { nombre: true } },
          cursos: { select: { nivel: true, grado_anio: true, division: true } },
          horarios: { select: { dia_semana: true, hora_inicio: true, hora_fin: true, aula: true } },
        },
      },
      actividades: { where: { activo: true }, select: { nombre: true, tipo: true, ...profesorYHorarios }, orderBy: { nombre: 'asc' } },
    },
  })
  if (!docente) throw new HttpError(404, 'Docente no encontrado')

  const nombre = docente.usuarios ? nombreCompleto(docente.usuarios) : `Docente ${docente.id_docente}`
  const porNivel = (a: { nivel: string }, b: { nivel: string }) =>
    (ORDEN_NIVEL.indexOf(a.nivel) + 1 || 99) - (ORDEN_NIVEL.indexOf(b.nivel) + 1 || 99)
  const cursos = [...docente.asignaciones].sort(
    (a, b) => porNivel(a.cursos, b.cursos) || ordenCurso(a.cursos, b.cursos) || a.materias.nombre.localeCompare(b.materias.nombre, 'es'),
  )
  const clases = docente.asignaciones
    .flatMap((a) => a.horarios.map((h) => ({ ...h, curso: a.cursos, materia: a.materias.nombre })))
    .sort(
      (a, b) =>
        DIAS_SEMANA.indexOf(a.dia_semana) - DIAS_SEMANA.indexOf(b.dia_semana) ||
        a.hora_inicio.getTime() - b.hora_inicio.getTime(),
    )

  responder(res, {
    titulo: 'Ficha del docente',
    subtitulo: `${nombre} · Legajo ${docente.id_docente}`,
    filtros: [],
    archivo: `ficha-docente-${docente.id_docente}`,
    bloques: [
      {
        tipo: 'datos',
        titulo: 'Datos del docente',
        items: [
          ['Apellido y nombre', nombre],
          ['Legajo', String(docente.id_docente)],
          ['DNI', docente.dni ?? '—'],
          ['Especialidad', docente.especialidad ?? '—'],
          ['Título', docente.titulo ?? '—'],
          ['Correo', docente.usuarios?.email ?? '—'],
          ['Teléfono', docente.usuarios?.telefono ?? '—'],
          ['Fecha de ingreso', docente.fecha_ingreso ? fechaTexto(docente.fecha_ingreso) : '—'],
          ['Estado', docente.activo ? 'Activo' : 'Inactivo'],
        ],
      },
      {
        tipo: 'tabla',
        titulo: 'Cursos a cargo por nivel',
        columnas: [
          { key: 'nivel', label: 'Nivel', ancho: 1 },
          { key: 'curso', label: 'Curso', ancho: 0.7 },
          { key: 'materia', label: 'Materia', ancho: 1.8 },
        ],
        filas: cursos.map((a) => ({ nivel: nivelDe(a.cursos), curso: nombreCurso(a.cursos), materia: a.materias.nombre })),
      },
      {
        tipo: 'tabla',
        titulo: 'Horarios de cada curso',
        columnas: [
          { key: 'horario', label: 'Día y horario', ancho: 1.6 },
          { key: 'curso', label: 'Curso', ancho: 1.2 },
          { key: 'materia', label: 'Materia', ancho: 1.6 },
          { key: 'aula', label: 'Aula', ancho: 0.7 },
        ],
        filas: clases.map((c) => ({
          horario: franjaTexto(c),
          curso: `${nombreCurso(c.curso)} (${nivelDe(c.curso)})`,
          materia: c.materia,
          aula: c.aula ?? '—',
        })),
      },
      {
        tipo: 'tabla',
        titulo: 'Actividades extracurriculares a cargo',
        columnas: [
          { key: 'actividad', label: 'Actividad', ancho: 1.2 },
          { key: 'tipo', label: 'Tipo', ancho: 0.7 },
          { key: 'horario', label: 'Horario', ancho: 2 },
        ],
        filas: docente.actividades.map((a) => ({ actividad: a.nombre, tipo: a.tipo, horario: horariosTexto(a.horarios) })),
      },
    ],
  }, req.query.formato)
})
