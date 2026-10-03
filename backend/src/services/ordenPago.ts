/**
 * Orden de pago: el "comprobante de pago" que el sistema emite cuando la familia
 * elige qué ítems de una factura va a pagar. Guarda el saldo de cada ítem al
 * emitirla; después la familia transfiere ese total al alias de la institución y
 * sube el comprobante de la transferencia (T13).
 *
 * `crearOrdenPago` valida y guarda; `pdfOrdenPago` arma el PDF con los datos
 * bancarios. El estilo del PDF es el de la factura (`services/facturacion/pdf.ts`).
 */
import PDFDocument from 'pdfkit'
import { Prisma } from '../generated/prisma/client.js'
import { config } from '../lib/config.js'
import { HttpError } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { numeroFactura } from './facturacion/pdf.js'

const INSTITUCION = 'Educar para Transformar'
const MORADO = '#5B35C5'
const TEXTO = '#1A1A2E'
const GRIS = '#6B6B8A'
const BORDE = '#E8E6F5'
const CEBRA = '#F7F5FF'
const MARGEN = 50

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const pesos = (n: number) =>
  `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fechaCorta = (d: Date) => d.toISOString().slice(0, 10).split('-').reverse().join('/')

/** Ids de los ítems elegidos: una lista no vacía de enteros positivos, sin repetidos. */
export function idsDeItems(valor: unknown): number[] {
  if (!Array.isArray(valor) || valor.length === 0) throw new HttpError(400, 'Elegí al menos un ítem para pagar')
  const ids = valor.map(Number)
  if (ids.some((n) => !Number.isInteger(n) || n <= 0)) throw new HttpError(400, 'Los ítems elegidos no son válidos')
  return [...new Set(ids)]
}

/**
 * Emite la orden de pago de los ítems elegidos de una factura, por el saldo que
 * tienen hoy. Responde 400 si algún ítem no es de esa factura o ya no tiene saldo.
 */
export async function crearOrdenPago(idFactura: number, idsItems: number[], idUsuario: string) {
  const orden = await prisma.$transaction(async (tx) => {
    const items = await tx.itemFactura.findMany({
      where: { id_factura: idFactura, id_item: { in: idsItems } },
      orderBy: { id_item: 'asc' },
    })
    if (items.length !== idsItems.length) throw new HttpError(400, 'Alguno de los ítems elegidos no es de esta factura')
    const pagado = items.find((i) => i.saldo.lte(0))
    if (pagado) throw new HttpError(400, `"${pagado.descripcion}" ya está pagado: sacalo de la lista para seguir`)

    const total = items.reduce((suma, i) => suma.plus(i.saldo), new Prisma.Decimal(0))
    return tx.ordenPago.create({
      data: {
        id_factura: idFactura,
        total,
        id_usuario: idUsuario,
        items: { create: items.map((i) => ({ id_item: i.id_item, importe: i.saldo })) },
      },
      include: { items: { include: { items: { select: { concepto: true, descripcion: true } } }, orderBy: { id_item: 'asc' } } },
    })
  })

  return {
    id_orden: orden.id_orden,
    id_factura: orden.id_factura,
    numero: orden.numero,
    fecha: orden.fecha,
    total: orden.total,
    alias: config.bancoAlias || null,
    items: orden.items.map((i) => ({
      id_item: i.id_item,
      importe: i.importe,
      concepto: i.items.concepto,
      descripcion: i.items.descripcion,
    })),
  }
}

/** El PDF de una orden de pago. Responde 404 si no existe. */
export async function pdfOrdenPago(idOrden: number): Promise<{ archivo: string; pdf: Buffer }> {
  const orden = await prisma.ordenPago.findUnique({
    where: { id_orden: idOrden },
    include: {
      items: { include: { items: { select: { concepto: true, descripcion: true } } }, orderBy: { id_item: 'asc' } },
      facturas: {
        select: {
          numero: true,
          anio: true,
          mes: true,
          fecha_vencimiento: true,
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
      },
    },
  })
  if (!orden) throw new HttpError(404, 'Orden de pago no encontrada')

  const numero = numeroFactura(orden.numero)
  const f = orden.facturas
  const a = f.alumnos
  const total = orden.total.toNumber()

  const pdf = new PDFDocument({
    size: 'A4',
    margin: MARGEN,
    info: { Title: `Orden de pago ${numero}`, Author: INSTITUCION },
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
  pdf.fillColor(TEXTO).font('Helvetica-Bold').fontSize(20).text('Orden de pago', MARGEN, MARGEN + 16)
  pdf.font('Helvetica-Bold').fontSize(12).text(`N° ${numero}`, MARGEN, MARGEN + 16, derecha)
  pdf.fillColor(GRIS).font('Helvetica').fontSize(10).text(`Emitida el ${fechaCorta(orden.fecha)}`, MARGEN, MARGEN + 34, derecha)
  let y = MARGEN + 62
  pdf.moveTo(MARGEN, y).lineTo(MARGEN + ancho, y).lineWidth(1.2).strokeColor(MORADO).stroke()

  // ── Datos ──
  const curso = a.cursos ? `${a.cursos.nivel} · ${a.cursos.grado_anio} "${a.cursos.division}"` : 'Sin curso'
  const datos: [string, string][] = [
    ['Alumno/a', `${a.apellido}, ${a.nombre}`],
    ['DNI', a.dni],
    ['Curso', curso],
    ['Familia', a.padre ? `${a.padre.nombre} ${a.padre.apellido}` : '—'],
    ['Factura', `N° ${numeroFactura(f.numero)} · ${MESES[f.mes - 1]} ${f.anio}`],
    ['Vencimiento de la factura', fechaCorta(f.fecha_vencimiento)],
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

  // ── Ítems que se pagan ──
  pdf.rect(MARGEN, y, ancho, 22).fill(MORADO)
  pdf.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5)
  pdf.text('CONCEPTO', MARGEN + 8, y + 7, { width: ancho * 0.2 })
  pdf.text('DETALLE', MARGEN + ancho * 0.2, y + 7, { width: ancho * 0.5 })
  pdf.text('A PAGAR', MARGEN, y + 7, { width: ancho - 8, align: 'right' })
  y += 22
  orden.items.forEach((item, i) => {
    if (i % 2 === 1) pdf.rect(MARGEN, y, ancho, 22).fill(CEBRA)
    pdf.fillColor(TEXTO).font('Helvetica').fontSize(9.5)
    pdf.text(item.items.concepto, MARGEN + 8, y + 7, { width: ancho * 0.2 - 8 })
    pdf.text(item.items.descripcion, MARGEN + ancho * 0.2, y + 7, { width: ancho * 0.55, ellipsis: true, lineBreak: false })
    pdf.text(pesos(item.importe.toNumber()), MARGEN, y + 7, { width: ancho - 8, align: 'right' })
    y += 22
    pdf.moveTo(MARGEN, y).lineTo(MARGEN + ancho, y).lineWidth(0.5).strokeColor(BORDE).stroke()
  })

  // ── Total ──
  y += 12
  pdf.fillColor(TEXTO).font('Helvetica-Bold').fontSize(12.5)
  pdf.text('Total a transferir', MARGEN + ancho * 0.5, y, { width: ancho * 0.25 })
  pdf.text(pesos(total), MARGEN, y, { width: ancho - 8, align: 'right' })
  y += 34

  // ── Datos bancarios ──
  const alias = config.bancoAlias
  const lineas = [
    alias
      ? `Transferí ${pesos(total)} al alias ${alias}.`
      : `Transferí ${pesos(total)} a la cuenta de la institución (consultá el alias en la administración).`,
    `En el motivo de la transferencia indicá "Orden ${numero}".`,
    'Después subí la foto o el PDF del comprobante de la transferencia desde la app, en la sección de cuotas.',
  ]
  pdf.rect(MARGEN, y, ancho, 78).fillAndStroke(CEBRA, BORDE)
  pdf.fillColor(MORADO).font('Helvetica-Bold').fontSize(10).text('Cómo pagar', MARGEN + 12, y + 10)
  pdf.fillColor(TEXTO).font('Helvetica').fontSize(9.5).text(lineas.join('\n'), MARGEN + 12, y + 26, { width: ancho - 24 })

  // ── Pie ──
  pdf.fillColor(GRIS).font('Helvetica').fontSize(8).text(
    'Comprobante interno de la institución. No válido como factura fiscal.',
    MARGEN,
    pdf.page.height - MARGEN - 10,
    { width: ancho, align: 'center', lineBreak: false },
  )
  pdf.end()

  return { archivo: `orden-de-pago-${numero}`, pdf: await terminado }
}
