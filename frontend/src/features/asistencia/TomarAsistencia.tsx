/**
 * TomarAsistencia — Registro diario de asistencia por clase (rol Docente).
 * Extraído verbatim de AdminPanel.tsx (sin cambios de lógica).
 */
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { Asignacion, AlumnoAsistencia } from '../../types'
import { card, inputField, selectField, fieldLabel, btnPrimary, badge } from '../../ui/styles'

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

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 20px' }}>
        📅 Tomar asistencia
      </h2>

      <div className={`${card} mb-5`}>
        <div
          style={{
            display: 'flex',
            gap: 16,
            alignItems: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <span className={fieldLabel}>
              Clase / Materia
            </span>
            <select
              className={`${selectField} w-[280px]`}
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
          <div>
            <span className={fieldLabel}>
              Fecha
            </span>
            <input
              type='date'
              className={`${inputField} w-[160px]`}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
        </div>
      </div>

      {selAsignacion && alumnos.length > 0 && (
        <div className={card}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <div className='text-[15px] font-extrabold text-text mb-5'>
              {alumnos.length} alumnos — Tocá el estado para cambiar
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['Presente', 'Ausente', 'Tarde', 'Justificado'] as const).map(
                (e) => (
                  <span key={e} style={badge(EST_COLOR[e])}>
                    {e}
                  </span>
                ),
              )}
            </div>
          </div>

          {alumnos.map((a) => (
            <div
              key={a.id_alumno}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 0',
                borderBottom: `1px solid ${'#E8E6F5'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: `${'#5B35C5'}18`,
                    color: '#5B35C5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: 13,
                  }}
                >
                  {a.nombre[0]}
                  {a.apellido[0]}
                </div>
                <span style={{ fontWeight: 700 }}>
                  {a.apellido}, {a.nombre}
                </span>
              </div>
              <button
                onClick={() => toggleEstado(a.id_alumno)}
                style={{
                  ...badge(EST_COLOR[a.estado]),
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  padding: '8px 20px',
                  fontSize: 13,
                  fontWeight: 800,
                  transition: 'all 0.15s',
                }}
              >
                {a.estado}
              </button>
            </div>
          ))}

          <div
            style={{
              marginTop: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <button
              onClick={guardar}
              disabled={loading}
              className={`${btnPrimary}${loading ? ' opacity-60' : ''}`}
            >
              {loading ? 'Guardando...' : '💾 Guardar asistencia'}
            </button>
            {msg && (
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: msg.startsWith('✅') ? '#27AE60' : '#E74C3C',
                }}
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
