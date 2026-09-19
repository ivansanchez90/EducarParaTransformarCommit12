/**
 * Hook de acceso a datos para la gestión de alumnos.
 *
 * Concentra TODA la interacción con Supabase (leer alumnos y cursos, crear un
 * alumno, cambiar su curso). El componente GestionAlumnos queda así libre de
 * lógica de datos y se ocupa únicamente de la interfaz — separando
 * responsabilidades (acceso a datos ↔ presentación).
 */
import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { Alumno, Curso } from '../../types'

export interface NuevoAlumno {
  nombre: string
  apellido: string
  dni: string
  fecha_nacimiento: string
  id_curso: string
  email_padre: string
  obra_social: string
}

export function useAlumnos() {
  const [alumnos, setAlumnos] = useState<Alumno[]>([])
  const [cursos, setCursos] = useState<Curso[]>([])

  const load = useCallback(async () => {
    const [{ data: al }, { data: cu }] = await Promise.all([
      api.get<Alumno[]>('/alumnos'),
      api.get<Curso[]>('/cursos'),
    ])
    if (al) setAlumnos(al)
    if (cu) setCursos(cu)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /** Crea un alumno (el backend vincula al padre por email). Devuelve el error si lo hay. */
  const crearAlumno = useCallback(
    async (form: NuevoAlumno): Promise<string | null> => {
      const { error } = await api.post('/alumnos', {
        nombre: form.nombre,
        apellido: form.apellido,
        dni: form.dni,
        fecha_nacimiento: form.fecha_nacimiento,
        id_curso: form.id_curso ? Number(form.id_curso) : null,
        email_padre: form.email_padre || null,
        obra_social: form.obra_social || null,
      })
      if (error) return error.message
      await load()
      return null
    },
    [load],
  )

  const cambiarCurso = useCallback(
    async (idAlumno: number, idCurso: string): Promise<string | null> => {
      const { error } = await api.patch(`/alumnos/${idAlumno}`, {
        id_curso: idCurso ? Number(idCurso) : null,
      })
      await load()
      return error?.message ?? null
    },
    [load],
  )

  return { alumnos, cursos, crearAlumno, cambiarCurso }
}
