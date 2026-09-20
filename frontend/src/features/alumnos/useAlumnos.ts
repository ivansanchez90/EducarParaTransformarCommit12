/**
 * Hook de acceso a datos para la gestión de alumnos.
 *
 * Concentra TODA la interacción con la API (leer alumnos y cursos, crear,
 * editar, cambiar de curso y activar/desactivar). El componente
 * GestionAlumnos queda así libre de lógica de datos y se ocupa únicamente de
 * la interfaz — separando responsabilidades (acceso a datos ↔ presentación).
 */
import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { Alumno, Curso } from '../../types'

export interface DatosAlumno {
  nombre: string
  apellido: string
  dni: string
  fecha_nacimiento: string
  id_curso: string
  email_padre: string
  obra_social: string
  nro_obra_social: string
  direccion: string
  telefono_emergencia: string
  nombre_contacto_emergencia: string
}

/** Convierte el formulario en el cuerpo que espera la API. */
function aPayload(form: DatosAlumno) {
  return {
    nombre: form.nombre,
    apellido: form.apellido,
    dni: form.dni,
    fecha_nacimiento: form.fecha_nacimiento,
    id_curso: form.id_curso ? Number(form.id_curso) : null,
    email_padre: form.email_padre || null,
    obra_social: form.obra_social || null,
    nro_obra_social: form.nro_obra_social || null,
    direccion: form.direccion || null,
    telefono_emergencia: form.telefono_emergencia || null,
    nombre_contacto_emergencia: form.nombre_contacto_emergencia || null,
  }
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
    async (form: DatosAlumno): Promise<string | null> => {
      const { error } = await api.post('/alumnos', aPayload(form))
      if (error) return error.message
      await load()
      return null
    },
    [load],
  )

  /** Edita todos los datos de un alumno. Devuelve el error si lo hay. */
  const editarAlumno = useCallback(
    async (idAlumno: number, form: DatosAlumno): Promise<string | null> => {
      const { error } = await api.patch(`/alumnos/${idAlumno}`, aPayload(form))
      if (error) return error.message
      await load()
      return null
    },
    [load],
  )

  /** Da de alta o de baja al alumno sin borrar su legajo. */
  const cambiarEstado = useCallback(
    async (idAlumno: number, activo: boolean): Promise<string | null> => {
      const { error } = await api.patch(`/alumnos/${idAlumno}`, { activo })
      await load()
      return error?.message ?? null
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

  return { alumnos, cursos, crearAlumno, editarAlumno, cambiarCurso, cambiarEstado }
}
