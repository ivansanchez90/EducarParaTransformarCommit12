/**
 * Estructura académica: cursos, materias, docentes, asignaciones y horarios.
 */
import { Router } from 'express'
import { Prisma } from '../generated/prisma/client.js'
import { HttpError, bool, fecha, id, numOrNull, textOrNull } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { cursoResumen, materiaNombre, nombreApellido } from '../lib/selects.js'
import { ROLES_ADMIN, ROLES_STAFF, idDocenteDe, requireAuth, requireRole } from '../middleware/auth.js'
import { crearUsuario, emailOpcional } from '../services/usuarios.js'

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
    select: { activo: true, nivel: true, grado_anio: true, division: true },
  })
  if (!otro) return
  throw new HttpError(
    409,
    otro.activo
      ? `Ya existe el curso ${nombreCurso(otro)} en este ciclo lectivo.`
      : `Ya existe el curso ${nombreCurso(otro)} en este ciclo lectivo, dado de baja: reactivalo en lugar de crear otro.`,
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
    select: { activo: true, nombre: true },
  })
  if (!otra) return
  throw new HttpError(
    409,
    otra.activo
      ? `Ya existe la materia ${otra.nombre}.`
      : `Ya existe la materia ${otra.nombre}, dada de baja: reactivala en lugar de crear otra.`,
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
// Módulo de profesores (HU 4 de la Parte 2): legajo (id_docente), DNI, nombre,
// apellido, especialidad, correo, teléfono y estado. Nombre, correo y teléfono
// viven en el usuario con el que el docente entra al sistema.

export const docentesRouter = Router()
docentesRouter.use(requireAuth, requireRole(...ROLES_ADMIN))

const datosDelDocente = {
  usuarios: { select: { id_usuario: true, nombre: true, apellido: true, email: true, telefono: true, activo: true } },
  asignaciones: {
    where: { activo: true },
    select: {
      id_asignacion: true,
      id_materia: true,
      id_curso: true,
      materias: materiaNombre,
      cursos: { select: { id_curso: true, nivel: true, grado_anio: true, division: true } },
    },
    orderBy: [{ cursos: { nivel: 'asc' } }, { id_curso: 'asc' }, { id_materia: 'asc' }],
  },
} satisfies Prisma.DocenteInclude

docentesRouter.get('/', async (req, res) => {
  const docentes = await prisma.docente.findMany({
    where: { activo: bool(req.query.activo) },
    include: datosDelDocente,
    orderBy: [{ usuarios: { apellido: 'asc' } }, { usuarios: { nombre: 'asc' } }],
  })
  res.json(docentes)
})

const DNI_DUPLICADO = 'Ya existe un profesor registrado con ese DNI'

/** Los datos del formulario del docente, validados. La contraseña solo se pide en el alta. */
function datosDocente(body: Record<string, unknown>) {
  const nombre = textOrNull(body.nombre)
  const apellido = textOrNull(body.apellido)
  if (!nombre || !apellido) throw new HttpError(400, 'Nombre y apellido son obligatorios')
  const email = emailOpcional(body.email)
  if (!email) throw new HttpError(400, 'El correo es obligatorio: es con el que el docente entra al sistema')
  const dni = String(body.dni ?? '').replace(/\./g, '').trim()
  if (!/^\d{7,8}$/.test(dni)) throw new HttpError(400, 'El DNI tiene que tener 7 u 8 números')
  return {
    usuario: { nombre, apellido, email, telefono: textOrNull(body.telefono) },
    docente: {
      dni,
      especialidad: textOrNull(body.especialidad),
      titulo: textOrNull(body.titulo),
      fecha_ingreso: fecha(body.fecha_ingreso),
    },
  }
}

async function assertDniLibre(dni: string, idDocente?: number) {
  const otro = await prisma.docente.findUnique({ where: { dni }, select: { id_docente: true } })
  if (otro && otro.id_docente !== idDocente) throw new HttpError(409, DNI_DUPLICADO, 'DNI_DUPLICADO')
}

async function assertEmailLibre(email: string, idUsuario: string) {
  const otro = await prisma.usuario.findUnique({ where: { email }, select: { id_usuario: true } })
  if (otro && otro.id_usuario !== idUsuario) throw new HttpError(409, `Ya existe un usuario con el email ${email}`, '23505')
}

/** Dos altas simultáneas con el mismo DNI: la base rechaza la segunda. */
function dniRepetido(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && String(err.meta?.target ?? '').includes('dni')
}

/** Alta: crea el usuario con rol Docente (con su contraseña inicial) y completa su legajo. */
docentesRouter.post('/', async (req, res) => {
  const body = req.body ?? {}
  const { usuario, docente } = datosDocente(body)
  const password = String(body.password ?? '')
  if (password.length < 6) throw new HttpError(400, 'La contraseña inicial debe tener al menos 6 caracteres')
  await assertDniLibre(docente.dni)

  try {
    const creado = await prisma.$transaction(async (tx) => {
      const u = await crearUsuario(tx, { ...usuario, password, rol: 'Docente' })
      await tx.usuario.update({ where: { id_usuario: u.id_usuario }, data: { telefono: usuario.telefono } })
      return tx.docente.update({ where: { id_usuario: u.id_usuario }, data: docente, include: datosDelDocente })
    })
    res.status(201).json(creado)
  } catch (err) {
    if (dniRepetido(err)) throw new HttpError(409, DNI_DUPLICADO, 'DNI_DUPLICADO')
    throw err
  }
})

docentesRouter.put('/:id', async (req, res) => {
  const idDocente = id(req.params.id)
  const actual = await prisma.docente.findUnique({ where: { id_docente: idDocente }, select: { id_usuario: true } })
  if (!actual) throw new HttpError(404, 'Docente no encontrado')
  if (!actual.id_usuario) throw new HttpError(400, 'El docente no tiene usuario: crealo desde Usuarios')
  const { usuario, docente } = datosDocente(req.body ?? {})
  await assertDniLibre(docente.dni, idDocente)
  await assertEmailLibre(usuario.email, actual.id_usuario)

  try {
    const editado = await prisma.$transaction(async (tx) => {
      await tx.usuario.update({ where: { id_usuario: actual.id_usuario! }, data: usuario })
      return tx.docente.update({ where: { id_docente: idDocente }, data: docente, include: datosDelDocente })
    })
    res.json(editado)
  } catch (err) {
    if (dniRepetido(err)) throw new HttpError(409, DNI_DUPLICADO, 'DNI_DUPLICADO')
    throw err
  }
})

/**
 * Activa o da de baja al docente (y a su usuario: un docente inactivo no entra al sistema).
 * Si tiene materias a cargo, la baja pide `confirmar: true`: esas asignaciones no cambian solas.
 */
docentesRouter.patch('/:id', async (req, res) => {
  const idDocente = id(req.params.id)
  const activo = req.body?.activo
  if (typeof activo !== 'boolean') throw new HttpError(400, 'El campo activo debe ser true o false')
  const actual = await prisma.docente.findUnique({
    where: { id_docente: idDocente },
    select: { activo: true, id_usuario: true, usuarios: nombreApellido, asignaciones: { where: { activo: true }, select: { id_asignacion: true } } },
  })
  if (!actual) throw new HttpError(404, 'Docente no encontrado')
  if (actual.id_usuario === req.user!.id_usuario && !activo) throw new HttpError(400, 'No podés desactivar tu propio usuario')

  const cantidad = actual.asignaciones.length
  if (!activo && actual.activo && cantidad > 0 && req.body?.confirmar !== true) {
    const nombre = actual.usuarios ? `${actual.usuarios.nombre} ${actual.usuarios.apellido}` : 'El docente'
    throw new HttpError(
      409,
      `${nombre} tiene ${cantidad} ${cantidad === 1 ? 'materia a cargo' : 'materias a cargo'}. ` +
        'Con la baja, esas materias siguen a su nombre hasta que las reasignes desde su ficha. Confirmá para continuar.',
      'DOCENTE_CON_ASIGNACIONES',
    )
  }
  const docente = await prisma.$transaction(async (tx) => {
    if (actual.id_usuario) await tx.usuario.update({ where: { id_usuario: actual.id_usuario }, data: { activo } })
    return tx.docente.update({ where: { id_docente: idDocente }, data: { activo }, include: datosDelDocente })
  })
  res.json(docente)
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

const nombreCursoCorto = (c: { grado_anio: string; division: string }) => `${c.grado_anio}° ${c.division}`

/**
 * Asigna una materia de un curso a un docente. Cada materia tiene un solo profesor por
 * curso (puede tener otro en otro curso): si ya lo tiene, responde 409 y con
 * `reemplazar: true` lo reemplaza. Los horarios pasan a la asignación nueva; las notas y la
 * asistencia ya cargadas quedan con la anterior, que se cierra (no se borra).
 */
asignacionesRouter.post('/', requireRole(...ROLES_ADMIN), async (req, res) => {
  const idDocente = id(req.body?.id_docente)
  const idMateria = id(req.body?.id_materia)
  const idCurso = id(req.body?.id_curso)
  const [docente, materia, curso] = await Promise.all([
    prisma.docente.findUnique({ where: { id_docente: idDocente }, select: { activo: true, usuarios: nombreApellido } }),
    prisma.materia.findUnique({ where: { id_materia: idMateria }, select: { nombre: true, activo: true } }),
    prisma.curso.findUnique({ where: { id_curso: idCurso }, select: { grado_anio: true, division: true, nivel: true, activo: true } }),
  ])
  if (!docente?.activo) throw new HttpError(400, 'El docente no existe o está de baja')
  if (!materia?.activo) throw new HttpError(400, 'La materia no existe o está dada de baja')
  if (!curso?.activo) throw new HttpError(400, 'El curso no existe o está dado de baja')
  const idPeriodo = await idPeriodoActivo()

  const asignacion = await prisma.$transaction(async (tx) => {
    // Bloquea el curso: dos asignaciones simultáneas de la misma materia no pasan las dos.
    await tx.$queryRaw`SELECT 1 FROM cursos WHERE id_curso = ${idCurso} FOR UPDATE`
    const vigente = await tx.asignacion.findFirst({
      where: { id_materia: idMateria, id_curso: idCurso, activo: true },
      select: { id_asignacion: true, id_docente: true, docentes: { select: { usuarios: nombreApellido } } },
    })
    const enCurso = `${materia.nombre} de ${nombreCursoCorto(curso)} (${curso.nivel})`
    if (vigente?.id_docente === idDocente) throw new HttpError(409, `${enCurso} ya está asignada a este docente`, '23505')
    if (vigente && req.body?.reemplazar !== true) {
      const actual = vigente.docentes.usuarios ? `${vigente.docentes.usuarios.nombre} ${vigente.docentes.usuarios.apellido}` : 'otro docente'
      const nuevo = docente.usuarios ? `${docente.usuarios.nombre} ${docente.usuarios.apellido}` : 'el docente elegido'
      throw new HttpError(
        409,
        `${enCurso} ya la dicta ${actual}. Si seguís, pasa a dictarla ${nuevo}: los horarios pasan a ${nuevo}, ` +
          `y las notas y la asistencia ya cargadas quedan registradas con ${actual}.`,
        'MATERIA_CON_PROFESOR',
      )
    }
    const creada = await tx.asignacion.create({
      data: { id_docente: idDocente, id_materia: idMateria, id_curso: idCurso, id_periodo: idPeriodo },
    })
    if (vigente) {
      await tx.asignacion.update({ where: { id_asignacion: vigente.id_asignacion }, data: { activo: false } })
      await tx.horario.updateMany({ where: { id_asignacion: vigente.id_asignacion }, data: { id_asignacion: creada.id_asignacion } })
    }
    return creada
  })
  res.status(201).json(asignacion)
})

/** Quita la materia al docente: la asignación se cierra (con sus notas y asistencia) y deja de verse. */
asignacionesRouter.patch('/:id', requireRole(...ROLES_ADMIN), async (req, res) => {
  if (req.body?.activo !== false) throw new HttpError(400, 'Solo se puede cerrar una asignación (activo: false)')
  const idAsignacion = id(req.params.id)
  const actual = await prisma.asignacion.findUnique({ where: { id_asignacion: idAsignacion }, select: { activo: true } })
  if (!actual) throw new HttpError(404, 'Asignación no encontrada')
  const asignacion = await prisma.asignacion.update({ where: { id_asignacion: idAsignacion }, data: { activo: false } })
  res.json(asignacion)
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
      // Una asignación cerrada (materia quitada o profesor reemplazado) no se muestra.
      asignaciones: { id_curso: idCurso, activo: true },
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
