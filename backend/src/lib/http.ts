/**
 * Utilidades HTTP compartidas por las rutas: errores con status y helpers para
 * convertir los valores que llegan en el body/query a los tipos de Prisma.
 */
import { config } from './config.js'

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message)
  }
}

/** Parsea un id numérico de la URL; responde 400 si no es válido. */
export function id(valor: unknown): number {
  const n = Number(valor)
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'Id inválido')
  return n
}

/** Número opcional: '' / null / undefined → null. */
export function numOrNull(valor: unknown): number | null {
  if (valor === '' || valor === null || valor === undefined) return null
  const n = Number(valor)
  return Number.isNaN(n) ? null : n
}

/** Texto opcional: '' / undefined → null. */
export function textOrNull(valor: unknown): string | null {
  if (valor === undefined || valor === null) return null
  const s = String(valor).trim()
  return s === '' ? null : s
}

/** 'YYYY-MM-DD' → Date para columnas `date`. '' / null → null. */
export function fecha(valor: unknown): Date | null {
  if (!valor) return null
  const s = String(valor)
  const d = new Date(s.length === 10 ? `${s}T00:00:00Z` : s)
  if (Number.isNaN(d.getTime())) throw new HttpError(400, `Fecha inválida: ${s}`)
  return d
}

/** Como `fecha()`, pero responde 400 si falta. */
export function fechaObligatoria(valor: unknown, campo: string): Date {
  const d = fecha(valor)
  if (!d) throw new HttpError(400, `La ${campo} es obligatoria`)
  return d
}

/** 'HH:MM' o 'HH:MM:SS' → Date para columnas `time`. */
export function hora(valor: unknown): Date {
  const s = String(valor ?? '')
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(s)) throw new HttpError(400, `Hora inválida: ${s}`)
  return new Date(`1970-01-01T${s.length === 5 ? `${s}:00` : s}Z`)
}

/** Fecha de hoy ('YYYY-MM-DD') en la zona horaria de la institución. */
export function hoyISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: config.zonaHoraria })
}

/** Lista separada por comas en la query (?estado=A,B) → array. */
export function lista(valor: unknown): string[] | undefined {
  if (typeof valor !== 'string' || valor === '') return undefined
  return valor.split(',').map((v) => v.trim())
}

/** Booleano en la query (?activo=true). */
export function bool(valor: unknown): boolean | undefined {
  if (valor === 'true') return true
  if (valor === 'false') return false
  return undefined
}
