/**
 * Serialización JSON de las respuestas.
 *
 * Prisma devuelve `Decimal` para montos/notas y `Date` para columnas `date` y
 * `time`. Supabase devolvía números y strings ('2026-03-10', '08:30:00'), así
 * que se normaliza acá para que el frontend reciba exactamente lo mismo.
 */
import { Prisma } from '../generated/prisma/client.js'

const CAMPOS_FECHA = new Set([
  'fecha',
  'fecha_nacimiento',
  'fecha_nacimiento_aspirante',
  'fecha_vencimiento',
  'fecha_pago',
  'fecha_compra',
  'fecha_otorgamiento',
  'fecha_publicacion',
  'fecha_cierre',
  'fecha_inicio',
  'fecha_fin',
])
const CAMPOS_HORA = new Set(['hora_inicio', 'hora_fin', 'hora_ida', 'hora_vuelta'])

export function jsonReplacer(this: Record<string, unknown>, key: string, value: unknown) {
  // `this[key]` es el valor original, antes de que se aplique su toJSON().
  const original = this[key]
  if (original instanceof Prisma.Decimal) return original.toNumber()
  if (original instanceof Date) {
    const iso = original.toISOString()
    if (CAMPOS_FECHA.has(key)) return iso.slice(0, 10)
    if (CAMPOS_HORA.has(key)) return iso.slice(11, 19)
    return iso
  }
  if (typeof value === 'bigint') return Number(value)
  return value
}
