/**
 * Gestión de cursos (panel admin): alta y listado de cursos.
 * Extraído verbatim desde AdminPanel.tsx.
 */
import type { FormEvent } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { Curso } from '../../types'
import {
  badge,
  btnPrimary,
  card,
  fieldLabel,
  inputField,
  selectField,
  tdCell,
  thCell,
} from '../../ui/styles'

export function GestionCursos() {
  const [cursos, setCursos] = useState<Curso[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({
    nivel: 'Inicial',
    grado_anio: '',
    division: 'A',
    capacidad_maxima: '30',
  })

  const load = useCallback(async () => {
    const { data } = await api.get<Curso[]>('/cursos')
    if (data) setCursos(data)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    // El backend asigna el período académico activo.
    const { error } = await api.post('/cursos', {
      nivel: form.nivel,
      grado_anio: form.grado_anio,
      division: form.division,
      capacidad_maxima: Number(form.capacidad_maxima),
    })
    if (error) setMsg('Error: ' + error.message)
    else {
      setMsg('✅ Curso creado.')
      setShowForm(false)
      load()
    }
    setLoading(false)
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>🏫 Cursos</h2>
        <button
          className={btnPrimary}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancelar' : '+ Nuevo curso'}
        </button>
      </div>

      {showForm && (
        <div className={`${card} mb-6`}>
          <div className='text-[15px] font-extrabold text-text mb-5'>
            Crear curso
          </div>
          <form
            onSubmit={handleCreate}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 1fr',
              gap: 14,
            }}
          >
            <div>
              <span className={fieldLabel}>
                Nivel
              </span>
              <select
                className={selectField}
                value={form.nivel}
                onChange={(e) =>
                  setForm((p) => ({ ...p, nivel: e.target.value }))
                }
              >
                <option>Inicial</option>
                <option>Primario</option>
                <option>Secundario</option>
              </select>
            </div>
            <div>
              <span className={fieldLabel}>
                Grado / Año
              </span>
              <input
                className={inputField}
                required
                value={form.grado_anio}
                placeholder='1er Grado'
                onChange={(e) =>
                  setForm((p) => ({ ...p, grado_anio: e.target.value }))
                }
              />
            </div>
            <div>
              <span className={fieldLabel}>
                División
              </span>
              <input
                className={inputField}
                required
                value={form.division}
                placeholder='A'
                onChange={(e) =>
                  setForm((p) => ({ ...p, division: e.target.value }))
                }
              />
            </div>
            <div>
              <span className={fieldLabel}>
                Capacidad máx.
              </span>
              <input
                type='number'
                className={inputField}
                value={form.capacidad_maxima}
                onChange={(e) =>
                  setForm((p) => ({ ...p, capacidad_maxima: e.target.value }))
                }
              />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <button
                type='submit'
                disabled={loading}
                className={`${btnPrimary}${loading ? ' opacity-60' : ''}`}
              >
                {loading ? 'Guardando...' : 'Crear curso'}
              </button>
            </div>
            {msg && (
              <div
                style={{
                  gridColumn: '1/-1',
                  fontSize: 13,
                  fontWeight: 700,
                  color: msg.startsWith('✅') ? '#27AE60' : '#E74C3C',
                }}
              >
                {msg}
              </div>
            )}
          </form>
        </div>
      )}

      <div className={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className={thCell}>
                Nivel
              </th>
              <th className={thCell}>
                Grado / Año
              </th>
              <th className={thCell}>
                División
              </th>
              <th className={thCell}>
                Capacidad
              </th>
            </tr>
          </thead>
          <tbody>
            {cursos.map((c) => (
              <tr key={c.id_curso}>
                <td className={tdCell}>
                  <span
                    style={badge(
                      c.nivel === 'Inicial'
                        ? '#27AE60'
                        : c.nivel === 'Primario'
                          ? '#2980B9'
                          : '#5B35C5',
                    )}
                  >
                    {c.nivel}
                  </span>
                </td>
                <td className={`${tdCell} font-bold`}>
                  {c.grado_anio}
                </td>
                <td className={tdCell}>
                  División {c.division}
                </td>
                <td className={`${tdCell} text-textMuted`}>
                  {c.capacidad_maxima} alumnos
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
