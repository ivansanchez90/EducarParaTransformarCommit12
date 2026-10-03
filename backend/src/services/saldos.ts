/**
 * Saldos de las facturas: imputación de los pagos a los ítems y deuda por ítem.
 *
 * Invariantes (ver PLAN-P3.md): `ítem.saldo = importe − Σ imputaciones del
 * ítem` y `factura.saldo = Σ ítems.saldo`. Todo pago pasa por `aplicarPago()`,
 * que los mantiene dentro de la misma transacción que crea el pago.
 *
 * La beca es un ítem negativo que descuenta sobre la cuota: se salda junto con
 * la cuota (imputación negativa a la beca y la cuota completa), como hizo la
 * migración de T01 con las facturas ya pagadas. Así la cuota no queda con
 * saldo "fantasma" cuando la factura está pagada.
 */
import type { Prisma } from '../generated/prisma/client.js'
import { HttpError, fecha, hoyISO } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { estadoFactura } from './facturacion/estado.js'

/** Ítem con su saldo en centavos. */
export interface ItemSaldo {
  id_item: number
  concepto: string
  saldo: number
}

/** Ítems que se saldan juntos: un ítem a cobrar y las becas que lo descuentan. */
interface Grupo {
  items: ItemSaldo[]
  /** Lo que falta pagar del grupo, en centavos (nunca negativo). */
  pagable: number
}

function agrupar(items: ItemSaldo[]): Grupo[] {
  const positivos = items.filter((i) => i.saldo > 0)
  const grupos = new Map(positivos.map((i) => [i.id_item, { items: [i], pagable: i.saldo }]))
  // Las becas pendientes descuentan sobre la cuota (o, si no hubiera, sobre el primer ítem).
  const destino = positivos.find((i) => i.concepto === 'Cuota') ?? positivos[0]
  for (const negativo of items.filter((i) => i.saldo < 0)) {
    if (!destino) continue
    const g = grupos.get(destino.id_item)!
    g.items.push(negativo)
    g.pagable = Math.max(0, g.pagable + negativo.saldo)
  }
  return [...grupos.values()].filter((g) => g.pagable > 0 || g.items.some((i) => i.saldo < 0))
}

/**
 * A qué ítems se aplica un pago: primero los `prioritarios` (los de la orden de
 * pago que eligió la familia), después los demás en orden (`id_item`, el orden en
 * que se emitió la factura). Devuelve el importe imputado a cada ítem, en
 * centavos; la suma es `importe`. Lanza si el importe supera el saldo.
 */
