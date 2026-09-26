/**
 * GestionCuotas — generación automática de cuotas para todos los alumnos,
 * procesamiento de vencimientos con notificación a las familias y listado
 * de las últimas cuotas generadas.
 */
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../../lib/api'
import type { Cuota } from '../../types'
import { MESES } from '../../constants'
import { TablaScroll } from '../../ui/components'
import {
  btnPrimary,
  btnSecondary,
  card,
  fieldLabel,
  inputField,
  selectField,
  tdCell,
  thCell,
  badge,
} from '../../ui/styles'

export function GestionCuotas() {
  const [cuotas, setCuotas] = useState<Cuota[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({
    mes: String(new Date().getMonth() + 1),
    anio: String(new Date().getFullYear()),
    monto_base: '',
  })

  const load = useCallback(async () => {
    const { data } = await api.get<Cuota[]>('/cuotas?limit=50')
    if (data) setCuotas(data)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Genera la cuota del mes para todos los alumnos activos. El backend aplica
  // el descuento de las becas activas y no duplica cuotas ya existentes.
  const generarCuotas = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    const mes = Number(form.mes)
    const anio = Number(form.anio)
    const { data, error } = await api.post<{ generadas: number }>(
      '/cuotas/generar',
      { mes, anio, monto_base: Number(form.monto_base) },
    )
    if (error) setMsg('Error: ' + error.message)
    else {
      setMsg(
        `✅ ${data.generadas} cuotas generadas para ${MESES[mes - 1]} ${anio}.`,
      )
      load()
    }
    setLoading(false)
  }

  // R6 · Marca como vencidas las cuotas impagas pasadas de fecha
  //       y notifica automáticamente a las familias (lo hace el backend).
  const procesarVencimientos = async () => {
    setLoading(true)
    setMsg('')
    const { data, error } = await api.post<{ vencidas: number }>(
      '/cuotas/procesar-vencimientos',
    )
    if (error) setMsg('Error: ' + error.message)
    else if (data.vencidas === 0)
      setMsg('No hay cuotas pendientes que hayan vencido.')
    else {
      setMsg(
        `✅ ${data.vencidas} cuota(s) marcadas como vencidas y familias notificadas.`,
      )
      load()
    }
    setLoading(false)
  }

  const CUOTA_COLOR: Record<string, string> = {
    Pendiente: '#E67E22',
    Pagada: '#27AE60',
    Vencida: '#E74C3C',
    'En mora': '#C0392B',
  }

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 20px' }}>
        💳 Cuotas
      </h2>

      {/* Generador */}
      <div className={`${card} mb-6`}>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Generar cuotas automáticamente para todos los alumnos
        </div>
        <form
          onSubmit={generarCuotas}
          style={{
            display: 'flex',
            gap: 14,
            alignItems: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <span className={fieldLabel}>
              Mes
            </span>
            <select
              className={`${selectField} w-[160px]`}
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
              Monto base ($)
            </span>
            <input
              type='number'
              className={`${inputField} w-[160px]`}
              required
              value={form.monto_base}
              onChange={(e) =>
                setForm((p) => ({ ...p, monto_base: e.target.value }))
              }
              placeholder='15000'
            />
          </div>
          <button
            type='submit'
            disabled={loading}
            className={`${btnPrimary}${loading ? ' opacity-60' : ''}`}
          >
            {loading ? 'Generando...' : '⚡ Generar cuotas'}
          </button>
          <button
            type='button'
            disabled={loading}
            onClick={procesarVencimientos}
            className={btnSecondary}
            title='Marca como vencidas las cuotas impagas pasadas de fecha y notifica a las familias'
          >
            ⏰ Procesar vencimientos
          </button>
        </form>
        {msg && (
          <div
            style={{
              marginTop: 12,
              fontSize: 13,
              fontWeight: 700,
              color: msg.startsWith('✅') ? '#27AE60' : '#E74C3C',
            }}
          >
            {msg}
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className={card}>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Últimas cuotas generadas
        </div>
        <TablaScroll>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className={thCell}>
                Alumno
              </th>
              <th className={thCell}>
                Período
              </th>
              <th className={thCell}>
                Monto base
              </th>
              <th className={thCell}>
                Descuento beca
              </th>
              <th className={thCell}>
                Neto a pagar
              </th>
              <th className={thCell}>
                Vencimiento
              </th>
              <th className={thCell}>
                Estado
              </th>
            </tr>
          </thead>
          <tbody>
            {cuotas.map((c) => {
              const desc = c.descuento ?? 0
              return (
                <tr key={c.id_cuota}>
                  <td className={`${tdCell} font-bold`}>
                    {c.alumnos?.apellido}, {c.alumnos?.nombre}
                  </td>
                  <td className={tdCell}>
                    {MESES[c.mes - 1]} {c.anio}
                  </td>
                  <td className={tdCell}>
                    ${c.monto_base.toLocaleString('es-AR')}
                  </td>
                  <td
                    className={tdCell}
                    style={{ color: desc > 0 ? '#27AE60' : '#6B6B8A' }}
                  >
                    {desc > 0 ? `– $${desc.toLocaleString('es-AR')}` : '—'}
                  </td>
                  <td className={`${tdCell} font-extrabold text-purple-700`}>
                    ${(c.monto_base - desc).toLocaleString('es-AR')}
                  </td>
                  <td className={`${tdCell} text-textMuted`}>
                    {c.fecha_vencimiento}
                  </td>
                  <td className={tdCell}>
                    <span style={badge(CUOTA_COLOR[c.estado] ?? '#6B6B8A')}>
                      {c.estado}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </TablaScroll>
      </div>
    </div>
  )
}
