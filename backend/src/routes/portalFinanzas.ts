/**
 * Endpoints del portal de familias para facturas, pagos y comprobantes. Cada ruta
 * lleva su propio `requireAuth` y el prefijo completo, porque el router se monta
 * en `/api`, junto a otros que comparten recursos (por ejemplo `/api/comprobantes`).
 */
import { Router } from 'express'
import type { NextFunction, Request, Response } from 'express'
import { Prisma } from '../generated/prisma/client.js'
import { HttpError, fecha, fechaObligatoria, hoyISO, id, lista } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { ROLES_ADMIN, assertAccesoAlumno, esStaff, requireAuth } from '../middleware/auth.js'
import type { UsuarioAuth } from '../middleware/auth.js'
import { borrarComprobante, guardarComprobante, recibirArchivoComprobante, rutaArchivoPrivado } from '../middleware/upload.js'
import { estadoFactura } from '../services/facturacion/estado.js'
import { crearOrdenPago, idsDeItems, pdfOrdenPago } from '../services/ordenPago.js'
import { deudaAlumno } from '../services/saldos.js'

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
 * Rango de fechas de la consulta (`?desde=2026-03-01&hasta=2026-10-31`, los dos opcionales y
 * inclusivos), listo para un filtro de Prisma sobre una columna `date`. Vacío si no se pidió.
 */
function rangoDeFechas(query: Request['query']) {
  const desde = fecha(query.desde)
  const hasta = fecha(query.hasta)
  if (desde && hasta && desde.getTime() > hasta.getTime()) {
    throw new HttpError(400, 'La fecha "desde" no puede ser posterior a la fecha "hasta"')
  }
  return { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) }
}

/**
 * Facturas de un alumno, de la más reciente a la más antigua, con sus ítems y sus
 * comprobantes de transferencia. El estado se calcula al leerla (saldo y vencimiento).
 * Con ?estado=Pendiente,Vencida solo las que están en esos estados, y con ?desde=&hasta=
 * (T15) solo las emitidas en ese rango de fechas.
 */
