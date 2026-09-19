// Gestión de compras de insumos — extraído de AdminPanel.tsx
import { useState, useEffect, useCallback } from 'react'
import type { FormEvent } from 'react'
import { api } from '../../lib/api'
import type { Compra } from '../../types'
import { DESTINOS_INSUMO } from '../../constants'
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

export function GestionCompras() {
  const [compras, setCompras] = useState<Compra[]>([])
  const [msg, setMsg] = useState('')
  const FORM_VACIO = {
    descripcion: '',
    destino: DESTINOS_INSUMO[0],
    cantidad: '1',
    monto: '',
    proveedor: '',
    fecha_compra: new Date().toISOString().slice(0, 10),
  }
  const [form, setForm] = useState(FORM_VACIO)

  const load = useCallback(async () => {
    const { data } = await api.get<Compra[]>('/compras')
    if (data) setCompras(data)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const registrar = async (e: FormEvent) => {
    e.preventDefault()
    setMsg('')
    const { error } = await api.post('/compras', {
      descripcion: form.descripcion,
      destino: form.destino,
      cantidad: Number(form.cantidad),
      monto: Number(form.monto),
      proveedor: form.proveedor || null,
      fecha_compra: form.fecha_compra,
    })
    if (error) setMsg('Error: ' + error.message)
    else {
      setForm(FORM_VACIO)
      load()
    }
  }

  const eliminar = async (id: number) => {
    await api.delete(`/compras/${id}`)
    load()
  }

  const totalGastado = compras.reduce((acc, c) => acc + Number(c.monto), 0)

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 20px' }}>
        🧪 Compras de insumos
      </h2>

      <div className={`${card} mb-6`}>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Registrar compra
        </div>
        <form
          onSubmit={registrar}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.5fr',
              gap: 14,
            }}
          >
            <div>
              <span className={fieldLabel}>
                Descripción
              </span>
              <input
                className={inputField}
                required
                value={form.descripcion}
                placeholder='Ej: 10 tubos de ensayo'
                onChange={(e) =>
                  setForm((p) => ({ ...p, descripcion: e.target.value }))
                }
              />
            </div>
            <div>
              <span className={fieldLabel}>
                Destino
              </span>
              <select
                className={selectField}
                value={form.destino}
                onChange={(e) =>
                  setForm((p) => ({ ...p, destino: e.target.value }))
                }
              >
                {DESTINOS_INSUMO.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1.5fr 1fr',
              gap: 14,
            }}
          >
            <div>
              <span className={fieldLabel}>
                Cantidad
              </span>
              <input
                className={inputField}
                type='number'
                min={1}
                required
                value={form.cantidad}
                onChange={(e) =>
                  setForm((p) => ({ ...p, cantidad: e.target.value }))
                }
              />
            </div>
            <div>
              <span className={fieldLabel}>
                Monto total ($)
              </span>
              <input
                className={inputField}
                type='number'
                required
                value={form.monto}
                onChange={(e) =>
                  setForm((p) => ({ ...p, monto: e.target.value }))
                }
              />
            </div>
            <div>
              <span className={fieldLabel}>
                Proveedor (opcional)
              </span>
              <input
                className={inputField}
                value={form.proveedor}
                onChange={(e) =>
                  setForm((p) => ({ ...p, proveedor: e.target.value }))
                }
              />
            </div>
            <div>
              <span className={fieldLabel}>
                Fecha
              </span>
              <input
                className={inputField}
                type='date'
                value={form.fecha_compra}
                onChange={(e) =>
                  setForm((p) => ({ ...p, fecha_compra: e.target.value }))
                }
              />
            </div>
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
            Registrar compra
          </button>
        </form>
      </div>

      <div className={card}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <div className='text-[15px] font-extrabold text-text mb-0'>
            Compras registradas
          </div>
          <span className='inline-block bg-[#5B35C51A] text-purple-700 rounded-[20px] px-[10px] py-[3px] text-[11px] font-extrabold'>
            Total: ${totalGastado.toLocaleString('es-AR')}
          </span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className={thCell}>
                Descripción
              </th>
              <th className={thCell}>
                Destino
              </th>
              <th className={thCell}>
                Cant.
              </th>
              <th className={thCell}>
                Monto
              </th>
              <th className={thCell}>
                Proveedor
              </th>
              <th className={thCell}>
                Fecha
              </th>
              <th className={thCell}>
                Acción
              </th>
            </tr>
          </thead>
          <tbody>
            {compras.map((c) => (
              <tr key={c.id_compra}>
                <td className={`${tdCell} font-bold`}>
                  {c.descripcion}
                </td>
                <td className={tdCell}>
                  <span className='inline-block bg-[#2980B91A] text-blue rounded-[20px] px-[10px] py-[3px] text-[11px] font-extrabold'>
                    {c.destino}
                  </span>
                </td>
                <td className={tdCell}>
                  {c.cantidad}
                </td>
                <td className={`${tdCell} font-extrabold text-purple-700`}>
                  ${Number(c.monto).toLocaleString('es-AR')}
                </td>
                <td className={`${tdCell} text-textMuted`}>
                  {c.proveedor ?? '—'}
                </td>
                <td className={`${tdCell} text-textMuted text-xs`}>
                  {c.fecha_compra}
                </td>
                <td className={tdCell}>
                  <button
                    className={btnDanger}
                    onClick={() => eliminar(c.id_compra)}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {compras.length === 0 && (
              <tr>
                <td
                  className={`${tdCell} text-textMuted`}
                  colSpan={7}
                >
                  No hay compras registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
