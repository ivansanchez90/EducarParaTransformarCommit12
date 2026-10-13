/**
 * Reportes financieros para la Dirección: ingresos por período y pagos completos o incompletos
 * por año y alumno (T21), y la cobranza de deportes y de transporte (T22).
 *
 * Igual que `reportes.ts`, cada uno se sirve con `?formato=json|pdf|csv` (ver `responderDocumento`).
 * Se monta en `/api/reportes`, junto al router de reportes académicos.
 */
import { Router } from 'express'
import type { Request, Response } from 'express'
import { config } from '../lib/config.js'
import type { Documento, Fila } from '../lib/documentos.js'
import { responderDocumento } from '../lib/documentos.js'
import { HttpError, fecha, hora, hoyISO, id } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { ROLES_ADMIN, requireRole } from '../middleware/auth.js'
import { asincrono, conSesion } from '../middleware/envoltorios.js'
import { estadoFactura } from '../services/facturacion/estado.js'
import {
  MESES,
  ingresosPorPeriodo,
  pesos,
  resumenPorAlumno,
} from '../services/reportesFinancieros.js'
import type { Agrupacion, FacturaDelAnio } from '../services/reportesFinancieros.js'
import { DIAS_SEMANA, cobranzaPorServicio, horaTexto, horariosTexto } from '../services/reportesCobranza.js'
import type { Cobranza, ItemServicio } from '../services/reportesCobranza.js'

export const reportesFinancierosRouter = Router()
reportesFinancierosRouter.use(conSesion, requireRole(...ROLES_ADMIN))

/** Argentina no cambia de hora en verano: la medianoche local es siempre UTC−3. */
const OFFSET_ARGENTINA = '-03:00'
const UN_DIA_MS = 24 * 60 * 60 * 1000

const fechaTexto = (dia: string) => dia.split('-').reverse().join('/')

/** Una fecha `AAAA-MM-DD` de la consulta, o `defecto`; responde 400 si no es una fecha válida. */
function diaDeLaConsulta(valor: unknown, defecto: string): string {
  const fechaPedida = fecha(valor)
  return fechaPedida ? fechaPedida.toISOString().slice(0, 10) : defecto
}

/** Año de la consulta (por defecto, el de hoy); responde 400 si no es un año razonable. */
function anioDeLaConsulta(valor: unknown): number {
  const anio = valor === undefined || valor === '' ? Number(hoyISO().slice(0, 4)) : Number(valor)
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) throw new HttpError(400, 'El año tiene que estar entre 2000 y 2100')
  return anio
}

// ── Ingresos por período ───────────────────────────────────────

/**
 * Lo que se cobró entre dos fechas (`?desde=&hasta=`, por defecto desde el 1 de enero hasta hoy,
 * inclusivas, por el día de Argentina en que se registró el pago), agrupado por `?agrupar=mes|dia`.
 */
