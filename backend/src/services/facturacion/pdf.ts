/**
 * PDF de una factura: datos del alumno, un renglón por ítem, totales y cómo
 * pagar. Devuelve un Buffer para poder mandarlo por la API o adjuntarlo a un
 * email (T17).
 */
import PDFDocument from 'pdfkit'
import { config } from '../../lib/config.js'
import { HttpError, fecha, hoyISO } from '../../lib/http.js'
import { prisma } from '../../lib/prisma.js'
import { estadoFactura } from './estado.js'
import { nombrePeriodo } from './estrategias.js'

const INSTITUCION = 'Educar para Transformar'
const MORADO = '#5B35C5'
const TEXTO = '#1A1A2E'
const GRIS = '#6B6B8A'
const BORDE = '#E8E6F5'
const CEBRA = '#F7F5FF'
const MARGEN = 50

/** $ 85.000,00 · - $ 42.500,00 (Helvetica no tiene el signo menos tipográfico). */
const pesos = (n: number) =>
  `${n < 0 ? '- ' : ''}$ ${Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** 'YYYY-MM-DD' de una columna `date` → 'DD/MM/YYYY'. */
const fechaCorta = (d: Date) => d.toISOString().slice(0, 10).split('-').reverse().join('/')

export const numeroFactura = (n: number) => String(n).padStart(8, '0')

export async function datosFactura(idFactura: number) {
  const factura = await prisma.factura.findUnique({
    where: { id_factura: idFactura },
    include: {
      items: { orderBy: { id_item: 'asc' } },
      alumnos: {
        select: {
          nombre: true,
          apellido: true,
          dni: true,
          cursos: { select: { nivel: true, grado_anio: true, division: true } },
          padre: { select: { nombre: true, apellido: true } },
        },
      },
    },
  })
  if (!factura) throw new HttpError(404, 'Factura no encontrada')
  return factura
}

export async function pdfFactura(idFactura: number): Promise<{ archivo: string; pdf: Buffer }> {
  const f = await datosFactura(idFactura)
  const total = f.total.toNumber()
  const saldo = f.saldo.toNumber()
  const estado = estadoFactura({ total, saldo, fecha_vencimiento: f.fecha_vencimiento }, fecha(hoyISO())!)
  const numero = numeroFactura(f.numero)
  const periodo = nombrePeriodo(f)
  const a = f.alumnos

  const pdf = new PDFDocument({
    size: 'A4',
    margin: MARGEN,
    info: { Title: `Factura ${numero}`, Author: INSTITUCION },
  })
  const partes: Buffer[] = []
  pdf.on('data', (c: Buffer) => partes.push(c))
  const terminado = new Promise<Buffer>((resolve, reject) => {
    pdf.on('end', () => resolve(Buffer.concat(partes)))
    pdf.on('error', reject)
  })

  const ancho = pdf.page.width - MARGEN * 2
  const derecha = { width: ancho, align: 'right' as const }

  // ── Encabezado ──
  pdf.fillColor(MORADO).font('Helvetica-Bold').fontSize(9).text(INSTITUCION.toUpperCase(), MARGEN, MARGEN, {
    characterSpacing: 1.5,
  })
  pdf.fillColor(TEXTO).font('Helvetica-Bold').fontSize(20).text('Factura', MARGEN, MARGEN + 16)
  pdf.font('Helvetica-Bold').fontSize(12).text(`N° ${numero}`, MARGEN, MARGEN + 16, derecha)
  pdf.fillColor(GRIS).font('Helvetica').fontSize(10).text(`Período: ${periodo}`, MARGEN, MARGEN + 34, derecha)
  let y = MARGEN + 62
  pdf.moveTo(MARGEN, y).lineTo(MARGEN + ancho, y).lineWidth(1.2).strokeColor(MORADO).stroke()

  // ── Datos ──
  const curso = a.cursos ? `${a.cursos.nivel} · ${a.cursos.grado_anio} "${a.cursos.division}"` : 'Sin curso'
  const datos: [string, string][] = [
    ['Alumno/a', `${a.apellido}, ${a.nombre}`],
    ['DNI', a.dni],
    ['Curso', curso],
    ['Familia', a.padre ? `${a.padre.nombre} ${a.padre.apellido}` : '—'],
    ['Emisión', fechaCorta(f.fecha_emision)],
    ['Vencimiento', fechaCorta(f.fecha_vencimiento)],
  ]
  y += 14
  const col = ancho / 2
  datos.forEach(([label, valor], i) => {
    const x = MARGEN + (i % 2) * col
    const fila = y + Math.floor(i / 2) * 32
    pdf.fillColor(GRIS).font('Helvetica-Bold').fontSize(7.5).text(label.toUpperCase(), x, fila, { characterSpacing: 0.5 })
    pdf.fillColor(TEXTO).font('Helvetica').fontSize(10.5).text(valor, x, fila + 11, { width: col - 10 })
  })
  y += Math.ceil(datos.length / 2) * 32 + 12

  // ── Ítems ──
  pdf.rect(MARGEN, y, ancho, 22).fill(MORADO)
  pdf.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5)
  pdf.text('CONCEPTO', MARGEN + 8, y + 7, { width: ancho * 0.2 })
  pdf.text('DETALLE', MARGEN + ancho * 0.2, y + 7, { width: ancho * 0.5 })
  pdf.text('IMPORTE', MARGEN, y + 7, { width: ancho - 8, align: 'right' })
  y += 22
  f.items.forEach((item, i) => {
    if (i % 2 === 1) pdf.rect(MARGEN, y, ancho, 22).fill(CEBRA)
    pdf.fillColor(TEXTO).font('Helvetica').fontSize(9.5)
    pdf.text(item.concepto, MARGEN + 8, y + 7, { width: ancho * 0.2 - 8 })
    pdf.text(item.descripcion, MARGEN + ancho * 0.2, y + 7, { width: ancho * 0.55, ellipsis: true, lineBreak: false })
    pdf.text(pesos(item.importe.toNumber()), MARGEN, y + 7, { width: ancho - 8, align: 'right' })
    y += 22
    pdf.moveTo(MARGEN, y).lineTo(MARGEN + ancho, y).lineWidth(0.5).strokeColor(BORDE).stroke()
  })

  // ── Totales ──
  y += 12
  const totales: [string, string, boolean][] = [
    ['Total', pesos(total), true],
    ['Pagado', pesos(total - saldo), false],
    ['Saldo', pesos(saldo), true],
  ]
  for (const [label, valor, fuerte] of totales) {
    pdf.fillColor(fuerte ? TEXTO : GRIS).font(fuerte ? 'Helvetica-Bold' : 'Helvetica').fontSize(fuerte ? 11.5 : 10)
    pdf.text(label, MARGEN + ancho * 0.5, y, { width: ancho * 0.25 })
    pdf.text(valor, MARGEN, y, { width: ancho - 8, align: 'right' })
    y += 18
  }
  pdf.fillColor(GRIS).font('Helvetica').fontSize(9).text(`Estado: ${estado}`, MARGEN, y + 2, { width: ancho - 8, align: 'right' })
  y += 30

  // ── Cómo pagar ──
  if (saldo > 0) {
    const lineas = [
      config.bancoAlias
        ? `Transferí el saldo al alias ${config.bancoAlias} antes del vencimiento.`
        : 'Transferí el saldo a la cuenta de la institución antes del vencimiento.',
      'Después subí el comprobante de la transferencia desde la app, en la sección de cuotas.',
    ]
    pdf.rect(MARGEN, y, ancho, 58).fillAndStroke(CEBRA, BORDE)
    pdf.fillColor(MORADO).font('Helvetica-Bold').fontSize(10).text('Cómo pagar', MARGEN + 12, y + 10)
    pdf.fillColor(TEXTO).font('Helvetica').fontSize(9.5).text(lineas.join('\n'), MARGEN + 12, y + 26, { width: ancho - 24 })
  }

  // ── Pie ──
  pdf.fillColor(GRIS).font('Helvetica').fontSize(8).text(
    'Comprobante interno de la institución. No válido como factura fiscal.',
    MARGEN,
    pdf.page.height - MARGEN - 10,
    { width: ancho, align: 'center', lineBreak: false },
  )
  pdf.end()

  return { archivo: `factura-${numero}`, pdf: await terminado }
}
