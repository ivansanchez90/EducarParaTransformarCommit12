/**
 * Hook de acceso a datos para la gestión de cursos.
 *
 * Concentra la interacción con la API (listar, crear, editar y dar de baja o
 * reactivar). GestionCursos queda solo con la interfaz.
 */
import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { Curso } from '../../types'

export interface DatosCurso {
  nivel: string
  grado_anio: string
  division: string
  /** Vacío = sin límite de cupo */
  capacidad_maxima: string
}

export const CURSO_VACIO: DatosCurso = {
  nivel: 'Inicial',
  grado_anio: '',
  division: 'A',
  capacidad_maxima: '30',
}

/** Precarga el formulario con los datos de un curso existente. */
export function aFormulario(c: Curso): DatosCurso {
  return {
    nivel: c.nivel,
    grado_anio: c.grado_anio,
    division: c.division,
    capacidad_maxima: c.capacidad_maxima === null ? '' : String(c.capacidad_maxima),
  }
}

/** Convierte el formulario en el cuerpo que espera la API. */
function aPayload(form: DatosCurso) {
  return {
    nivel: form.nivel,
    grado_anio: form.grado_anio,
    division: form.division,
    capacidad_maxima: form.capacidad_maxima.trim() === '' ? null : Number(form.capacidad_maxima),
  }
}

export function useCursos() {
  const [cursos, setCursos] = useState<Curso[]>([])

  // Todos, incluidos los dados de baja, para poder reactivarlos.
  const load = useCallback(async () => {
    const { data } = await api.get<Curso[]>('/cursos?activo=todos')
    if (data) setCursos(data)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /** Crea un curso (el backend asigna el período activo). Devuelve el error si lo hay. */
  const crearCurso = useCallback(
    async (form: DatosCurso): Promise<string | null> => {
      const { error } = await api.post('/cursos', aPayload(form))
      if (error) return error.message
      await load()
      return null
    },
    [load],
  )

  /** Edita los datos de un curso. Devuelve el error si lo hay. */
  const editarCurso = useCallback(
    async (idCurso: number, form: DatosCurso): Promise<string | null> => {
      const { error } = await api.patch(`/cursos/${idCurso}`, aPayload(form))
      if (error) return error.message
      await load()
      return null
    },
    [load],
  )

  /** Da de baja o reactiva el curso (el backend rechaza la baja si tiene alumnos activos). */
  const cambiarEstado = useCallback(
    async (idCurso: number, activo: boolean): Promise<string | null> => {
      const { error } = await api.patch(`/cursos/${idCurso}`, { activo })
      await load()
      return error?.message ?? null
    },
    [load],
  )

  return { cursos, crearCurso, editarCurso, cambiarEstado }
}
