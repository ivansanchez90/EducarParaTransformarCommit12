/**
 * LegajosDocente — permite a un docente consultar el legajo de los alumnos de
 * los cursos que tiene asignados.
 */
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { Asignacion } from '../../types'
import { card, fieldLabel, tdCell, thCell } from '../../ui/styles'
import { LegajoAlumno } from '../alumnos/LegajoAlumno'
import { TablaScroll } from '../../ui/components'

export function LegajosDocente() {
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [selAsignacion, setSelAsignacion] = useState<number | null>(null)
  const [alumnos, setAlumnos] = useState<
    { id_alumno: number; nombre: string; apellido: string }[]
  >([])
  const [legajoId, setLegajoId] = useState<number | null>(null)

  // Asignaciones del docente logueado
  useEffect(() => {
    api.get<Asignacion[]>('/asignaciones/mias').then(({ data }) => {
      if (data) setAsignaciones(data)
    })
  }, [])

  // Alumnos del curso de la asignación seleccionada
  useEffect(() => {
    if (!selAsignacion) {
      setAlumnos([])
      return
    }
    api
      .get<typeof alumnos>(`/asignaciones/${selAsignacion}/alumnos`)
      .then(({ data: al }) => {
        if (al) setAlumnos(al)
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
          <TablaScroll>
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
          </TablaScroll>
        )}
      </div>
    </div>
  )
}
