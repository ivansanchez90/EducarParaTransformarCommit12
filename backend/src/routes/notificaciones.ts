import { Router } from 'express'
import { id, numOrNull } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'

export const notificacionesRouter = Router()
notificacionesRouter.use(requireAuth)

notificacionesRouter.get('/', async (req, res) => {
  const notificaciones = await prisma.notificacion.findMany({
    where: { id_usuario_destino: req.user!.id_usuario },
    orderBy: { fecha_envio: 'desc' },
    take: Math.min(numOrNull(req.query.limit) ?? 20, 100),
  })
  res.json(notificaciones)
})

notificacionesRouter.patch('/leidas', async (req, res) => {
  const { count } = await prisma.notificacion.updateMany({
    where: { id_usuario_destino: req.user!.id_usuario, leida: false },
    data: { leida: true },
  })
  res.json({ actualizadas: count })
})

notificacionesRouter.patch('/:id/leida', async (req, res) => {
  // updateMany con el destinatario en el filtro: nadie marca notificaciones ajenas.
  const { count } = await prisma.notificacion.updateMany({
    where: { id_notificacion: id(req.params.id), id_usuario_destino: req.user!.id_usuario },
    data: { leida: true },
  })
  res.json({ actualizadas: count })
})
