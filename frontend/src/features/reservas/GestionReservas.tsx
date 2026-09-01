// GestionReservas — reservas de instalaciones (R5).
// Extraído de AdminPanel.tsx sin cambios de lógica.
import { useState, useEffect, useCallback } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { Instalacion, Reserva } from '../../types'
import {
  btnPrimary,
  btnDanger,
  inputField,
  selectField,
  fieldLabel,
  thCell,
  tdCell,
  card,
} from '../../ui/styles'

export function GestionReservas({ userId }: { userId: string }) {
  const [instalaciones, setInstalaciones] = useState<Instalacion[]>([])
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [msg, setMsg] = useState('')
  const FORM_VACIO = {
    id_instalacion: '',
    fecha: '',
    hora_inicio: '',
    hora_fin: '',
    motivo: '',
  }
  const [form, setForm] = useState(FORM_VACIO)

  const hoy = new Date().toISOString().slice(0, 10)

  const load = useCallback(async () => {
    const { data: inst } = await supabase
      .from('instalaciones')
      .select('*')
      .eq('activo', true)
      .order('nombre', { ascending: true })
    if (inst) setInstalaciones(inst as Instalacion[])

    const { data: res } = await supabase
      .from('reservas_instalaciones')
      .select('*, instalaciones(nombre), usuarios(nombre, apellido)')
      .gte('fecha', new Date().toISOString().slice(0, 10))
      .order('fecha', { ascending: true })
      .order('hora_inicio', { ascending: true })
    if (res) setReservas(res as unknown as Reserva[])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const crear = async (e: FormEvent) => {
    e.preventDefault()
    setMsg('')
    if (form.hora_fin <= form.hora_inicio) {
      setMsg('La hora de fin debe ser posterior a la de inicio.')
      return
    }
    const { error } = await supabase.from('reservas_instalaciones').insert([
      {
        id_instalacion: Number(form.id_instalacion),
        fecha: form.fecha,
        hora_inicio: form.hora_inicio,
        hora_fin: form.hora_fin,
        motivo: form.motivo || null,
        reservado_por: userId,
      },
    ])
    if (error) {
      setMsg(
        error.message.includes('ya está reservada')
          ? '⛔ La instalación ya está reservada en ese horario. Elegí otra franja.'
          : 'Error: ' + error.message,
      )
    } else {
      setForm(FORM_VACIO)
      load()
    }
  }

  const eliminar = async (id: number) => {
    await supabase.from('reservas_instalaciones').delete().eq('id_reserva', id)
    load()
  }

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 20px' }}>
        🏟️ Reservas de instalaciones
      </h2>

      <div className={`${card} mb-6`}>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Nueva reserva
        </div>
        <form
          onSubmit={crear}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr',
              gap: 14,
            }}
          >
            <div>
              <span className={fieldLabel}>
                Instalación
              </span>
              <select
                className={selectField}
                required
                value={form.id_instalacion}
                onChange={(e) =>
                  setForm((p) => ({ ...p, id_instalacion: e.target.value }))
                }
              >
                <option value=''>Seleccioná...</option>
                {instalaciones.map((i) => (
                  <option key={i.id_instalacion} value={i.id_instalacion}>
                    {i.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className={fieldLabel}>
                Fecha
              </span>
              <input
                className={inputField}
                type='date'
                required
                min={hoy}
                value={form.fecha}
                onChange={(e) =>
                  setForm((p) => ({ ...p, fecha: e.target.value }))
                }
              />
            </div>
            <div>
              <span className={fieldLabel}>
                Hora inicio
              </span>
              <input
                className={inputField}
                type='time'
                required
                value={form.hora_inicio}
                onChange={(e) =>
                  setForm((p) => ({ ...p, hora_inicio: e.target.value }))
                }
              />
            </div>
            <div>
              <span className={fieldLabel}>
                Hora fin
              </span>
              <input
                className={inputField}
                type='time'
                required
                value={form.hora_fin}
                onChange={(e) =>
                  setForm((p) => ({ ...p, hora_fin: e.target.value }))
                }
              />
            </div>
          </div>
          <div>
            <span className={fieldLabel}>
              Motivo (opcional)
            </span>
            <input
              className={inputField}
              value={form.motivo}
              placeholder='Ej: entrenamiento de natación'
              onChange={(e) =>
                setForm((p) => ({ ...p, motivo: e.target.value }))
              }
            />
          </div>
          {msg && (
            <div style={{ fontSize: 12, color: '#E74C3C', fontWeight: 700 }}>
              {msg}
            </div>
          )}
          <button
            type='submit'
            className={`${btnPrimary} self-start`}
          >
            Reservar
          </button>
        </form>
      </div>

      <div className={card}>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Próximas reservas
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className={thCell}>
                Instalación
              </th>
              <th className={thCell}>
                Fecha
              </th>
              <th className={thCell}>
                Horario
              </th>
              <th className={thCell}>
                Motivo
              </th>
              <th className={thCell}>
                Reservó
              </th>
              <th className={thCell}>
                Acción
              </th>
            </tr>
          </thead>
          <tbody>
            {reservas.map((r) => (
              <tr key={r.id_reserva}>
                <td className={`${tdCell} font-bold`}>
                  {r.instalaciones?.nombre ?? '—'}
                </td>
                <td className={tdCell}>
                  {new Date(r.fecha + 'T00:00:00').toLocaleDateString('es-AR')}
                </td>
                <td className={tdCell}>
                  {r.hora_inicio.slice(0, 5)} – {r.hora_fin.slice(0, 5)}
                </td>
                <td className={`${tdCell} text-textMuted`}>
                  {r.motivo ?? '—'}
                </td>
                <td className={`${tdCell} text-textMuted text-xs`}>
                  {r.usuarios
                    ? `${r.usuarios.nombre} ${r.usuarios.apellido}`
                    : '—'}
                </td>
                <td className={tdCell}>
                  <button
                    className={btnDanger}
                    onClick={() => eliminar(r.id_reserva)}
                  >
                    Cancelar
                  </button>
                </td>
              </tr>
            ))}
            {reservas.length === 0 && (
              <tr>
                <td
                  className={`${tdCell} text-textMuted`}
                  colSpan={6}
                >
                  No hay reservas próximas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
