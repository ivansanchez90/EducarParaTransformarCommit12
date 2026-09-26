import { Router } from 'express'
import { Prisma } from '../generated/prisma/client.js'
import { HttpError, bool, fechaObligatoria, id, lista, numOrNull, textOrNull } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { cursoResumen, materiaNombre } from '../lib/selects.js'
import {
  ROLES_ADMIN,
  ROLES_STAFF,
  assertAccesoAlumno,
  esTutor,
  requireAuth,
  requireRole,
} from '../middleware/auth.js'
import { borrarArchivo, uploader, urlPublica } from '../middleware/upload.js'

export const alumnosRouter = Router()
alumnosRouter.use(requireAuth)

/**
 * Rechaza la asignación de un alumno a un curso sin cupo
 * (reemplaza al trigger `trg_cupo_curso` de Supabase).
 */
export async function verificarCupoCurso(
  tx: Prisma.TransactionClient,
  idCurso: number | null,
  idAlumnoExcluido?: number,
) {
  if (!idCurso) return
  // Bloquea la fila del curso para que dos altas simultáneas no superen el cupo.
  await tx.$queryRaw`SELECT 1 FROM cursos WHERE id_curso = ${idCurso} FOR UPDATE`
  const curso = await tx.curso.findUnique({ where: { id_curso: idCurso }, select: { capacidad_maxima: true } })
  if (!curso) throw new HttpError(400, 'El curso no existe')
  const ocupados = await tx.alumno.count({
    where: { id_curso: idCurso, activo: true, id_alumno: idAlumnoExcluido ? { not: idAlumnoExcluido } : undefined },
  })
  // capacidad_maxima NULL = curso sin límite de cupo
  if (curso.capacidad_maxima !== null && ocupados >= curso.capacidad_maxima) {
    throw new HttpError(409, 'Cupo completo')
  }
}

/**
 * Rechaza asignar un alumno a un curso dado de baja. Va después de
 * verificarCupoCurso (que bloquea la fila). Si el alumno ya estaba en ese curso
 * no es una asignación nueva: se deja editar el resto de sus datos.
 */
async function assertCursoActivo(tx: Prisma.TransactionClient, idCurso: number | null, idAlumno?: number) {
  if (!idCurso) return
  const curso = await tx.curso.findUnique({ where: { id_curso: idCurso }, select: { activo: true } })
  if (!curso || curso.activo) return
  if (idAlumno) {
    const yaEstaba = await tx.alumno.count({ where: { id_alumno: idAlumno, id_curso: idCurso } })
    if (yaEstaba) return
  }
  throw new HttpError(400, 'El curso está dado de baja. Elegí un curso activo.')
}

// ── Listados para el personal ──────────────────────────────────

alumnosRouter.get('/', requireRole(...ROLES_STAFF), async (req, res) => {
  const alumnos = await prisma.alumno.findMany({
    where: { activo: bool(req.query.activo), id_curso: numOrNull(req.query.id_curso) ?? undefined },
    include: { cursos: cursoResumen, padre: { select: { email: true } } },
    orderBy: { apellido: 'asc' },
  })
  res.json(alumnos)
})

// ── Portal: alumnos del usuario logueado (el propio alumno o los hijos del tutor) ──

alumnosRouter.get('/mios', async (req, res) => {
  const u = req.user!
  const alumnos = await prisma.alumno.findMany({
    where: esTutor(u) ? { id_usuario_padre: u.id_usuario } : { id_usuario: u.id_usuario },
    select: {
      id_alumno: true,
      nombre: true,
      apellido: true,
      dni: true,
      obra_social: true,
      id_curso: true,
      cursos: cursoResumen,
    },
    orderBy: { apellido: 'asc' },
  })
  res.json(alumnos)
})

alumnosRouter.get('/:id', async (req, res) => {
  const idAlumno = id(req.params.id)
  await assertAccesoAlumno(req.user!, idAlumno)
  const alumno = await prisma.alumno.findUnique({
    where: { id_alumno: idAlumno },
    include: { cursos: cursoResumen },
  })
  if (!alumno) throw new HttpError(404, 'Alumno no encontrado')
  res.json(alumno)
})

alumnosRouter.post('/', requireRole(...ROLES_ADMIN), async (req, res) => {
  const body = req.body ?? {}
  // El padre/tutor se vincula por email (antes se resolvía desde el frontend).
  let idPadre: string | null = null
  const emailPadre = textOrNull(body.email_padre)
  if (emailPadre) {
    const padre = await prisma.usuario.findUnique({
      where: { email: emailPadre.toLowerCase() },
      select: { id_usuario: true },
    })
    idPadre = padre?.id_usuario ?? null
  }
  const idCurso = numOrNull(body.id_curso)
  const alumno = await prisma.$transaction(async (tx) => {
    await verificarCupoCurso(tx, idCurso)
    await assertCursoActivo(tx, idCurso)
    return tx.alumno.create({
      data: {
        nombre: String(body.nombre ?? '').trim(),
        apellido: String(body.apellido ?? '').trim(),
        dni: String(body.dni ?? '').trim(),
        fecha_nacimiento: fechaObligatoria(body.fecha_nacimiento, 'fecha de nacimiento'),
        id_curso: idCurso,
        id_usuario_padre: idPadre,
        direccion: textOrNull(body.direccion),
        telefono_emergencia: textOrNull(body.telefono_emergencia),
        nombre_contacto_emergencia: textOrNull(body.nombre_contacto_emergencia),
        obra_social: textOrNull(body.obra_social),
        nro_obra_social: textOrNull(body.nro_obra_social),
      },
    })
  })
  res.status(201).json(alumno)
})

