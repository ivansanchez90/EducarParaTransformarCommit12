import { HttpError } from '../../lib/http.js'
import type { Periodo } from './tipos.js'

/**
 * Período de un mes. `inicio` es el día 1 como fecha sin hora (igual que
 * `vigente_desde` de las tarifas); `comienzo` y `fin` son la medianoche del
 * día 1 de este mes y del siguiente en Argentina (UTC−3, sin horario de
 * verano), para comparar con las altas y bajas, que tienen hora.
 */
export function crearPeriodo(anio: number, mes: number): Periodo {
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) throw new HttpError(400, 'Mes inválido')
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) throw new HttpError(400, 'Año inválido')
  return {
    anio,
    mes,
    inicio: new Date(Date.UTC(anio, mes - 1, 1)),
    comienzo: new Date(Date.UTC(anio, mes - 1, 1, 3)),
    fin: new Date(Date.UTC(anio, mes, 1, 3)),
  }
}