async function ingresos(req: Request, res: Response) {
  const hoy = hoyISO()
  const desde = diaDeLaConsulta(req.query.desde, `${hoy.slice(0, 4)}-01-01`)
  const hasta = diaDeLaConsulta(req.query.hasta, hoy)
  if (desde > hasta) throw new HttpError(400, 'La fecha "desde" no puede ser posterior a la fecha "hasta"')
  const agrupar: Agrupacion = req.query.agrupar === 'dia' ? 'dia' : 'mes'

  const inicio = new Date(`${desde}T00:00:00${OFFSET_ARGENTINA}`)
  const fin = new Date(new Date(`${hasta}T00:00:00${OFFSET_ARGENTINA}`).getTime() + UN_DIA_MS)
  const pagos = await prisma.pago.findMany({
    where: { fecha_pago: { gte: inicio, lt: fin } },
    select: { fecha_pago: true, monto_pagado: true, metodo_pago: true },
  })
  const resultado = ingresosPorPeriodo(
    pagos.map((p) => ({ ...p, monto_pagado: p.monto_pagado.toNumber() })),
    agrupar,
    config.zonaHoraria,
  )

  const doc: Documento = {
    titulo: 'Ingresos por período',
    filtros: [`Desde: ${fechaTexto(desde)}`, `Hasta: ${fechaTexto(hasta)}`, `Agrupado por: ${agrupar === 'mes' ? 'mes' : 'día'}`],
    archivo: 'ingresos',
    bloques: [
      {
        tipo: 'datos',
        items: [
          ['Total ingresado', pesos(resultado.total)],
          ['Cantidad de pagos', String(resultado.cantidad)],
        ],
      },
      {
        tipo: 'tabla',
        titulo: agrupar === 'mes' ? 'Ingresos por mes' : 'Ingresos por día',
        columnas: [
          { key: 'periodo', label: 'Período', ancho: 1.5 },
          { key: 'pagos', label: 'Pagos', ancho: 0.7 },
          { key: 'ingresos', label: 'Ingresos', ancho: 1.2 },
        ],
        filas: resultado.periodos.map((p) => ({ periodo: p.etiqueta, pagos: p.cantidad, ingresos: pesos(p.monto) })),
      },
      {
        tipo: 'tabla',
        titulo: 'Por método de pago',
        columnas: [
          { key: 'metodo', label: 'Método de pago', ancho: 1.5 },
          { key: 'pagos', label: 'Pagos', ancho: 0.7 },
          { key: 'ingresos', label: 'Ingresos', ancho: 1.2 },
        ],
        filas: resultado.porMetodo.map((m) => ({ metodo: m.metodo, pagos: m.cantidad, ingresos: pesos(m.monto) })),
      },
    ],
  }
  responderDocumento(res, doc, req.query.formato)
}

// ── Pagos completos e incompletos ──────────────────────────────

/**
 * Facturas de un año con los datos de su alumno, listas para resumir. Con `id_alumno` solo las
 * de ese alumno; con `nivel`, solo las de los alumnos de ese nivel educativo.
 */
async function facturasDelAnio(anio: number, nivel: string | undefined, idAlumno: number | null): Promise<FacturaDelAnio[]> {
  const facturas = await prisma.factura.findMany({
    where: {
      anio,
      id_alumno: idAlumno ?? undefined,
      alumnos: nivel ? { cursos: { nivel } } : undefined,
    },
    select: {
      id_alumno: true,
      mes: true,
      numero: true,
      total: true,
      saldo: true,
      fecha_vencimiento: true,
      alumnos: { select: { nombre: true, apellido: true, cursos: { select: { nivel: true, grado_anio: true, division: true } } } },
    },
    orderBy: [{ id_alumno: 'asc' }, { mes: 'asc' }],
  })
  return facturas.map((f) => ({
    id_alumno: f.id_alumno,
    mes: f.mes,
    numero: f.numero,
    total: f.total.toNumber(),
    saldo: f.saldo.toNumber(),
    fecha_vencimiento: f.fecha_vencimiento,
    nombre: f.alumnos.nombre,
    apellido: f.alumnos.apellido,
    curso: f.alumnos.cursos ? `${f.alumnos.cursos.grado_anio}° ${f.alumnos.cursos.division}` : 'Sin curso',
    nivel: f.alumnos.cursos?.nivel ?? 'Sin nivel',
  }))
}

/**
 * Pagos de un año, por alumno. `completos`: los alumnos con todas sus facturas del año pagadas.
 * `incompletos`: los que tienen alguna con saldo. Con `?id_alumno=` el reporte baja al detalle
 * de las facturas de ese alumno (las pagadas o las que tienen saldo, según el reporte).
 */
