/**
 * Exportación de reportes a PDF y CSV.
 *
 * Cada reporte se arma como un `Documento` (título, filtros aplicados y
 * bloques de datos o tablas) y desde ahí se genera el PDF con PDFKit o el CSV.
 * Así un mismo reporte se sirve en los dos formatos sin duplicar la consulta.
 */
import PDFDocument from 'pdfkit'
import { config } from './config.js'

export interface Columna {
  key: string
  label: string
  /** Peso relativo del ancho de la columna (por defecto 1). */
  ancho?: number
}

export type Fila = Record<string, string | number | null | undefined>

export type Bloque =
  | { tipo: 'tabla'; titulo?: string; columnas: Columna[]; filas: Fila[] }
  | { tipo: 'datos'; titulo?: string; items: [string, string][] }
  | { tipo: 'texto'; titulo?: string; texto: string }

export interface Documento {
  titulo: string
  subtitulo?: string
  /** Filtros aplicados, para dejar constancia en el encabezado. */
  filtros?: string[]
  bloques: Bloque[]
  orientacion?: 'portrait' | 'landscape'
  /** Nombre del archivo sin extensión. */
  archivo: string
}

const INSTITUCION = 'Educar para Transformar'
const MORADO = '#5B35C5'
const GRIS = '#6B6B8A'
const BORDE = '#E8E6F5'
const CEBRA = '#F7F5FF'

const texto = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v))

/** Fecha y hora de emisión en la zona horaria de la institución. */
function emitidoEl(): string {
  return new Date().toLocaleString('es-AR', { timeZone: config.zonaHoraria, hour12: false })
}

// ── CSV ─────────────────────────────────────────────────────────

/**
 * CSV con `;` como separador y BOM, que es lo que Excel en español espera.
 */
export function documentoCsv(doc: Documento): string {
  const escapar = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lineas: string[] = [escapar(doc.titulo)]
  if (doc.subtitulo) lineas.push(escapar(doc.subtitulo))
  for (const f of doc.filtros ?? []) lineas.push(escapar(f))
  lineas.push(escapar(`Emitido: ${emitidoEl()}`))

  for (const bloque of doc.bloques) {
    lineas.push('')
    if (bloque.titulo) lineas.push(escapar(bloque.titulo))
    if (bloque.tipo === 'tabla') {
      lineas.push(bloque.columnas.map((c) => escapar(c.label)).join(';'))
      for (const fila of bloque.filas) {
        lineas.push(bloque.columnas.map((c) => escapar(fila[c.key] ?? '')).join(';'))
      }
      if (bloque.filas.length === 0) lineas.push(escapar('Sin datos'))
    } else if (bloque.tipo === 'datos') {
      for (const [label, valor] of bloque.items) lineas.push(`${escapar(label)};${escapar(valor)}`)
    } else {
      lineas.push(escapar(bloque.texto))
    }
  }
  return `﻿${lineas.join('\r\n')}\r\n`
}

// ── PDF ─────────────────────────────────────────────────────────

const MARGEN = 40

/** Devuelve el PDF ya generado como stream listo para enviar al cliente. */
export function documentoPdf(doc: Documento): PDFKit.PDFDocument {
  const pdf = new PDFDocument({
    size: 'A4',
    layout: doc.orientacion ?? 'portrait',
    margin: MARGEN,
    bufferPages: true,
    info: { Title: doc.titulo, Author: INSTITUCION },
  })

  encabezado(pdf, doc)
  for (const bloque of doc.bloques) {
    if (bloque.tipo === 'tabla') dibujarTabla(pdf, bloque)
    else if (bloque.tipo === 'datos') dibujarDatos(pdf, bloque)
    else dibujarTexto(pdf, bloque)
  }
  piePaginas(pdf)
  pdf.end()
  return pdf
}

const anchoUtil = (pdf: PDFKit.PDFDocument) => pdf.page.width - MARGEN * 2

function encabezado(pdf: PDFKit.PDFDocument, doc: Documento) {
  pdf.fillColor(MORADO).font('Helvetica-Bold').fontSize(9).text(INSTITUCION.toUpperCase(), MARGEN, MARGEN, {
    characterSpacing: 1.5,
  })
  pdf.moveDown(0.3)
  pdf.fillColor('#1A1A2E').font('Helvetica-Bold').fontSize(17).text(doc.titulo)
  if (doc.subtitulo) {
    pdf.moveDown(0.15)
    pdf.fillColor(GRIS).font('Helvetica').fontSize(11).text(doc.subtitulo)
  }
  pdf.moveDown(0.4)
  pdf.fillColor(GRIS).font('Helvetica').fontSize(8.5)
  for (const filtro of doc.filtros ?? []) pdf.text(filtro)
  pdf.text(`Emitido: ${emitidoEl()}`)
  pdf.moveDown(0.6)
  const y = pdf.y
  pdf.moveTo(MARGEN, y).lineTo(pdf.page.width - MARGEN, y).lineWidth(1).strokeColor(MORADO).stroke()
  pdf.y = y + 14
}

function tituloBloque(pdf: PDFKit.PDFDocument, titulo?: string) {
  if (!titulo) return
  espacioParaOSalto(pdf, 30)
  pdf.fillColor('#1A1A2E').font('Helvetica-Bold').fontSize(11).text(titulo, MARGEN, pdf.y)
  pdf.moveDown(0.4)
}

