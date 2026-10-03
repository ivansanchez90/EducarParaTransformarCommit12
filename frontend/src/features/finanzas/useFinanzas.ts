/**
 * Hook de acceso a datos de las facturas y los pagos de un alumno (portal de familias).
 *
 * Concentra la interacción con la API; los componentes de esta carpeta solo
 * muestran lo que devuelve. `recargar` vuelve a pedir los datos, por ejemplo
 * después de subir un comprobante.
 */
import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { FacturaPortal, PagoPortal } from './types'

interface Datos {
  idAlumno: number
  facturas: FacturaPortal[]
  pagos: PagoPortal[]
  error: string
}

export function useFinanzas(idAlumno: number | null) {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (idAlumno === null) return
    let vigente = true
    const cargar = async () => {
      const [facturas, pagos] = await Promise.all([
        api.get<FacturaPortal[]>(`/alumnos/${idAlumno}/facturas`),
        api.get<PagoPortal[]>(`/alumnos/${idAlumno}/pagos`),
      ])
      if (!vigente) return
      setDatos({
        idAlumno,
        facturas: facturas.data ?? [],
        pagos: pagos.data ?? [],
        error: facturas.error?.message ?? pagos.error?.message ?? '',
      })
    }
    void cargar()
    return () => {
      vigente = false
    }
  }, [idAlumno, version])

  const recargar = useCallback(() => {
    setVersion((v) => v + 1)
  }, [])

  // Mientras llegan los datos del alumno elegido, no se muestran los del anterior.
  const actuales = datos && datos.idAlumno === idAlumno ? datos : null
  const facturas = actuales?.facturas ?? []

  return {
    idAlumno,
    /** Cambia cada vez que se vuelven a pedir los datos: las consultas que dependen de ellos se refrescan. */
    version,
    facturas,
    pagos: actuales?.pagos ?? [],
    /** Facturas con saldo: pendientes, con pago parcial o vencidas. */
    pendientes: facturas.filter((f) => f.estado !== 'Pagada'),
    cargando: idAlumno !== null && actuales === null,
    error: actuales?.error ?? '',
    recargar,
  }
}

export type Finanzas = ReturnType<typeof useFinanzas>
