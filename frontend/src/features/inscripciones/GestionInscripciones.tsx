// Gestión de inscripciones — extraído de AdminPanel.tsx
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { Inscripcion, PrefillUsuario } from '../../types'
import { thCell, tdCell, card, badge } from '../../ui/styles'

export function GestionInscripciones({
  onRegistrar,
}: {
  onRegistrar: (data: PrefillUsuario) => void
}) {
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([])

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('inscripciones')
      .select('*')
      .order('fecha_solicitud', { ascending: false })
    if (data) setInscripciones(data as Inscripcion[])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const cambiarEstado = async (id: number, estado: string) => {
    await supabase
      .from('inscripciones')
      .update({ estado })
      .eq('id_inscripcion', id)
    load()
  }

  const ESTADOS = [
    'Pendiente',
    'En revisión',
    'Aprobada',
    'Rechazada',
    'En lista de espera',
  ]
  const EST_COLOR: Record<string, string> = {
    Pendiente: '#E67E22',
    'En revisión': '#2980B9',
    Aprobada: '#27AE60',
    Rechazada: '#E74C3C',
    'En lista de espera': '#6B6B8A',
  }

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 20px' }}>
        📋 Inscripciones
      </h2>
      <div className={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className={thCell}>
                Aspirante
              </th>
              <th className={thCell}>
                Tutor
              </th>
              <th className={thCell}>
                Nivel
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
            {inscripciones.map((i) => (
              <tr key={i.id_inscripcion}>
                <td className={`${tdCell} font-bold`}>
                  {i.nombre_aspirante} {i.apellido_aspirante ?? ''}
                  <br />
                  <span style={{ fontSize: 11, color: '#6B6B8A' }}>
                    DNI: {i.dni_aspirante}
                    {i.fecha_nacimiento_aspirante &&
                      ` · Nac: ${new Date(
                        i.fecha_nacimiento_aspirante,
                      ).toLocaleDateString('es-AR')}`}
                  </span>
                </td>
                <td className={tdCell}>
                  {i.nombre_tutor}
                  <br />
                  <span style={{ fontSize: 11, color: '#6B6B8A' }}>
                    {i.email_tutor}
                  </span>
                </td>
                <td className={tdCell}>
                  <span className='inline-block bg-[#5B35C51A] text-purple-700 rounded-[20px] px-[10px] py-[3px] text-[11px] font-extrabold'>
                    {i.nivel_solicitado}
                  </span>
                </td>
                <td className={`${tdCell} text-textMuted text-xs`}>
                  {new Date(i.fecha_solicitud).toLocaleDateString('es-AR')}
                </td>
                <td className={tdCell}>
                  <span style={badge(EST_COLOR[i.estado] ?? '#6B6B8A')}>
                    {i.estado}
                  </span>
                </td>
                <td className={tdCell}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <select
                      className='rounded-input border-2 border-border text-[13px] text-text outline-none box-border w-[160px] px-[10px] py-[6px] appearance-none'
                      value={i.estado}
                      onChange={(e) =>
                        cambiarEstado(i.id_inscripcion, e.target.value)
                      }
                    >
                      {ESTADOS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    {i.estado === 'Aprobada' && !i.id_alumno_creado && (
                      <button
                        className='bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn w-[160px] px-[10px] py-[6px] text-xs font-extrabold cursor-pointer'
                        onClick={() => {
                          const partes = i.nombre_tutor.trim().split(/\s+/)
                          onRegistrar({
                            nombre: partes[0] ?? '',
                            apellido: partes.slice(1).join(' '),
                            email: i.email_tutor,
                            password: i.dni_aspirante,
                            rol: 'Padre',
                            alumno: {
                              nombre: i.nombre_aspirante,
                              apellido: i.apellido_aspirante ?? '',
                              dni: i.dni_aspirante,
                              fecha_nacimiento:
                                i.fecha_nacimiento_aspirante ?? '',
                            },
                          })
                        }}
                      >
                        Registrar
                      </button>
                    )}
                    {i.id_alumno_creado && (
                      <span className='text-[11px] font-extrabold text-green text-center'>
                        ✓ Usuario registrado
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