export function calcularImputacion(items: ItemSaldo[], importe: number, prioritarios: number[] = []): Map<number, number> {
  if (!Number.isInteger(importe) || importe <= 0) throw new HttpError(400, 'El importe tiene que ser mayor que cero')
  const grupos = agrupar([...items].sort((a, b) => a.id_item - b.id_item))
  const saldo = grupos.reduce((s, g) => s + g.pagable, 0)
  if (saldo === 0) throw new HttpError(400, 'La factura ya está pagada')
  if (importe > saldo) {
    const enPesos = (saldo / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    throw new HttpError(400, `El importe supera el saldo de la factura ($ ${enPesos})`)
  }

  const prioridad = new Set(prioritarios)
  const esPrioritario = (g: Grupo) => g.items.some((i) => prioridad.has(i.id_item))
  const orden = [...grupos.filter(esPrioritario), ...grupos.filter((g) => !esPrioritario(g))]

  const imputado = new Map<number, number>()
  let resto = importe
  for (const g of orden) {
    if (resto === 0) break
    const aplicado = Math.min(resto, g.pagable)
    const [principal, ...becas] = g.items
    const descuento = becas.reduce((s, b) => s + b.saldo, 0)
    for (const b of becas) imputado.set(b.id_item, b.saldo)
    // La beca se salda entera: la cuota absorbe el pago más lo que descuenta la beca.
    imputado.set(principal.id_item, aplicado - descuento)
    resto -= aplicado
  }
  return imputado
}

const centavos = (d: Prisma.Decimal | number) => Math.round(Number(d) * 100)

export interface DatosPago {
  id_factura: number
  /** En pesos, con hasta dos decimales. */
  importe: number
  id_comprobante?: number | null
  id_orden?: number | null
  fecha_pago?: Date
  id_usuario_registra?: string | null
  nro_comprobante?: string | null
}

/**
 * Registra un pago sobre una factura dentro de `tx`: crea el `Pago`, lo imputa
 * a los ítems, baja sus saldos y recalcula el saldo y el estado de la factura.
 * Bloquea la fila de la factura, así dos aprobaciones simultáneas sobre la
 * misma factura no imputan sobre el mismo saldo.
 */
export async function aplicarPago(tx: Prisma.TransactionClient, datos: DatosPago) {
  await tx.$queryRaw`SELECT id_factura FROM facturas WHERE id_factura = ${datos.id_factura} FOR UPDATE`
  const factura = await tx.factura.findUnique({
    where: { id_factura: datos.id_factura },
    select: {
      total: true,
      fecha_vencimiento: true,
      items: { select: { id_item: true, concepto: true, saldo: true } },
    },
  })
  if (!factura) throw new HttpError(404, 'Factura no encontrada')

  const prioritarios = datos.id_orden
    ? (await tx.ordenPagoItem.findMany({ where: { id_orden: datos.id_orden }, select: { id_item: true } })).map((o) => o.id_item)
    : []
  const items = factura.items.map((i) => ({ ...i, saldo: centavos(i.saldo) }))
  const imputacion = calcularImputacion(items, centavos(datos.importe), prioritarios)

  const pago = await tx.pago.create({
    data: {
      id_factura: datos.id_factura,
      id_comprobante: datos.id_comprobante ?? null,
      monto_pagado: centavos(datos.importe) / 100,
      metodo_pago: 'Transferencia',
      fecha_pago: datos.fecha_pago,
      id_usuario_registra: datos.id_usuario_registra ?? null,
      nro_comprobante: datos.nro_comprobante ?? null,
      imputaciones: {
        create: [...imputacion]
          .filter(([, cent]) => cent !== 0)
          .map(([id_item, cent]) => ({ id_item, importe: cent / 100 })),
      },
    },
  })

  let saldoFactura = 0
  for (const item of items) {
    const nuevo = item.saldo - (imputacion.get(item.id_item) ?? 0)
    saldoFactura += nuevo
    if (nuevo !== item.saldo) await tx.itemFactura.update({ where: { id_item: item.id_item }, data: { saldo: nuevo / 100 } })
  }
  const saldo = saldoFactura / 100
  const estado = estadoFactura({ total: Number(factura.total), saldo, fecha_vencimiento: factura.fecha_vencimiento }, fecha(hoyISO())!)
  await tx.factura.update({ where: { id_factura: datos.id_factura }, data: { saldo, estado } })
  return { pago, saldo, estado }
}

/**
 * Deuda de un alumno: sus facturas con saldo y, de cada una, los ítems que
 * todavía deben algo (la beca pendiente aparece en negativo). Para el portal
 * (T16, `GET /api/alumnos/:id/deuda`) y el aviso del día 20 (T18).
 */
export async function deudaAlumno(idAlumno: number) {
  const hoy = fecha(hoyISO())!
  const facturas = await prisma.factura.findMany({
    where: { id_alumno: idAlumno, saldo: { gt: 0 } },
    select: {
      id_factura: true,
      numero: true,
      anio: true,
      mes: true,
      fecha_vencimiento: true,
      total: true,
      saldo: true,
      items: {
        where: { saldo: { not: 0 } },
        select: { id_item: true, concepto: true, id_referencia: true, descripcion: true, importe: true, saldo: true },
        orderBy: { id_item: 'asc' },
      },
    },
    orderBy: [{ anio: 'asc' }, { mes: 'asc' }],
  })
  const conEstado = facturas.map((f) => ({
    ...f,
    estado: estadoFactura({ total: Number(f.total), saldo: Number(f.saldo), fecha_vencimiento: f.fecha_vencimiento }, hoy),
  }))
  return { total: conEstado.reduce((s, f) => s + centavos(f.saldo), 0) / 100, facturas: conEstado }
}