function reportePagos(completos: boolean) {
  return async (req: Request, res: Response) => {
    const anio = anioDeLaConsulta(req.query.anio)
    const nivel = typeof req.query.nivel === 'string' && req.query.nivel ? req.query.nivel : undefined
    const idAlumno = req.query.id_alumno ? id(req.query.id_alumno) : null
    const hoy = fecha(hoyISO()) ?? new Date()
    const facturas = await facturasDelAnio(anio, nivel, idAlumno)

    const filtros = [`Año: ${anio}`, `Nivel educativo: ${nivel ?? 'Todos'}`]
    const titulo = completos ? 'Pagos completos' : 'Pagos incompletos'
    const archivo = completos ? 'pagos-completos' : 'pagos-incompletos'
    const alumnos = resumenPorAlumno(facturas, hoy).filter((a) => a.completo === completos)

    // Detalle de un alumno: sus facturas, no el resumen.
    if (idAlumno) {
      const nombre = facturas[0] ? `${facturas[0].apellido}, ${facturas[0].nombre}` : 'Alumno sin facturas ese año'
      const filas: Fila[] = facturas
        .filter((f) => (f.saldo <= 0) === completos)
        .map((f) => ({
          periodo: `${MESES[f.mes - 1]} ${anio}`,
          factura: String(f.numero).padStart(8, '0'),
          total: pesos(f.total),
          pagado: pesos(f.total - f.saldo),
          saldo: pesos(Math.max(0, f.saldo)),
          estado: estadoFactura({ total: f.total, saldo: f.saldo, fecha_vencimiento: f.fecha_vencimiento }, hoy),
        }))
      responderDocumento(
        res,
        {
          titulo: `${titulo} · detalle del alumno`,
          subtitulo: nombre,
          filtros: [`Año: ${anio}`],
          archivo: `${archivo}-alumno-${idAlumno}`,
          bloques: [
            {
              tipo: 'tabla',
              columnas: [
                { key: 'periodo', label: 'Período', ancho: 1.3 },
                { key: 'factura', label: 'Factura', ancho: 1 },
                { key: 'total', label: 'Total', ancho: 1 },
                { key: 'pagado', label: 'Pagado', ancho: 1 },
                { key: 'saldo', label: 'Saldo', ancho: 1 },
                { key: 'estado', label: 'Estado', ancho: 1 },
              ],
              filas,
            },
          ],
        },
        req.query.formato,
      )
      return
    }

    const suma = (campo: 'facturado' | 'pagado' | 'adeudado') => Math.round(alumnos.reduce((s, a) => s + a[campo] * 100, 0)) / 100
    const columnas = [
      { key: 'alumno', label: 'Alumno', ancho: 1.8 },
      { key: 'legajo', label: 'Legajo', ancho: 0.7 },
      { key: 'curso', label: 'Curso', ancho: 0.8 },
      { key: 'nivel', label: 'Nivel', ancho: 1 },
      { key: 'facturas', label: 'Facturas', ancho: 0.8 },
      { key: 'facturado', label: 'Facturado', ancho: 1.1 },
      { key: 'pagado', label: 'Pagado', ancho: 1.1 },
      ...(completos ? [] : [{ key: 'adeudado', label: 'Adeudado', ancho: 1.1 }, { key: 'vencidas', label: 'Vencidas', ancho: 0.8 }]),
    ]
    const doc: Documento = {
      titulo,
      filtros,
      archivo,
      orientacion: 'landscape',
      bloques: [
        {
          tipo: 'datos',
          items: [
            ['Alumnos', String(alumnos.length)],
            ['Total facturado', pesos(suma('facturado'))],
            ['Total pagado', pesos(suma('pagado'))],
            ...(completos ? [] : ([['Total adeudado', pesos(suma('adeudado'))]] as [string, string][])),
          ],
        },
        {
          tipo: 'tabla',
          columnas,
          filas: alumnos.map((a) => ({
            alumno: a.alumno,
            legajo: a.id_alumno,
            curso: a.curso,
            nivel: a.nivel,
            facturas: a.facturas,
            facturado: pesos(a.facturado),
            pagado: pesos(a.pagado),
            adeudado: pesos(a.adeudado),
            vencidas: a.vencidas,
          })),
        },
      ],
    }
    responderDocumento(res, doc, req.query.formato)
  }
}

// ── Cobranza de deportes y de transporte ───────────────────────

