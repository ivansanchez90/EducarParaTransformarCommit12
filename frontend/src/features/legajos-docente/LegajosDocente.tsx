/**
 * LegajosDocente — permite a un docente consultar el legajo de los alumnos de
 * los cursos que tiene asignados.
 */
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { Asignacion } from '../../types'
import { card, fieldLabel, tdCell, thCell } from '../../ui/styles'
import { LegajoAlumno } from '../alumnos/LegajoAlumno'

export function LegajosDocente({ userId }: { userId: string }) {
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [selAsignacion, setSelAsignacion] = useState<number | null>(null)
  const [alumnos, setAlumnos] = useState<
    { id_alumno: number; nombre: string; apellido: string }[]
  >([])
  const [legajoId, setLegajoId] = useState<number | null>(null)

  // Asignaciones del docente logueado
  useEffect(() => {
    supabase
      .from('docentes')
      .select('id_docente')
      .eq('id_usuario', userId)
      .single()
      .then(({ data: doc }) => {
        if (!doc) return
        supabase
          .from('asignaciones')
          .select('*, materias(nombre), cursos(nivel, grado_anio, division)')
          .eq('id_docente', doc.id_docente)
          .eq('activo', true)
          .then(({ data }) => {
            if (data) setAsignaciones(data as unknown as Asignacion[])
          })
      })
  }, [userId])

  // Alumnos del curso de la asignación seleccionada
  useEffect(() => {
    if (!selAsignacion) {
      setAlumnos([])
      return
    }
    supabase
      .from('asignaciones')
      .select('id_curso')
      .eq('id_asignacion', selAsignacion)
      .single()
      .then(({ data: a }) => {
        if (!a) return
        supabase
          .from('alumnos')
          .select('id_alumno, nombre, apellido')
          .eq('id_curso', a.id_curso)
          .eq('activo', true)
          .order('apellido')
          .then(({ data: al }) => {
            if (al)
              setAlumnos(
                al as { id_alumno: number; nombre: string; apellido: string }[],
              )
          })
      })
  }, [selAsignacion])

  if (legajoId !== null) {
    return (
      <LegajoAlumno idAlumno={legajoId} onClose={() => setLegajoId(null)} />
    )
  }

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 20px' }}>
        📁 Legajos de alumnos
      </h2>
      <div className={card}>
        <label className={fieldLabel}>
          Elegí una de tus asignaciones
        </label>
        <select
          className='rounded-input border-2 border-border text-[13px] text-text outline-none box-border w-full max-w-[420px] px-[14px] py-[10px] appearance-none mb-5'
          value={selAsignacion ?? ''}
          onChange={(e) =>
            setSelAsignacion(e.target.value ? Number(e.target.value) : null)
          }
        >
          <option value=''>— Seleccioná materia y curso —</option>
          {asignaciones.map((a) => (
            <option key={a.id_asignacion} value={a.id_asignacion}>
              {a.materias?.nombre ?? 'Materia'} ·{' '}
              {a.cursos
                ? `${a.cursos.nivel} ${a.cursos.grado_anio} ${a.cursos.division}`
                : 'Curso'}
            </option>
          ))}
        </select>

        {selAsignacion && alumnos.length === 0 && (
          <p className='text-[13px] text-textMuted'>
            No hay alumnos activos en este curso.
          </p>
        )}

        {alumnos.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className={thCell}>
                  Alumno
                </th>
                <th className={thCell}>
                  Legajo
                </th>
              </tr>
            </thead>
            <tbody>
              {alumnos.map((a) => (
                <tr key={a.id_alumno}>
                  <td className={`${tdCell} font-bold`}>
                    {a.apellido}, {a.nombre}
                  </td>
                  <td className={tdCell}>
                    <button
                      className='bg-[#5B35C51A] text-purple-700 border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                      onClick={() => setLegajoId(a.id_alumno)}
                    >
                      Ver legajo
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
