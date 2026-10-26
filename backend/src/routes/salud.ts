/**
 * Salud y enfermería: ficha médica, atenciones y auditoría.
 *
 * - Enfermero, Admin y Directivo: ven y cargan todo.
 * - La familia: solo la ficha y las atenciones de sus hijos, en lectura.
 * - El docente: solo el resumen (alergias críticas y contacto de emergencia).
 *
 * Las atenciones no se borran, se corrigen; cada alta y cada corrección quedan en la auditoría.
 */
import { Router } from 'express'
import type { Request, Response } from 'express'
import { HttpError, id, textOrNull } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { cursoResumen } from '../lib/selects.js'
import { ROLES_SALUD, requireRole } from '../middleware/auth.js'
import type { UsuarioAuth } from '../middleware/auth.js'
import { asincrono, conSesion } from '../middleware/envoltorios.js'
import { aTexto, estadoAptitud, hoyComoFecha, validarCertificado } from '../services/aptitud.js'
import {
  assertVeSaludDe,
  avisarAtencion,
  diferencias,
  registrarAuditoria,
  validarAtencion,
  validarFicha,
  veResumenDeSalud,
} from '../services/salud.js'

export const saludRouter = Router()
saludRouter.use(conSesion)

function usuarioDe(req: Request): UsuarioAuth {
  if (!req.user) throw new HttpError(401, 'No autenticado')
  return req.user
}

/** Los datos del alumno que acompañan a la ficha. 404 si no existe. */
async function alumnoDe(idAlumno: number) {
  const alumno = await prisma.alumno.findUnique({
    where: { id_alumno: idAlumno },
    select: {
      id_alumno: true,
      nombre: true,
      apellido: true,
      dni: true,
      fecha_nacimiento: true,
      obra_social: true,
      nro_obra_social: true,
      telefono_emergencia: true,
      nombre_contacto_emergencia: true,
      cursos: cursoResumen,
    },
  })
  if (!alumno) throw new HttpError(404, 'Alumno no encontrado')
  return alumno
}

// ── Búsqueda de alumnos ────────────────────────────────────────

/** Alumnos activos para elegir a quién abrirle la ficha, con ?buscar= por nombre, apellido o DNI. */
async function buscarAlumnos(req: Request, res: Response) {
  const buscar = textOrNull(req.query.buscar)
  const alumnos = await prisma.alumno.findMany({
    where: {
      activo: true,
      ...(buscar
        ? { OR: [{ nombre: { contains: buscar, mode: 'insensitive' } }, { apellido: { contains: buscar, mode: 'insensitive' } }, { dni: { contains: buscar } }] }
        : {}),
    },
    select: {
      id_alumno: true,
      nombre: true,
      apellido: true,
      dni: true,
      cursos: cursoResumen,
      ficha_medica: { select: { alergias_criticas: true } },
      atenciones_enfermeria: { select: { fecha_hora: true }, orderBy: { fecha_hora: 'desc' }, take: 1 },
    },
    orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
    take: 100,
  })
  res.json(
    alumnos.map(({ ficha_medica, atenciones_enfermeria, ...a }) => ({
      ...a,
      tiene_ficha: ficha_medica !== null,
      tiene_alergias_criticas: Boolean(ficha_medica?.alergias_criticas),
      ultima_atencion: atenciones_enfermeria[0]?.fecha_hora ?? null,
    })),
  )
}

// ── Ficha médica ───────────────────────────────────────────────

async function verFicha(req: Request, res: Response) {
  const idAlumno = id(req.params.id)
  await assertVeSaludDe(usuarioDe(req), idAlumno)
  const [alumno, ficha] = await Promise.all([alumnoDe(idAlumno), prisma.fichaMedica.findUnique({ where: { id_alumno: idAlumno } })])
  res.json({ alumno, ficha })
}

