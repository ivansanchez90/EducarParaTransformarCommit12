/**
 * Cálculos de los reportes de cobranza por servicio (T22): pagos de deportes por deporte,
 * nivel, horario y profesor (HU22), y pagos de transporte por recorrido (HU23). Son funciones
 * puras sobre los ítems de factura ya leídos; `routes/reportesFinancieros.ts` hace las consultas.
 *
 * Lo facturado de un ítem es su importe y lo pagado, lo que se le imputó (importe − saldo).
 * Los importes se suman en centavos para no arrastrar errores de redondeo.
 */
import { estadoFactura } from './facturacion/estado.js'
import type { EstadoFactura } from './facturacion/estado.js'
import { MESES } from './reportesFinancieros.js'

const centavos = (importe: number) => Math.round(importe * 100)

/** Un ítem de deporte o de transporte de una factura, con su alumno y el servicio que cobra. */
export interface ItemServicio {
  /** Id de la actividad o del recorrido (el `id_referencia` del ítem). */
  id_servicio: number
  servicio: string
  id_alumno: number
  nombre: string
  apellido: string
  curso: string
  nivel: string
  anio: number
  mes: number
  importe: number
  saldo: number
  fecha_vencimiento: Date
}

export interface FilaCobranza {
  id_servicio: number
  servicio: string
  id_alumno: number
  alumno: string
  curso: string
  nivel: string
  periodo: string
  facturado: number
  pagado: number
  saldo: number
  estado: EstadoFactura
}

export interface ResumenServicio {
  id_servicio: number
  servicio: string
  /** Alumnos distintos con el servicio facturado en el período. */
  alumnos: number
  facturado: number
  pagado: number
  saldo: number
}

export interface Cobranza {
  filas: FilaCobranza[]
  porServicio: ResumenServicio[]
  alumnos: number
  facturado: number
  pagado: number
  saldo: number
}

const porNombre = (a: string, b: string) => a.localeCompare(b, 'es')

/**
 * Una fila por ítem (ordenadas por servicio, alumno y período) y el resumen de cada servicio.
 * El estado del ítem se calcula como el de una factura, con el vencimiento de la suya: un
 * deporte sin pagar de una factura vencida figura como *Vencida* aunque la cuota esté paga.
 */
export function cobranzaPorServicio(items: ItemServicio[], hoy: Date): Cobranza {
  const servicios = new Map<number, { servicio: string; alumnos: Set<number>; facturado: number; saldo: number }>()
  const alumnos = new Set<number>()
  let facturadoC = 0
  let saldoC = 0

  const ordenados = [...items].sort(
    (a, b) =>
      porNombre(a.servicio, b.servicio) ||
      a.id_servicio - b.id_servicio ||
      porNombre(`${a.apellido}, ${a.nombre}`, `${b.apellido}, ${b.nombre}`) ||
      a.id_alumno - b.id_alumno ||
      a.anio * 100 + a.mes - (b.anio * 100 + b.mes),
  )

  const filas = ordenados.map((i): FilaCobranza => {
    const importe = centavos(i.importe)
    const saldo = Math.max(0, centavos(i.saldo))

    const resumen = servicios.get(i.id_servicio) ?? { servicio: i.servicio, alumnos: new Set<number>(), facturado: 0, saldo: 0 }
    resumen.alumnos.add(i.id_alumno)
    resumen.facturado += importe
    resumen.saldo += saldo
    servicios.set(i.id_servicio, resumen)
    alumnos.add(i.id_alumno)
    facturadoC += importe
    saldoC += saldo

    return {
      id_servicio: i.id_servicio,
      servicio: i.servicio,
      id_alumno: i.id_alumno,
      alumno: `${i.apellido}, ${i.nombre}`,
      curso: i.curso,
      nivel: i.nivel,
      periodo: `${MESES[i.mes - 1]} ${i.anio}`,
      facturado: importe / 100,
      pagado: (importe - saldo) / 100,
      saldo: saldo / 100,
      estado: estadoFactura({ total: i.importe, saldo: i.saldo, fecha_vencimiento: i.fecha_vencimiento }, hoy),
    }
  })

  return {
    filas,
    porServicio: [...servicios.entries()]
      .map(([id_servicio, s]) => ({
        id_servicio,
        servicio: s.servicio,
        alumnos: s.alumnos.size,
        facturado: s.facturado / 100,
        pagado: (s.facturado - s.saldo) / 100,
        saldo: s.saldo / 100,
      }))
      .sort((a, b) => porNombre(a.servicio, b.servicio) || a.id_servicio - b.id_servicio),
    alumnos: alumnos.size,
    facturado: facturadoC / 100,
    pagado: (facturadoC - saldoC) / 100,
    saldo: saldoC / 100,
  }
}

// ── Horarios de los deportes ───────────────────────────────────

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export interface Franja {
  dia_semana: string
  hora_inicio: Date
  hora_fin: Date
}

/** Las columnas `time` llegan como 1970-01-01T17:00:00Z: la hora es la de UTC. */
export const horaTexto = (d: Date) => d.toISOString().slice(11, 16)

/** "Lunes 17:00–18:30". */
export const franjaTexto = (f: Franja) => `${f.dia_semana} ${horaTexto(f.hora_inicio)}–${horaTexto(f.hora_fin)}`

/** Las franjas de un deporte de lunes a domingo y por hora: "Lunes 17:00–18:30 · Miércoles 17:00–18:30". */
export function horariosTexto(franjas: Franja[]): string {
  if (franjas.length === 0) return 'Sin horario'
  return [...franjas]
    .sort((a, b) => DIAS_SEMANA.indexOf(a.dia_semana) - DIAS_SEMANA.indexOf(b.dia_semana) || a.hora_inicio.getTime() - b.hora_inicio.getTime())
    .map(franjaTexto)
    .join(' · ')
}
