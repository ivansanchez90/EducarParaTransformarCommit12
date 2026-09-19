/**
 * RegistrarPagos — búsqueda y filtrado de cuotas pendientes/vencidas,
 * con registro del pago (fecha y método) directamente desde la tabla.
 */
import { useCallback, useEffect, useState } from 'react'
import { api, qs } from '../../lib/api'
import type { Cuota, Pago } from '../../types'
import { MESES, METODOS_PAGO, CUOTA_ESTADO_COLOR } from '../../constants'
import {
  btnPrimary,
  btnDanger,
  card,
  fieldLabel,
  inputField,
  tdCell,
  thCell,
  badge,
} from '../../ui/styles'

export function RegistrarPagos() {
  const [cuotas, setCuotas] = useState<Cuota[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroMes, setFiltroMes] = useState('')
  const [filtroAnio, setFiltroAnio] = useState(String(new Date().getFullYear()))
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [selCuota, setSelCuota] = useState<number | null>(null)
  const FORM_PAGO_VACIO = {
    fecha_pago: new Date().toISOString().split('T')[0],
    metodo_pago: 'Efectivo',
    nro_comprobante: '',
    observaciones: '',
  }
  const [formPago, setFormPago] = useState(FORM_PAGO_VACIO)

  const load = useCallback(async () => {
    const { data } = await api.get<Cuota[]>(
      `/cuotas${qs({
        estado: 'Pendiente,Vencida,En mora',
        anio: filtroAnio,
        mes: filtroMes,
        orden: 'asc',
      })}`,
    )
    if (data) setCuotas(data)
  }, [filtroAnio, filtroMes])

  useEffect(() => {
    load()
  }, [load])

  // Historial: últimos pagos registrados (más recientes primero).
  const loadPagos = useCallback(async () => {
    const { data } = await api.get<Pago[]>('/cuotas/pagos')
    if (data) setPagos(data)
  }, [])

  useEffect(() => {
    loadPagos()
  }, [loadPagos])

  const registrarPago = async (c: Cuota) => {
    setLoading(true)
    setMsg('')
    // El backend marca la cuota como pagada y guarda el movimiento en el historial.
    const { error } = await api.patch(`/cuotas/${c.id_cuota}/pago`, {
      fecha_pago: formPago.fecha_pago,
      metodo_pago: formPago.metodo_pago,
      nro_comprobante: formPago.nro_comprobante || null,
      observaciones: formPago.observaciones || null,
    })
    if (error) {
      setMsg('❌ Error al registrar: ' + error.message)
    } else {
      setMsg(
        `✅ Pago de ${c.alumnos?.apellido}, ${c.alumnos?.nombre} registrado correctamente.`,
      )
      setSelCuota(null)
      setFormPago(FORM_PAGO_VACIO)
      load()
      loadPagos()
    }
    setLoading(false)
  }

  const cuotasFiltradas = cuotas.filter((c) => {
    if (filtroEstado !== 'todos' && c.estado !== filtroEstado) return false
    if (busqueda) {
      const term = busqueda.toLowerCase()
      const nombre = `${c.alumnos?.apellido} ${c.alumnos?.nombre}`.toLowerCase()
      if (!nombre.includes(term)) return false
    }
    return true
  })

  // Neto = base + recargo − descuento (lo mismo que registra el backend como monto pagado).
  const netoCuota = (c: Cuota) =>
    c.monto_base + (c.recargo ?? 0) - (c.descuento ?? 0)

  const totalPendiente = cuotasFiltradas.reduce(
    (acc, c) => acc + netoCuota(c),
    0,
  )

  const pagosFiltrados = pagos.filter((p) => {
    if (!busqueda) return true
    const al = p.cuotas?.alumnos
    return `${al?.apellido} ${al?.nombre}`
      .toLowerCase()
      .includes(busqueda.toLowerCase())
  })

  return (
    <div className='flex flex-col gap-6'>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
        💰 Registro de pagos
      </h2>

      {/* Filtros */}
      <div className={card}>
        <div className='flex flex-wrap gap-4 items-end'>
          <div className='flex-1' style={{ minWidth: 200 }}>
            <span className={fieldLabel}>
              Buscar alumno
            </span>
            <input
              className={inputField}
              placeholder='Apellido o nombre...'
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <div>
            <span className={fieldLabel}>
              Mes
            </span>
            <select
              className='px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border appearance-none'
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
            >
              <option value=''>Todos</option>
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
              className='w-[90px] px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
              value={filtroAnio}
              onChange={(e) => setFiltroAnio(e.target.value)}
            />
          </div>
          <div>
            <span className={fieldLabel}>
              Estado
            </span>
            <select
              className='px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border appearance-none'
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
            >
              <option value='todos'>Todos los pendientes</option>
              <option value='Pendiente'>Pendiente</option>
              <option value='Vencida'>Vencida</option>
              <option value='En mora'>En mora</option>
            </select>
          </div>
        </div>
      </div>

      {/* Estadísticas */}
      <div className='grid grid-cols-3 gap-4'>
        {[
          {
            label: 'Total pendiente',
            value: `$${totalPendiente.toLocaleString('es-AR')}`,
            color: '#5B35C5',
          },
          {
            label: 'Cuotas sin pagar',
            value: cuotasFiltradas.length,
            color: '#E67E22',
          },
          {
            label: 'Vencidas',
            value: cuotasFiltradas.filter(
              (c) => c.estado === 'Vencida' || c.estado === 'En mora',
            ).length,
            color: '#E74C3C',
          },
        ].map((s) => (
          <div
            key={s.label}
            className='bg-white rounded-card p-6 shadow-card border border-border text-center'
          >
            <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>
              {s.value}
            </div>
            <div className='text-[12px] text-textMuted mt-1'>{s.label}</div>
          </div>
        ))}
      </div>

      {msg && (
        <div
          className='text-[13px] font-bold px-4 py-3 rounded-lg border'
          style={{
            color: msg.startsWith('✅') ? '#27AE60' : '#E74C3C',
            background: msg.startsWith('✅') ? '#27AE6012' : '#E74C3C12',
            borderColor: msg.startsWith('✅') ? '#27AE6040' : '#E74C3C40',
          }}
        >
          {msg}
        </div>
      )}

      {/* Tabla */}
      <div className={card}>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Cuotas pendientes de pago
          {cuotasFiltradas.length > 0 && (
            <span className='ml-2 text-[12px] font-bold text-textMuted'>
              ({cuotasFiltradas.length} resultado
              {cuotasFiltradas.length !== 1 ? 's' : ''})
            </span>
          )}
        </div>

        {cuotasFiltradas.length === 0 ? (
          <div className='text-center text-textMuted py-10 text-[14px]'>
            🎉 No hay cuotas pendientes con los filtros seleccionados.
          </div>
        ) : (
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
                  Neto a pagar
                </th>
                <th className={thCell}>
                  Vencimiento
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
              {cuotasFiltradas.map((c) => {
                const neto = netoCuota(c)
                const isSelected = selCuota === c.id_cuota
                const color = CUOTA_ESTADO_COLOR[c.estado] ?? '#6B6B8A'
                return (
                  <>
                    <tr key={c.id_cuota}>
                      <td className={`${tdCell} font-bold`}>
                        {c.alumnos?.apellido}, {c.alumnos?.nombre}
                      </td>
                      <td className={tdCell}>
                        {MESES[c.mes - 1]} {c.anio}
                      </td>
                      <td className={`${tdCell} font-extrabold text-purple-700`}>
                        ${neto.toLocaleString('es-AR')}
                      </td>
                      <td className={`${tdCell} text-textMuted`}>
                        {c.fecha_vencimiento}
                      </td>
                      <td className={tdCell}>
                        <span style={badge(color)}>{c.estado}</span>
                      </td>
                      <td className={tdCell}>
                        {isSelected ? (
                          <button
                            className={btnDanger}
                            onClick={() => setSelCuota(null)}
                          >
                            Cancelar
                          </button>
                        ) : (
                          <button
                            className='bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                            onClick={() => {
                              setSelCuota(c.id_cuota)
                              setMsg('')
                            }}
                          >
                            💳 Registrar pago
                          </button>
                        )}
                      </td>
                    </tr>
                    {isSelected && (
                      <tr key={`pago-${c.id_cuota}`}>
                        <td
                          colSpan={6}
                          className='bg-purpleLight border-b border-border py-4 px-4'
                        >
                          <div className='flex items-center gap-4 flex-wrap'>
                            <div>
                              <span className={fieldLabel}>
                                Fecha de pago
                              </span>
                              <input
                                type='date'
                                className='px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                                value={formPago.fecha_pago}
                                onChange={(e) =>
                                  setFormPago((p) => ({
                                    ...p,
                                    fecha_pago: e.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div>
                              <span className={fieldLabel}>
                                Método de pago
                              </span>
                              <select
                                className='px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border appearance-none'
                                value={formPago.metodo_pago}
                                onChange={(e) =>
                                  setFormPago((p) => ({
                                    ...p,
                                    metodo_pago: e.target.value,
                                  }))
                                }
                              >
                                {METODOS_PAGO.map((m) => (
                                  <option key={m} value={m}>
                                    {m}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <span className={fieldLabel}>
                                N° de comprobante
                              </span>
                              <input
                                className='w-[150px] px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                                placeholder='Opcional'
                                value={formPago.nro_comprobante}
                                onChange={(e) =>
                                  setFormPago((p) => ({
                                    ...p,
                                    nro_comprobante: e.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className='flex-1' style={{ minWidth: 180 }}>
                              <span className={fieldLabel}>
                                Observaciones
                              </span>
                              <input
                                className={inputField}
                                placeholder='Opcional'
                                value={formPago.observaciones}
                                onChange={(e) =>
                                  setFormPago((p) => ({
                                    ...p,
                                    observaciones: e.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className='flex items-end'>
                              <button
                                disabled={loading}
                                className={`${btnPrimary}${loading ? ' opacity-60' : ''}`}
                                onClick={() => registrarPago(c)}
                              >
                                {loading ? 'Guardando...' : '✅ Confirmar pago'}
                              </button>
                            </div>
                            <div className='text-[12px] text-textMuted self-end pb-[10px]'>
                              Alumno:{' '}
                              <strong>
                                {c.alumnos?.apellido}, {c.alumnos?.nombre}
                              </strong>{' '}
                              · Neto:{' '}
                              <strong>${neto.toLocaleString('es-AR')}</strong>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Historial de pagos */}
      <div className={card}>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          🧾 Historial de pagos
          {pagosFiltrados.length > 0 && (
            <span className='ml-2 text-[12px] font-bold text-textMuted'>
              (últimos {pagosFiltrados.length})
            </span>
          )}
        </div>

        {pagosFiltrados.length === 0 ? (
          <div className='text-center text-textMuted py-10 text-[14px]'>
            Todavía no hay pagos registrados.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className={thCell}>Fecha</th>
                <th className={thCell}>Alumno</th>
                <th className={thCell}>Período</th>
                <th className={thCell}>Monto</th>
                <th className={thCell}>Método</th>
                <th className={thCell}>Comprobante</th>
                <th className={thCell}>Registró</th>
              </tr>
            </thead>
            <tbody>
              {pagosFiltrados.map((p) => (
                <tr key={p.id_pago}>
                  <td className={`${tdCell} text-textMuted`}>
                    {p.fecha_pago
                      ? new Date(p.fecha_pago).toLocaleDateString('es-AR')
                      : '—'}
                  </td>
                  <td className={`${tdCell} font-bold`}>
                    {p.cuotas?.alumnos
                      ? `${p.cuotas.alumnos.apellido}, ${p.cuotas.alumnos.nombre}`
                      : '—'}
                  </td>
                  <td className={tdCell}>
                    {p.cuotas ? `${MESES[p.cuotas.mes - 1]} ${p.cuotas.anio}` : '—'}
                  </td>
                  <td className={`${tdCell} font-extrabold text-purple-700`}>
                    ${p.monto_pagado.toLocaleString('es-AR')}
                  </td>
                  <td className={tdCell}>{p.metodo_pago ?? '—'}</td>
                  <td className={tdCell} title={p.observaciones ?? undefined}>
                    {p.nro_comprobante ?? '—'}
                    {p.observaciones && (
                      <span className='ml-1 text-textMuted'>📝</span>
                    )}
                  </td>
                  <td className={`${tdCell} text-textMuted`}>
                    {p.usuarios
                      ? `${p.usuarios.nombre} ${p.usuarios.apellido}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
