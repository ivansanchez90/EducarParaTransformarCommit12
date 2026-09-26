/**
 * TomarAsistencia — Registro diario de asistencia por clase (rol Docente).
 * Extraído verbatim de AdminPanel.tsx (sin cambios de lógica).
 *
 * En el celular (PWA-T6) los filtros van en una columna, cada alumno ocupa una
 * fila con el botón de estado de 44 px a la derecha y el guardado ocupa todo
 * el ancho, para tomar la asistencia de un curso completo con una mano.
 */
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { Asignacion, AlumnoAsistencia } from '../../types'
import { card, inputField, selectField, fieldLabel, btnPrimary, badge, touchTarget } from '../../ui/styles'

export function TomarAsistencia() {
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [selAsignacion, setSelAsignacion] = useState<number | null>(null)
  const [alumnos, setAlumnos] = useState<AlumnoAsistencia[]>([])
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    api.get<Asignacion[]>('/asignaciones/mias').then(({ data }) => {
      if (data) setAsignaciones(data)
    })
  }, [])

  useEffect(() => {
    if (!selAsignacion) return
    // Cargar alumnos del curso de la asignación
    const asig = asignaciones.find((a) => a.id_asignacion === selAsignacion)
    if (!asig) return
    api
      .get<Omit<AlumnoAsistencia, 'estado'>[]>(
        `/asignaciones/${selAsignacion}/alumnos`,
      )
      .then(({ data: al }) => {
        if (al) setAlumnos(al.map((a) => ({ ...a, estado: 'Presente' as const })))
      })
  }, [selAsignacion, asignaciones])

  const toggleEstado = (id: number) => {
    setAlumnos((prev) =>
      prev.map((a) => {
        if (a.id_alumno !== id) return a
        const ciclo: AlumnoAsistencia['estado'][] = [
          'Presente',
          'Ausente',
          'Tarde',
          'Justificado',
        ]
        const next = ciclo[(ciclo.indexOf(a.estado) + 1) % ciclo.length]
        return { ...a, estado: next }
      }),
    )
  }

  const guardar = async () => {
    if (!selAsignacion || alumnos.length === 0) return
    setLoading(true)
    setMsg('')
    // R6 · El backend guarda (upsert por alumno/fecha) y notifica las inasistencias.
    const { data, error } = await api.post<{ ausentes: number }>('/asistencias', {
      id_asignacion: selAsignacion,
      fecha,
      registros: alumnos.map((a) => ({ id_alumno: a.id_alumno, estado: a.estado })),
    })
    if (error) {
      setMsg('Error: ' + error.message)
    } else {
      setMsg(
        data.ausentes > 0
          ? `✅ Asistencia guardada. Se notificó a ${data.ausentes} familia(s) por inasistencia.`
          : '✅ Asistencia guardada correctamente.',
      )
    }
    setLoading(false)
  }

  const EST_COLOR: Record<string, string> = {
    Presente: '#27AE60',
    Ausente: '#E74C3C',
    Tarde: '#E67E22',
    Justificado: '#2980B9',
  }

  const conteo = alumnos.reduce<Record<string, number>>((acc, a) => {
    acc[a.estado] = (acc[a.estado] ?? 0) + 1
    return acc
  }, {})

  return (
    <div>
      <h2 className='text-[22px] font-black m-0 mb-5'>📅 Tomar asistencia</h2>

      <div className={`${card} mb-5`}>
        <div className='flex flex-col md:flex-row md:items-end gap-4'>
          <div className='w-full md:w-[280px]'>
            <label className={fieldLabel} htmlFor='asist-clase'>
              Clase / Materia
            </label>
            <select
              id='asist-clase'
              className={selectField}
              value={selAsignacion ?? ''}
              onChange={(e) => setSelAsignacion(Number(e.target.value))}
            >
              <option value=''>Seleccioná una clase...</option>
              {asignaciones.map((a) => (
                <option key={a.id_asignacion} value={a.id_asignacion}>
                  {a.materias?.nombre} — {a.cursos?.nivel}{' '}
                  {a.cursos?.grado_anio} "{a.cursos?.division}"
                </option>
              ))}
            </select>
          </div>
          <div className='w-full md:w-[160px]'>
            <label className={fieldLabel} htmlFor='asist-fecha'>
              Fecha
            </label>
            <input
              id='asist-fecha'
              type='date'
              className={inputField}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
        </div>
      </div>

      {selAsignacion && alumnos.length > 0 && (
        <div className={card}>
          <div className='flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-4'>
            <div className='text-[15px] font-extrabold text-text'>
              {alumnos.length} alumnos — Tocá el estado para cambiar
            </div>
            <div className='flex flex-wrap gap-2'>
              {(['Presente', 'Ausente', 'Tarde', 'Justificado'] as const).map(
                (e) => (
                  <span key={e} style={badge(EST_COLOR[e])}>
                    {e} {conteo[e] ?? 0}
                  </span>
                ),
              )}
            </div>
          </div>

          <ul className='list-none m-0 p-0'>
            {alumnos.map((a) => (
              <li
                key={a.id_alumno}
                className='flex items-center justify-between gap-3 py-2.5 md:py-3 border-b border-border'
              >
                <div className='flex items-center gap-3 min-w-0'>
                  <div className='w-9 h-9 rounded-full bg-[#5B35C518] text-purple-700 hidden sm:flex items-center justify-center font-black text-[13px] shrink-0'>
                    {a.nombre[0]}
                    {a.apellido[0]}
                  </div>
                  <span className='font-bold text-sm md:text-base truncate'>
                    {a.apellido}, {a.nombre}
                  </span>
                </div>
                <button
                  type='button'
                  onClick={() => toggleEstado(a.id_alumno)}
                  aria-label={`${a.apellido}, ${a.nombre}: ${a.estado}. Tocá para cambiar`}
                  className={`${touchTarget} w-[118px] shrink-0 border-0 cursor-pointer font-[inherit] text-[13px] font-extrabold rounded-[20px] transition-all duration-150`}
                  style={{
                    background: EST_COLOR[a.estado] + '1A',
                    color: EST_COLOR[a.estado],
                  }}
                >
                  {a.estado}
                </button>
              </li>
            ))}
          </ul>

          <div className='mt-5 flex flex-col md:flex-row md:items-center gap-3.5'>
            <button
              onClick={guardar}
              disabled={loading}
              className={`${btnPrimary} ${touchTarget} w-full md:w-auto${loading ? ' opacity-60' : ''}`}
            >
              {loading ? 'Guardando...' : '💾 Guardar asistencia'}
            </button>
            {msg && (
              <span
                role='status'
                className={`text-[13px] font-bold ${msg.startsWith('✅') ? 'text-green' : 'text-red'}`}
              >
                {msg}
              </span>
            )}
          </div>
        </div>
      )}

      {selAsignacion && alumnos.length === 0 && (
        <div className={`${card} text-center text-textMuted`}>
          No hay alumnos asignados a este curso.
        </div>
      )}
    </div>
  )
}
