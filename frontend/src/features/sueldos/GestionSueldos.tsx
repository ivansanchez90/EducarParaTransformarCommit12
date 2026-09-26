// Gestión de sueldos del personal — extraído de AdminPanel.tsx
import { useState, useEffect, useCallback } from 'react'
import type { FormEvent } from 'react'
import { api } from '../../lib/api'
import type { Sueldo, UsuarioPanel } from '../../types'
import { MESES } from '../../constants'
import { TablaScroll } from '../../ui/components'
import {
  btnPrimary,
  btnSecondary,
  inputField,
  selectField,
  fieldLabel,
  thCell,
  tdCell,
  card,
  badge,
} from '../../ui/styles'

export function GestionSueldos() {
  const [sueldos, setSueldos] = useState<Sueldo[]>([])
  const [personal, setPersonal] = useState<UsuarioPanel[]>([])
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({
    id_usuario: '',
    mes: String(new Date().getMonth() + 1),
    anio: String(new Date().getFullYear()),
    monto: '',
  })

  const load = useCallback(async () => {
    const { data } = await api.get<Sueldo[]>('/sueldos')
    if (data) setSueldos(data)

    const { data: us } = await api.get<UsuarioPanel[]>(
      '/usuarios?rol=Admin,Directivo,Docente&activo=true',
    )
    if (us) setPersonal(us)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const registrar = async (e: FormEvent) => {
    e.preventDefault()
    setMsg('')
    const { error } = await api.post('/sueldos', {
      id_usuario: form.id_usuario,
      mes: Number(form.mes),
      anio: Number(form.anio),
      monto: Number(form.monto),
    })
    if (error) setMsg('Error: ' + error.message)
    else {
      setForm((p) => ({ ...p, id_usuario: '', monto: '' }))
      load()
    }
  }

  const marcarPagado = async (id: number) => {
    await api.patch(`/sueldos/${id}/pagar`)
    load()
  }

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 20px' }}>
        💼 Sueldos del personal
      </h2>

      <div className={`${card} mb-6`}>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Registrar pago de sueldo
        </div>
        <form
          onSubmit={registrar}
          style={{
            display: 'flex',
            gap: 14,
            alignItems: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '1 1 240px' }}>
            <span className={fieldLabel}>
              Personal
            </span>
            <select
              className={selectField}
              required
              value={form.id_usuario}
              onChange={(e) =>
                setForm((p) => ({ ...p, id_usuario: e.target.value }))
              }
            >
              <option value=''>Seleccioná...</option>
              {personal.map((u) => (
                <option key={u.id_usuario} value={u.id_usuario}>
                  {u.apellido}, {u.nombre} ({u.rol})
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className={fieldLabel}>
              Mes
            </span>
            <select
              className={`${selectField} w-[150px]`}
              value={form.mes}
              onChange={(e) => setForm((p) => ({ ...p, mes: e.target.value }))}
            >
              {MESES.map((m, i) => (
                <option key={i} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className={fieldLabel}>
              Año
            </span>
            <input
              className={`${inputField} w-[100px]`}
              value={form.anio}
              onChange={(e) => setForm((p) => ({ ...p, anio: e.target.value }))}
            />
          </div>
          <div>
            <span className={fieldLabel}>
              Monto ($)
            </span>
            <input
              className={`${inputField} w-[150px]`}
              type='number'
              required
              value={form.monto}
              onChange={(e) =>
                setForm((p) => ({ ...p, monto: e.target.value }))
              }
              placeholder='350000'
            />
          </div>
          <button
            type='submit'
            className={btnPrimary}
          >
            Registrar
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
      </div>

      <div className={card}>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Sueldos registrados
        </div>
        <TablaScroll>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className={thCell}>
                Personal
              </th>
              <th className={thCell}>
                Período
              </th>
              <th className={thCell}>
                Monto
              </th>
              <th className={thCell}>
                Estado
              </th>
              <th className={thCell}>
                Pagado el
              </th>
              <th className={thCell}>
                Acción
              </th>
            </tr>
          </thead>
          <tbody>
            {sueldos.map((s) => (
              <tr key={s.id_sueldo}>
                <td className={`${tdCell} font-bold`}>
                  {s.usuarios
                    ? `${s.usuarios.apellido}, ${s.usuarios.nombre}`
                    : '—'}
                  {s.usuarios && (
                    <>
                      <br />
                      <span style={{ fontSize: 11, color: '#6B6B8A' }}>
                        {s.usuarios.rol}
                      </span>
                    </>
                  )}
                </td>
                <td className={tdCell}>
                  {MESES[s.mes - 1]} {s.anio}
                </td>
                <td className={`${tdCell} font-extrabold text-purple-700`}>
                  ${Number(s.monto).toLocaleString('es-AR')}
                </td>
                <td className={tdCell}>
                  <span
                    style={badge(s.estado === 'Pagado' ? '#27AE60' : '#E67E22')}
                  >
                    {s.estado}
                  </span>
                </td>
                <td className={`${tdCell} text-textMuted text-xs`}>
                  {s.fecha_pago ?? '—'}
                </td>
                <td className={tdCell}>
                  {s.estado !== 'Pagado' && (
                    <button
                      className={`${btnSecondary} !py-[6px] !px-3 !text-xs`}
                      onClick={() => marcarPagado(s.id_sueldo)}
                    >
                      Marcar pagado
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {sueldos.length === 0 && (
              <tr>
                <td
                  className={`${tdCell} text-textMuted`}
                  colSpan={6}
                >
                  No hay sueldos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </TablaScroll>
      </div>
    </div>
  )
}
