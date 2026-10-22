/**
 * Hook de acceso a datos de la ficha de salud de un alumno (enfermería y administración).
 *
 * Pide la ficha y las atenciones, y las guarda con la API; cada guardado vuelve a pedir los datos,
 * así lo que se ve es lo que quedó. Los mensajes de error son los que devuelve el backend.
 */
import { useState } from 'react'
import { api, qs } from '../../lib/api'
import { useConsulta } from '../../lib/useConsulta'
import { instanteDe } from './formato'
import type { Atencion, DatosAtencion, DatosFicha, FichaDelAlumno, FichaMedica } from './types'

/** Los campos vacíos se mandan como `null`: así se borra un dato. */
const aNulos = (datos: DatosFicha) => Object.fromEntries(Object.entries(datos).map(([campo, valor]) => [campo, valor.trim() || null]))

export function useSalud(idAlumno: number) {
  const [version, setVersion] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const ficha = useConsulta<FichaDelAlumno>(`/salud/alumnos/${idAlumno}/ficha${qs({ v: version })}`)
  const atenciones = useConsulta<Atencion[]>(`/salud/alumnos/${idAlumno}/atenciones${qs({ v: version })}`)

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
    ficha: ficha.datos,
    atenciones: atenciones.datos ?? [],
    cargando: ficha.cargando || atenciones.cargando,
    error: error || ficha.error || atenciones.error,
    guardando,
    version,
    guardarFicha: (datos: DatosFicha) => guardar(() => api.put<FichaMedica>(`/salud/alumnos/${idAlumno}/ficha`, aNulos(datos))),
    registrarAtencion: (datos: DatosAtencion) =>
      guardar(() => api.post<Atencion>(`/salud/alumnos/${idAlumno}/atenciones`, { ...datos, fecha_hora: instanteDe(datos.fecha_hora) })),
    corregirAtencion: (idAtencion: number, datos: DatosAtencion) =>
      guardar(() => api.put<Atencion>(`/salud/atenciones/${idAtencion}`, { ...datos, fecha_hora: instanteDe(datos.fecha_hora) })),
  }
}

export type Salud = ReturnType<typeof useSalud>
