/**
 * Endpoints del portal de familias para facturas, pagos y comprobantes. Cada ruta
 * lleva su propio `requireAuth` y el prefijo completo, porque el router se monta
 * en `/api`, junto a otros que comparten recursos (por ejemplo `/api/comprobantes`).
 */
import { Router } from 'express'
import { HttpError, id } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { ROLES_ADMIN, assertAccesoAlumno, esStaff, requireAuth } from '../middleware/auth.js'
import { rutaArchivoPrivado } from '../middleware/upload.js'

export const portalFinanzasRouter = Router()

/**
 * Descarga el archivo de un comprobante de transferencia. Lo ve la administración
 * o la familia del alumno de la factura; el resto del personal, no.
 */
portalFinanzasRouter.get('/comprobantes/:id/archivo', requireAuth, async (req, res, next) => {
  const usuario = req.user
  if (!usuario) throw new HttpError(401, 'No autenticado')

  const comprobante = await prisma.comprobanteTransferencia.findUnique({
    where: { id_comprobante: id(req.params.id) },
    select: { archivo: true, facturas: { select: { id_alumno: true } } },
  })
  if (!comprobante) throw new HttpError(404, 'Comprobante no encontrado')

  if (!ROLES_ADMIN.includes(usuario.rol)) {
    if (esStaff(usuario)) throw new HttpError(403, 'No tenés permisos para ver comprobantes de pago')
    await assertAccesoAlumno(usuario, comprobante.facturas.id_alumno)
  }

  const ruta = rutaArchivoPrivado('comprobantes', comprobante.archivo)
  if (!ruta) throw new HttpError(404, 'El archivo del comprobante no está disponible')

  // Un comprobante tiene datos bancarios: que ningún caché intermedio lo guarde.
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.sendFile(ruta, (err) => {
    if (err) next(new HttpError(404, 'El archivo del comprobante no está disponible'))
  })
})