/** Mes de la consulta (1 a 12), o null para todo el año; responde 400 si no es un mes. */
function mesDeLaConsulta(valor: unknown): number | null {
  if (valor === undefined || valor === '') return null
  const mes = Number(valor)
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) throw new HttpError(400, 'El mes tiene que estar entre 1 y 12')
  return mes
}

const textoDeLaConsulta = (valor: unknown) => (typeof valor === 'string' && valor ? valor : undefined)
const idOpcional = (valor: unknown) => (valor === undefined || valor === '' ? undefined : id(valor))

/** Período, servicio y nivel que piden los dos reportes de cobranza. */
function filtrosComunes(req: Request) {
  const anio = anioDeLaConsulta(req.query.anio)
  const mes = mesDeLaConsulta(req.query.mes)
  const nivel = textoDeLaConsulta(req.query.nivel)
  return { anio, mes, nivel, periodo: mes ? `${MESES[mes - 1]} ${anio}` : `Año ${anio}` }
}

/**
 * Ítems de deporte o de transporte facturados en el período, con su alumno. Con `ids`, solo los
 * de esos servicios; sin `ids`, todos (también los de un servicio ya borrado, para no perder plata).
 */
async function itemsDelPeriodo(
  concepto: 'Deporte' | 'Transporte',
  ids: number[] | undefined,
  { anio, mes, nivel }: { anio: number; mes: number | null; nivel: string | undefined },
  nombres: Map<number, string>,
): Promise<ItemServicio[]> {
  const items = await prisma.itemFactura.findMany({
    where: {
      concepto,
      id_referencia: ids ? { in: ids } : { not: null },
      facturas: { anio, mes: mes ?? undefined, alumnos: nivel ? { cursos: { nivel } } : undefined },
    },
    select: {
      id_referencia: true,
      importe: true,
      saldo: true,
      facturas: {
        select: {
          anio: true,
          mes: true,
          fecha_vencimiento: true,
          id_alumno: true,
          alumnos: { select: { nombre: true, apellido: true, cursos: { select: { nivel: true, grado_anio: true, division: true } } } },
        },
      },
    },
  })
  return items.map((i) => {
    const idServicio = i.id_referencia ?? 0
    const f = i.facturas
    return {
      id_servicio: idServicio,
      servicio: nombres.get(idServicio) ?? `${concepto} ${idServicio} (dado de baja)`,
      id_alumno: f.id_alumno,
      nombre: f.alumnos.nombre,
      apellido: f.alumnos.apellido,
      curso: f.alumnos.cursos ? `${f.alumnos.cursos.grado_anio}° ${f.alumnos.cursos.division}` : 'Sin curso',
      nivel: f.alumnos.cursos?.nivel ?? 'Sin nivel',
      anio: f.anio,
      mes: f.mes,
      importe: i.importe.toNumber(),
      saldo: i.saldo.toNumber(),
      fecha_vencimiento: f.fecha_vencimiento,
    }
  })
}

const totales = (c: Cobranza): [string, string][] => [
  ['Alumnos', String(c.alumnos)],
  ['Total facturado', pesos(c.facturado)],
  ['Total pagado', pesos(c.pagado)],
  ['Saldo', pesos(c.saldo)],
]

/** Tabla con una fila por ítem: lo facturado, lo pagado y el saldo del servicio de cada alumno. */
function tablaDetalle(c: Cobranza, servicio: string): Documento['bloques'][number] {
  return {
    tipo: 'tabla',
    titulo: 'Detalle por alumno',
    columnas: [
      { key: 'servicio', label: servicio, ancho: 1.2 },
      { key: 'alumno', label: 'Alumno', ancho: 1.6 },
      { key: 'legajo', label: 'Legajo', ancho: 0.6 },
      { key: 'curso', label: 'Curso', ancho: 0.6 },
      { key: 'nivel', label: 'Nivel', ancho: 0.9 },
      { key: 'periodo', label: 'Período', ancho: 1.1 },
      { key: 'facturado', label: 'Facturado', ancho: 1 },
      { key: 'pagado', label: 'Pagado', ancho: 1 },
      { key: 'saldo', label: 'Saldo', ancho: 1 },
      { key: 'estado', label: 'Estado', ancho: 0.9 },
    ],
    filas: c.filas.map((f) => ({
      servicio: f.servicio,
      alumno: f.alumno,
      legajo: f.id_alumno,
      curso: f.curso,
      nivel: f.nivel,
      periodo: f.periodo,
      facturado: pesos(f.facturado),
      pagado: pesos(f.pagado),
      saldo: pesos(f.saldo),
      estado: f.estado,
    })),
  }
}

