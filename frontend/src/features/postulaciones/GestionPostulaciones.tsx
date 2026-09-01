// GestionPostulaciones — panel de administración de postulaciones a empleos.
// Extraído de AdminPanel.tsx sin cambios de lógica.
import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { Postulacion } from '../../types'
import { POST_ESTADOS, POST_COLOR } from '../../constants'
import { fieldLabel, thCell, tdCell, card, badge } from '../../ui/styles'

export function GestionPostulaciones() {
  const [postulaciones, setPostulaciones] = useState<Postulacion[]>([])
  const [empleos, setEmpleos] = useState<
    { id_empleo: number; titulo: string }[]
  >([])
  const [filtroEmpleo, setFiltroEmpleo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [expandido, setExpandido] = useState<number | null>(null)

  const load = useCallback(async () => {
    const [{ data: posts }, { data: emps }] = await Promise.all([
      supabase
        .from('postulaciones')
        .select('*, empleos(titulo, area)')
        .order('fecha_postulacion', { ascending: false }),
      supabase
        .from('empleos')
        .select('id_empleo, titulo')
        .eq('activo', true)
        .order('titulo'),
    ])
    if (posts) setPostulaciones(posts as unknown as Postulacion[])
    if (emps) setEmpleos(emps as { id_empleo: number; titulo: string }[])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const cambiarEstado = async (id: number, estado: string) => {
    await supabase
      .from('postulaciones')
      .update({ estado })
      .eq('id_postulacion', id)
    load()
  }

  const filtradas = postulaciones.filter((p) => {
    if (filtroEmpleo && p.id_empleo !== Number(filtroEmpleo)) return false
    if (filtroEstado && p.estado !== filtroEstado) return false
    return true
  })

  const conteosPorEstado = POST_ESTADOS.reduce<Record<string, number>>(
    (acc, e) => {
      acc[e] = postulaciones.filter((p) => p.estado === e).length
      return acc
    },
    {},
  )

  return (
    <div className='flex flex-col gap-6'>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
        📩 Postulaciones
      </h2>

      {/* Estadísticas */}
      <div className='grid grid-cols-5 gap-3'>
        {POST_ESTADOS.map((e) => (
          <button
            key={e}
            onClick={() => setFiltroEstado(filtroEstado === e ? '' : e)}
            className='bg-white rounded-card p-4 shadow-card border text-center transition-all duration-200 cursor-pointer'
            style={{
              borderColor: filtroEstado === e ? POST_COLOR[e] : '#E8E6F5',
              borderWidth: filtroEstado === e ? 2 : 1,
            }}
          >
            <div
              className='text-[22px] font-black'
              style={{ color: POST_COLOR[e] }}
            >
              {conteosPorEstado[e] ?? 0}
            </div>
            <div className='text-[10px] font-extrabold text-textMuted mt-1'>
              {e}
            </div>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className='flex gap-4 items-center'>
        <div>
          <span className={fieldLabel}>
            Filtrar por empleo
          </span>
          <select
            className='px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none appearance-none'
            style={{ minWidth: 260 }}
            value={filtroEmpleo}
            onChange={(e) => setFiltroEmpleo(e.target.value)}
          >
            <option value=''>Todos los empleos</option>
            {empleos.map((emp) => (
              <option key={emp.id_empleo} value={emp.id_empleo}>
                {emp.titulo}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className={fieldLabel}>
            Filtrar por estado
          </span>
          <select
            className='px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none appearance-none'
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value=''>Todos los estados</option>
            {POST_ESTADOS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        {(filtroEmpleo || filtroEstado) && (
          <button
            className='mt-5 text-[12px] font-bold text-purple-700 bg-purpleLight border-0 rounded-lg px-3 py-[7px] cursor-pointer'
            onClick={() => {
              setFiltroEmpleo('')
              setFiltroEstado('')
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className={card}>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Postulantes
          <span className='ml-2 text-[12px] font-bold text-textMuted'>
            ({filtradas.length} resultado{filtradas.length !== 1 ? 's' : ''})
          </span>
        </div>

        {filtradas.length === 0 ? (
          <div className='text-center text-textMuted py-10 text-[14px]'>
            No hay postulaciones con los filtros seleccionados.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className={thCell}>
                  Postulante
                </th>
                <th className={thCell}>
                  Empleo
                </th>
                <th className={thCell}>
                  Fecha
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
              {filtradas.map((p) => (
                <>
                  <tr key={p.id_postulacion}>
                    <td className={tdCell}>
                      <div className='font-bold'>
                        {p.apellido}, {p.nombre}
                      </div>
                      <a
                        href={`mailto:${p.email}`}
                        className='text-[11px] text-purple-700 no-underline hover:underline'
                      >
                        {p.email}
                      </a>
                      {p.telefono && (
                        <div className='text-[11px] text-textMuted'>
                          {p.telefono}
                        </div>
                      )}
                    </td>
                    <td className={tdCell}>
                      <div className='font-extrabold text-purple-700 text-[12px]'>
                        {p.empleos?.titulo}
                      </div>
                      {p.empleos?.area && (
                        <div className='text-[11px] text-textMuted'>
                          📍 {p.empleos.area}
                        </div>
                      )}
                    </td>
                    <td className={`${tdCell} text-textMuted text-xs`}>
                      {new Date(p.fecha_postulacion).toLocaleDateString(
                        'es-AR',
                      )}
                    </td>
                    <td className={tdCell}>
                      <span style={badge(POST_COLOR[p.estado] ?? '#6B6B8A')}>
                        {p.estado}
                      </span>
                    </td>
                    <td className={tdCell}>
                      <div className='flex flex-col gap-[6px]'>
                        <select
                          className='rounded-input border-2 border-border text-[13px] text-text outline-none w-[160px] px-[10px] py-[6px] appearance-none'
                          value={p.estado}
                          onChange={(e) =>
                            cambiarEstado(p.id_postulacion, e.target.value)
                          }
                        >
                          {POST_ESTADOS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        {p.mensaje && (
                          <button
                            className='bg-purpleLight text-purple-700 border-0 rounded-lg w-[160px] px-[10px] py-[6px] text-xs font-extrabold cursor-pointer text-left'
                            onClick={() =>
                              setExpandido(
                                expandido === p.id_postulacion
                                  ? null
                                  : p.id_postulacion,
                              )
                            }
                          >
                            {expandido === p.id_postulacion
                              ? '▲ Ocultar mensaje'
                              : '▼ Ver mensaje'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandido === p.id_postulacion && p.mensaje && (
                    <tr key={`msg-${p.id_postulacion}`}>
                      <td
                        colSpan={5}
                        className='bg-purpleLight px-6 py-4 border-b border-border text-[13px] text-text leading-relaxed'
                      >
                        <div className='text-[10px] font-extrabold text-textMuted uppercase tracking-wider mb-2'>
                          Mensaje del postulante
                        </div>
                        {p.mensaje}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
