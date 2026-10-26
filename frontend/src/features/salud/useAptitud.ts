/**
 * Hook de acceso a datos del certificado de aptitud física de un alumno (enfermería y administración).
 *
 * Pide el estado y los certificados, y los guarda con la API; cada guardado vuelve a pedir los datos.
 * Los mensajes de error son los que devuelve el backend.
 */
import { useState } from 'react'
import { api, qs } from '../../lib/api'
import { useConsulta } from '../../lib/useConsulta'
import type { AptitudDelAlumno, CertificadoDeAptitud, DatosCertificado } from './types'

export function useAptitud(idAlumno: number) {
  const [version, setVersion] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const consulta = useConsulta<AptitudDelAlumno>(`/salud/alumnos/${idAlumno}/aptitud${qs({ v: version })}`)

  /** Corre un guardado: devuelve `true` si salió bien y vuelve a pedir los datos. */
  const guardar = async (pedido: () => Promise<{ error: { message: string } | null }>) => {
    setError('')
    setGuardando(true)
    const { error: fallo } = await pedido()
    setGuardando(false)
    if (fallo) {
      setError(fallo.message)
      return false
    }
    setVersion((v) => v + 1)
    return true
  }

  return {
    aptitud: consulta.datos?.aptitud ?? null,
    certificados: consulta.datos?.certificados ?? [],
    cargando: consulta.cargando,
    error: error || consulta.error,
    guardando,
    cargar: (datos: DatosCertificado) => guardar(() => api.post<CertificadoDeAptitud>(`/salud/alumnos/${idAlumno}/aptitud`, datos)),
    corregir: (idCertificado: number, datos: DatosCertificado) => guardar(() => api.put<CertificadoDeAptitud>(`/salud/aptitud/${idCertificado}`, datos)),
  }
}
