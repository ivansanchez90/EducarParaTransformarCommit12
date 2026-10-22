/** Formatos de fechas y de nombres del módulo de salud. */
import type { CursoResumen } from './types'

const ZONA = 'America/Argentina/Buenos_Aires'

/** `12 oct 2026, 10:30`, en hora de Argentina. */
export function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', { timeZone: ZONA, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

/** `12 oct 2026`, de una fecha sin hora (`AAAA-MM-DD`): se arma desde el texto para que la zona no corra el día. */
export function fechaCorta(iso: string): string {
  const [anio, mes, dia] = iso.slice(0, 10).split('-').map(Number)
  const nombre = new Date(Date.UTC(anio, mes - 1, 1)).toLocaleString('es-AR', { month: 'short', timeZone: 'UTC' })
  return `${dia} ${nombre} ${anio}`
}

export const nombreCurso = (c: CursoResumen | null) => (c ? `${c.nivel} · ${c.grado_anio}° ${c.division}` : 'Sin curso')

/** El valor de un `datetime-local` a un instante ISO; `undefined` si está vacío (la API pone la hora de ahora). */
export function instanteDe(valorLocal: string): string | undefined {
  if (!valorLocal) return undefined
  const fecha = new Date(valorLocal)
  return Number.isNaN(fecha.getTime()) ? undefined : fecha.toISOString()
}

/** Cómo se muestra un valor de la auditoría: vacío como un guion. */
export const valorAuditado = (valor: unknown) => (valor === null || valor === undefined || valor === '' ? '—' : String(valor))