/**
 * Pagos de deportes (HU22): lo facturado, pagado y adeudado de cada deporte en un año o un mes
 * (`?anio=&mes=`), filtrado por deporte (`?id_actividad=`), nivel educativo del alumno
 * (`?nivel=`), horario (`?dia=` y/o `?hora=` de inicio) y profesor a cargo (`?id_docente=`).
 */
async function pagosDeportes(req: Request, res: Response) {
  const comunes = filtrosComunes(req)
  const idActividad = idOpcional(req.query.id_actividad)
  const idDocente = idOpcional(req.query.id_docente)
  const dia = textoDeLaConsulta(req.query.dia)
  if (dia && !DIAS_SEMANA.includes(dia)) throw new HttpError(400, `Día inválido: ${dia}`)
  const horaInicio = req.query.hora ? hora(req.query.hora) : undefined

  const actividades = await prisma.actividadExtracurricular.findMany({
    where: {
      id_actividad: idActividad,
      id_docente: idDocente,
      horarios: dia || horaInicio ? { some: { dia_semana: dia, hora_inicio: horaInicio } } : undefined,
    },
    select: {
      id_actividad: true,
      nombre: true,
      horarios: { select: { dia_semana: true, hora_inicio: true, hora_fin: true } },
      docentes: { select: { usuarios: { select: { nombre: true, apellido: true } } } },
    },
  })
  const profesorDe = (a: (typeof actividades)[number]) =>
    a.docentes?.usuarios ? `${a.docentes.usuarios.apellido}, ${a.docentes.usuarios.nombre}` : 'Sin asignar'
  const datos = new Map(actividades.map((a) => [a.id_actividad, { profesor: profesorDe(a), horario: horariosTexto(a.horarios) }]))

  const filtraActividad = idActividad !== undefined || idDocente !== undefined || dia !== undefined || horaInicio !== undefined
  const items = await itemsDelPeriodo(
    'Deporte',
    filtraActividad ? actividades.map((a) => a.id_actividad) : undefined,
    comunes,
    new Map(actividades.map((a) => [a.id_actividad, a.nombre])),
  )
  const cobranza = cobranzaPorServicio(items, fecha(hoyISO()) ?? new Date())

  const horarioPedido = [dia, horaInicio ? horaTexto(horaInicio) : undefined].filter(Boolean).join(' ')
  const doc: Documento = {
    titulo: 'Pagos de deportes',
    filtros: [
      `Período: ${comunes.periodo}`,
      `Deporte: ${idActividad ? (actividades[0]?.nombre ?? '—') : 'Todos'}`,
      `Nivel educativo: ${comunes.nivel ?? 'Todos'}`,
      `Horario: ${horarioPedido || 'Todos'}`,
      `Profesor: ${idDocente ? (actividades[0] ? profesorDe(actividades[0]) : '—') : 'Todos'}`,
    ],
    archivo: 'pagos-deportes',
    orientacion: 'landscape',
    bloques: [
      { tipo: 'datos', items: totales(cobranza) },
      {
        tipo: 'tabla',
        titulo: 'Por deporte',
        columnas: [
          { key: 'deporte', label: 'Deporte', ancho: 1.2 },
          { key: 'profesor', label: 'Profesor a cargo', ancho: 1.3 },
          { key: 'horario', label: 'Horario', ancho: 2 },
          { key: 'alumnos', label: 'Alumnos', ancho: 0.7 },
          { key: 'facturado', label: 'Facturado', ancho: 1 },
          { key: 'pagado', label: 'Pagado', ancho: 1 },
          { key: 'saldo', label: 'Saldo', ancho: 1 },
        ],
        filas: cobranza.porServicio.map((s) => ({
          deporte: s.servicio,
          profesor: datos.get(s.id_servicio)?.profesor ?? '—',
          horario: datos.get(s.id_servicio)?.horario ?? '—',
          alumnos: s.alumnos,
          facturado: pesos(s.facturado),
          pagado: pesos(s.pagado),
          saldo: pesos(s.saldo),
        })),
      },
      tablaDetalle(cobranza, 'Deporte'),
    ],
  }
  responderDocumento(res, doc, req.query.formato)
}

