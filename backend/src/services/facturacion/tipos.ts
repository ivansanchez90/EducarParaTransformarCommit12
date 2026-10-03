/**
 * Tipos de la facturación mensual.
 *
 * Las estrategias trabajan sobre un `AlumnoFacturable` ya cargado (sin tocar
 * la base), así se prueban solas y la generación hace pocas consultas.
 */
import type { ReferenciaTarifa } from '../tarifas.js'

/** Período facturado. */
export interface Periodo {
  anio: number
  /** 1 = enero … 12 = diciembre */
  mes: number
  /** Primer día del mes como fecha sin hora: la fecha con la que se buscan las tarifas. */
  inicio: Date
  /** Primer instante del mes en Argentina: lo dado de baja antes no se cobra. */
  comienzo: Date
  /** Primer instante del mes siguiente en Argentina: lo inscripto antes se cobra. */
  fin: Date
}

/**
 * Desde cuándo y hasta cuándo un alumno usa un servicio (una fila de
 * `vigencias_servicio`). `hasta` es la fecha de la baja, o null si sigue.
 */
export interface Vigencia {
  desde: Date
  hasta?: Date | null
}

export interface AlumnoFacturable {
  id_alumno: number
  nombre: string
  apellido: string
  /** Nivel del curso (la cuota se cobra por nivel); null si no tiene curso. */
  nivel: string | null
  /** Porcentaje de la beca activa, o null. */
  beca: number | null
  /** Puede repetir un deporte si el alumno se dio de baja y se volvió a anotar. */
  deportes: ({ id_actividad: number; nombre: string } & Vigencia)[]
  /** Varias si cambió de recorrido: se cobra el más reciente del mes. */
  transportes: ({ id_recorrido: number; nombre: string } & Vigencia)[]
  comedor: Vigencia[]
}

export interface ItemCalculado {
  concepto: 'Cuota' | 'Deporte' | 'Transporte' | 'Comedor' | 'Beca'
  id_referencia: number | null
  descripcion: string
  /** En centavos, para no arrastrar errores de redondeo. */
  centavos: number
}

export interface ContextoFacturacion {
  periodo: Periodo
  /** Precio vigente en el período, en centavos. Lanza `FaltaDatoFacturacion` si no hay. */
  precio: (ref: ReferenciaTarifa, nombre: string) => number
}

/** Cómo se calculan los ítems de un concepto (patrón Strategy). */
export interface EstrategiaConcepto {
  concepto: ItemCalculado['concepto']
  /** `previos`: los ítems que ya calcularon las estrategias anteriores (la beca los usa). */
  calcular: (alumno: AlumnoFacturable, ctx: ContextoFacturacion, previos: ItemCalculado[]) => ItemCalculado[]
}

/** Falta un dato para facturar a un alumno (tarifa, curso): no se emite su factura. */
export class FaltaDatoFacturacion extends Error {}
