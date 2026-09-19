import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { ROLES_ADMIN, requireAuth, requireRole } from '../middleware/auth.js'

export const dashboardRouter = Router()

dashboardRouter.get('/stats', requireAuth, requireRole(...ROLES_ADMIN), async (_req, res) => {
  const [alumnos, docentes, inscripciones, cuotasPendientes] = await Promise.all([
    prisma.alumno.count({ where: { activo: true } }),
    prisma.docente.count({ where: { activo: true } }),
    prisma.inscripcion.count({ where: { estado: 'Pendiente' } }),
    prisma.cuota.count({ where: { estado: { in: ['Pendiente', 'Vencida', 'En mora'] } } }),
  ])
  res.json({ alumnos, docentes, inscripciones, cuotasPendientes })
})
