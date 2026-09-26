/**
 * Estructura académica: cursos, materias, docentes, asignaciones y horarios.
 */
import { Router } from 'express'
import { Prisma } from '../generated/prisma/client.js'
import { HttpError, bool, id, numOrNull, textOrNull } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { cursoResumen, materiaNombre, nombreApellido } from '../lib/selects.js'
import { ROLES_ADMIN, ROLES_STAFF, idDocenteDe, requireAuth, requireRole } from '../middleware/auth.js'

async function idPeriodoActivo(): Promise<number | null> {
  const periodo = await prisma.periodoAcademico.findFirst({
    where: { activo: true },
    select: { id_periodo: true },
    orderBy: { id_periodo: 'desc' },
  })
  return periodo?.id_periodo ?? null
}

// ── Cursos ─────────────────────────────────────────────────────

export const cursosRouter = Router()
cursosRouter.use(requireAuth, requireRole(...ROLES_STAFF))

type ClaveCurso = { nivel: string; grado_anio: string; division: string }

const CAMPOS_CURSO = { nivel: 'nivel', grado_anio: 'grado/año', division: 'división' } as const

/** "1 A de Primario", para los mensajes. */
const nombreCurso = (c: ClaveCurso) => `${c.grado_anio} ${c.division} de ${c.nivel}`

/** Capacidad del curso: null o '' = sin límite; si no, entero mayor a 0. */
function capacidadCurso(valor: unknown): number | null {
  if (valor === null || valor === '') return null
  const n = Number(valor)
  if (!Number.isInteger(n) || n < 1) {
    throw new HttpError(400, 'La capacidad debe ser un número entero mayor a 0, o quedar vacía para no limitar el cupo')
  }
  return n
}

/**
 * No hay unique en la base: se evita a nivel aplicación que haya dos cursos
 * iguales en el mismo ciclo lectivo (el mismo curso sí puede repetirse entre ciclos).
 */
async function assertCursoNoDuplicado(clave: ClaveCurso, idPeriodo: number | null, idExcluido?: number) {
  const otro = await prisma.curso.findFirst({
    where: {
      nivel: { equals: clave.nivel, mode: 'insensitive' },
      grado_anio: { equals: clave.grado_anio, mode: 'insensitive' },
      division: { equals: clave.division, mode: 'insensitive' },
      id_periodo: idPeriodo,
      id_curso: idExcluido ? { not: idExcluido } : undefined,
    },
    select: { activo: true },
  })
  if (!otro) return
  throw new HttpError(
    409,
    otro.activo
      ? `Ya existe el curso ${nombreCurso(clave)} en este ciclo lectivo.`
      : `Ya existe el curso ${nombreCurso(clave)} en este ciclo lectivo, dado de baja: reactivalo en lugar de crear otro.`,
    '23505',
  )
}

/** Sin filtro, solo los activos (los selects de otras pantallas dependen de eso). ?activo=false: los dados de baja; ?activo=todos: todos. */
cursosRouter.get('/', async (req, res) => {
  const activo = req.query.activo === 'todos' ? undefined : (bool(req.query.activo) ?? true)
  const cursos = await prisma.curso.findMany({
    where: { activo },
    orderBy: [{ nivel: 'asc' }, { grado_anio: 'asc' }, { division: 'asc' }],
  })
  res.json(cursos)
})

cursosRouter.post('/', requireRole(...ROLES_ADMIN), async (req, res) => {
  const body = req.body ?? {}
  const clave = { nivel: textOrNull(body.nivel), grado_anio: textOrNull(body.grado_anio), division: textOrNull(body.division) }
  if (!clave.nivel || !clave.grado_anio || !clave.division) {
    throw new HttpError(400, 'Nivel, grado/año y división son obligatorios')
  }
  const idPeriodo = await idPeriodoActivo()
  await assertCursoNoDuplicado(clave as ClaveCurso, idPeriodo)
  const curso = await prisma.curso.create({
    data: {
      ...(clave as ClaveCurso),
      // Sin el campo, el default del schema (30); con null explícito, sin límite.
      capacidad_maxima: 'capacidad_maxima' in body ? capacidadCurso(body.capacidad_maxima) : undefined,
      id_periodo: idPeriodo,
    },
  })
  res.status(201).json(curso)
})

