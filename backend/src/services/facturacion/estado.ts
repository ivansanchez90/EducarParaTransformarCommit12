/**
 * Estado de una factura según su saldo y su vencimiento. Se calcula al leer
 * (no depende de que una tarea lo actualice a tiempo).
 */

export type EstadoFactura = 'Pendiente' | 'Pago parcial' | 'Pagada' | 'Vencida'

/** Día del mes en que vence la factura. */
export const DIA_VENCIMIENTO = 10

/**
 * Pagada si no tiene saldo; Vencida si tiene saldo y pasó el vencimiento
 * (aunque se haya pagado una parte); Pago parcial si se pagó algo; si no,
 * Pendiente. `hoy` y `fecha_vencimiento` son fechas sin hora (medianoche UTC).
 */
export function estadoFactura(
  f: { total: number; saldo: number; fecha_vencimiento: Date },
  hoy: Date,
): EstadoFactura {
  if (f.saldo <= 0) return 'Pagada'
  if (hoy.getTime() > f.fecha_vencimiento.getTime()) return 'Vencida'
  if (f.saldo < f.total) return 'Pago parcial'
  return 'Pendiente'
}
