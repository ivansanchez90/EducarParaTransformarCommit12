import bcrypt from 'bcryptjs'
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
import { borrarArchivoPrivado, guardarArchivoPrivado, recibirArchivoPrivado, rutaArchivoPrivado } from '../middleware/upload.js'
import { crearUsuario, emailInstitucionalAlumno, emailOpcional } from '../services/usuarios.js'

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

/** Usuario con el que el alumno entra a la plataforma (email y si está activo). */
const usuarioAlumno = { select: { email: true, activo: true } } as const

/**
 * Crea el usuario del alumno: con su email si lo tiene, o con el institucional
 * (`<dni>@alumno.local`). La contraseña inicial es el DNI.
 */
async function crearUsuarioAlumno(
  tx: Prisma.TransactionClient,
  alumno: { nombre: string; apellido: string; dni: string },
  email: string | null,
) {
  return crearUsuario(tx, {
    email: email ?? emailInstitucionalAlumno(alumno.dni),
    password: alumno.dni,
    nombre: alumno.nombre,
    apellido: alumno.apellido,
    rol: 'Alumno',
  })
}

// ── Listados para el personal ──────────────────────────────────

alumnosRouter.get('/', requireRole(...ROLES_STAFF), async (req, res) => {
  const alumnos = await prisma.alumno.findMany({
    where: { activo: bool(req.query.activo), id_curso: numOrNull(req.query.id_curso) ?? undefined },
    include: { cursos: cursoResumen, padre: { select: { email: true } }, usuarios: usuarioAlumno },
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
    include: { cursos: cursoResumen, usuarios: usuarioAlumno },
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
  const nombre = String(body.nombre ?? '').trim()
  const apellido = String(body.apellido ?? '').trim()
  const dni = String(body.dni ?? '').trim()
  if (!nombre || !apellido || !dni) throw new HttpError(400, 'Nombre, apellido y DNI son obligatorios')
  // Email propio del alumno (opcional); sin él se usa el institucional.
  const email = emailOpcional(body.email)

  const alumno = await prisma.$transaction(async (tx) => {
    const otro = await tx.alumno.findUnique({ where: { dni }, select: { id_alumno: true } })
    if (otro) throw new HttpError(409, 'Ya existe un alumno registrado con ese DNI', '23505')
    await verificarCupoCurso(tx, idCurso)
    await assertCursoActivo(tx, idCurso)
    const usuario = await crearUsuarioAlumno(tx, { nombre, apellido, dni }, email)
    return tx.alumno.create({
      data: {
        nombre,
        apellido,
        dni,
        id_usuario: usuario.id_usuario,
        fecha_nacimiento: fechaObligatoria(body.fecha_nacimiento, 'fecha de nacimiento'),
        id_curso: idCurso,
        id_usuario_padre: idPadre,
        direccion: textOrNull(body.direccion),
        telefono_emergencia: textOrNull(body.telefono_emergencia),
        nombre_contacto_emergencia: textOrNull(body.nombre_contacto_emergencia),
        obra_social: textOrNull(body.obra_social),
        nro_obra_social: textOrNull(body.nro_obra_social),
      },
      include: { cursos: cursoResumen, usuarios: usuarioAlumno },
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
    // Email con el que entra el alumno: se cambia en su usuario.
    if ('email' in body) {
      const email = emailOpcional(body.email)
      if (!email) throw new HttpError(400, 'El email del alumno no puede quedar vacío')
      const actual = await tx.alumno.findUnique({ where: { id_alumno: idAlumno }, select: { id_usuario: true } })
      if (!actual) throw new HttpError(404, 'Alumno no encontrado')
      if (!actual.id_usuario) {
        throw new HttpError(400, 'El alumno no tiene usuario: crealo desde el legajo')
      }
      const otro = await tx.usuario.findUnique({ where: { email }, select: { id_usuario: true } })
      if (otro && otro.id_usuario !== actual.id_usuario) {
        throw new HttpError(409, `Ya existe un usuario con el email ${email}`, '23505')
      }
      await tx.usuario.update({ where: { id_usuario: actual.id_usuario }, data: { email } })
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
      include: { cursos: cursoResumen, usuarios: usuarioAlumno },
    })
  })
  res.json(alumno)
})

/**
 * Crea el usuario de un alumno que no lo tiene (los que se cargaron antes de
 * que el alta lo creara). Body: `{ email? }`; sin email, el institucional.
 */
alumnosRouter.post('/:id/acceso', requireRole(...ROLES_ADMIN), async (req, res) => {
  const idAlumno = id(req.params.id)
  const email = emailOpcional(req.body?.email)
  const alumno = await prisma.$transaction(async (tx) => {
    const actual = await tx.alumno.findUnique({
      where: { id_alumno: idAlumno },
      select: { nombre: true, apellido: true, dni: true, id_usuario: true },
    })
    if (!actual) throw new HttpError(404, 'Alumno no encontrado')
    if (actual.id_usuario) throw new HttpError(409, 'El alumno ya tiene usuario')
    const usuario = await crearUsuarioAlumno(tx, actual, email)
    return tx.alumno.update({
      where: { id_alumno: idAlumno },
      data: { id_usuario: usuario.id_usuario },
      include: { cursos: cursoResumen, usuarios: usuarioAlumno },
    })
  })
  res.status(201).json(alumno)
})

/**
 * Cambia la contraseña del usuario del alumno. Body: `{ nueva? }`; sin
 * `nueva` la restablece al DNI. No pide la anterior: es una acción del
 * personal administrativo (por ejemplo, si el alumno la olvidó).
 */
alumnosRouter.patch('/:id/password', requireRole(...ROLES_ADMIN), async (req, res) => {
  const idAlumno = id(req.params.id)
  const alumno = await prisma.alumno.findUnique({
    where: { id_alumno: idAlumno },
    select: { dni: true, id_usuario: true, usuarios: { select: { email: true } } },
  })
  if (!alumno) throw new HttpError(404, 'Alumno no encontrado')
  if (!alumno.id_usuario) throw new HttpError(400, 'El alumno no tiene usuario: crealo desde el legajo')

  const alDni = req.body?.nueva === undefined || req.body?.nueva === null || req.body?.nueva === ''
  const nueva = alDni ? alumno.dni : String(req.body.nueva)
  if (!alDni && nueva.length < 6) throw new HttpError(400, 'La contraseña debe tener al menos 6 caracteres')

  await prisma.usuario.update({
    where: { id_usuario: alumno.id_usuario },
    data: { password_hash: await bcrypt.hash(nueva, 10) },
  })
  res.json({ ok: true, email: alumno.usuarios?.email, al_dni: alDni })
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
// DNI, partidas, certificados médicos: datos personales. Los archivos viven en la
// carpeta privada `documentos-alumnos` y se bajan con sesión, como los comprobantes.
// `url_archivo` guarda el nombre del archivo en esa carpeta; los registros viejos que
// apuntan a otro sitio (http…) conservan su enlace.

const esEnlaceExterno = (valor: string) => /^https?:\/\//i.test(valor)

/** Extensiones que el navegador puede mostrar sin riesgo (lo que acepta la subida). */
const MIME_VISIBLE = new Map([
  ['pdf', 'application/pdf'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['webp', 'image/webp'],
  ['avif', 'image/avif'],
  ['heic', 'image/heic'],
])

alumnosRouter.get('/:id/documentos', requireRole(...ROLES_STAFF), async (req, res) => {
  const documentos = await prisma.documentoAlumno.findMany({
    where: { id_alumno: id(req.params.id) },
    orderBy: { fecha_carga: 'desc' },
  })
  // El nombre del archivo en disco no sale de la API; solo el enlace de los documentos externos.
  res.json(
    documentos.map(({ url_archivo, ...d }) => ({ ...d, enlace_externo: esEnlaceExterno(url_archivo) ? url_archivo : null })),
  )
})

alumnosRouter.post('/:id/documentos', requireRole(...ROLES_STAFF), async (req, res) => {
  const idAlumno = id(req.params.id)
  await recibirArchivoPrivado(req, res)
  // Solo fotos o PDF, por su contenido: un HTML subido no puede terminar abierto en la app.
  const archivo = await guardarArchivoPrivado('documentos-alumnos', req.file, 'Seleccioná un archivo (foto o PDF)')
  try {
    const documento = await prisma.documentoAlumno.create({
      data: {
        id_alumno: idAlumno,
        nombre: textOrNull(req.body?.nombre) ?? req.file!.originalname,
        tipo: textOrNull(req.body?.tipo),
        url_archivo: archivo,
      },
    })
    const { url_archivo: _archivo, ...datos } = documento
    res.status(201).json({ ...datos, enlace_externo: null })
  } catch (err) {
    await borrarArchivoPrivado('documentos-alumnos', archivo)
    throw err
  }
})

/** Descarga el archivo de un documento con sesión (los mismos roles que ven el legajo). */
alumnosRouter.get('/documentos/:idDocumento/archivo', requireRole(...ROLES_STAFF), async (req, res, next) => {
  const documento = await prisma.documentoAlumno.findUnique({
    where: { id_documento: id(req.params.idDocumento) },
    select: { url_archivo: true },
  })
  if (!documento) throw new HttpError(404, 'Documento no encontrado')
  if (esEnlaceExterno(documento.url_archivo)) throw new HttpError(404, 'Este documento es un enlace a otro sitio')
  const ruta = rutaArchivoPrivado('documentos-alumnos', documento.url_archivo)
  if (!ruta) throw new HttpError(404, 'El archivo del documento no está disponible')

  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  // Un archivo viejo de otro tipo (subido antes de este control) se baja, nunca se abre en el navegador.
  const ext = documento.url_archivo.split('.').pop()?.toLowerCase() ?? ''
  const mime = MIME_VISIBLE.get(ext)
  if (mime) res.type(mime)
  else res.type('application/octet-stream').attachment()
  res.sendFile(ruta, (err: Error | undefined) => {
    if (err) next(new HttpError(404, 'El archivo del documento no está disponible'))
  })
})

alumnosRouter.delete('/documentos/:idDocumento', requireRole(...ROLES_STAFF), async (req, res) => {
  const documento = await prisma.documentoAlumno.delete({
    where: { id_documento: id(req.params.idDocumento) },
  })
  if (!esEnlaceExterno(documento.url_archivo)) await borrarArchivoPrivado('documentos-alumnos', documento.url_archivo)
  res.status(204).end()
})