/** Crea la ficha o la modifica. Si no cambió nada no toca la base ni deja auditoría. */
async function guardarFicha(req: Request, res: Response) {
  const usuario = usuarioDe(req)
  const idAlumno = id(req.params.id)
  await alumnoDe(idAlumno)
  const datos = validarFicha(req.body)

  const ficha = await prisma.$transaction(async (tx) => {
    const actual = await tx.fichaMedica.findUnique({ where: { id_alumno: idAlumno } })
    if (!actual) {
      const creada = await tx.fichaMedica.create({ data: { id_alumno: idAlumno, ...datos } })
      await registrarAuditoria(tx, {
        idAlumno,
        entidad: 'Ficha médica',
        idRegistro: creada.id_ficha,
        accion: 'Alta',
        cambios: diferencias({}, datos),
        idUsuario: usuario.id_usuario,
      })
      return creada
    }
    const cambios = diferencias(actual, datos)
    if (Object.keys(cambios).length === 0) return actual
    const modificada = await tx.fichaMedica.update({ where: { id_ficha: actual.id_ficha }, data: datos })
    await registrarAuditoria(tx, { idAlumno, entidad: 'Ficha médica', idRegistro: actual.id_ficha, accion: 'Modificación', cambios, idUsuario: usuario.id_usuario })
    return modificada
  })
  res.json(ficha)
}

// ── Atenciones ─────────────────────────────────────────────────

const incluirQuienRegistra = { registra: { select: { nombre: true, apellido: true } } } as const

async function listarAtenciones(req: Request, res: Response) {
  const idAlumno = id(req.params.id)
  await assertVeSaludDe(usuarioDe(req), idAlumno)
  const atenciones = await prisma.atencionEnfermeria.findMany({
    where: { id_alumno: idAlumno },
    include: incluirQuienRegistra,
    orderBy: [{ fecha_hora: 'desc' }, { id_atencion: 'desc' }],
  })
  res.json(atenciones.map(({ registra, ...a }) => ({ ...a, registrada_por: registra ? `${registra.apellido}, ${registra.nombre}` : null })))
}

async function registrarAtencion(req: Request, res: Response) {
  const usuario = usuarioDe(req)
  const idAlumno = id(req.params.id)
  const alumno = await alumnoDe(idAlumno)
  const { fecha_hora, ...resto } = validarAtencion(req.body)

  const atencion = await prisma.$transaction(async (tx) => {
    const creada = await tx.atencionEnfermeria.create({
      data: { id_alumno: idAlumno, ...resto, ...(fecha_hora ? { fecha_hora } : {}), id_usuario_registra: usuario.id_usuario },
    })
    await registrarAuditoria(tx, {
      idAlumno,
      entidad: 'Atención',
      idRegistro: creada.id_atencion,
      accion: 'Alta',
      cambios: diferencias({}, resto),
      idUsuario: usuario.id_usuario,
    })
    return creada
  })
  // La atención ya está guardada: el aviso a la familia va aparte y, si falla, no la deshace.
  const familiaAvisada = await avisarAtencion(atencion, alumno)
  res.status(201).json({ ...atencion, familia_avisada: familiaAvisada })
}

/** Corrige motivo, descripción, tratamiento o fecha de una atención. Sin cambios, no deja auditoría. */
async function corregirAtencion(req: Request, res: Response) {
  const usuario = usuarioDe(req)
  const idAtencion = id(req.params.id)
  const { fecha_hora, ...resto } = validarAtencion(req.body)

  const atencion = await prisma.$transaction(async (tx) => {
    const actual = await tx.atencionEnfermeria.findUnique({ where: { id_atencion: idAtencion } })
    if (!actual) throw new HttpError(404, 'Atención no encontrada')
    const nuevos = { ...resto, ...(fecha_hora ? { fecha_hora } : {}) }
    const cambios = diferencias(actual, nuevos)
    if (Object.keys(cambios).length === 0) return actual
    const modificada = await tx.atencionEnfermeria.update({ where: { id_atencion: idAtencion }, data: nuevos })
    await registrarAuditoria(tx, { idAlumno: actual.id_alumno, entidad: 'Atención', idRegistro: idAtencion, accion: 'Modificación', cambios, idUsuario: usuario.id_usuario })
    return modificada
  })
  res.json(atencion)
}

// ── Auditoría y resumen ────────────────────────────────────────

