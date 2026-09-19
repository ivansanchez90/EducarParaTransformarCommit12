/**
 * Contenido del sitio público y formularios de la web: noticias, galería,
 * empleos, postulaciones, preinscripciones y mensajes de contacto.
 *
 * Las rutas `/publicas` y los POST de formularios no requieren sesión.
 */
import { Router } from 'express'
import { HttpError, bool, fecha, id, numOrNull, textOrNull } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { ROLES_ADMIN, requireAuth, requireRole } from '../middleware/auth.js'
import { borrarArchivo, uploader, urlPublica } from '../middleware/upload.js'
import { notificarFamilias } from '../services/notificaciones.js'

const soloAdmin = [requireAuth, requireRole(...ROLES_ADMIN)]
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function obligatorio(valor: unknown, campo: string): string {
  const s = textOrNull(valor)
  if (!s) throw new HttpError(400, `El campo ${campo} es obligatorio`)
  return s
}

function email(valor: unknown): string {
  const s = obligatorio(valor, 'email')
  if (!EMAIL_RE.test(s)) throw new HttpError(400, 'Email inválido')
  return s
}

// ── Noticias ───────────────────────────────────────────────────

export const noticiasRouter = Router()

noticiasRouter.get('/publicas', async (req, res) => {
  const noticias = await prisma.noticia.findMany({
    where: { activo: true },
    select: { id_noticia: true, titulo: true, resumen: true, url_imagen: true, fecha_publicacion: true, destacada: true },
    orderBy: [{ fecha_publicacion: 'desc' }, { id_noticia: 'desc' }],
    take: Math.min(numOrNull(req.query.limit) ?? 6, 50),
  })
  res.json(noticias)
})

noticiasRouter.get('/publicas/:id', async (req, res) => {
  const noticia = await prisma.noticia.findFirst({
    where: { id_noticia: id(req.params.id), activo: true },
    select: {
      id_noticia: true,
      titulo: true,
      resumen: true,
      contenido: true,
      url_imagen: true,
      fecha_publicacion: true,
      destacada: true,
    },
  })
  if (!noticia) throw new HttpError(404, 'Noticia no encontrada')
  res.json(noticia)
})

noticiasRouter.get('/', ...soloAdmin, async (_req, res) => {
  const noticias = await prisma.noticia.findMany({
    orderBy: [{ fecha_publicacion: 'desc' }, { id_noticia: 'desc' }],
  })
  res.json(noticias)
})

/**
 * Publica una noticia (multipart/form-data). La imagen puede venir como
 * archivo (`imagen`) o como URL externa (`url_imagen`). Con `notificar=true`
 * se envía un comunicado a las familias de todos los alumnos activos.
 */
noticiasRouter.post('/', ...soloAdmin, uploader('noticias', { soloImagenes: true }).single('imagen'), async (req, res) => {
  const body = req.body ?? {}
  const urlImagen = req.file ? urlPublica('noticias', req.file.filename) : textOrNull(body.url_imagen)
  let noticia
  try {
    noticia = await prisma.noticia.create({
      data: {
        titulo: obligatorio(body.titulo, 'título'),
        resumen: textOrNull(body.resumen),
        contenido: textOrNull(body.contenido) ?? '',
        url_imagen: urlImagen,
        destacada: body.destacada === 'true' || body.destacada === true,
        id_autor: req.user!.id_usuario,
      },
    })
  } catch (err) {
    if (req.file) await borrarArchivo(urlImagen)
    throw err
  }

  let notificados = 0
  if (body.notificar === 'true' || body.notificar === true) {
    const alumnos = await prisma.alumno.findMany({ where: { activo: true }, select: { id_alumno: true } })
    notificados = await notificarFamilias(
      alumnos.map((a) => ({ id_alumno: a.id_alumno, titulo: 'Comunicado institucional', mensaje: noticia.titulo })),
      'Novedad',
    )
  }
  res.status(201).json({ ...noticia, notificados })
})

noticiasRouter.patch('/:id', ...soloAdmin, async (req, res) => {
  const { activo, destacada } = req.body ?? {}
  const noticia = await prisma.noticia.update({
    where: { id_noticia: id(req.params.id) },
    data: {
      activo: typeof activo === 'boolean' ? activo : undefined,
      destacada: typeof destacada === 'boolean' ? destacada : undefined,
    },
  })
  res.json(noticia)
})

