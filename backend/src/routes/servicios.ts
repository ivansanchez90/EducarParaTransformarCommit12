/**
 * Servicios complementarios: transporte escolar y comedor.
 *
 * El personal administrativo gestiona los recorridos e inscribe a cualquier
 * alumno; el padre/tutor inscribe únicamente a sus hijos desde el portal.
 * Un alumno viaja en un solo recorrido: volver a inscribirlo lo cambia.
 */
import { Router } from 'express'
import type { Request } from 'express'
import { HttpError, bool, hora, id, numOrNull, textOrNull } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { cursoResumen } from '../lib/selects.js'
import {
  ROLES_ADMIN,
  ROLES_STAFF,
  assertAccesoAlumno,
  esStaff,
  requireAuth,
  requireRole,
} from '../middleware/auth.js'

// ── Recorridos de transporte ───────────────────────────────────

export const recorridosRouter = Router()
recorridosRouter.use(requireAuth)

/** Recorridos con la cantidad de alumnos inscriptos en cada uno. */
recorridosRouter.get('/', async (req, res) => {
  // Alumnos y familias solo ven los recorridos activos.
  const activo = esStaff(req.user!) ? bool(req.query.activo) : true
  const recorridos = await prisma.recorridoTransporte.findMany({
    where: { activo },
    include: { _count: { select: { inscripciones_transporte: true } } },
    orderBy: { nombre: 'asc' },
  })
  res.json(
    recorridos.map(({ _count, ...r }) => ({ ...r, inscriptos: _count.inscripciones_transporte })),
  )
})

function datosRecorrido(body: Record<string, unknown>) {
  const nombre = textOrNull(body.nombre)
  if (!nombre) throw new HttpError(400, 'El nombre del recorrido es obligatorio')
  const capacidad = numOrNull(body.capacidad)
  if (capacidad !== null && capacidad <= 0) throw new HttpError(400, 'La capacidad debe ser mayor a 0')
  return {
    nombre,
    zona: textOrNull(body.zona),
    paradas: textOrNull(body.paradas),
    hora_ida: body.hora_ida ? hora(body.hora_ida) : null,
    hora_vuelta: body.hora_vuelta ? hora(body.hora_vuelta) : null,
    capacidad,
  }
}

recorridosRouter.post('/', requireRole(...ROLES_ADMIN), async (req, res) => {
  const recorrido = await prisma.recorridoTransporte.create({ data: datosRecorrido(req.body ?? {}) })
  res.status(201).json(recorrido)
})

recorridosRouter.put('/:id', requireRole(...ROLES_ADMIN), async (req, res) => {
  const recorrido = await prisma.recorridoTransporte.update({
    where: { id_recorrido: id(req.params.id) },
    data: datosRecorrido(req.body ?? {}),
  })
  res.json(recorrido)
})

recorridosRouter.patch('/:id', requireRole(...ROLES_ADMIN), async (req, res) => {
  const recorrido = await prisma.recorridoTransporte.update({
    where: { id_recorrido: id(req.params.id) },
    data: { activo: typeof req.body?.activo === 'boolean' ? req.body.activo : undefined },
  })
  res.json(recorrido)
})

recorridosRouter.delete('/:id', requireRole(...ROLES_ADMIN), async (req, res) => {
  const idRecorrido = id(req.params.id)
  const inscriptos = await prisma.inscripcionTransporte.count({ where: { id_recorrido: idRecorrido } })
  if (inscriptos > 0) {
    throw new HttpError(409, `El recorrido tiene ${inscriptos} alumno(s) inscripto(s): desactivalo en lugar de eliminarlo`)
  }
  await prisma.recorridoTransporte.delete({ where: { id_recorrido: idRecorrido } })
  res.status(204).end()
})

// ── Servicios de cada alumno ───────────────────────────────────

export const serviciosRouter = Router()
serviciosRouter.use(requireAuth)

/** El personal gestiona cualquier alumno; la familia, solo los propios. */
async function assertPuedeGestionar(req: Request, idAlumno: number) {
  if (esStaff(req.user!)) return
  await assertAccesoAlumno(req.user!, idAlumno)
}

const recorridoResumen = {
  select: { id_recorrido: true, nombre: true, zona: true, hora_ida: true, hora_vuelta: true },
} as const

