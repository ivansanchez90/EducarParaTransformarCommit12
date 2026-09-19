/**
 * Reservas de instalaciones con control de solapamiento horario.
 */
import { Router } from 'express'
import { HttpError, fecha, hora, hoyISO, id, textOrNull } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { nombreApellido } from '../lib/selects.js'
import { ROLES_ADMIN, ROLES_STAFF, requireAuth, requireRole } from '../middleware/auth.js'

export const instalacionesRouter = Router()
instalacionesRouter.use(requireAuth, requireRole(...ROLES_STAFF))

instalacionesRouter.get('/', async (_req, res) => {
  const instalaciones = await prisma.instalacion.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } })
  res.json(instalaciones)
})

export const reservasRouter = Router()
reservasRouter.use(requireAuth, requireRole(...ROLES_STAFF))

/** Reservas desde hoy en adelante. */
reservasRouter.get('/', async (_req, res) => {
  const reservas = await prisma.reservaInstalacion.findMany({
    where: { fecha: { gte: fecha(hoyISO())! } },
    include: { instalaciones: { select: { nombre: true } }, usuarios: nombreApellido },
    orderBy: [{ fecha: 'asc' }, { hora_inicio: 'asc' }],
  })
  res.json(reservas)
})

reservasRouter.post('/', async (req, res) => {
  const body = req.body ?? {}
  const idInstalacion = id(body.id_instalacion)
  const dia = fecha(body.fecha)
  if (!dia) throw new HttpError(400, 'Falta la fecha')
  const inicio = hora(body.hora_inicio)
  const fin = hora(body.hora_fin)
  if (fin <= inicio) throw new HttpError(400, 'La hora de fin debe ser posterior a la de inicio')

  const reserva = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM instalaciones WHERE id_instalacion = ${idInstalacion} FOR UPDATE`
    const solapada = await tx.reservaInstalacion.findFirst({
      where: {
        id_instalacion: idInstalacion,
        fecha: dia,
        hora_inicio: { lt: fin },
        hora_fin: { gt: inicio },
      },
      select: { id_reserva: true },
    })
    if (solapada) throw new HttpError(409, 'La instalación ya está reservada en ese horario')
    return tx.reservaInstalacion.create({
      data: {
        id_instalacion: idInstalacion,
        fecha: dia,
        hora_inicio: inicio,
        hora_fin: fin,
        motivo: textOrNull(body.motivo),
        reservado_por: req.user!.id_usuario,
      },
    })
  })
  res.status(201).json(reserva)
})

/** Cualquier miembro del personal puede cancelar sus reservas; la dirección, todas. */
reservasRouter.delete('/:id', async (req, res) => {
  const reserva = await prisma.reservaInstalacion.findUnique({
    where: { id_reserva: id(req.params.id) },
    select: { id_reserva: true, reservado_por: true },
  })
  if (!reserva) throw new HttpError(404, 'Reserva no encontrada')
  if (!ROLES_ADMIN.includes(req.user!.rol) && reserva.reservado_por !== req.user!.id_usuario) {
    throw new HttpError(403, 'Solo podés cancelar tus propias reservas')
  }
  await prisma.reservaInstalacion.delete({ where: { id_reserva: reserva.id_reserva } })
  res.status(204).end()
})