noticiasRouter.delete('/:id', ...soloAdmin, async (req, res) => {
  const noticia = await prisma.noticia.delete({ where: { id_noticia: id(req.params.id) } })
  await borrarArchivo(noticia.url_imagen)
  res.status(204).end()
})

// ── Galería ────────────────────────────────────────────────────

export const galeriaRouter = Router()

galeriaRouter.get('/publica', async (req, res) => {
  const imagenes = await prisma.galeria.findMany({
    where: { activo: true },
    select: { id_imagen: true, titulo: true, url_imagen: true, categoria: true },
    orderBy: { fecha_subida: 'desc' },
    take: Math.min(numOrNull(req.query.limit) ?? 8, 50),
  })
  res.json(imagenes)
})

galeriaRouter.get('/', ...soloAdmin, async (_req, res) => {
  const imagenes = await prisma.galeria.findMany({ orderBy: { fecha_subida: 'desc' } })
  res.json(imagenes)
})

galeriaRouter.post('/', ...soloAdmin, uploader('galeria', { soloImagenes: true }).single('imagen'), async (req, res) => {
  const body = req.body ?? {}
  const urlImagen = req.file ? urlPublica('galeria', req.file.filename) : textOrNull(body.url_imagen)
  if (!urlImagen) throw new HttpError(400, 'Debes seleccionar un archivo de imagen o ingresar una URL externa.')
  try {
    const imagen = await prisma.galeria.create({
      data: {
        titulo: textOrNull(body.titulo),
        descripcion: textOrNull(body.descripcion),
        categoria: textOrNull(body.categoria),
        url_imagen: urlImagen,
        id_autor: req.user!.id_usuario,
      },
    })
    res.status(201).json(imagen)
  } catch (err) {
    if (req.file) await borrarArchivo(urlImagen)
    throw err
  }
})

galeriaRouter.patch('/:id', ...soloAdmin, async (req, res) => {
  const imagen = await prisma.galeria.update({
    where: { id_imagen: id(req.params.id) },
    data: { activo: typeof req.body?.activo === 'boolean' ? req.body.activo : undefined },
  })
  res.json(imagen)
})

galeriaRouter.delete('/:id', ...soloAdmin, async (req, res) => {
  const imagen = await prisma.galeria.delete({ where: { id_imagen: id(req.params.id) } })
  await borrarArchivo(imagen.url_imagen)
  res.status(204).end()
})

// ── Empleos ────────────────────────────────────────────────────

export const empleosRouter = Router()

empleosRouter.get('/publicos', async (req, res) => {
  const empleos = await prisma.empleo.findMany({
    where: { activo: true },
    select: {
      id_empleo: true,
      titulo: true,
      descripcion: true,
      area: true,
      requisitos: true,
      tipo_contrato: true,
      fecha_publicacion: true,
      fecha_cierre: true,
    },
    orderBy: [{ fecha_publicacion: 'desc' }, { id_empleo: 'desc' }],
    take: Math.min(numOrNull(req.query.limit) ?? 6, 50),
  })
  res.json(empleos)
})

empleosRouter.get('/', ...soloAdmin, async (req, res) => {
  const empleos = await prisma.empleo.findMany({
    where: { activo: bool(req.query.activo) },
    orderBy: [{ fecha_publicacion: 'desc' }, { id_empleo: 'desc' }],
  })
  res.json(empleos)
})

empleosRouter.post('/', ...soloAdmin, async (req, res) => {
  const body = req.body ?? {}
  const empleo = await prisma.empleo.create({
    data: {
      titulo: obligatorio(body.titulo, 'título'),
      descripcion: textOrNull(body.descripcion) ?? '',
      area: textOrNull(body.area),
      requisitos: textOrNull(body.requisitos),
      tipo_contrato: textOrNull(body.tipo_contrato),
      fecha_cierre: fecha(body.fecha_cierre),
      id_autor: req.user!.id_usuario,
    },
  })
  res.status(201).json(empleo)
})

empleosRouter.patch('/:id', ...soloAdmin, async (req, res) => {
  const empleo = await prisma.empleo.update({
    where: { id_empleo: id(req.params.id) },
    data: { activo: typeof req.body?.activo === 'boolean' ? req.body.activo : undefined },
  })
  res.json(empleo)
})

empleosRouter.delete('/:id', ...soloAdmin, async (req, res) => {
  await prisma.empleo.delete({ where: { id_empleo: id(req.params.id) } })
  res.status(204).end()
})

// ── Postulaciones a empleos ────────────────────────────────────

export const postulacionesRouter = Router()

