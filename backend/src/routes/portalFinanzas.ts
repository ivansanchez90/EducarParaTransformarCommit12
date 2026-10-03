/**
 * Endpoints del portal de familias para facturas, pagos y comprobantes. Cada ruta
 * lleva su propio `requireAuth` y el prefijo completo, porque el router se monta
 * en `/api`, junto a otros que comparten recursos (por ejemplo `/api/comprobantes`).
 */
import { Router } from 'express'
import type { NextFunction, Request, Response } from 'express'
import { HttpError, fecha, hoyISO, id, lista } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { ROLES_ADMIN, assertAccesoAlumno, esStaff, requireAuth } from '../middleware/auth.js'
import type { UsuarioAuth } from '../middleware/auth.js'
import { rutaArchivoPrivado } from '../middleware/upload.js'
import { estadoFactura } from '../services/facturacion/estado.js'
import { crearOrdenPago, idsDeItems, pdfOrdenPago } from '../services/ordenPago.js'

export const portalFinanzasRouter = Router()

/**
 * `requireAuth` es async: se lo envuelve para que Express no reciba una promesa donde
 * espera `void`. Si falla, el error llega al manejador igual que antes.
 */
const conSesion = (req: Request, res: Response, next: NextFunction) => {
  requireAuth(req, res, next).catch(next)
}

type Manejador = (req: Request, res: Response, next: NextFunction) => Promise<void>

/** Lo mismo para los manejadores async de este archivo. */
const asincrono = (manejador: Manejador) => (req: Request, res: Response, next: NextFunction) => {
  manejador(req, res, next).catch(next)
}

function usuarioDe(req: Request): UsuarioAuth {
  if (!req.user) throw new HttpError(401, 'No autenticado')
  return req.user
}

/**
 * Los datos de pagos los ve la administración o la familia del alumno. El resto del
 * personal (los docentes) no: `assertAccesoAlumno` deja pasar a todo el personal.
 */
async function assertVePagosDe(usuario: UsuarioAuth, idAlumno: number) {
  if (ROLES_ADMIN.includes(usuario.rol)) return
  if (esStaff(usuario)) throw new HttpError(403, 'No tenés permisos para ver datos de pagos')
  await assertAccesoAlumno(usuario, idAlumno)
}

/**
 * Facturas de un alumno, de la más reciente a la más antigua, con sus ítems y sus
 * comprobantes de transferencia. El estado se calcula al leerla (saldo y vencimiento).
 * Con ?estado=Pendiente,Vencida solo las que están en esos estados.
 */
async function facturasDelAlumno(req: Request, res: Response) {
  const idAlumno = id(req.params.id)
  await assertVePagosDe(usuarioDe(req), idAlumno)

  const estados = lista(req.query.estado)
  const hoy = fecha(hoyISO()) ?? new Date()
  const facturas = await prisma.factura.findMany({
    where: { id_alumno: idAlumno },
    include: {
      items: { orderBy: { id_item: 'asc' } },
      comprobantes: {
        select: { id_comprobante: true, estado: true, importe: true, fecha_transferencia: true, motivo_rechazo: true },
        orderBy: { id_comprobante: 'asc' },
      },
    },
    orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
  })
  const conEstado = facturas.map((f) => ({
    ...f,
    estado: estadoFactura(
      { total: f.total.toNumber(), saldo: f.saldo.toNumber(), fecha_vencimiento: f.fecha_vencimiento },
      hoy,
    ),
  }))
  res.json(estados ? conEstado.filter((f) => estados.includes(f.estado)) : conEstado)
}

/**
 * Historial de pagos de un alumno, del más reciente al más antiguo: los aprobados
 * desde una factura y los que registró la administración sobre una cuota anterior.
 */
