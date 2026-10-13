/**
 * Cálculos de los reportes financieros (T21): ingresos por período y pagos completos o
 * incompletos por alumno. Son funciones puras sobre datos ya leídos, así se prueban sin base;
 * `routes/reportesFinancieros.ts` hace las consultas y arma el documento.
 *
 * Los importes se suman en centavos para no arrastrar errores de redondeo.
 */
import { diaEnZona } from '../jobs/calendario.js'
import { estadoFactura } from './facturacion/estado.js'

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const centavos = (importe: number) => Math.round(importe * 100)

/** $ 85.000,00 */
export const pesos = (n: number) =>
  `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const dos = (n: number) => String(n).padStart(2, '0')

// ── Ingresos por período ───────────────────────────────────────

export type Agrupacion = 'mes' | 'dia'

export interface PagoIngreso {
  fecha_pago: Date | null
  monto_pagado: number
  metodo_pago: string | null
}

export interface FilaIngreso {
  /** `AAAA-MM` o `AAAA-MM-DD`: ordena cronológicamente. */
  clave: string
  etiqueta: string
  cantidad: number
  monto: number
}

export interface Ingresos {
  periodos: FilaIngreso[]
  porMetodo: { metodo: string; cantidad: number; monto: number }[]
  cantidad: number
  total: number
}

/**
 * Suma los pagos por mes o por día, según el día de Argentina en que se hicieron (un pago de las
 * 23:00 del 30/9 no cuenta en octubre aunque en UTC ya sea 1/10), y por método de pago.
 */
export function ingresosPorPeriodo(pagos: PagoIngreso[], agrupar: Agrupacion, zona?: string): Ingresos {
  const periodos = new Map<string, { etiqueta: string; cantidad: number; centavos: number }>()
  const metodos = new Map<string, { cantidad: number; centavos: number }>()
  let totalCentavos = 0

  for (const pago of pagos) {
    if (!pago.fecha_pago) continue
    const { anio, mes, dia } = diaEnZona(pago.fecha_pago, zona)
    const clave = agrupar === 'mes' ? `${anio}-${dos(mes)}` : `${anio}-${dos(mes)}-${dos(dia)}`
    const etiqueta = agrupar === 'mes' ? `${MESES[mes - 1]} ${anio}` : `${dos(dia)}/${dos(mes)}/${anio}`
    const monto = centavos(pago.monto_pagado)

    const periodo = periodos.get(clave) ?? { etiqueta, cantidad: 0, centavos: 0 }
    periodo.cantidad += 1
    periodo.centavos += monto
    periodos.set(clave, periodo)

    const nombre = pago.metodo_pago ?? 'Sin dato'
    const metodo = metodos.get(nombre) ?? { cantidad: 0, centavos: 0 }
    metodo.cantidad += 1
    metodo.centavos += monto
    metodos.set(nombre, metodo)

    totalCentavos += monto
  }

  return {
    periodos: [...periodos.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([clave, p]) => ({ clave, etiqueta: p.etiqueta, cantidad: p.cantidad, monto: p.centavos / 100 })),
    porMetodo: [...metodos.entries()]
      .sort(([, a], [, b]) => b.centavos - a.centavos)
      .map(([metodo, m]) => ({ metodo, cantidad: m.cantidad, monto: m.centavos / 100 })),
    cantidad: pagos.filter((p) => p.fecha_pago).length,
    total: totalCentavos / 100,
  }
}

// ── Pagos completos e incompletos ──────────────────────────────

export interface FacturaDelAnio {
  id_alumno: number
  mes: number
  numero: number
  total: number
  saldo: number
  fecha_vencimiento: Date
  nombre: string
  apellido: string
  curso: string
  nivel: string
}

export interface ResumenAlumno {
  id_alumno: number
  alumno: string
  curso: string
  nivel: string
  facturas: number
  facturado: number
  pagado: number
  adeudado: number
  /** Facturas con saldo cuyo vencimiento ya pasó. */
  vencidas: number
  /** Todas sus facturas del año están pagadas. */
  completo: boolean
}

/** Resume las facturas de un año por alumno, de la A a la Z por apellido y nombre. */
export function resumenPorAlumno(facturas: FacturaDelAnio[], hoy: Date): ResumenAlumno[] {
  const alumnos = new Map<number, ResumenAlumno & { facturadoC: number; adeudadoC: number }>()

  for (const f of facturas) {
    const actual = alumnos.get(f.id_alumno) ?? {
      id_alumno: f.id_alumno,
      alumno: `${f.apellido}, ${f.nombre}`,
      curso: f.curso,
      nivel: f.nivel,
      facturas: 0,
      facturado: 0,
      pagado: 0,
      adeudado: 0,
      vencidas: 0,
      completo: true,
      facturadoC: 0,
      adeudadoC: 0,
    }
    actual.facturas += 1
    actual.facturadoC += centavos(f.total)
    actual.adeudadoC += Math.max(0, centavos(f.saldo))
    if (f.saldo > 0) {
      actual.completo = false
      if (estadoFactura({ total: f.total, saldo: f.saldo, fecha_vencimiento: f.fecha_vencimiento }, hoy) === 'Vencida') actual.vencidas += 1
    }
    alumnos.set(f.id_alumno, actual)
  }

  return [...alumnos.values()]
    .map(({ facturadoC, adeudadoC, ...a }) => ({
      ...a,
      facturado: facturadoC / 100,
      adeudado: adeudadoC / 100,
      pagado: (facturadoC - adeudadoC) / 100,
    }))
    .sort((a, b) => a.alumno.localeCompare(b.alumno, 'es'))
}
