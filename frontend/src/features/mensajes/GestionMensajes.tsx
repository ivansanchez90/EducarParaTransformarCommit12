// GestionMensajes — bandeja de mensajes de contacto.
// Extraído de AdminPanel.tsx sin cambios de lógica.
import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'
import type { MensajeContacto } from '../../types'
import { btnSecondary, card, badge } from '../../ui/styles'

export function GestionMensajes() {
  const [mensajes, setMensajes] = useState<MensajeContacto[]>([])
  const [abierto, setAbierto] = useState<number | null>(null)

  const load = useCallback(async () => {
    const { data } = await api.get<MensajeContacto[]>('/mensajes')
    if (data) setMensajes(data)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const marcarLeido = async (id: number, leido: boolean) => {
    await api.patch(`/mensajes/${id}`, { leido })
    load()
  }

  const sinLeer = mensajes.filter((m) => !m.leido).length

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 20px' }}>
        ✉️ Mensajes de contacto
        {sinLeer > 0 && (
          <span style={{ ...badge('#E67E22'), marginLeft: 10 }}>
            {sinLeer} sin leer
          </span>
        )}
      </h2>
      <div className={card}>
        {mensajes.length === 0 ? (
          <div style={{ color: '#6B6B8A', fontSize: 13 }}>
            No hay mensajes recibidos.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {mensajes.map((m) => (
              <div
                key={m.id_mensaje}
                style={{
                  border: `1px solid ${'#E8E6F5'}`,
                  borderRadius: 12,
                  padding: 14,
                  background: m.leido ? '#FFFFFF' : '#EEE9FF',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    rowGap: 12,
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}
                  onClick={() =>
                    setAbierto(abierto === m.id_mensaje ? null : m.id_mensaje)
                  }
                >
                  <div className='min-w-0 break-words'>
                    <span style={{ fontWeight: 800, fontSize: 14 }}>
                      {m.nombre}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: '#6B6B8A',
                        marginLeft: 8,
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {m.email}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: '#6B6B8A' }}>
                    {new Date(m.fecha_envio).toLocaleString('es-AR')}
                  </span>
                </div>
                {abierto === m.id_mensaje && (
                  <div style={{ marginTop: 12 }}>
                    <p
                      style={{
                        fontSize: 13,
                        lineHeight: 1.6,
                        color: '#1A1A2E',
                        whiteSpace: 'pre-wrap',
                        margin: '0 0 12px',
                      }}
                    >
                      {m.mensaje}
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <a
                        href={`mailto:${m.email}`}
                        className={`${btnSecondary} py-[6px] px-[14px] !text-xs no-underline`}
                      >
                        Responder por correo
                      </a>
                      <button
                        className={`${btnSecondary} py-[6px] px-[14px] !text-xs`}
                        onClick={() => marcarLeido(m.id_mensaje, !m.leido)}
                      >
                        {m.leido ? 'Marcar como no leído' : 'Marcar como leído'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
