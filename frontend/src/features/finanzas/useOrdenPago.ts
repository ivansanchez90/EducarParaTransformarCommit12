/**
 * Hook de acceso a datos para emitir la orden de pago de una factura.
 *
 * Guarda qué ítems con saldo eligió la familia (todos al empezar), calcula el
 * total, pide la orden a la API y baja su PDF. El diálogo solo muestra el estado.
 */
import { useState } from 'react'
import { api, descargar } from '../../lib/api'
import type { FacturaPortal, OrdenPago } from './types'

export function useOrdenPago(factura: FacturaPortal) {
  const conSaldo = factura.items.filter((i) => i.saldo > 0)
  const [elegidos, setElegidos] = useState<Set<number>>(() => new Set(conSaldo.map((i) => i.id_item)))
  const [orden, setOrden] = useState<OrdenPago | null>(null)
  const [emitiendo, setEmitiendo] = useState(false)
  const [error, setError] = useState('')

  const alternar = (idItem: number) =>
    setElegidos((actuales) => {
      const nuevos = new Set(actuales)
      if (nuevos.has(idItem)) nuevos.delete(idItem)
      else nuevos.add(idItem)
      return nuevos
    })

  const total = conSaldo.filter((i) => elegidos.has(i.id_item)).reduce((suma, i) => suma + i.saldo, 0)

  const emitir = async () => {
    setError('')
    setEmitiendo(true)
    const { data, error: fallo } = await api.post<OrdenPago>(`/facturas/${factura.id_factura}/ordenes-pago`, {
      items: [...elegidos],
    })
    setEmitiendo(false)
    if (fallo) setError(fallo.message)
    else setOrden(data)
  }

  const bajarPdf = async () => {
    if (!orden) return
    setError('')
    const fallo = await descargar(`/ordenes-pago/${orden.id_orden}/pdf`)
    if (fallo) setError(fallo.message)
  }

  return { conSaldo, elegidos, alternar, total, orden, emitiendo, error, emitir, bajarPdf }
}
