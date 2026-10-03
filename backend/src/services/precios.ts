/**
 * Precios que ve la familia en el portal: la tarifa que rige hoy para cada servicio
 * (ver `services/tarifas.ts`), o `null` si todavía no hay una cargada. Una tarifa
 * programada para más adelante no cuenta hasta que llegue su fecha.
 */
import { fecha, hoyISO } from '../lib/http.js'
import { claveTarifa, tarifasVigentes, type ReferenciaTarifa } from './tarifas.js'

export type PrecioDe = (ref: ReferenciaTarifa) => number | null

/** Lee las tarifas vigentes una sola vez y devuelve la función que busca el precio de cada servicio. */
export async function preciosVigentes(): Promise<PrecioDe> {
  const vigentes = await tarifasVigentes(fecha(hoyISO()) ?? new Date())
  return (ref) => vigentes.get(claveTarifa(ref))?.importe.toNumber() ?? null
}
