/**
 * Bandeja de comprobantes de transferencia (administración, T14).
 *
 * La familia sube el comprobante (T13, `portalFinanzas.ts`) y queda "En
 * revisión". El admin lo aprueba con el importe que efectivamente se acreditó
 * (se crea el `Pago` y se imputa a los ítems, ver `services/saldos.ts`) o lo
 * rechaza con un motivo. En los dos casos se avisa a la familia.
 *
 * `GET /api/comprobantes/:id/archivo` (la descarga, también para la familia)
 * vive en `portalFinanzas.ts`, que se monta antes en `/api`.
 */
import { Router } from 'express'
import type { Prisma } from '../generated/prisma/client.js'
import { HttpError, id, lista, textOrNull } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { cursoResumen, nombreApellido } from '../lib/selects.js'
import { ROLES_ADMIN, requireAuth, requireRole } from '../middleware/auth.js'
import { publicar } from '../services/avisos/index.js'
import { aplicarPago } from '../services/saldos.js'

export const comprobantesRouter = Router()
comprobantesRouter.use(requireAuth, requireRole(...ROLES_ADMIN))

const ESTADOS = ['En revisión', 'Aprobado', 'Rechazado']
const MAX_MOTIVO = 300

/** Lo que muestra la bandeja de cada comprobante (sin el nombre del archivo en disco). */
const detalle = {
  id_comprobante: true,
  id_factura: true,
  id_orden: true,
  importe: true,
  fecha_transferencia: true,
  estado: true,
  motivo_rechazo: true,
  fecha_carga: true,
  fecha_revision: true,
  facturas: {
    select: {
      numero: true,
      anio: true,
      mes: true,
      total: true,
      saldo: true,
      fecha_vencimiento: true,
      alumnos: { select: { id_alumno: true, nombre: true, apellido: true, dni: true, cursos: cursoResumen } },
    },
  },
  ordenes_pago: {
    select: {
      numero: true,
      total: true,
      items: { select: { importe: true, items: { select: { concepto: true, descripcion: true } } } },
    },
  },
  carga: { select: { nombre: true, apellido: true, email: true } },
  revision: nombreApellido,
  pagos: { select: { id_pago: true, monto_pagado: true, fecha_pago: true } },
} satisfies Prisma.ComprobanteTransferenciaSelect

/**
 * Comprobantes por estado: ?estado=En revisión (o varios separados por coma).
 * Los que esperan revisión, del más viejo al más nuevo; el resto, al revés.
 */
comprobantesRouter.get('/', async (req, res) => {
  const estados = lista(req.query.estado)
  if (estados?.some((e) => !ESTADOS.includes(e))) throw new HttpError(400, 'Estado inválido')
  const soloPendientes = estados?.length === 1 && estados[0] === 'En revisión'
  const comprobantes = await prisma.comprobanteTransferencia.findMany({
    where: estados ? { estado: { in: estados } } : undefined,
    select: detalle,
    orderBy: { fecha_carga: soloPendientes ? 'asc' : 'desc' },
    take: soloPendientes ? undefined : 200,
  })
  res.json(comprobantes)
})

/** Importe en pesos con hasta dos decimales, mayor que cero. */
function importeValido(valor: unknown): number {
  const n = typeof valor === 'string' ? Number(valor.replace(',', '.')) : Number(valor)
  if (!Number.isFinite(n) || n <= 0) throw new HttpError(400, 'Indicá el importe acreditado')
  if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) throw new HttpError(400, 'El importe admite hasta dos decimales')
  return n
}

/**
 * Pasa el comprobante de "En revisión" a `estado` (solo si sigue en revisión:
 * dos admins no pueden validarlo a la vez). Devuelve los datos para el aviso.
 */
async function cerrarRevision(tx: Prisma.TransactionClient, idComprobante: number, idUsuario: string, data: Prisma.ComprobanteTransferenciaUpdateManyMutationInput) {
  const { count } = await tx.comprobanteTransferencia.updateMany({
    where: { id_comprobante: idComprobante, estado: 'En revisión' },
    data: { ...data, id_usuario_revisa: idUsuario, fecha_revision: new Date() },
  })
  const comprobante = await tx.comprobanteTransferencia.findUnique({
    where: { id_comprobante: idComprobante },
    select: {
      estado: true,
      importe: true,
      id_factura: true,
      id_orden: true,
      fecha_transferencia: true,
      facturas: { select: { numero: true, anio: true, mes: true, id_alumno: true, alumnos: nombreApellido } },
    },
  })
  if (!comprobante) throw new HttpError(404, 'Comprobante no encontrado')
  if (count === 0) throw new HttpError(409, `El comprobante ya está ${comprobante.estado.toLowerCase()}`)
  return comprobante
}

/** `{ importe }` → crea el pago, lo imputa y devuelve el saldo y el estado de la factura. */
comprobantesRouter.patch('/:id/aprobar', async (req, res) => {
  const idComprobante = id(req.params.id)
  const importe = importeValido(req.body?.importe)

  const { comprobante, saldo, estado } = await prisma.$transaction(async (tx) => {
    const comprobante = await cerrarRevision(tx, idComprobante, req.user!.id_usuario, { estado: 'Aprobado', motivo_rechazo: null })
    const pago = await aplicarPago(tx, {
      id_factura: comprobante.id_factura,
      importe,
      id_comprobante: idComprobante,
      id_orden: comprobante.id_orden,
      // La fecha del pago es la de la transferencia (12 h en Argentina, para que no cambie de día).
      fecha_pago: new Date(comprobante.fecha_transferencia.getTime() + 15 * 3600 * 1000),
      id_usuario_registra: req.user!.id_usuario,
    })
    return { comprobante, ...pago }
  })

  const { facturas: f } = comprobante
  void publicar({
    tipo: 'ComprobanteValidado',
    aprobado: true,
    id_alumno: f.id_alumno,
    alumno: `${f.alumnos.nombre} ${f.alumnos.apellido}`,
    factura: { numero: f.numero, anio: f.anio, mes: f.mes, saldo },
    importe,
  })
  res.json({ estado: 'Aprobado', factura: { saldo, estado } })
})

/** `{ motivo }` → el comprobante queda rechazado y la familia puede subir otro. */
comprobantesRouter.patch('/:id/rechazar', async (req, res) => {
  const idComprobante = id(req.params.id)
  const motivo = textOrNull(req.body?.motivo)
  if (!motivo) throw new HttpError(400, 'Indicá el motivo del rechazo')
  if (motivo.length > MAX_MOTIVO) throw new HttpError(400, `El motivo admite hasta ${MAX_MOTIVO} caracteres`)

  const comprobante = await prisma.$transaction(async (tx) =>
    cerrarRevision(tx, idComprobante, req.user!.id_usuario, { estado: 'Rechazado', motivo_rechazo: motivo }),
  )
  const saldo = await prisma.factura.findUnique({ where: { id_factura: comprobante.id_factura }, select: { saldo: true } })

  const { facturas: f } = comprobante
  void publicar({
    tipo: 'ComprobanteValidado',
    aprobado: false,
    id_alumno: f.id_alumno,
    alumno: `${f.alumnos.nombre} ${f.alumnos.apellido}`,
    factura: { numero: f.numero, anio: f.anio, mes: f.mes, saldo: Number(saldo?.saldo ?? 0) },
    importe: Number(comprobante.importe),
    motivo,
  })
  res.json({ estado: 'Rechazado' })
})
