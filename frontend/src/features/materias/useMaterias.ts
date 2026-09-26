/**
 * Hook de acceso a datos para la gestión de materias.
 *
 * Concentra la interacción con la API (listar, crear, editar y dar de baja o
 * reactivar). GestionMaterias queda solo con la interfaz.
 */
import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { ApiError } from '../../lib/api'
import type { Materia } from '../../types'

export interface DatosMateria {
  nombre: string
  descripcion: string
  horas_semanales: string
}

export const MATERIA_VACIA: DatosMateria = { nombre: '', descripcion: '', horas_semanales: '4' }

/** Precarga el formulario con los datos de una materia existente. */
export function aFormulario(m: Materia): DatosMateria {
  return {
    nombre: m.nombre,
    descripcion: m.descripcion ?? '',
    horas_semanales: String(m.horas_semanales),
  }
}

/** Convierte el formulario en el cuerpo que espera la API. */
function aPayload(form: DatosMateria) {
  return {
    nombre: form.nombre,
    descripcion: form.descripcion || null,
    horas_semanales: Number(form.horas_semanales),
  }
}

export function useMaterias() {
  const [materias, setMaterias] = useState<Materia[]>([])

  const load = useCallback(async () => {
    const { data } = await api.get<Materia[]>('/materias')
    if (data) setMaterias(data)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /** Crea una materia. Devuelve el error si lo hay. */
  const crearMateria = useCallback(
    async (form: DatosMateria): Promise<string | null> => {
      const { error } = await api.post('/materias', aPayload(form))
      if (error) return error.message
      await load()
      return null
    },
    [load],
  )

  /** Edita los datos de una materia. Devuelve el error si lo hay. */
  const editarMateria = useCallback(
    async (idMateria: number, form: DatosMateria): Promise<string | null> => {
      const { error } = await api.patch(`/materias/${idMateria}`, aPayload(form))
      if (error) return error.message
      await load()
      return null
    },
    [load],
  )

  /**
   * Da de baja o reactiva la materia. Si tiene asignaciones activas, la baja
   * vuelve con code MATERIA_CON_ASIGNACIONES y hay que repetirla con `confirmar`.
   * Devuelve el error completo para que la pantalla pueda leer el code.
   */
  const cambiarEstado = useCallback(
    async (idMateria: number, activo: boolean, confirmar = false): Promise<ApiError | null> => {
      const { error } = await api.patch(`/materias/${idMateria}`, confirmar ? { activo, confirmar } : { activo })
      if (!error) await load()
      return error
    },
    [load],
  )

  return { materias, crearMateria, editarMateria, cambiarEstado }
}