/**
 * Pagos de transporte (HU23): lo facturado, pagado y adeudado de cada recorrido en un año o un
 * mes (`?anio=&mes=`), filtrado por recorrido (`?id_recorrido=`) y nivel educativo (`?nivel=`).
 */
async function pagosTransporte(req: Request, res: Response) {
  const comunes = filtrosComunes(req)
  const idRecorrido = idOpcional(req.query.id_recorrido)

  const recorridos = await prisma.recorridoTransporte.findMany({
    where: { id_recorrido: idRecorrido },
    select: { id_recorrido: true, nombre: true, zona: true, hora_ida: true, hora_vuelta: true },
  })
  const datos = new Map(recorridos.map((r) => [r.id_recorrido, r]))
  const items = await itemsDelPeriodo(
    'Transporte',
    idRecorrido === undefined ? undefined : recorridos.map((r) => r.id_recorrido),
    comunes,
    new Map(recorridos.map((r) => [r.id_recorrido, r.nombre])),
  )
  const cobranza = cobranzaPorServicio(items, fecha(hoyISO()) ?? new Date())
  const horaOGuion = (d: Date | null) => (d ? horaTexto(d) : '—')

  const doc: Documento = {
    titulo: 'Pagos de transporte',
    filtros: [
      `Período: ${comunes.periodo}`,
      `Recorrido: ${idRecorrido ? (recorridos[0]?.nombre ?? '—') : 'Todos'}`,
      `Nivel educativo: ${comunes.nivel ?? 'Todos'}`,
    ],
    archivo: 'pagos-transporte',
    orientacion: 'landscape',
    bloques: [
      { tipo: 'datos', items: totales(cobranza) },
      {
        tipo: 'tabla',
        titulo: 'Por recorrido',
        columnas: [
          { key: 'recorrido', label: 'Recorrido', ancho: 1.3 },
          { key: 'zona', label: 'Zona', ancho: 1.2 },
          { key: 'horario', label: 'Ida / vuelta', ancho: 1 },
          { key: 'alumnos', label: 'Alumnos', ancho: 0.7 },
          { key: 'facturado', label: 'Facturado', ancho: 1 },
          { key: 'pagado', label: 'Pagado', ancho: 1 },
          { key: 'saldo', label: 'Saldo', ancho: 1 },
        ],
        filas: cobranza.porServicio.map((s) => {
          const r = datos.get(s.id_servicio)
          return {
            recorrido: s.servicio,
            zona: r?.zona ?? '—',
            horario: r ? `${horaOGuion(r.hora_ida)} / ${horaOGuion(r.hora_vuelta)}` : '—',
            alumnos: s.alumnos,
            facturado: pesos(s.facturado),
            pagado: pesos(s.pagado),
            saldo: pesos(s.saldo),
          }
        }),
      },
      tablaDetalle(cobranza, 'Recorrido'),
    ],
  }
  responderDocumento(res, doc, req.query.formato)
}

reportesFinancierosRouter.get('/ingresos', asincrono(ingresos))
reportesFinancierosRouter.get('/pagos-completos', asincrono(reportePagos(true)))
reportesFinancierosRouter.get('/pagos-incompletos', asincrono(reportePagos(false)))
reportesFinancierosRouter.get('/pagos-deportes', asincrono(pagosDeportes))
reportesFinancierosRouter.get('/pagos-transporte', asincrono(pagosTransporte))
