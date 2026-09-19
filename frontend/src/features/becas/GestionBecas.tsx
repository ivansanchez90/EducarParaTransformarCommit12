/**
 * GestionBecas — otorgamiento y actualización de becas por alumno (una beca
 * por alumno vía upsert), con activación/desactivación y listado.
 */
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../../lib/api'
import type { Alumno, Beca } from '../../types'
import {
  btnPrimary,
  btnSecondary,
  btnDanger,
  card,
  fieldLabel,
  inputField,
  selectField,
  tdCell,
  thCell,
  badge,
} from '../../ui/styles'

export function GestionBecas() {
  const [becas, setBecas] = useState<Beca[]>([])
  const [alumnos, setAlumnos] = useState<Alumno[]>([])
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({
    id_alumno: '',
    porcentaje: '',
    motivo: '',
  })

  const load = useCallback(async () => {
    const { data } = await api.get<Beca[]>('/becas')
    if (data) setBecas(data)

    const { data: al } = await api.get<Alumno[]>('/alumnos?activo=true')
    if (al) setAlumnos(al)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    setMsg('')
    const pct = Number(form.porcentaje)
    if (pct <= 0 || pct > 100) {
      setMsg('El porcentaje debe estar entre 1 y 100.')
      return
    }
    // PUT = upsert: una beca por alumno (si ya tiene, se actualiza)
    const { error } = await api.put('/becas', {
      id_alumno: Number(form.id_alumno),
      porcentaje: pct,
      motivo: form.motivo || null,
    })
    if (error) setMsg('Error: ' + error.message)
    else {
      setForm({ id_alumno: '', porcentaje: '', motivo: '' })
      load()
    }
  }

  const toggleActivo = async (b: Beca) => {
    await api.patch(`/becas/${b.id_beca}`, { activo: !b.activo })
    load()
  }

  const eliminar = async (id: number) => {
    await api.delete(`/becas/${id}`)
    load()
  }

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 20px' }}>
        🎟️ Becas
      </h2>

      <div className={`${card} mb-6`}>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Otorgar / actualizar beca
        </div>
        <form
          onSubmit={guardar}
          style={{
            display: 'flex',
            gap: 14,
            alignItems: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '1 1 240px' }}>
            <span className={fieldLabel}>
              Alumno
            </span>
            <select
              className={selectField}
              required
              value={form.id_alumno}
              onChange={(e) =>
                setForm((p) => ({ ...p, id_alumno: e.target.value }))
              }
            >
              <option value=''>Seleccioná un alumno...</option>
              {alumnos.map((a) => (
                <option key={a.id_alumno} value={a.id_alumno}>
                  {a.apellido}, {a.nombre} — DNI {a.dni}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className={fieldLabel}>
              Descuento (%)
            </span>
            <input
              className={`${inputField} w-[130px]`}
              type='number'
              min={1}
              max={100}
              required
              value={form.porcentaje}
              onChange={(e) =>
                setForm((p) => ({ ...p, porcentaje: e.target.value }))
              }
            />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <span className={fieldLabel}>
              Motivo (opcional)
            </span>
            <input
              className={inputField}
              value={form.motivo}
              placeholder='Ej: beca por hermanos'
              onChange={(e) =>
                setForm((p) => ({ ...p, motivo: e.target.value }))
              }
            />
          </div>
          <button
            type='submit'
            className={btnPrimary}
          >
            Guardar beca
          </button>
        </form>
        {msg && (
          <div
            style={{
              marginTop: 12,
              fontSize: 12,
              color: '#E74C3C',
              fontWeight: 700,
            }}
          >
            {msg}
          </div>
        )}
        <div style={{ marginTop: 10, fontSize: 12, color: '#6B6B8A' }}>
          El descuento se aplica automáticamente al generar las cuotas del mes.
        </div>
      </div>

      <div className={card}>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Becas otorgadas
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className={thCell}>
                Alumno
              </th>
              <th className={thCell}>
                Descuento
              </th>
              <th className={thCell}>
                Motivo
              </th>
              <th className={thCell}>
                Estado
              </th>
              <th className={thCell}>
                Acción
              </th>
            </tr>
          </thead>
          <tbody>
            {becas.map((b) => (
              <tr key={b.id_beca}>
                <td className={`${tdCell} font-bold`}>
                  {b.alumnos?.apellido}, {b.alumnos?.nombre}
                </td>
                <td className={tdCell}>
                  <span className='inline-block bg-[#27AE601A] text-green rounded-[20px] px-[10px] py-[3px] text-[11px] font-extrabold'>
                    {b.porcentaje}%
                  </span>
                </td>
                <td className={`${tdCell} text-textMuted`}>
                  {b.motivo ?? '—'}
                </td>
                <td className={tdCell}>
                  <span style={badge(b.activo ? '#27AE60' : '#6B6B8A')}>
                    {b.activo ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td className={tdCell}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className={`${btnSecondary} !py-[6px] !px-3 !text-xs`}
                      onClick={() => toggleActivo(b)}
                    >
                      {b.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      className={btnDanger}
                      onClick={() => eliminar(b.id_beca)}
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {becas.length === 0 && (
              <tr>
                <td
                  className={`${tdCell} text-textMuted`}
                  colSpan={5}
                >
                  No hay becas otorgadas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
