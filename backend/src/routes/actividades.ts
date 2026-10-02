/**
 * Actividades extracurriculares (idiomas y deportes) con control de cupo.
 */
import { Router } from 'express'
import type { Request } from 'express'
import { Prisma } from '../generated/prisma/client.js'
import { HttpError, bool, hora, id, numOrNull, textOrNull } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { cursoResumen, nombreApellido } from '../lib/selects.js'
import { ROLES_ADMIN, assertAccesoAlumno, esStaff, requireAuth, requireRole } from '../middleware/auth.js'

export const actividadesRouter = Router()
actividadesRouter.use(requireAuth)

const TIPO_DEPORTE = 'Deporte'
const TIPOS = ['Idioma', TIPO_DEPORTE]

/** Máximo de deportes en los que puede estar inscripto un alumno (HU 2). */
const TOPE_DEPORTES = 2

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

/** Profesor y horarios de cada actividad, en el orden de la semana. */
const includeProfesorYHorarios = {
  docentes: { select: { id_docente: true, usuarios: nombreApellido } },
  horarios: { orderBy: { hora_inicio: 'asc' } },
} as const

function ordenarHorarios<T extends { dia_semana: string }>(horarios: T[]): T[] {
  return [...horarios].sort((a, b) => DIAS_SEMANA.indexOf(a.dia_semana) - DIAS_SEMANA.indexOf(b.dia_semana))
}

/**
 * Catálogo de actividades con la cantidad de inscriptos.
 * Con ?id_alumno=N agrega `inscripto` indicando si ese alumno ya está anotado.
 */
actividadesRouter.get('/', async (req, res) => {
  const idAlumno = numOrNull(req.query.id_alumno)
  if (idAlumno) await assertAccesoAlumno(req.user!, idAlumno)
  // Alumnos y familias solo ven las actividades activas.
  const activo = esStaff(req.user!) ? bool(req.query.activo) : true

  const actividades = await prisma.actividadExtracurricular.findMany({
    where: { activo },
    include: {
      ...includeProfesorYHorarios,
      _count: { select: { inscripciones_actividades: true } },
      inscripciones_actividades: idAlumno ? { where: { id_alumno: idAlumno }, select: { id_alumno: true } } : false,
    },
    orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
  })
  res.json(
    actividades.map(({ _count, inscripciones_actividades, horarios, ...a }) => ({
      ...a,
      horarios: ordenarHorarios(horarios),
      inscriptos: _count.inscripciones_actividades,
      ...(idAlumno ? { inscripto: (inscripciones_actividades ?? []).length > 0 } : {}),
    })),
  )
})

const hhmm = (d: Date) => d.toISOString().slice(11, 16)

/**
 * Días y franjas de la actividad: `[{ dia_semana, hora_inicio, hora_fin }]`.
 * La franja tiene que terminar después de empezar y dos franjas del mismo
 * día no pueden superponerse. Sin el campo, `null` (no se tocan los que hay).
 */
function horariosValidos(valor: unknown) {
  if (valor === undefined) return null
  if (!Array.isArray(valor)) throw new HttpError(400, 'Horarios inválidos')
  const horarios = valor.map((h: Record<string, unknown>) => {
    const dia = String(h?.dia_semana ?? '')
    if (!DIAS_SEMANA.includes(dia)) throw new HttpError(400, `Día inválido: ${dia}`)
    const inicio = hora(h.hora_inicio)
    const fin = hora(h.hora_fin)
    if (fin <= inicio) throw new HttpError(400, `El horario del ${dia} tiene que terminar después de empezar`)
    return { dia_semana: dia, hora_inicio: inicio, hora_fin: fin }
  })
  for (const [i, a] of horarios.entries()) {
    const choca = horarios.find(
      (b, j) => j > i && b.dia_semana === a.dia_semana && b.hora_inicio < a.hora_fin && a.hora_inicio < b.hora_fin,
    )
    if (choca) {
      throw new HttpError(
        400,
        `Los horarios del ${a.dia_semana} se superponen (${hhmm(a.hora_inicio)}–${hhmm(a.hora_fin)} y ${hhmm(choca.hora_inicio)}–${hhmm(choca.hora_fin)})`,
      )
    }
  }
  return horarios
}

