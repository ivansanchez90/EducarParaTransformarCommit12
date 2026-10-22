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
import {
  assertVeSaludDe,
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
  await alumnoDe(idAlumno)
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
  res.status(201).json(atencion)
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

/** Lo que ve un docente: solo las alergias críticas y el contacto de emergencia. */
async function resumen(req: Request, res: Response) {
  const idAlumno = id(req.params.id)
  if (!veResumenDeSalud(usuarioDe(req))) throw new HttpError(403, 'No tenés permisos para ver el resumen de salud')
  const [alumno, ficha] = await Promise.all([alumnoDe(idAlumno), prisma.fichaMedica.findUnique({ where: { id_alumno: idAlumno }, select: { alergias_criticas: true } })])
  res.json({
    id_alumno: alumno.id_alumno,
    alergias_criticas: ficha?.alergias_criticas ?? null,
    nombre_contacto_emergencia: alumno.nombre_contacto_emergencia,
    telefono_emergencia: alumno.telefono_emergencia,
    ficha_cargada: ficha !== null,
  })
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