async function verAuditoria(req: Request, res: Response) {
  const idAlumno = id(req.params.id)
  await alumnoDe(idAlumno)
  const filas = await prisma.auditoriaSalud.findMany({
    where: { id_alumno: idAlumno },
    include: { usuarios: { select: { nombre: true, apellido: true, rol: true } } },
    orderBy: [{ fecha_hora: 'desc' }, { id_auditoria: 'desc' }],
    take: 200,
  })
  res.json(
    filas.map(({ usuarios, ...f }) => ({
      ...f,
      usuario: usuarios ? `${usuarios.apellido}, ${usuarios.nombre}` : null,
      rol: usuarios?.rol ?? null,
    })),
  )
}

/** Lo que ve un docente: las alergias críticas, si la aptitud física está al día y el contacto de emergencia. */
async function resumen(req: Request, res: Response) {
  const idAlumno = id(req.params.id)
  if (!veResumenDeSalud(usuarioDe(req))) throw new HttpError(403, 'No tenés permisos para ver el resumen de salud')
  const [alumno, ficha, certificados] = await Promise.all([
    alumnoDe(idAlumno),
    prisma.fichaMedica.findUnique({ where: { id_alumno: idAlumno }, select: { alergias_criticas: true } }),
    prisma.certificadoAptitud.findMany({ where: { id_alumno: idAlumno }, select: { fecha_vencimiento: true } }),
  ])
  const { estado, vigente_hasta } = estadoAptitud(certificados, hoyComoFecha())
  res.json({
    id_alumno: alumno.id_alumno,
    alergias_criticas: ficha?.alergias_criticas ?? null,
    aptitud_fisica: { estado, vigente_hasta },
    nombre_contacto_emergencia: alumno.nombre_contacto_emergencia,
    telefono_emergencia: alumno.telefono_emergencia,
    ficha_cargada: ficha !== null,
  })
}

// ── Certificado de aptitud física ──────────────────────────────

/** Los certificados del alumno, del que vence más tarde al más viejo, y el estado de su aptitud. */
async function verAptitud(req: Request, res: Response) {
  const idAlumno = id(req.params.id)
  await assertVeSaludDe(usuarioDe(req), idAlumno)
  await alumnoDe(idAlumno)
  const certificados = await prisma.certificadoAptitud.findMany({
    where: { id_alumno: idAlumno },
    include: { registra: { select: { nombre: true, apellido: true } } },
    orderBy: [{ fecha_vencimiento: 'desc' }, { id_certificado: 'desc' }],
  })
  res.json({
    aptitud: estadoAptitud(certificados, hoyComoFecha()),
    certificados: certificados.map(({ registra, ...c }) => ({ ...c, registrado_por: registra ? `${registra.apellido}, ${registra.nombre}` : null })),
  })
}

/** Dos certificados emitidos el mismo día para el mismo alumno son un error de carga. */
async function assertSinCertificadoDelDia(idAlumno: number, emision: Date, salvo?: number) {
  const repetido = await prisma.certificadoAptitud.findFirst({
    where: { id_alumno: idAlumno, fecha_emision: emision, ...(salvo ? { NOT: { id_certificado: salvo } } : {}) },
    select: { id_certificado: true },
  })
  if (repetido) throw new HttpError(409, `El alumno ya tiene un certificado emitido el ${aTexto(emision).split('-').reverse().join('/')}`)
}

/** Lo que se guarda en la auditoría de un certificado: las fechas como texto, no como instantes. */
const datosAuditados = (c: { fecha_emision: Date; fecha_vencimiento: Date; observaciones: string | null }) => ({
  fecha_emision: aTexto(c.fecha_emision),
  fecha_vencimiento: aTexto(c.fecha_vencimiento),
  observaciones: c.observaciones,
})

async function cargarCertificado(req: Request, res: Response) {
  const usuario = usuarioDe(req)
  const idAlumno = id(req.params.id)
  await alumnoDe(idAlumno)
  const datos = validarCertificado(req.body, hoyComoFecha())
  await assertSinCertificadoDelDia(idAlumno, datos.fecha_emision)

  const certificado = await prisma.$transaction(async (tx) => {
    const creado = await tx.certificadoAptitud.create({ data: { id_alumno: idAlumno, ...datos, id_usuario_registra: usuario.id_usuario } })
    await registrarAuditoria(tx, {
      idAlumno,
      entidad: 'Certificado de aptitud',
      idRegistro: creado.id_certificado,
      accion: 'Alta',
      cambios: diferencias({}, datosAuditados(datos)),
      idUsuario: usuario.id_usuario,
    })
    return creado
  })
  res.status(201).json(certificado)
}