async function facturasDelAlumno(req: Request, res: Response) {
  const idAlumno = id(req.params.id)
  await assertVePagosDe(usuarioDe(req), idAlumno)

  const estados = lista(req.query.estado)
  const emision = rangoDeFechas(req.query)
  const hoy = fecha(hoyISO()) ?? new Date()
  const facturas = await prisma.factura.findMany({
    where: { id_alumno: idAlumno, ...(Object.keys(emision).length ? { fecha_emision: emision } : {}) },
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
 * Comprobantes de transferencia de un alumno, del más reciente al más antiguo (T15):
 * ?desde=&hasta= filtra por la fecha de la transferencia y ?estado=En revisión,Aprobado
 * por su estado. Cada uno trae la factura que paga y la orden de pago, si venía de una.
 * No incluye el nombre del archivo: se baja con `GET /api/comprobantes/:id/archivo`.
 */
async function comprobantesDelAlumno(req: Request, res: Response) {
  const idAlumno = id(req.params.id)
  await assertVePagosDe(usuarioDe(req), idAlumno)

  const estados = lista(req.query.estado)
  const transferencia = rangoDeFechas(req.query)
  const comprobantes = await prisma.comprobanteTransferencia.findMany({
    where: {
      facturas: { id_alumno: idAlumno },
      ...(estados ? { estado: { in: estados } } : {}),
      ...(Object.keys(transferencia).length ? { fecha_transferencia: transferencia } : {}),
    },
    select: {
      id_comprobante: true,
      estado: true,
      importe: true,
      fecha_transferencia: true,
      fecha_carga: true,
      motivo_rechazo: true,
      facturas: { select: { id_factura: true, numero: true, anio: true, mes: true } },
      ordenes_pago: { select: { id_orden: true, numero: true } },
    },
    orderBy: [{ fecha_transferencia: 'desc' }, { id_comprobante: 'desc' }],
  })
  res.json(comprobantes.map(({ facturas, ordenes_pago, ...comprobante }) => ({ ...comprobante, factura: facturas, orden: ordenes_pago })))
}

/**
 * Deuda de un alumno por ítem y período (T16): sus facturas con saldo y, de cada una, los
 * ítems que todavía deben algo (una beca pendiente aparece en negativo), más el total.
 * Es lo mismo que usa el aviso del día 20 (`deudaAlumno` de `services/saldos.ts`).
 */
async function deudaDelAlumno(req: Request, res: Response) {
  const idAlumno = id(req.params.id)
  await assertVePagosDe(usuarioDe(req), idAlumno)
  res.json(await deudaAlumno(idAlumno))
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

/** Lo que la familia declara de su transferencia: importe, fecha y, si la hay, la orden de pago que está pagando. */
function datosDelComprobante(body: Record<string, unknown> | undefined) {
  const importe = Number(String(body?.importe ?? '').replace(',', '.'))
  if (!(importe > 0) || importe > 999_999_999) throw new HttpError(400, 'El importe de la transferencia tiene que ser mayor a 0')

  const fechaTransferencia = fechaObligatoria(body?.fecha_transferencia, 'fecha de la transferencia')
  const hoy = fecha(hoyISO()) ?? new Date()
  if (fechaTransferencia.getTime() > hoy.getTime()) {
    throw new HttpError(400, 'La fecha de la transferencia no puede ser posterior a hoy')
  }

  const idOrden = body?.id_orden ? id(body.id_orden) : null
  return { importe: new Prisma.Decimal(importe.toFixed(2)), fechaTransferencia, idOrden }
}

/**
 * Sube el comprobante de una transferencia (multipart: `archivo`, `importe`,
 * `fecha_transferencia` y, opcional, `id_orden`). Queda "En revisión" hasta que la
 * administración lo apruebe o lo rechace (T14). Una factura puede tener varios.
 */
async function subirComprobante(req: Request, res: Response) {
  const usuario = usuarioDe(req)
  const idFactura = id(req.params.id)
  const factura = await prisma.factura.findUnique({
    where: { id_factura: idFactura },
    select: { id_alumno: true, saldo: true },
  })
  if (!factura) throw new HttpError(404, 'Factura no encontrada')
  await assertVePagosDe(usuario, factura.id_alumno)
  if (factura.saldo.lte(0)) throw new HttpError(409, 'La factura ya está pagada: no hace falta subir un comprobante')

  await recibirArchivoComprobante(req, res)
  const { importe, fechaTransferencia, idOrden } = datosDelComprobante(req.body)
  if (idOrden) {
    const orden = await prisma.ordenPago.findFirst({ where: { id_orden: idOrden, id_factura: idFactura }, select: { id_orden: true } })
    if (!orden) throw new HttpError(400, 'La orden de pago no es de esta factura')
  }

  // Se guarda el archivo recién cuando todo lo demás es válido; si falla el alta, se borra.
  const archivo = await guardarComprobante(req.file)
  try {
    const comprobante = await prisma.comprobanteTransferencia.create({
      data: {
        id_factura: idFactura,
        id_orden: idOrden,
        archivo,
        importe,
        fecha_transferencia: fechaTransferencia,
        id_usuario_carga: usuario.id_usuario,
      },
      select: { id_comprobante: true, id_factura: true, id_orden: true, estado: true, importe: true, fecha_transferencia: true, fecha_carga: true },
    })
    res.status(201).json(comprobante)
  } catch (error) {
    await borrarComprobante(archivo)
    throw error
  }
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
portalFinanzasRouter.get('/alumnos/:id/comprobantes', conSesion, asincrono(comprobantesDelAlumno))
portalFinanzasRouter.get('/alumnos/:id/deuda', conSesion, asincrono(deudaDelAlumno))
portalFinanzasRouter.get('/comprobantes/:id/archivo', conSesion, asincrono(descargarComprobante))
portalFinanzasRouter.post('/facturas/:id/ordenes-pago', conSesion, asincrono(emitirOrdenPago))
portalFinanzasRouter.get('/ordenes-pago/:id/pdf', conSesion, asincrono(pdfDeLaOrden))
portalFinanzasRouter.post('/facturas/:id/comprobantes', conSesion, asincrono(subirComprobante))
