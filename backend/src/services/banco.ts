/**
 * Datos de la cuenta a la que transfieren las familias: alias, CBU, banco y
 * titular, tomados de las variables de entorno (`BANCO_*`). Los usan la orden
 * de pago, la factura y los emails. Lo que no está cargado no se muestra.
 */
import { config } from '../lib/config.js'

export interface DatosBancarios {
  alias: string | null
  cbu: string | null
  titular: string | null
  banco: string | null
}

export function datosBancarios(): DatosBancarios {
  return {
    alias: config.bancoAlias || null,
    cbu: config.bancoCbu || null,
    titular: config.bancoTitular || null,
    banco: config.bancoNombre || null,
  }
}

/** "Banco: …", "Titular: …", "CBU: …" y "Alias: …", solo los que están cargados. */
export function lineasBancarias(datos = datosBancarios()): string[] {
  return (
    [
      ['Banco', datos.banco],
      ['Titular', datos.titular],
      ['CBU', datos.cbu],
      ['Alias', datos.alias],
    ] as const
  )
    .filter(([, valor]) => valor)
    .map(([etiqueta, valor]) => `${etiqueta}: ${valor}`)
}

/** Para una frase: "al alias X (CBU Y)", "al alias X", "al CBU Y" o "" si no hay datos. */
export function destinoTransferencia(datos = datosBancarios()): string {
  if (datos.alias && datos.cbu) return `al alias ${datos.alias} (CBU ${datos.cbu})`
  if (datos.alias) return `al alias ${datos.alias}`
  if (datos.cbu) return `al CBU ${datos.cbu}`
  return ''
}