async function datosActividad(body: Record<string, unknown>) {
  if (!textOrNull(body.nombre)) throw new HttpError(400, 'El nombre es obligatorio')
  if (!TIPOS.includes(String(body.tipo))) throw new HttpError(400, 'Tipo inválido')
  const cupo = Number(body.cupo_maximo)
  if (!Number.isInteger(cupo) || cupo <= 0) throw new HttpError(400, 'El cupo debe ser mayor a 0')
  const idDocente = numOrNull(body.id_docente)
  if (idDocente) {
    const docente = await prisma.docente.findUnique({ where: { id_docente: idDocente }, select: { activo: true } })
    if (!docente?.activo) throw new HttpError(400, 'El profesor no existe o está inactivo')
  }
  return {
    datos: {
      nombre: String(body.nombre).trim(),
      tipo: String(body.tipo),
      descripcion: textOrNull(body.descripcion),
      cupo_maximo: cupo,
      id_docente: idDocente,
    },
    horarios: horariosValidos(body.horarios),
  }
}

actividadesRouter.post('/', requireRole(...ROLES_ADMIN), async (req, res) => {
  const { datos, horarios } = await datosActividad(req.body ?? {})
  const actividad = await prisma.actividadExtracurricular.create({
    data: { ...datos, horarios: { create: horarios ?? [] } },
    include: includeProfesorYHorarios,
  })
  res.status(201).json(actividad)
})

/** Edita la actividad y, si llegan horarios, reemplaza los que tenía. */
actividadesRouter.put('/:id', requireRole(...ROLES_ADMIN), async (req, res) => {
  const { datos, horarios } = await datosActividad(req.body ?? {})
  const actividad = await prisma.actividadExtracurricular.update({
    where: { id_actividad: id(req.params.id) },
    data: { ...datos, horarios: horarios ? { deleteMany: {}, create: horarios } : undefined },
    include: includeProfesorYHorarios,
  })
  res.json(actividad)
})

actividadesRouter.patch('/:id', requireRole(...ROLES_ADMIN), async (req, res) => {
  const actividad = await prisma.actividadExtracurricular.update({
    where: { id_actividad: id(req.params.id) },
    data: { activo: typeof req.body?.activo === 'boolean' ? req.body.activo : undefined },
  })
  res.json(actividad)
})

// ── Inscripciones a actividades ────────────────────────────────

actividadesRouter.get('/:id/inscripciones', requireRole(...ROLES_ADMIN), async (req, res) => {
  const inscripciones = await prisma.inscripcionActividad.findMany({
    where: { id_actividad: id(req.params.id) },
    include: { alumnos: { select: { nombre: true, apellido: true, dni: true, cursos: cursoResumen } } },
    orderBy: { fecha_inscripcion: 'asc' },
  })
  res.json(inscripciones)
})

/** Admin: cualquier alumno. Alumno/tutor: solo los propios. */
async function assertPuedeInscribir(req: Request, idAlumno: number) {
  if (ROLES_ADMIN.includes(req.user!.rol)) return
  await assertAccesoAlumno(req.user!, idAlumno)
}