postulacionesRouter.post('/', async (req, res) => {
  const body = req.body ?? {}
  const idEmpleo = id(body.id_empleo)
  const empleo = await prisma.empleo.findFirst({ where: { id_empleo: idEmpleo, activo: true }, select: { id_empleo: true } })
  if (!empleo) throw new HttpError(404, 'La oferta de empleo no existe o ya no está activa')
  const postulacion = await prisma.postulacion.create({
    data: {
      id_empleo: idEmpleo,
      nombre: obligatorio(body.nombre, 'nombre'),
      apellido: obligatorio(body.apellido, 'apellido'),
      email: email(body.email),
      telefono: textOrNull(body.telefono),
      mensaje: textOrNull(body.mensaje),
    },
  })
  res.status(201).json({ id_postulacion: postulacion.id_postulacion })
})

postulacionesRouter.get('/', ...soloAdmin, async (_req, res) => {
  const postulaciones = await prisma.postulacion.findMany({
    include: { empleos: { select: { titulo: true, area: true } } },
    orderBy: { fecha_postulacion: 'desc' },
  })
  res.json(postulaciones)
})

postulacionesRouter.patch('/:id', ...soloAdmin, async (req, res) => {
  const postulacion = await prisma.postulacion.update({
    where: { id_postulacion: id(req.params.id) },
    data: { estado: obligatorio(req.body?.estado, 'estado') },
  })
  res.json(postulacion)
})

// ── Preinscripciones online ────────────────────────────────────

export const inscripcionesRouter = Router()

inscripcionesRouter.post('/', async (req, res) => {
  const body = req.body ?? {}
  const nacimiento = fecha(body.fecha_nacimiento_aspirante)
  if (nacimiento && nacimiento > new Date()) throw new HttpError(400, 'La fecha de nacimiento no puede ser futura')
  const inscripcion = await prisma.inscripcion.create({
    data: {
      nombre_aspirante: obligatorio(body.nombre_aspirante, 'nombre del aspirante'),
      apellido_aspirante: textOrNull(body.apellido_aspirante),
      fecha_nacimiento_aspirante: nacimiento,
      dni_aspirante: obligatorio(body.dni_aspirante, 'DNI del aspirante'),
      nombre_tutor: obligatorio(body.nombre_tutor, 'nombre del tutor'),
      email_tutor: email(body.email_tutor),
      telefono_tutor: textOrNull(body.telefono_tutor),
      nivel_solicitado: obligatorio(body.nivel_solicitado, 'nivel solicitado'),
      grado_anio_solicitado: textOrNull(body.grado_anio_solicitado),
    },
  })
  res.status(201).json({ id_inscripcion: inscripcion.id_inscripcion })
})

inscripcionesRouter.get('/', ...soloAdmin, async (_req, res) => {
  const inscripciones = await prisma.inscripcion.findMany({ orderBy: { fecha_solicitud: 'desc' } })
  res.json(inscripciones)
})

inscripcionesRouter.patch('/:id', ...soloAdmin, async (req, res) => {
  const inscripcion = await prisma.inscripcion.update({
    where: { id_inscripcion: id(req.params.id) },
    data: {
      estado: req.body?.estado !== undefined ? obligatorio(req.body.estado, 'estado') : undefined,
      observaciones: req.body?.observaciones !== undefined ? textOrNull(req.body.observaciones) : undefined,
      documentacion_completa:
        typeof req.body?.documentacion_completa === 'boolean' ? req.body.documentacion_completa : undefined,
    },
  })
  res.json(inscripcion)
})

// ── Mensajes de contacto ───────────────────────────────────────

export const mensajesRouter = Router()

mensajesRouter.post('/', async (req, res) => {
  const body = req.body ?? {}
  const mensaje = await prisma.mensajeContacto.create({
    data: {
      nombre: obligatorio(body.nombre, 'nombre'),
      email: email(body.email),
      mensaje: obligatorio(body.mensaje, 'mensaje'),
    },
  })
  res.status(201).json({ id_mensaje: mensaje.id_mensaje })
})

mensajesRouter.get('/', ...soloAdmin, async (_req, res) => {
  const mensajes = await prisma.mensajeContacto.findMany({ orderBy: { fecha_envio: 'desc' } })
  res.json(mensajes)
})

mensajesRouter.patch('/:id', ...soloAdmin, async (req, res) => {
  const mensaje = await prisma.mensajeContacto.update({
    where: { id_mensaje: id(req.params.id) },
    data: { leido: Boolean(req.body?.leido) },
  })
  res.json(mensaje)
})
