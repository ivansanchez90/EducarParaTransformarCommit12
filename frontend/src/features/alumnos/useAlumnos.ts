/**
 * Hook de acceso a datos para la gestión de alumnos.
 *
 * Concentra TODA la interacción con Supabase (leer alumnos y cursos, crear un
 * alumno, cambiar su curso). El componente GestionAlumnos queda así libre de
 * lógica de datos y se ocupa únicamente de la interfaz — separando
 * responsabilidades (acceso a datos ↔ presentación).
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
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
      supabase
        .from('alumnos')
        .select('*, cursos(nivel, grado_anio, division)')
        .order('apellido'),
      supabase.from('cursos').select('*').eq('activo', true),
    ])
    if (al) setAlumnos(al as unknown as Alumno[])
    if (cu) setCursos(cu as Curso[])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /** Crea un alumno resolviendo el usuario padre por email. Devuelve el error si lo hay. */
  const crearAlumno = useCallback(
    async (form: NuevoAlumno): Promise<string | null> => {
      const { data: padre } = await supabase
        .from('usuarios')
        .select('id_usuario')
        .eq('email', form.email_padre)
        .single()
      const { error } = await supabase.from('alumnos').insert([
        {
          nombre: form.nombre,
          apellido: form.apellido,
          dni: form.dni,
          fecha_nacimiento: form.fecha_nacimiento,
          id_curso: form.id_curso ? Number(form.id_curso) : null,
          id_usuario_padre: padre?.id_usuario ?? null,
          obra_social: form.obra_social || null,
        },
      ])
      if (error) return error.message
      await load()
      return null
    },
    [load],
  )

  const cambiarCurso = useCallback(
    async (idAlumno: number, idCurso: string) => {
      await supabase
        .from('alumnos')
        .update({ id_curso: idCurso ? Number(idCurso) : null })
        .eq('id_alumno', idAlumno)
      await load()
    },
    [load],
  )

  return { alumnos, cursos, crearAlumno, cambiarCurso }
}