/** Edición del curso: solo se tocan los campos que vienen en el body. */
cursosRouter.patch('/:id', requireRole(...ROLES_ADMIN), async (req, res) => {
  const idCurso = id(req.params.id)
  const body = req.body ?? {}
  const actual = await prisma.curso.findUnique({ where: { id_curso: idCurso } })
  if (!actual) throw new HttpError(404, 'Curso no encontrado')

  const data: Prisma.CursoUncheckedUpdateInput = {}
  const clave: ClaveCurso = { nivel: actual.nivel, grado_anio: actual.grado_anio, division: actual.division }
  let cambiaClave = false
  for (const campo of Object.keys(CAMPOS_CURSO) as (keyof ClaveCurso)[]) {
    if (campo in body) {
      const valor = textOrNull(body[campo])
      if (!valor) throw new HttpError(400, `El campo ${CAMPOS_CURSO[campo]} no puede quedar vacío`)
      data[campo] = clave[campo] = valor
      cambiaClave = true
    }
  }
  if ('capacidad_maxima' in body) data.capacidad_maxima = capacidadCurso(body.capacidad_maxima)
  if (cambiaClave) await assertCursoNoDuplicado(clave, actual.id_periodo, idCurso)

  if ('activo' in body) {
    if (typeof body.activo !== 'boolean') throw new HttpError(400, 'El campo activo debe ser true o false')
    data.activo = body.activo
  }
  const esBaja = data.activo === false && actual.activo

  const curso = await prisma.$transaction(async (tx) => {
    // La baja no toca alumnos ni asignaciones, por eso se rechaza mientras el
    // curso tenga alumnos activos. El lock es el mismo que toma verificarCupoCurso:
    // una asignación simultánea no puede colarse entre el conteo y la baja.
    if (esBaja) {
      await tx.$queryRaw`SELECT 1 FROM cursos WHERE id_curso = ${idCurso} FOR UPDATE`
      const alumnos = await tx.alumno.count({ where: { id_curso: idCurso, activo: true } })
      if (alumnos > 0) {
        throw new HttpError(
          409,
          `${nombreCurso(clave)} tiene ${alumnos} ${alumnos === 1 ? 'alumno activo' : 'alumnos activos'}. Reasignalos a otro curso antes de darlo de baja.`,
          'CURSO_CON_ALUMNOS',
        )
      }
    }
    return tx.curso.update({ where: { id_curso: idCurso }, data })
  })
  res.json(curso)
})

// ── Materias ───────────────────────────────────────────────────

export const materiasRouter = Router()
materiasRouter.use(requireAuth, requireRole(...ROLES_STAFF))

materiasRouter.get('/', async (req, res) => {
  const materias = await prisma.materia.findMany({
    where: { activo: bool(req.query.activo) },
    orderBy: { nombre: 'asc' },
  })
  res.json(materias)
})

/** Horas semanales: entero mayor o igual a 0 (la columna no admite null). */
function horasSemanales(valor: unknown): number {
  const n = valor === null || valor === '' ? NaN : Number(valor)
  if (!Number.isInteger(n) || n < 0) throw new HttpError(400, 'Las horas semanales deben ser un número entero mayor o igual a 0')
  return n
}

/** Sin unique en la base: se evita a nivel aplicación que haya dos materias con el mismo nombre. */
async function assertMateriaNoDuplicada(nombre: string, idExcluido?: number) {
  const otra = await prisma.materia.findFirst({
    where: {
      nombre: { equals: nombre, mode: 'insensitive' },
      id_materia: idExcluido ? { not: idExcluido } : undefined,
    },
    select: { activo: true },
  })
  if (!otra) return
  throw new HttpError(
    409,
    otra.activo
      ? `Ya existe la materia ${nombre}.`
      : `Ya existe la materia ${nombre}, dada de baja: reactivala en lugar de crear otra.`,
    '23505',
  )
}

materiasRouter.post('/', requireRole(...ROLES_ADMIN), async (req, res) => {
  const body = req.body ?? {}
  const nombre = textOrNull(body.nombre)
  if (!nombre) throw new HttpError(400, 'El nombre es obligatorio')
  await assertMateriaNoDuplicada(nombre)
  const materia = await prisma.materia.create({
    data: {
      nombre,
      descripcion: textOrNull(body.descripcion),
      horas_semanales: 'horas_semanales' in body ? horasSemanales(body.horas_semanales) : 0,
    },
  })
  res.status(201).json(materia)
})

/** Edición de la materia: solo se tocan los campos que vienen en el body. */
materiasRouter.patch('/:id', requireRole(...ROLES_ADMIN), async (req, res) => {
  const idMateria = id(req.params.id)
  const body = req.body ?? {}
  const actual = await prisma.materia.findUnique({ where: { id_materia: idMateria } })
  if (!actual) throw new HttpError(404, 'Materia no encontrada')

  const data: Prisma.MateriaUpdateInput = {}
  if ('nombre' in body) {
    const nombre = textOrNull(body.nombre)
    if (!nombre) throw new HttpError(400, 'El campo nombre no puede quedar vacío')
    await assertMateriaNoDuplicada(nombre, idMateria)
    data.nombre = nombre
  }
  if ('descripcion' in body) data.descripcion = textOrNull(body.descripcion)
  if ('horas_semanales' in body) data.horas_semanales = horasSemanales(body.horas_semanales)

  // Baja lógica y reactivación. Las asignaciones no se pueden cerrar todavía,
  // así que la baja no se bloquea: se advierte y hace falta confirmar.
  if ('activo' in body) {
    if (typeof body.activo !== 'boolean') throw new HttpError(400, 'El campo activo debe ser true o false')
    if (!body.activo && actual.activo && body.confirmar !== true) {
      const asignaciones = await prisma.asignacion.findMany({
        where: { id_materia: idMateria, activo: true },
        select: { cursos: { select: { nivel: true, grado_anio: true, division: true } } },
        orderBy: { id_curso: 'asc' },
      })
      if (asignaciones.length > 0) {
        const cursos = asignaciones.map((a) => nombreCurso(a.cursos)).join(', ')
        throw new HttpError(
          409,
          `${actual.nombre} tiene ${asignaciones.length} ${asignaciones.length === 1 ? 'asignación activa' : 'asignaciones activas'} (${cursos}). ` +
            'Si la das de baja, esas asignaciones y sus horarios no se modifican. Confirmá para continuar.',
          'MATERIA_CON_ASIGNACIONES',
        )
      }
    }
    data.activo = body.activo
  }

  const materia = await prisma.materia.update({ where: { id_materia: idMateria }, data })
  res.json(materia)
})