/** Edición del alumno: solo se tocan los campos que vienen en el body. */
alumnosRouter.patch('/:id', requireRole(...ROLES_ADMIN), async (req, res) => {
  const idAlumno = id(req.params.id)
  const body = req.body ?? {}

  const alumno = await prisma.$transaction(async (tx) => {
    const data: Prisma.AlumnoUncheckedUpdateInput = {}

    if ('id_curso' in body) {
      data.id_curso = numOrNull(body.id_curso)
      await verificarCupoCurso(tx, data.id_curso, idAlumno)
      await assertCursoActivo(tx, data.id_curso, idAlumno)
    }
    if (typeof body.activo === 'boolean') data.activo = body.activo

    for (const campo of ['nombre', 'apellido'] as const) {
      if (campo in body) {
        const valor = textOrNull(body[campo])
        if (!valor) throw new HttpError(400, `El campo ${campo} no puede quedar vacío`)
        data[campo] = valor
      }
    }
    if ('dni' in body) {
      const dni = textOrNull(body.dni)
      if (!dni) throw new HttpError(400, 'El DNI no puede quedar vacío')
      const otro = await tx.alumno.findFirst({
        where: { dni, id_alumno: { not: idAlumno } },
        select: { id_alumno: true },
      })
      if (otro) throw new HttpError(409, 'Ya existe un alumno registrado con ese DNI', '23505')
      data.dni = dni
    }
    if ('fecha_nacimiento' in body) {
      data.fecha_nacimiento = fechaObligatoria(body.fecha_nacimiento, 'fecha de nacimiento')
    }
    // Vincular (o desvincular, con cadena vacía) al padre/tutor por email.
    if ('email_padre' in body) {
      const email = textOrNull(body.email_padre)
      if (!email) data.id_usuario_padre = null
      else {
        const padre = await tx.usuario.findUnique({
          where: { email: email.toLowerCase() },
          select: { id_usuario: true },
        })
        if (!padre) throw new HttpError(404, `No existe un usuario con el email ${email}`)
        data.id_usuario_padre = padre.id_usuario
      }
    }
    for (const campo of [
      'direccion',
      'telefono_emergencia',
      'nombre_contacto_emergencia',
      'obra_social',
      'nro_obra_social',
    ] as const) {
      if (campo in body) data[campo] = textOrNull(body[campo])
    }
    return tx.alumno.update({
      where: { id_alumno: idAlumno },
      data,
      include: { cursos: cursoResumen },
    })
  })
  res.json(alumno)
})

// ── Datos académicos y administrativos de un alumno ────────────

alumnosRouter.get('/:id/calificaciones', async (req, res) => {
  const idAlumno = id(req.params.id)
  await assertAccesoAlumno(req.user!, idAlumno)
  const calificaciones = await prisma.calificacion.findMany({
    where: { id_alumno: idAlumno },
    include: { asignaciones: { select: { materias: materiaNombre } } },
    orderBy: [{ fecha_carga: 'desc' }, { created_at: 'desc' }],
    take: numOrNull(req.query.limit) ?? undefined,
  })
  res.json(calificaciones)
})

alumnosRouter.get('/:id/asistencias', async (req, res) => {
  const idAlumno = id(req.params.id)
  await assertAccesoAlumno(req.user!, idAlumno)
  const asistencias = await prisma.asistencia.findMany({
    where: { id_alumno: idAlumno },
    select: { estado: true, fecha: true },
  })
  res.json(asistencias)
})

alumnosRouter.get('/:id/cuotas', async (req, res) => {
  const idAlumno = id(req.params.id)
  await assertAccesoAlumno(req.user!, idAlumno)
  const estados = lista(req.query.estado)
  const cuotas = await prisma.cuota.findMany({
    where: { id_alumno: idAlumno, estado: estados ? { in: estados } : undefined },
    orderBy: { fecha_vencimiento: 'asc' },
  })
  res.json(cuotas)
})

alumnosRouter.get('/:id/amonestaciones', requireRole(...ROLES_STAFF), async (req, res) => {
  const amonestaciones = await prisma.amonestacion.findMany({
    where: { id_alumno: id(req.params.id) },
    select: { id_amonestacion: true, tipo: true, descripcion: true, fecha: true },
    orderBy: { fecha: 'desc' },
  })
  res.json(amonestaciones)
})

// ── Legajo digital: documentación del alumno ───────────────────

alumnosRouter.get('/:id/documentos', requireRole(...ROLES_STAFF), async (req, res) => {
  const documentos = await prisma.documentoAlumno.findMany({
    where: { id_alumno: id(req.params.id) },
    orderBy: { fecha_carga: 'desc' },
  })
  res.json(documentos)
})

alumnosRouter.post(
  '/:id/documentos',
  requireRole(...ROLES_STAFF),
  uploader('documentos-alumnos').single('archivo'),
  async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Seleccioná un archivo')
    const url = urlPublica('documentos-alumnos', req.file.filename)
    try {
      const documento = await prisma.documentoAlumno.create({
        data: {
          id_alumno: id(req.params.id),
          nombre: textOrNull(req.body?.nombre) ?? req.file.originalname,
          tipo: textOrNull(req.body?.tipo),
          url_archivo: url,
        },
      })
      res.status(201).json(documento)
    } catch (err) {
      await borrarArchivo(url)
      throw err
    }
  },
)

alumnosRouter.delete('/documentos/:idDocumento', requireRole(...ROLES_STAFF), async (req, res) => {
  const documento = await prisma.documentoAlumno.delete({
    where: { id_documento: id(req.params.idDocumento) },
  })
  await borrarArchivo(documento.url_archivo)
  res.status(204).end()
})
