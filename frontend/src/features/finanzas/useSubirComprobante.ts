/**
 * Hook de acceso a datos para subir el comprobante de una transferencia.
 *
 * Guarda el archivo y los datos que declara la familia (importe y fecha), revisa lo
 * básico antes de mandarlos y hace el POST multipart. La API vuelve a validar todo:
 * el tipo se decide por el contenido del archivo, no por su nombre.
 */
import { useState } from 'react'
import { api } from '../../lib/api'
import type { ComprobanteFactura, FacturaPortal } from './types'

export const MAX_COMPROBANTE_MB = 10
/** Formatos que acepta la API: fotos (incluido AVIF y HEIC, el de las fotos de iPhone) y PDF. */
export const TIPOS_COMPROBANTE = '.jpg,.jpeg,.png,.webp,.avif,.heic,.heif,.pdf'
const EXTENSIONES = TIPOS_COMPROBANTE.split(',').map((e) => e.slice(1))

interface Opciones {
  factura: FacturaPortal
  /** Orden de pago que se está pagando, si se llegó desde ella. */
  idOrden: number | null
  importeSugerido: number
  onSubido: () => void
}

const hoy = () => new Date().toLocaleDateString('en-CA')

export function useSubirComprobante({ factura, idOrden, importeSugerido, onSubido }: Opciones) {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [importe, setImporte] = useState(String(importeSugerido))
  const [fechaTransferencia, setFechaTransferencia] = useState(hoy)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [subido, setSubido] = useState<ComprobanteFactura | null>(null)

  const elegirArchivo = (elegido: File | null) => {
    setError('')
    setArchivo(null)
    if (!elegido) return
    const ext = elegido.name.split('.').pop()?.toLowerCase() ?? ''
    if (!EXTENSIONES.includes(ext)) {
      setError('Elegí una foto (JPG, PNG, WebP, AVIF o HEIC) o un PDF.')
    } else if (elegido.size > MAX_COMPROBANTE_MB * 1024 * 1024) {
      setError(`El archivo pesa más de ${MAX_COMPROBANTE_MB} MB: sacale una foto más liviana o comprimilo.`)
    } else {
      setArchivo(elegido)
    }
  }

  const enviar = async () => {
    setError('')
    const monto = Number(importe.replace(',', '.'))
    if (!archivo) {
      setError('Adjuntá el comprobante de la transferencia.')
      return
    }
    if (!(monto > 0)) {
      setError('Escribí el importe que transferiste.')
      return
    }

    const datos = new FormData()
    datos.append('archivo', archivo)
    datos.append('importe', String(monto))
    datos.append('fecha_transferencia', fechaTransferencia)
    if (idOrden !== null) datos.append('id_orden', String(idOrden))

    setEnviando(true)
    const { data, error: fallo } = await api.post<ComprobanteFactura>(`/facturas/${factura.id_factura}/comprobantes`, datos)
    setEnviando(false)
    if (fallo) {
      setError(fallo.message)
      return
    }
    setSubido(data)
    onSubido()
  }

  return {
    archivo,
    elegirArchivo,
    importe,
    setImporte,
    fechaTransferencia,
    setFechaTransferencia,
    hoy: hoy(),
    enviando,
    error,
    subido,
    enviar,
  }
}