/** Corrige la fecha de emisión (el vencimiento se vuelve a calcular) o las observaciones de un certificado. */
async function corregirCertificado(req: Request, res: Response) {
  const usuario = usuarioDe(req)
  const idCertificado = id(req.params.id)
  const datos = validarCertificado(req.body, hoyComoFecha())

  const actual = await prisma.certificadoAptitud.findUnique({ where: { id_certificado: idCertificado } })
  if (!actual) throw new HttpError(404, 'Certificado no encontrado')
  await assertSinCertificadoDelDia(actual.id_alumno, datos.fecha_emision, idCertificado)

  const certificado = await prisma.$transaction(async (tx) => {
    const cambios = diferencias(datosAuditados(actual), datosAuditados(datos))
    if (Object.keys(cambios).length === 0) return actual
    const modificado = await tx.certificadoAptitud.update({ where: { id_certificado: idCertificado }, data: datos })
    await registrarAuditoria(tx, { idAlumno: actual.id_alumno, entidad: 'Certificado de aptitud', idRegistro: idCertificado, accion: 'Modificación', cambios, idUsuario: usuario.id_usuario })
    return modificado
  })
  res.json(certificado)
}

/**
 * Alumnos activos inscriptos a algún deporte sin certificado vigente. La inscripción no se les da de baja: enfermería
 * los regulariza con esta lista.
 */
async function pendientesDeAptitud(_req: Request, res: Response) {
  const hoy = hoyComoFecha()
  const alumnos = await prisma.alumno.findMany({
    where: {
      activo: true,
      inscripciones_actividades: { some: { actividades_extracurriculares: { tipo: 'Deporte' } } },
      certificados_aptitud: { none: { fecha_vencimiento: { gte: hoy } } },
    },
    select: {
      id_alumno: true,
      nombre: true,
      apellido: true,
      dni: true,
      cursos: cursoResumen,
      inscripciones_actividades: { where: { actividades_extracurriculares: { tipo: 'Deporte' } }, select: { actividades_extracurriculares: { select: { nombre: true } } } },
      certificados_aptitud: { select: { fecha_vencimiento: true }, orderBy: { fecha_vencimiento: 'desc' }, take: 1 },
    },
    orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
  })
  res.json(
    alumnos.map(({ inscripciones_actividades, certificados_aptitud, ...a }) => ({
      ...a,
      deportes: inscripciones_actividades.map((i) => i.actividades_extracurriculares.nombre),
      ...estadoAptitud(certificados_aptitud, hoy),
    })),
  )
}

const soloSalud = requireRole(...ROLES_SALUD)

saludRouter.get('/alumnos', soloSalud, asincrono(buscarAlumnos))
saludRouter.get('/alumnos/:id/ficha', asincrono(verFicha))
saludRouter.put('/alumnos/:id/ficha', soloSalud, asincrono(guardarFicha))
saludRouter.get('/alumnos/:id/atenciones', asincrono(listarAtenciones))
saludRouter.post('/alumnos/:id/atenciones', soloSalud, asincrono(registrarAtencion))
saludRouter.put('/atenciones/:id', soloSalud, asincrono(corregirAtencion))
saludRouter.get('/alumnos/:id/auditoria', soloSalud, asincrono(verAuditoria))
saludRouter.get('/alumnos/:id/resumen', asincrono(resumen))
saludRouter.get('/aptitud/pendientes', soloSalud, asincrono(pendientesDeAptitud))
saludRouter.get('/alumnos/:id/aptitud', asincrono(verAptitud))
saludRouter.post('/alumnos/:id/aptitud', soloSalud, asincrono(cargarCertificado))
saludRouter.put('/aptitud/:id', soloSalud, asincrono(corregirCertificado))

