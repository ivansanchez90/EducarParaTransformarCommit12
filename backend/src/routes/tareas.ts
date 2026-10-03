/**
 * Ejecución a mano de las tareas programadas (administración): hacen lo mismo
 * que el cron, para probarlas o para reintentar sin esperar a la próxima vuelta.
 */
import { Router } from 'express'
import { ROLES_ADMIN, requireAuth, requireRole } from '../middleware/auth.js'
import { enviarAvisoDeuda } from '../jobs/avisoDeuda.js'
import { enviarFinDeMes } from '../jobs/emailFinDeMes.js'
import { crearPeriodo } from '../services/facturacion/periodo.js'

export const tareasRouter = Router()
tareasRouter.use(requireAuth, requireRole(...ROLES_ADMIN))

/**
 * `{ anio, mes }` del período facturado (el cron del 30/10 manda noviembre):
 * emite las facturas que falten y manda el email a las familias que todavía no
 * lo recibieron.
 */
tareasRouter.post('/recordatorio-mensual', async (req, res) => {
  const { anio, mes } = crearPeriodo(Number(req.body?.anio), Number(req.body?.mes))
  res.json(await enviarFinDeMes(anio, mes))
})

/**
 * `{ anio, mes }` del aviso: avisa a las familias con facturas vencidas al día
 * 20 de ese mes y que todavía no recibieron el aviso.
 */
tareasRouter.post('/aviso-deuda', async (req, res) => {
  const { anio, mes } = crearPeriodo(Number(req.body?.anio), Number(req.body?.mes))
  res.json(await enviarAvisoDeuda(anio, mes))
})
