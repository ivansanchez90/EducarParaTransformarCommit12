/** Texto de cada aviso, el mismo para in-app, push y email. */
import type { EventoFinanzas } from './eventos.js'

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** $ 85.000 · $ 85.000,50 */
export const pesos = (n: number) =>
  `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`

export interface TextoAviso {
  titulo: string
  mensaje: string
}

export function textoAviso(evento: EventoFinanzas): TextoAviso {
  const { factura, alumno } = evento
  const deLaFactura = `la factura de ${MESES[factura.mes - 1]} ${factura.anio} de ${alumno}`
  if (evento.aprobado) {
    const saldo = factura.saldo > 0 ? `Queda un saldo de ${pesos(factura.saldo)}.` : 'La factura quedó pagada.'
    return {
      titulo: 'Pago acreditado',
      mensaje: `Acreditamos tu transferencia de ${pesos(evento.importe)} para ${deLaFactura}. ${saldo}`,
    }
  }
  return {
    titulo: 'Comprobante rechazado',
    mensaje:
      `No pudimos validar tu comprobante de ${pesos(evento.importe)} para ${deLaFactura}. ` +
      `Motivo: ${evento.motivo ?? 'sin detalle'}. Podés subir otro desde la app.`,
  }
}