/** 'A' | 'A y B' | 'A, B y C' */
function enumerar(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`
}

/**
 * Un alumno puede estar inscripto como máximo en TOPE_DEPORTES deportes, sin
 * excepción de rol. Cuentan también los deportes desactivados: la inscripción
 * sigue vigente aunque la familia ya no los vea en el portal.
 */
async function assertTopeDeportes(tx: Prisma.TransactionClient, idAlumno: number) {
  const deportes = await tx.inscripcionActividad.findMany({
    where: { id_alumno: idAlumno, actividades_extracurriculares: { tipo: TIPO_DEPORTE } },
    select: { actividades_extracurriculares: { select: { nombre: true, activo: true } } },
    orderBy: { actividades_extracurriculares: { nombre: 'asc' } },
  })
  if (deportes.length < TOPE_DEPORTES) return

  const actividades = deportes.map((d) => d.actividades_extracurriculares)
  const nombres = actividades.map((a) => (a.activo ? a.nombre : `${a.nombre} [desactivado]`))
  const desactivados = actividades.filter((a) => !a.activo).map((a) => a.nombre)
  let mensaje =
    `El alumno ya está inscripto en ${deportes.length} deportes (${enumerar(nombres)}). ` +
    'Para inscribirlo en otro, primero dalo de baja de alguno de ellos.'
  if (desactivados.length > 0) {
    mensaje +=
      desactivados.length === 1
        ? ` ${desactivados[0]} está desactivado y no aparece en el portal: esa baja hay que pedírsela a la administración.`
        : ` ${enumerar(desactivados)} están desactivados y no aparecen en el portal: esas bajas hay que pedírselas a la administración.`
  }
  throw new HttpError(409, mensaje, 'TOPE_DEPORTES')
}

actividadesRouter.post('/:id/inscripciones', async (req, res) => {
  const idActividad = id(req.params.id)
  const idAlumno = id(req.body?.id_alumno)
  await assertPuedeInscribir(req, idAlumno)

  const inscripcion = await prisma.$transaction(async (tx) => {
    // Bloquea al alumno para que dos inscripciones simultáneas suyas a deportes
    // distintos no pasen las dos el tope. Se toma siempre antes que el de la
    // actividad (orden fijo, sin deadlocks). NO KEY UPDATE no frena los inserts
    // de otras tablas con FK al alumno.
    const alumno = await tx.$queryRaw<unknown[]>`SELECT 1 FROM alumnos WHERE id_alumno = ${idAlumno} FOR NO KEY UPDATE`
    if (alumno.length === 0) throw new HttpError(404, 'Alumno no encontrado')

    // Bloquea la actividad para que dos inscripciones simultáneas no superen el cupo.
    await tx.$queryRaw`SELECT 1 FROM actividades_extracurriculares WHERE id_actividad = ${idActividad} FOR UPDATE`
    const actividad = await tx.actividadExtracurricular.findUnique({
      where: { id_actividad: idActividad },
      select: { tipo: true, cupo_maximo: true, activo: true, _count: { select: { inscripciones_actividades: true } } },
    })
    if (!actividad) throw new HttpError(404, 'Actividad no encontrada')
    if (!actividad.activo) throw new HttpError(400, 'La actividad no está activa')

    const existente = await tx.inscripcionActividad.findUnique({
      where: { id_actividad_id_alumno: { id_actividad: idActividad, id_alumno: idAlumno } },
      select: { id_inscripcion_act: true },
    })
    // Mismo code que el P2002 del errorHandler: el frontend lo reconoce.
    if (existente) throw new HttpError(409, 'El alumno ya está inscripto en esta actividad', '23505')

    if (actividad._count.inscripciones_actividades >= actividad.cupo_maximo) {
      throw new HttpError(409, 'Cupo completo para esta actividad')
    }

    if (actividad.tipo === TIPO_DEPORTE) await assertTopeDeportes(tx, idAlumno)

    return tx.inscripcionActividad.create({ data: { id_actividad: idActividad, id_alumno: idAlumno } })
  })
  res.status(201).json(inscripcion)
})

/** Cancela la inscripción de un alumno a una actividad. */
actividadesRouter.delete('/:id/inscripciones/:idAlumno', async (req, res) => {
  const idAlumno = id(req.params.idAlumno)
  await assertPuedeInscribir(req, idAlumno)
  await prisma.inscripcionActividad.deleteMany({
    where: { id_actividad: id(req.params.id), id_alumno: idAlumno },
  })
  res.status(204).end()
})
