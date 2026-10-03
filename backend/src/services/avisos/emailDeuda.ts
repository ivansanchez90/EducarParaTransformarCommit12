/**
 * Email del aviso de deuda (T18): lo que debe cada hijo, factura por factura y
 * ítem por ítem. Función pura para poder probar el texto.
 */
import { config } from '../../lib/config.js'
import { escaparHtml as e } from '../email.js'
import type { DeudaDetectada } from './eventos.js'
import { nombreMes, pesos } from './mensajes.js'

const numero = (n: number) => String(n).padStart(8, '0')
/** Columna `date` (medianoche UTC) → DD/MM/YYYY. */
const fechaCorta = (d: Date) => d.toISOString().slice(0, 10).split('-').reverse().join('/')

export function emailDeuda(evento: DeudaDetectada): { asunto: string; html: string; texto: string } {
  const { familia, alumnos, total } = evento
  const comoPagar = config.bancoAlias
    ? `Podés pagar por transferencia al alias ${config.bancoAlias} y subir el comprobante desde la app, en Cuotas.`
    : 'Podés pagar por transferencia y subir el comprobante desde la app, en Cuotas.'
  const enlace = config.publicUrl ? `${config.publicUrl}/portal` : ''
  const intro = `Te recordamos que hay facturas vencidas con saldo pendiente por un total de ${pesos(total)}.`
  const yaPagaste = 'Si ya pagaste y subiste el comprobante, no hace falta que hagas nada: lo estamos revisando.'

  const bloques = alumnos.flatMap((a) =>
    a.facturas.map((f) => ({
      titulo: `${a.nombre} · ${nombreMes(f.anio, f.mes)} · Factura N° ${numero(f.numero)} (venció el ${fechaCorta(f.fecha_vencimiento)})`,
      items: f.items,
      saldo: f.saldo,
    })),
  )

  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;color:#1A1A2E">
<h2 style="color:#5B35C5;margin:0 0 12px">Saldo pendiente</h2>
<p style="font-size:15px;line-height:1.5;margin:0 0 8px">Hola ${e(familia.nombre)}:</p>
<p style="font-size:15px;line-height:1.5;margin:0 0 8px">${e(intro)}</p>
${bloques
  .map(
    (b) => `<h3 style="font-size:14px;margin:18px 0 6px">${e(b.titulo)}</h3>
<table style="border-collapse:collapse;width:100%;font-size:14px">
${b.items
  .map(
    (i) =>
      `<tr><td style="padding:4px 0;border-bottom:1px solid #EEE">${e(i.descripcion)}</td>` +
      `<td style="padding:4px 0;border-bottom:1px solid #EEE;text-align:right;white-space:nowrap">${pesos(i.saldo)}</td></tr>`,
  )
  .join('\n')}
<tr><td style="padding:6px 0;font-weight:bold">Saldo</td><td style="padding:6px 0;text-align:right;font-weight:bold">${pesos(b.saldo)}</td></tr>
</table>`,
  )
  .join('\n')}
<p style="font-size:15px;font-weight:bold;margin:16px 0 0">Total pendiente: ${pesos(total)}</p>
<p style="font-size:15px;line-height:1.5;margin:16px 0 0">${e(comoPagar)}</p>
<p style="font-size:14px;line-height:1.5;color:#6B6B80;margin:8px 0 0">${e(yaPagaste)}</p>
${enlace ? `<p style="margin:16px 0 0"><a href="${e(enlace)}" style="color:#5B35C5;font-weight:bold">Abrir la app</a></p>` : ''}
<p style="font-size:12px;color:#6B6B80;margin:24px 0 0">Educar para Transformar · Este es un aviso automático, no hace falta responderlo.</p>
</div>`

  const texto = [
    `Hola ${familia.nombre}:`,
    '',
    intro,
    ...bloques.flatMap((b) => ['', b.titulo, ...b.items.map((i) => `  ${i.descripcion}: ${pesos(i.saldo)}`), `  Saldo: ${pesos(b.saldo)}`]),
    '',
    `Total pendiente: ${pesos(total)}`,
    '',
    comoPagar,
    yaPagaste,
    ...(enlace ? ['', enlace] : []),
  ].join('\n')

  return { asunto: `Saldo pendiente · Educar para Transformar`, html, texto }
}
