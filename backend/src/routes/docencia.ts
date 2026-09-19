/**
 * Tareas del docente: calificaciones, asistencia y amonestaciones.
 * Cada acción genera las notificaciones correspondientes a las familias.
 */
import { Router } from 'express'
import { HttpError, fecha, id, numOrNull, textOrNull } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { materiaNombre, nombreApellido } from '../lib/selects.js'
import { ROLES_STAFF, idDocenteDe, requireAuth, requireRole } from '../middleware/auth.js'
import { notificarFamilias } from '../services/notificaciones.js'

// ── Calificaciones ─────────────────────────────────────────────

export const calificacionesRouter = Router()
calificacionesRouter.use(requireAuth, requireRole(...ROLES_STAFF))

calificacionesRouter.get('/', async (req, res) => {
  const idAsignacion = numOrNull(req.query.id_asignacion)
  if (!idAsignacion) throw new HttpError(400, 'Falta id_asignacion')
  const calificaciones = await prisma.calificacion.findMany({
    where: { id_asignacion: idAsignacion },
    include: { alumnos: nombreApellido, asignaciones: { select: { materias: materiaNombre } } },
    orderBy: [{ fecha_carga: 'desc' }, { created_at: 'desc' }],
  })
  res.json(calificaciones)
})

calificacionesRouter.post('/', async (req, res) => {
  const body = req.body ?? {}
  const nota = Number(body.nota)
  if (Number.isNaN(nota) || nota < 0 || nota > 10) throw new HttpError(400, 'La nota debe estar entre 0 y 10')
  const periodo = await prisma.periodoAcademico.findFirst({ where: { activo: true }, select: { id_periodo: true } })

  const calificacion = await prisma.calificacion.create({
    data: {
      id_alumno: id(body.id_alumno),
      id_asignacion: id(body.id_asignacion),
      id_periodo: periodo?.id_periodo ?? null,
      trimestre: Number(body.trimestre),
      tipo_evaluacion: textOrNull(body.tipo_evaluacion),
      nota,
      descripcion: textOrNull(body.descripcion),
    },
    include: { asignaciones: { select: { materias: materiaNombre } } },
  })

  const materia = calificacion.asignaciones.materias.nombre
  await notificarFamilias(
    [
      {
        id_alumno: calificacion.id_alumno,
        titulo: 'Nueva calificación publicada',
        mensaje: `Se publicó una nota de ${materia}: ${nota} (${[calificacion.tipo_evaluacion, `${calificacion.trimestre}° trimestre`].filter(Boolean).join(', ')}).`,
      },
    ],
    'Calificación',
  )
  res.status(201).json(calificacion)
})

// ── Asistencias ────────────────────────────────────────────────

export const asistenciasRouter = Router()
asistenciasRouter.use(requireAuth, requireRole(...ROLES_STAFF))

const ESTADOS_ASISTENCIA = ['Presente', 'Ausente', 'Tarde', 'Justificado']

/**
 * Guarda la asistencia de un curso en una fecha (upsert por alumno/asignación/fecha).
 * Body: { id_asignacion, fecha, registros: [{ id_alumno, estado }] }
 */
asistenciasRouter.post('/', async (req, res) => {
  const body = req.body ?? {}
  const idAsignacion = id(body.id_asignacion)
  const dia = fecha(body.fecha)
  if (!dia) throw new HttpError(400, 'Falta la fecha')
  const registros: { id_alumno: number; estado: string }[] = Array.isArray(body.registros) ? body.registros : []
  if (registros.some((r) => !ESTADOS_ASISTENCIA.includes(r.estado))) {
    throw new HttpError(400, 'Estado de asistencia inválido')
  }

  await prisma.$transaction(
    registros.map((r) =>
      prisma.asistencia.upsert({
        where: {
          id_alumno_id_asignacion_fecha: { id_alumno: id(r.id_alumno), id_asignacion: idAsignacion, fecha: dia },
        },
        create: {
          id_alumno: id(r.id_alumno),
          id_asignacion: idAsignacion,
          fecha: dia,
          estado: r.estado,
          registrado_por: req.user!.id_usuario,
        },
        update: { estado: r.estado, registrado_por: req.user!.id_usuario },
      }),
    ),
  )

  // Notificación automática por inasistencia
  const idsAusentes = registros.filter((r) => r.estado === 'Ausente').map((r) => id(r.id_alumno))
  const ausentes = await prisma.alumno.findMany({
    where: { id_alumno: { in: idsAusentes } },
    select: { id_alumno: true, nombre: true, apellido: true },
  })
  const fechaTexto = dia.toLocaleDateString('es-AR', { timeZone: 'UTC' })
  const notificados = await notificarFamilias(
    ausentes.map((a) => ({
      id_alumno: a.id_alumno,
      titulo: 'Inasistencia registrada',
      mensaje: `${a.nombre} ${a.apellido} fue registrado/a como ausente el ${fechaTexto}.`,
    })),
    'Asistencia',
  )
  res.json({ guardados: registros.length, ausentes: ausentes.length, notificados })
})

// ── Amonestaciones ─────────────────────────────────────────────

export const amonestacionesRouter = Router()
amonestacionesRouter.use(requireAuth, requireRole(...ROLES_STAFF))

/** Amonestaciones registradas por el docente logueado. */
amonestacionesRouter.get('/mias', async (req, res) => {
  const idDocente = await idDocenteDe(req.user!)
  const amonestaciones = await prisma.amonestacion.findMany({
    where: { id_docente: idDocente },
    include: { alumnos: nombreApellido },
    orderBy: [{ fecha: 'desc' }, { id_amonestacion: 'desc' }],
  })
  res.json(amonestaciones)
})

amonestacionesRouter.post('/', async (req, res) => {
  const body = req.body ?? {}
  if (!textOrNull(body.descripcion)) throw new HttpError(400, 'La descripción es obligatoria')
  const amonestacion = await prisma.amonestacion.create({
    data: {
      id_alumno: id(body.id_alumno),
      id_docente: await idDocenteDe(req.user!),
      tipo: String(body.tipo ?? 'Leve'),
      descripcion: String(body.descripcion),
    },
  })
  res.status(201).json(amonestacion)
})