/** Listado de alumnos con sus servicios. Filtros: ?id_recorrido=, ?comedor=true, ?nivel= */
serviciosRouter.get('/', requireRole(...ROLES_STAFF), async (req, res) => {
  const idRecorrido = numOrNull(req.query.id_recorrido)
  const comedor = bool(req.query.comedor)
  const nivel = typeof req.query.nivel === 'string' && req.query.nivel ? req.query.nivel : undefined

  const alumnos = await prisma.alumno.findMany({
    where: {
      activo: true,
      cursos: nivel ? { nivel } : undefined,
      transporte: idRecorrido ? { id_recorrido: idRecorrido } : undefined,
      comedor: comedor === true ? { isNot: null } : comedor === false ? { is: null } : undefined,
    },
    select: {
      id_alumno: true,
      nombre: true,
      apellido: true,
      dni: true,
      cursos: cursoResumen,
      transporte: { select: { observaciones: true, recorridos_transporte: recorridoResumen } },
      comedor: { select: { observaciones: true, fecha_inscripcion: true } },
    },
    orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
  })
  res.json(alumnos)
})

/** Servicios de un alumno (para el portal de familias y el legajo). */
serviciosRouter.get('/:idAlumno', async (req, res) => {
  const idAlumno = id(req.params.idAlumno)
  await assertAccesoAlumno(req.user!, idAlumno)
  const [transporte, comedor] = await Promise.all([
    prisma.inscripcionTransporte.findUnique({
      where: { id_alumno: idAlumno },
      include: { recorridos_transporte: recorridoResumen },
    }),
    prisma.inscripcionComedor.findUnique({ where: { id_alumno: idAlumno } }),
  ])
  res.json({ transporte, comedor })
})

/** Inscribe al alumno en un recorrido; si ya viajaba en otro, lo cambia. */
serviciosRouter.put('/:idAlumno/transporte', async (req, res) => {
  const idAlumno = id(req.params.idAlumno)
  await assertPuedeGestionar(req, idAlumno)
  const idRecorrido = id(req.body?.id_recorrido)
  // Si no vienen observaciones, se conservan las que ya estaban cargadas.
  const observaciones = 'observaciones' in (req.body ?? {}) ? textOrNull(req.body.observaciones) : undefined

  const inscripcion = await prisma.$transaction(async (tx) => {
    // Bloquea el recorrido para que dos inscripciones simultáneas no superen la capacidad.
    await tx.$queryRaw`SELECT 1 FROM recorridos_transporte WHERE id_recorrido = ${idRecorrido} FOR UPDATE`
    const recorrido = await tx.recorridoTransporte.findUnique({
      where: { id_recorrido: idRecorrido },
      select: { activo: true, capacidad: true, nombre: true },
    })
    if (!recorrido) throw new HttpError(404, 'El recorrido no existe')
    if (!recorrido.activo) throw new HttpError(400, 'El recorrido no está activo')

    if (recorrido.capacidad !== null) {
      const ocupados = await tx.inscripcionTransporte.count({
        where: { id_recorrido: idRecorrido, id_alumno: { not: idAlumno } },
      })
      if (ocupados >= recorrido.capacidad) {
        throw new HttpError(409, `No quedan lugares en el recorrido ${recorrido.nombre}`)
      }
    }
    return tx.inscripcionTransporte.upsert({
      where: { id_alumno: idAlumno },
      create: { id_alumno: idAlumno, id_recorrido: idRecorrido, observaciones: observaciones ?? null },
      update: { id_recorrido: idRecorrido, observaciones },
      include: { recorridos_transporte: recorridoResumen },
    })
  })
  res.json(inscripcion)
})

serviciosRouter.delete('/:idAlumno/transporte', async (req, res) => {
  const idAlumno = id(req.params.idAlumno)
  await assertPuedeGestionar(req, idAlumno)
  await prisma.inscripcionTransporte.deleteMany({ where: { id_alumno: idAlumno } })
  res.status(204).end()
})

/** Inscribe al alumno al comedor (o actualiza sus observaciones). */
serviciosRouter.put('/:idAlumno/comedor', async (req, res) => {
  const idAlumno = id(req.params.idAlumno)
  await assertPuedeGestionar(req, idAlumno)
  const observaciones = 'observaciones' in (req.body ?? {}) ? textOrNull(req.body.observaciones) : undefined
  const alumno = await prisma.alumno.findUnique({ where: { id_alumno: idAlumno }, select: { id_alumno: true } })
  if (!alumno) throw new HttpError(404, 'El alumno no existe')
  const inscripcion = await prisma.inscripcionComedor.upsert({
    where: { id_alumno: idAlumno },
    create: { id_alumno: idAlumno, observaciones: observaciones ?? null },
    update: { observaciones },
  })
  res.json(inscripcion)
})

serviciosRouter.delete('/:idAlumno/comedor', async (req, res) => {
  const idAlumno = id(req.params.idAlumno)
  await assertPuedeGestionar(req, idAlumno)
  await prisma.inscripcionComedor.deleteMany({ where: { id_alumno: idAlumno } })
  res.status(204).end()
})
