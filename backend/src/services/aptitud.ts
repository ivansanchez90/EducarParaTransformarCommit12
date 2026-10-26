/**
 * Certificado de aptitud física: vence al año de su emisión y hace falta vigente para inscribirse a un deporte.
 *
 * Un alumno puede tener varios (uno por año): rige el que vence más tarde. Las reglas son funciones puras sobre
 * fechas sin hora (`AAAA-MM-DD`, medianoche UTC, como las columnas `date`), así se prueban sin base.
 */
import type { Prisma } from '../generated/prisma/client.js'
import { HttpError, fecha, fechaObligatoria, hoyISO, textOrNull } from '../lib/http.js'

/** Se avisa que el certificado está por vencer cuando faltan hasta estos días. */
export const DIAS_POR_VENCER = 30

const UN_DIA_MS = 24 * 60 * 60 * 1000
const MAX_OBSERVACIONES = 500

/** `AAAA-MM-DD` de una fecha sin hora. */
export const aTexto = (d: Date) => d.toISOString().slice(0, 10)
const diaMesAnio = (d: Date) => aTexto(d).split('-').reverse().join('/')

/** El último día en que sirve un certificado emitido en `emision`: el mismo día un año después (el 29/2 pasa al 28/2). */
export function vencimientoDe(emision: Date): Date {
  const anio = emision.getUTCFullYear() + 1
  const mes = emision.getUTCMonth()
  const candidato = new Date(Date.UTC(anio, mes, emision.getUTCDate()))
  // Un 29 de febrero no existe en el año siguiente: JavaScript lo pasa al 1 de marzo, y acá se queda en febrero.
  return candidato.getUTCMonth() === mes ? candidato : new Date(Date.UTC(anio, mes + 1, 0))
}

export type EstadoAptitud = 'Vigente' | 'Vencido' | 'Faltante'

export interface Aptitud {
  estado: EstadoAptitud
  /** Hasta cuándo sirve el último certificado (`AAAA-MM-DD`); `null` si no hay ninguno. */
  vigente_hasta: string | null
  /** Días que le quedan al vigente (0 si vence hoy); `null` si no está vigente. */
  dias_restantes: number | null
  /** Vigente, pero le faltan `DIAS_POR_VENCER` días o menos. */
  por_vencer: boolean
}

/** El estado según los certificados del alumno y el día de hoy: rige el que vence más tarde. */
export function estadoAptitud(certificados: { fecha_vencimiento: Date }[], hoy: Date): Aptitud {
  const ultimo = certificados.reduce<Date | null>((mayor, c) => (mayor === null || c.fecha_vencimiento > mayor ? c.fecha_vencimiento : mayor), null)
  if (ultimo === null) return { estado: 'Faltante', vigente_hasta: null, dias_restantes: null, por_vencer: false }
  if (ultimo < hoy) return { estado: 'Vencido', vigente_hasta: aTexto(ultimo), dias_restantes: null, por_vencer: false }
  const dias = Math.round((ultimo.getTime() - hoy.getTime()) / UN_DIA_MS)
  return { estado: 'Vigente', vigente_hasta: aTexto(ultimo), dias_restantes: dias, por_vencer: dias <= DIAS_POR_VENCER }
}

export const hoyComoFecha = (): Date => fecha(hoyISO()) ?? new Date()

export interface DatosCertificado {
  fecha_emision: Date
  fecha_vencimiento: Date
  observaciones: string | null
}

/**
 * Valida lo que carga enfermería. La emisión no puede ser futura ni de hace más de un año (ya estaría vencido y no
 * serviría para nada); el vencimiento se calcula, no se carga.
 */
export function validarCertificado(body: Record<string, unknown> | undefined, hoy: Date): DatosCertificado {
  const emision = fechaObligatoria(body?.fecha_emision, 'fecha de emisión del certificado')
  if (emision > hoy) throw new HttpError(400, 'La fecha de emisión no puede ser posterior a hoy')
  const vencimiento = vencimientoDe(emision)
  if (vencimiento < hoy) {
    throw new HttpError(400, `Ese certificado venció el ${diaMesAnio(vencimiento)}: no sirve para inscribirse. Cargá uno vigente.`)
  }
  const observaciones = textOrNull(body?.observaciones)
  if (observaciones !== null && observaciones.length > MAX_OBSERVACIONES) {
    throw new HttpError(400, `Las observaciones no pueden tener más de ${MAX_OBSERVACIONES} caracteres`)
  }
  return { fecha_emision: emision, fecha_vencimiento: vencimiento, observaciones }
}

/**
 * Para inscribirse a un deporte el alumno necesita un certificado vigente. Lo comprueba dentro de la transacción de la
 * inscripción y no tiene excepción por rol, igual que el tope de dos deportes. Los idiomas no lo piden.
 */
export async function assertAptitudVigente(tx: Pick<Prisma.TransactionClient, 'certificadoAptitud'>, idAlumno: number) {
  const ultimo = await tx.certificadoAptitud.findFirst({
    where: { id_alumno: idAlumno },
    orderBy: { fecha_vencimiento: 'desc' },
    select: { fecha_vencimiento: true },
  })
  const aptitud = estadoAptitud(ultimo ? [ultimo] : [], hoyComoFecha())
  if (aptitud.estado === 'Vigente') return

  const base = 'Para inscribirse a un deporte el alumno necesita un certificado de aptitud física vigente'
  const detalle = ultimo ? `El último venció el ${diaMesAnio(ultimo.fecha_vencimiento)}.` : 'Todavía no tiene ninguno cargado.'
  throw new HttpError(409, `${base}. ${detalle} Presentalo en enfermería.`, 'APTITUD_FISICA')
}
