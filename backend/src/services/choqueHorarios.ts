/**
 * Conflictos de horario entre deportes (HU 2 de la Parte 2): un alumno no puede
 * estar en dos deportes que tengan clase el mismo día en franjas que se pisan.
 * Dos franjas que solo se tocan (una termina 18:00 y la otra empieza 18:00) no chocan.
 */

/** Una franja semanal; las horas son `Date` del 1/1/1970 en UTC, como las guarda Prisma (`@db.Time`). */
export interface Franja {
  dia_semana: string
  hora_inicio: Date
  hora_fin: Date
}

export interface DeporteConHorarios {
  nombre: string
  horarios: Franja[]
}

export interface Choque {
  /** El otro deporte, con el que se pisa. */
  deporte: string
  nueva: Franja
  existente: Franja
}

export const hhmm = (d: Date) => d.toISOString().slice(11, 16)

export const textoFranja = (f: Franja) => `${f.dia_semana} ${hhmm(f.hora_inicio)}–${hhmm(f.hora_fin)}`

const sePisan = (a: Franja, b: Franja) =>
  a.dia_semana === b.dia_semana && a.hora_inicio < b.hora_fin && b.hora_inicio < a.hora_fin

/** El primer choque entre las franjas `nuevas` y las de los `otros` deportes, o `null`. */
export function buscarChoque(nuevas: Franja[], otros: DeporteConHorarios[]): Choque | null {
  for (const otro of otros) {
    for (const existente of otro.horarios) {
      const nueva = nuevas.find((n) => sePisan(n, existente))
      if (nueva) return { deporte: otro.nombre, nueva, existente }
    }
  }
  return null
}
