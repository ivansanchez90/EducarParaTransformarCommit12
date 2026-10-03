/** Texto de cada aviso, el mismo para in-app, push y email. */
import type { ComprobanteValidado, DeudaDetectada } from './eventos.js'

export const MESES = [
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

export const nombreMes = (anio: number, mes: number) => `${MESES[mes - 1]} ${anio}`

/** Texto corto del aviso (in-app, push y el aviso de comprobante por email). */
export function textoAviso(evento: ComprobanteValidado): TextoAviso {
  const { factura, alumno } = evento
  const deLaFactura = `la factura de ${nombreMes(factura.anio, factura.mes)} de ${alumno}`
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

/** Aviso in-app y push de la deuda de un hijo. */
export function textoDeuda(alumno: DeudaDetectada['alumnos'][number]): TextoAviso {
  const saldo = alumno.facturas.reduce((s, f) => s + Math.round(f.saldo * 100), 0) / 100
  const meses = alumno.facturas.map((f) => nombreMes(f.anio, f.mes))
  const deLas = meses.length > 1 ? `las facturas de ${meses.slice(0, -1).join(', ')} y ${meses.at(-1)}` : `la factura de ${meses[0]}`
  return {
    titulo: 'Saldo pendiente',
    mensaje:
      `${alumno.nombre.split(' ')[0]} tiene ${pesos(saldo)} pendientes de ${deLas}, ya vencida${meses.length > 1 ? 's' : ''}. ` +
      'Podés pagar por transferencia y subir el comprobante desde la app. Si ya pagaste, no hace falta que hagas nada.',
  }
}
