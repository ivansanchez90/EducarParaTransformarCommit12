/**
 * Estructura académica: cursos, materias, docentes, asignaciones y horarios.
 */
import { Router } from 'express'
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

cursosRouter.get('/', async (_req, res) => {
  const cursos = await prisma.curso.findMany({
    where: { activo: true },
    orderBy: [{ nivel: 'asc' }, { grado_anio: 'asc' }, { division: 'asc' }],
  })
  res.json(cursos)
})

cursosRouter.post('/', requireRole(...ROLES_ADMIN), async (req, res) => {
  const { nivel, grado_anio, division, capacidad_maxima } = req.body ?? {}
  if (!nivel || !grado_anio || !division) throw new HttpError(400, 'Nivel, grado/año y división son obligatorios')
  const curso = await prisma.curso.create({
    data: {
      nivel,
      grado_anio: String(grado_anio),
      division: String(division),
      capacidad_maxima: numOrNull(capacidad_maxima) ?? undefined,
      id_periodo: await idPeriodoActivo(),
    },
  })
  res.status(201).json(curso)
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

materiasRouter.post('/', requireRole(...ROLES_ADMIN), async (req, res) => {
  const { nombre, horas_semanales, descripcion } = req.body ?? {}
  if (!nombre) throw new HttpError(400, 'El nombre es obligatorio')
  const materia = await prisma.materia.create({
    data: { nombre, descripcion: textOrNull(descripcion), horas_semanales: numOrNull(horas_semanales) ?? 0 },
  })
  res.status(201).json(materia)
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
