/**
 * Email de fin de mes (T17): la factura del mes que viene de cada hijo, con su
 * composición. Un email por familia; los PDF van adjuntos (los agrega
 * `jobs/emailFinDeMes.ts`). Es una función pura para poder probar el texto.
 */
import { config } from '../../lib/config.js'
import { pesos } from '../avisos/mensajes.js'
import { escaparHtml as e } from '../email.js'
import { nombrePeriodo } from './estrategias.js'

export interface FacturaParaEmail {
  id_factura: number
  numero: number
  anio: number
  mes: number
  fecha_vencimiento: Date
  total: number
  saldo: number
  /** "Nombre Apellido" del alumno. */
  alumno: string
  items: { descripcion: string; importe: number }[]
}

export interface EmailFinDeMes {
  asunto: string
  html: string
  texto: string
}

const numero = (n: number) => String(n).padStart(8, '0')
/** Columna `date` (medianoche UTC) → DD/MM/YYYY. */
const fechaCorta = (d: Date) => d.toISOString().slice(0, 10).split('-').reverse().join('/')
const enumerar = (nombres: string[]) =>
  nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}` : (nombres[0] ?? '')

export function emailFinDeMes(nombreFamilia: string, facturas: FacturaParaEmail[]): EmailFinDeMes {
  const { anio, mes, fecha_vencimiento } = facturas[0]
  const periodo = nombrePeriodo({ anio, mes })
  const aPagar = facturas.reduce((s, f) => s + Math.round(f.saldo * 100), 0) / 100
  const vence = fechaCorta(fecha_vencimiento)
  const hijos = enumerar(facturas.map((f) => f.alumno.split(' ')[0]))
  const comoPagar = config.bancoAlias
    ? `Podés pagar por transferencia al alias ${config.bancoAlias} y subir el comprobante desde la app, en Cuotas.`
    : 'Podés pagar por transferencia y subir el comprobante desde la app, en Cuotas.'
  const enlace = config.publicUrl ? `${config.publicUrl}/portal` : ''

  const intro =
    `Te enviamos la factura de ${periodo} de ${hijos}. ` +
    (aPagar > 0 ? `Vence el ${vence}.` : 'No tiene saldo a pagar.') +
    (facturas.length > 1 ? ' Adjuntamos el PDF de cada una.' : ' Adjuntamos el PDF.')

  const tablas = facturas
    .map(
      (f) => `<h3 style="font-size:15px;margin:20px 0 6px">${e(f.alumno)} · Factura N° ${numero(f.numero)}</h3>
<table style="border-collapse:collapse;width:100%;font-size:14px">
${f.items
  .map(
    (i) =>
      `<tr><td style="padding:4px 0;border-bottom:1px solid #EEE">${e(i.descripcion)}</td>` +
      `<td style="padding:4px 0;border-bottom:1px solid #EEE;text-align:right;white-space:nowrap">${pesos(i.importe)}</td></tr>`,
  )
  .join('\n')}
<tr><td style="padding:6px 0;font-weight:bold">Total</td><td style="padding:6px 0;text-align:right;font-weight:bold">${pesos(f.total)}</td></tr>
</table>`,
    )
    .join('\n')

  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;color:#1A1A2E">
<h2 style="color:#5B35C5;margin:0 0 12px">Factura de ${periodo}</h2>
<p style="font-size:15px;line-height:1.5;margin:0 0 8px">Hola ${e(nombreFamilia)}:</p>
<p style="font-size:15px;line-height:1.5;margin:0 0 8px">${e(intro)}</p>
${tablas}
${facturas.length > 1 ? `<p style="font-size:15px;font-weight:bold;margin:16px 0 0">Total a pagar: ${pesos(aPagar)}</p>` : ''}
${aPagar > 0 ? `<p style="font-size:15px;line-height:1.5;margin:16px 0 0">${e(comoPagar)}</p>` : ''}
${enlace ? `<p style="margin:16px 0 0"><a href="${e(enlace)}" style="color:#5B35C5;font-weight:bold">Abrir la app</a></p>` : ''}
<p style="font-size:12px;color:#6B6B80;margin:24px 0 0">Educar para Transformar · Comprobante interno, no válido como factura fiscal. Este es un aviso automático, no hace falta responderlo.</p>
</div>`

  const texto = [
    `Hola ${nombreFamilia}:`,
    '',
    intro,
    ...facturas.flatMap((f) => [
      '',
      `${f.alumno} · Factura N° ${numero(f.numero)}`,
      ...f.items.map((i) => `  ${i.descripcion}: ${pesos(i.importe)}`),
      `  Total: ${pesos(f.total)}`,
    ]),
    ...(facturas.length > 1 ? ['', `Total a pagar: ${pesos(aPagar)}`] : []),
    ...(aPagar > 0 ? ['', comoPagar] : []),
    ...(enlace ? ['', enlace] : []),
  ].join('\n')

  return { asunto: `Factura de ${periodo} · Educar para Transformar`, html, texto }
}