// ── Docentes ───────────────────────────────────────────────────

export const docentesRouter = Router()
docentesRouter.use(requireAuth, requireRole(...ROLES_ADMIN))

docentesRouter.get('/', async (req, res) => {
  const docentes = await prisma.docente.findMany({
    where: { activo: bool(req.query.activo) },
    include: { usuarios: { select: { nombre: true, apellido: true, email: true } } },
    orderBy: { id_docente: 'asc' },
  })
  res.json(docentes)
})

// ── Asignaciones (docente + materia + curso) ───────────────────

export const asignacionesRouter = Router()
asignacionesRouter.use(requireAuth, requireRole(...ROLES_STAFF))

asignacionesRouter.get('/', requireRole(...ROLES_ADMIN), async (_req, res) => {
  const asignaciones = await prisma.asignacion.findMany({
    where: { activo: true },
    include: {
      docentes: { select: { usuarios: nombreApellido } },
      materias: materiaNombre,
      cursos: cursoResumen,
    },
    orderBy: { id_asignacion: 'asc' },
  })
  res.json(asignaciones)
})

/** Asignaciones activas del docente logueado. */
asignacionesRouter.get('/mias', async (req, res) => {
  const idDocente = await idDocenteDe(req.user!)
  const asignaciones = await prisma.asignacion.findMany({
    where: { id_docente: idDocente, activo: true },
    include: {
      materias: materiaNombre,
      cursos: { select: { id_curso: true, nivel: true, grado_anio: true, division: true } },
    },
    orderBy: { id_asignacion: 'asc' },
  })
  res.json(asignaciones)
})

/** Alumnos activos del curso de una asignación. */
asignacionesRouter.get('/:id/alumnos', async (req, res) => {
  const asignacion = await prisma.asignacion.findUnique({
    where: { id_asignacion: id(req.params.id) },
    select: { id_curso: true },
  })
  if (!asignacion) throw new HttpError(404, 'Asignación no encontrada')
  const alumnos = await prisma.alumno.findMany({
    where: { id_curso: asignacion.id_curso, activo: true },
    select: { id_alumno: true, nombre: true, apellido: true },
    orderBy: { apellido: 'asc' },
  })
  res.json(alumnos)
})

asignacionesRouter.post('/', requireRole(...ROLES_ADMIN), async (req, res) => {
  const { id_docente, id_materia, id_curso } = req.body ?? {}
  const asignacion = await prisma.asignacion.create({
    data: {
      id_docente: id(id_docente),
      id_materia: id(id_materia),
      id_curso: id(id_curso),
      id_periodo: await idPeriodoActivo(),
    },
  })
  res.status(201).json(asignacion)
})

// ── Horarios ───────────────────────────────────────────────────

export const horariosRouter = Router()
horariosRouter.use(requireAuth)

/** Horario de un curso para un día (?id_curso=1&dia=Lunes). */
horariosRouter.get('/', async (req, res) => {
  const idCurso = numOrNull(req.query.id_curso)
  if (!idCurso) throw new HttpError(400, 'Falta id_curso')
  const horarios = await prisma.horario.findMany({
    where: {
      dia_semana: typeof req.query.dia === 'string' ? req.query.dia : undefined,
      asignaciones: { id_curso: idCurso },
    },
    include: {
      asignaciones: {
        select: {
          id_curso: true,
          materias: materiaNombre,
          docentes: { select: { usuarios: nombreApellido } },
        },
      },
    },
    orderBy: { hora_inicio: 'asc' },
  })
  // El portal espera `docentes: { nombre, apellido }` (sin el nivel `usuarios`).
  // Un docente puede no tener usuario vinculado (id_usuario es opcional).
  res.json(
    horarios.map(({ asignaciones: { docentes, ...asig }, ...h }) => ({
      ...h,
      asignaciones: { ...asig, docentes: docentes.usuarios ?? { nombre: '', apellido: '' } },
    })),
  )
})
