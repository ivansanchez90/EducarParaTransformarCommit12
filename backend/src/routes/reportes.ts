/**
 * Reportes para la Dirección: listados de alumnos por curso, materia, deporte
 * y recorrido de transporte, y la ficha individual del alumno.
 *
 * Cada reporte se sirve en tres formatos con el parámetro `?formato=`:
 * `json` (para mostrarlo en pantalla), `pdf` y `csv`.
 */
import { Router } from 'express'
import type { Response } from 'express'
import { HttpError, hoyISO, id, numOrNull } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import type { Documento } from '../lib/documentos.js'
import { documentoCsv, documentoPdf } from '../lib/documentos.js'
import { ROLES_ADMIN, requireAuth, requireRole } from '../middleware/auth.js'

export const reportesRouter = Router()
reportesRouter.use(requireAuth, requireRole(...ROLES_ADMIN))

type Curso = { nivel: string; grado_anio: string; division: string } | null

const nombreCurso = (c: Curso) => (c ? `${c.grado_anio}° ${c.division}` : 'Sin curso')
const nivelDe = (c: Curso) => c?.nivel ?? 'Sin nivel'
const nombreCompleto = (p: { apellido: string; nombre: string }) => `${p.apellido}, ${p.nombre}`
const horaTexto = (d: Date | null) => (d ? d.toISOString().slice(11, 16) : '—')
const fechaTexto = (d: Date) => d.toISOString().slice(0, 10).split('-').reverse().join('/')

/** Envía el reporte en el formato pedido. */
function responder(res: Response, doc: Documento, formato: unknown) {
  const archivo = `${doc.archivo}-${hoyISO()}`
  if (formato === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${archivo}.pdf"`)
    documentoPdf(doc).pipe(res)
    return
  }
  if (formato === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${archivo}.csv"`)
    res.send(documentoCsv(doc))
    return
  }
  res.json(doc)
}

const filtroNivel = (req: { query: Record<string, unknown> }) =>
  typeof req.query.nivel === 'string' && req.query.nivel ? req.query.nivel : undefined

/** Opciones para armar los filtros en pantalla. */
reportesRouter.get('/opciones', async (_req, res) => {
  const [cursos, materias, actividades, recorridos] = await Promise.all([
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
  ])
  res.json({ niveles: [...new Set(cursos.map((c) => c.nivel))], cursos, materias, actividades, recorridos })
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

reportesRouter.get('/alumnos-por-deporte', async (req, res) => {
  const nivel = filtroNivel(req)
  const idActividad = numOrNull(req.query.id_actividad)
  const tipo = req.query.tipo === 'Idioma' ? 'Idioma' : 'Deporte'

  const inscripciones = await prisma.inscripcionActividad.findMany({
    where: {
      id_actividad: idActividad ?? undefined,
      actividades_extracurriculares: idActividad ? undefined : { tipo },
      alumnos: { activo: true, cursos: nivel ? { nivel } : undefined },
    },
    select: {
      fecha_inscripcion: true,
      actividades_extracurriculares: { select: { nombre: true, tipo: true } },
      alumnos: {
        select: {
          id_alumno: true,
          nombre: true,
          apellido: true,
          cursos: { select: { nivel: true, grado_anio: true, division: true } },
        },
      },
    },
    orderBy: [{ id_actividad: 'asc' }, { id_alumno: 'asc' }],
  })

  responder(res, {
    titulo: tipo === 'Idioma' ? 'Listado de alumnos por idioma' : 'Listado de alumnos por deporte',
    filtros: [
      `Nivel educativo: ${nivel ?? 'Todos'}`,
      `Actividad: ${idActividad ? (inscripciones[0]?.actividades_extracurriculares.nombre ?? '—') : `Todas (${tipo.toLowerCase()}s)`}`,
    ],
    archivo: 'alumnos-por-deporte',
    bloques: [
      {
        tipo: 'tabla',
        columnas: [
          { key: 'actividad', label: 'Actividad', ancho: 1.3 },
          { key: 'alumno', label: 'Alumno', ancho: 1.8 },
          { key: 'legajo', label: 'Legajo', ancho: 0.7 },
          { key: 'curso', label: 'Curso', ancho: 0.8 },
          { key: 'nivel', label: 'Nivel', ancho: 1.2 },
        ],
        filas: inscripciones.map((i) => ({
          actividad: i.actividades_extracurriculares.nombre,
          alumno: nombreCompleto(i.alumnos),
          legajo: i.alumnos.id_alumno,
          curso: nombreCurso(i.alumnos.cursos),
          nivel: nivelDe(i.alumnos.cursos),
        })),
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
        select: { actividades_extracurriculares: { select: { nombre: true, tipo: true } } },
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
          { key: 'actividad', label: 'Actividad', ancho: 2 },
          { key: 'tipo', label: 'Tipo', ancho: 1 },
        ],
        filas: alumno.inscripciones_actividades.map((i) => ({
          actividad: i.actividades_extracurriculares.nombre,
          tipo: i.actividades_extracurriculares.tipo,
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
