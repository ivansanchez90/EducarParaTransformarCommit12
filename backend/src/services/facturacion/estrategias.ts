/**
 * Una estrategia por concepto facturable (patrón Strategy). Para cobrar un
 * concepto nuevo alcanza con escribir su estrategia y sumarla a `ESTRATEGIAS`:
 * la generación de facturas no cambia.
 */
import type { AlumnoFacturable, EstrategiaConcepto, ItemCalculado, Periodo, Vigencia } from './tipos.js'
import { FaltaDatoFacturacion } from './tipos.js'

/** El servicio se usó en algún momento del período. */
export function vigenteEnPeriodo({ desde, hasta }: Vigencia, periodo: Periodo): boolean {
  return desde < periodo.fin && (!hasta || hasta >= periodo.inicio)
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export const nombrePeriodo = ({ anio, mes }: { anio: number; mes: number }) => `${MESES[mes - 1]} ${anio}`

export const cuota: EstrategiaConcepto = {
  concepto: 'Cuota',
  calcular(alumno, ctx) {
    if (!alumno.nivel) throw new FaltaDatoFacturacion('No tiene curso asignado (la cuota depende del nivel)')
    const nombre = `Cuota ${alumno.nivel}`
    return [
      {
        concepto: 'Cuota',
        id_referencia: null,
        descripcion: `${nombre} · ${nombrePeriodo(ctx.periodo)}`,
        centavos: ctx.precio({ concepto: 'Cuota', nivel: alumno.nivel }, nombre),
      },
    ]
  },
}

export const deporte: EstrategiaConcepto = {
  concepto: 'Deporte',
  calcular(alumno, ctx) {
    return alumno.deportes
      .filter((d) => vigenteEnPeriodo(d, ctx.periodo))
      .map((d) => ({
        concepto: 'Deporte' as const,
        id_referencia: d.id_actividad,
        descripcion: d.nombre,
        centavos: ctx.precio({ concepto: 'Deporte', id_referencia: d.id_actividad }, d.nombre),
      }))
  },
}

export const transporte: EstrategiaConcepto = {
  concepto: 'Transporte',
  calcular(alumno, ctx) {
    const t = alumno.transporte
    if (!t || !vigenteEnPeriodo(t, ctx.periodo)) return []
    return [
      {
        concepto: 'Transporte',
        id_referencia: t.id_recorrido,
        descripcion: `Transporte · ${t.nombre}`,
        centavos: ctx.precio({ concepto: 'Transporte', id_referencia: t.id_recorrido }, t.nombre),
      },
    ]
  },
}

export const comedor: EstrategiaConcepto = {
  concepto: 'Comedor',
  calcular(alumno, ctx) {
    if (!alumno.comedor || !vigenteEnPeriodo(alumno.comedor, ctx.periodo)) return []
    return [
      {
        concepto: 'Comedor',
        id_referencia: null,
        descripcion: 'Comedor',
        centavos: ctx.precio({ concepto: 'Comedor' }, 'Comedor'),
      },
    ]
  },
}

/** La beca descuenta su porcentaje sobre la cuota (no sobre los servicios). */
export const beca: EstrategiaConcepto = {
  concepto: 'Beca',
  calcular(alumno, _ctx, previos) {
    if (!alumno.beca || alumno.beca <= 0) return []
    const base = previos.filter((i) => i.concepto === 'Cuota').reduce((s, i) => s + i.centavos, 0)
    const descuento = Math.round((base * Math.min(alumno.beca, 100)) / 100)
    if (descuento === 0) return []
    return [
      {
        concepto: 'Beca',
        id_referencia: null,
        descripcion: `Beca ${alumno.beca}% sobre la cuota`,
        centavos: -descuento,
      },
    ]
  },
}

/** En este orden: la beca va al final porque se calcula sobre la cuota. */
export const ESTRATEGIAS: EstrategiaConcepto[] = [cuota, deporte, transporte, comedor, beca]

export function calcularItems(
  alumno: AlumnoFacturable,
  ctx: Parameters<EstrategiaConcepto['calcular']>[1],
  estrategias: EstrategiaConcepto[] = ESTRATEGIAS,
): ItemCalculado[] {
  const items: ItemCalculado[] = []
  for (const estrategia of estrategias) items.push(...estrategia.calcular(alumno, ctx, items))
  return items
}