/** Si no entra `alto` en lo que queda de página, pasa a una nueva. */
function espacioParaOSalto(pdf: PDFKit.PDFDocument, alto: number) {
  if (pdf.y + alto > pdf.page.height - MARGEN - 20) pdf.addPage()
}

function dibujarTexto(pdf: PDFKit.PDFDocument, bloque: Extract<Bloque, { tipo: 'texto' }>) {
  tituloBloque(pdf, bloque.titulo)
  pdf.fillColor(GRIS).font('Helvetica').fontSize(10).text(bloque.texto, MARGEN, pdf.y, { width: anchoUtil(pdf) })
  pdf.moveDown(1)
}

/** Ficha de datos en dos columnas (etiqueta arriba, valor abajo). */
function dibujarDatos(pdf: PDFKit.PDFDocument, bloque: Extract<Bloque, { tipo: 'datos' }>) {
  tituloBloque(pdf, bloque.titulo)
  const ancho = anchoUtil(pdf) / 2
  let fila = 0
  for (let i = 0; i < bloque.items.length; i += 2) {
    espacioParaOSalto(pdf, 34)
    const y = pdf.y
    const pareja = bloque.items.slice(i, i + 2)
    pareja.forEach(([label, valor], col) => {
      const x = MARGEN + col * ancho
      pdf.fillColor(GRIS).font('Helvetica-Bold').fontSize(7.5).text(label.toUpperCase(), x, y, {
        width: ancho - 10,
        characterSpacing: 0.5,
      })
      pdf.fillColor('#1A1A2E').font('Helvetica').fontSize(10.5).text(texto(valor), x, y + 11, { width: ancho - 10 })
    })
    pdf.y = y + 32
    fila++
  }
  if (fila === 0) pdf.moveDown(0.5)
  pdf.moveDown(0.5)
}

function dibujarTabla(pdf: PDFKit.PDFDocument, bloque: Extract<Bloque, { tipo: 'tabla' }>) {
  tituloBloque(pdf, bloque.titulo)

  const total = anchoUtil(pdf)
  const pesos = bloque.columnas.map((c) => c.ancho ?? 1)
  const suma = pesos.reduce((a, b) => a + b, 0)
  const anchos = pesos.map((p) => (p / suma) * total)
  const xs = anchos.reduce<number[]>((acc, w, i) => [...acc, (acc[i - 1] ?? MARGEN) + (anchos[i - 1] ?? 0)], [])

  if (bloque.filas.length === 0) {
    pdf.fillColor(GRIS).font('Helvetica-Oblique').fontSize(10).text('Sin datos para los filtros seleccionados.', MARGEN, pdf.y)
    pdf.moveDown(1)
    return
  }

  const cabecera = () => {
    const y = pdf.y
    pdf.rect(MARGEN, y, total, 20).fill(MORADO)
    pdf.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5)
    bloque.columnas.forEach((c, i) => {
      pdf.text(c.label.toUpperCase(), xs[i] + 6, y + 6, { width: anchos[i] - 12, ellipsis: true, lineBreak: false })
    })
    pdf.y = y + 20
  }

  cabecera()
  bloque.filas.forEach((fila, indice) => {
    const valores = bloque.columnas.map((c, i) => {
      const v = texto(fila[c.key])
      return { v, alto: pdf.font('Helvetica').fontSize(9).heightOfString(v, { width: anchos[i] - 12 }) }
    })
    const alto = Math.max(18, ...valores.map((v) => v.alto + 8))

    if (pdf.y + alto > pdf.page.height - MARGEN - 20) {
      pdf.addPage()
      cabecera()
    }
    const y = pdf.y
    if (indice % 2 === 1) pdf.rect(MARGEN, y, total, alto).fill(CEBRA)
    pdf.fillColor('#1A1A2E').font('Helvetica').fontSize(9)
    valores.forEach((valor, i) => {
      pdf.text(valor.v, xs[i] + 6, y + 5, { width: anchos[i] - 12 })
    })
    pdf.moveTo(MARGEN, y + alto).lineTo(MARGEN + total, y + alto).lineWidth(0.5).strokeColor(BORDE).stroke()
    pdf.y = y + alto
  })

  pdf.moveDown(0.6)
  pdf.fillColor(GRIS).font('Helvetica-Bold').fontSize(9).text(`Total: ${bloque.filas.length} registro(s)`, MARGEN, pdf.y)
  pdf.moveDown(1)
}

/** Numera todas las páginas al final ("Página X de Y"). */
function piePaginas(pdf: PDFKit.PDFDocument) {
  const rango = pdf.bufferedPageRange()
  for (let i = 0; i < rango.count; i++) {
    pdf.switchToPage(rango.start + i)
    // Escribir por debajo del margen inferior haría que PDFKit agregue una
    // página nueva; se anula el margen mientras se dibuja el pie.
    pdf.page.margins.bottom = 0
    const y = pdf.page.height - MARGEN + 6
    pdf.fillColor(GRIS).font('Helvetica').fontSize(8)
    pdf.text(INSTITUCION, MARGEN, y, { width: anchoUtil(pdf) / 2, lineBreak: false })
    pdf.text(`Página ${i + 1} de ${rango.count}`, MARGEN + anchoUtil(pdf) / 2, y, {
      width: anchoUtil(pdf) / 2,
      align: 'right',
      lineBreak: false,
    })
  }
  pdf.flushPages()
}
