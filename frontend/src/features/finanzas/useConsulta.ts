/**
 * Hook de acceso a datos para una consulta de solo lectura a la API del portal.
 *
 * Pide `ruta` cada vez que cambia (otro alumno, otro rango de fechas) y no pide nada si
 * es `null`. Mientras llegan los datos de la ruta nueva no se muestran los de la anterior.
 */
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'

interface Resultado<T> {
  ruta: string
  datos: T | null
  error: string
}

export function useConsulta<T>(ruta: string | null) {
  const [resultado, setResultado] = useState<Resultado<T> | null>(null)

  useEffect(() => {
    if (ruta === null) return
    let vigente = true
    const cargar = async () => {
      const { data, error } = await api.get<T>(ruta)
      if (vigente) setResultado({ ruta, datos: data, error: error?.message ?? '' })
    }
    void cargar()
    return () => {
      vigente = false
    }
  }, [ruta])

  const actual = resultado && resultado.ruta === ruta ? resultado : null
  return {
    datos: actual?.datos ?? null,
    error: actual?.error ?? '',
    cargando: ruta !== null && actual === null,
  }
}