async function pagosDelAlumno(req: Request, res: Response) {
  const idAlumno = id(req.params.id)
  await assertVePagosDe(usuarioDe(req), idAlumno)

  const pagos = await prisma.pago.findMany({
    where: { OR: [{ facturas: { id_alumno: idAlumno } }, { cuotas: { id_alumno: idAlumno } }] },
    select: {
      id_pago: true,
      fecha_pago: true,
      monto_pagado: true,
      metodo_pago: true,
      nro_comprobante: true,
      facturas: { select: { id_factura: true, numero: true, anio: true, mes: true } },
      cuotas: { select: { anio: true, mes: true } },
    },
    orderBy: [{ fecha_pago: 'desc' }, { id_pago: 'desc' }],
  })
  res.json(
    pagos.map(({ facturas, cuotas, ...pago }) => {
      const origen = facturas ?? cuotas
      return { ...pago, factura: facturas, periodo: origen ? { anio: origen.anio, mes: origen.mes } : null }
    }),
  )
}

/**
 * Descarga el archivo de un comprobante de transferencia. Lo ve la administración
 * o la familia del alumno de la factura; el resto del personal, no.
 */
async function descargarComprobante(req: Request, res: Response, next: NextFunction) {
  const usuario = usuarioDe(req)

  const comprobante = await prisma.comprobanteTransferencia.findUnique({
    where: { id_comprobante: id(req.params.id) },
    select: { archivo: true, facturas: { select: { id_alumno: true } } },
  })
  if (!comprobante) throw new HttpError(404, 'Comprobante no encontrado')

  await assertVePagosDe(usuario, comprobante.facturas.id_alumno)

  const ruta = rutaArchivoPrivado('comprobantes', comprobante.archivo)
  if (!ruta) throw new HttpError(404, 'El archivo del comprobante no está disponible')

  // Un comprobante tiene datos bancarios: que ningún caché intermedio lo guarde.
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.sendFile(ruta, (err: Error | undefined) => {
    if (err) next(new HttpError(404, 'El archivo del comprobante no está disponible'))
  })
}

/**
 * Emite la orden de pago (el comprobante de pago) de los ítems elegidos de una factura:
 * `{ items: number[] }` → 201 con la orden y el alias al que transferir.
 */
async function emitirOrdenPago(req: Request, res: Response) {
  const usuario = usuarioDe(req)
  const idFactura = id(req.params.id)
  const factura = await prisma.factura.findUnique({ where: { id_factura: idFactura }, select: { id_alumno: true } })
  if (!factura) throw new HttpError(404, 'Factura no encontrada')
  await assertVePagosDe(usuario, factura.id_alumno)

  const orden = await crearOrdenPago(idFactura, idsDeItems(req.body?.items), usuario.id_usuario)
  res.status(201).json(orden)
}

/** PDF de una orden de pago, con los datos bancarios. Lo ve la administración o la familia del alumno. */
async function pdfDeLaOrden(req: Request, res: Response) {
  const usuario = usuarioDe(req)
  const idOrden = id(req.params.id)
  const orden = await prisma.ordenPago.findUnique({
    where: { id_orden: idOrden },
    select: { facturas: { select: { id_alumno: true } } },
  })
  if (!orden) throw new HttpError(404, 'Orden de pago no encontrada')
  await assertVePagosDe(usuario, orden.facturas.id_alumno)

  const { archivo, pdf } = await pdfOrdenPago(idOrden)
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${archivo}.pdf"`)
  res.send(pdf)
}

portalFinanzasRouter.get('/alumnos/:id/facturas', conSesion, asincrono(facturasDelAlumno))
portalFinanzasRouter.get('/alumnos/:id/pagos', conSesion, asincrono(pagosDelAlumno))
portalFinanzasRouter.get('/comprobantes/:id/archivo', conSesion, asincrono(descargarComprobante))
portalFinanzasRouter.post('/facturas/:id/ordenes-pago', conSesion, asincrono(emitirOrdenPago))
portalFinanzasRouter.get('/ordenes-pago/:id/pdf', conSesion, asincrono(pdfDeLaOrden))
