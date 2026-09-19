/**
 * Gestión de materias (panel admin): alta y listado de materias.
 * Extraído verbatim desde AdminPanel.tsx.
 */
import type { FormEvent } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { Materia } from '../../types'
import {
  badge,
  btnPrimary,
  card,
  fieldLabel,
  inputField,
  tdCell,
  thCell,
} from '../../ui/styles'

export function GestionMaterias() {
  const [materias, setMaterias] = useState<Materia[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nombre: '', horas_semanales: '4' })
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const { data } = await api.get<Materia[]>('/materias')
    if (data) setMaterias(data)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setMsg('')
    const { error } = await api.post('/materias', {
      nombre: form.nombre,
      horas_semanales: Number(form.horas_semanales),
    })
    if (error) setMsg('Error: ' + error.message)
    else {
      setMsg('✅ Materia creada.')
      setShowForm(false)
      load()
    }
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
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
          📚 Materias
        </h2>
        <button
          className={btnPrimary}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancelar' : '+ Nueva materia'}
        </button>
      </div>
      {showForm && (
        <div className={`${card} mb-6`}>
          <form
            onSubmit={handleCreate}
            style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}
          >
            <div style={{ flex: 2 }}>
              <span className={fieldLabel}>
                Nombre de la materia
              </span>
              <input
                className={inputField}
                required
                value={form.nombre}
                onChange={(e) =>
                  setForm((p) => ({ ...p, nombre: e.target.value }))
                }
              />
            </div>
            <div style={{ flex: 1 }}>
              <span className={fieldLabel}>
                Horas semanales
              </span>
              <input
                type='number'
                className={inputField}
                value={form.horas_semanales}
                onChange={(e) =>
                  setForm((p) => ({ ...p, horas_semanales: e.target.value }))
                }
              />
            </div>
            <button
              type='submit'
              className={btnPrimary}
            >
              Guardar
            </button>
          </form>
          {msg && (
            <div
              style={{
                marginTop: 10,
                fontSize: 13,
                fontWeight: 700,
                color: msg.startsWith('✅') ? '#27AE60' : '#E74C3C',
              }}
            >
              {msg}
            </div>
          )}
        </div>
      )}
      <div className={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className={thCell}>
                Materia
              </th>
              <th className={thCell}>
                Horas semanales
              </th>
              <th className={thCell}>
                Estado
              </th>
            </tr>
          </thead>
          <tbody>
            {materias.map((m) => (
              <tr key={m.id_materia}>
                <td className={`${tdCell} font-bold`}>
                  {m.nombre}
                </td>
                <td className={tdCell}>
                  {m.horas_semanales} hs
                </td>
                <td className={tdCell}>
                  <span style={badge(m.activo ? '#27AE60' : '#E74C3C')}>
                    {m.activo ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
