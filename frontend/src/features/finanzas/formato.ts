/** Formatos de importes, fechas y períodos de las facturas. */
import { MESES } from '../../constants'
import type { EstadoFactura, RangoFechas } from './types'

export const ESTADO_FACTURA_COLOR: Record<EstadoFactura, string> = {
  Pendiente: '#E67E22',
  'Pago parcial': '#2980B9',
  Pagada: '#27AE60',
  Vencida: '#E74C3C',
}

export const pesos = (importe: number) =>
  importe.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 2 })

/** `AAAA-MM-DD` (o una fecha ISO) → `10 Nov 2026`. Se lee el texto y no un `Date`, para no correr el día por la zona horaria. */
export function fechaCorta(iso: string): string {
  const [anio, mes, dia] = iso.slice(0, 10).split('-').map(Number)
  return `${dia} ${MESES[mes - 1].slice(0, 3)} ${anio}`
}

export const nombrePeriodo = (anio: number, mes: number) => `${MESES[mes - 1]} ${anio}`

export const numeroFactura = (numero: number) => String(numero).padStart(8, '0')

/** El rango de fechas es válido si no está al revés (vacío = sin límite). */
export const rangoValido = ({ desde, hasta }: RangoFechas) => !desde || !hasta || desde <= hasta
