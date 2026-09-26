/**
 * Gestión de docentes (panel admin): lista de docentes en solo lectura.
 * Extraído verbatim desde AdminPanel.tsx.
 */
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { Docente } from '../../types'
import { badge, card, tdCell, thCell } from '../../ui/styles'
import { TablaScroll } from '../../ui/components'

export function GestionDocentes() {
  const [docentes, setDocentes] = useState<Docente[]>([])

  useEffect(() => {
    api.get<Docente[]>('/docentes').then(({ data }) => {
      if (data) setDocentes(data)
    })
  }, [])

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 20px' }}>
        👨‍🏫 Docentes
      </h2>
      <div className={`${card} mb-3`}>
        <p style={{ fontSize: 13, color: '#6B6B8A', margin: 0 }}>
          Para agregar docentes, primero creá el usuario desde{' '}
          <strong>Usuarios</strong> con rol <strong>Docente</strong>. El
          registro en esta tabla se crea automáticamente.
        </p>
      </div>
      <div className={card}>
        <TablaScroll>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className={thCell}>
                  Docente
                </th>
                <th className={thCell}>
                  Email
                </th>
                <th className={thCell}>
                  Especialidad
                </th>
                <th className={thCell}>
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {docentes.map((d) => (
                <tr key={d.id_docente}>
                  <td className={`${tdCell} font-bold`}>
                    {d.usuarios?.apellido}, {d.usuarios?.nombre}
                  </td>
                  <td className={`${tdCell} text-textMuted`}>
                    {d.usuarios?.email}
                  </td>
                  <td className={tdCell}>
                    {d.especialidad ?? '—'}
                  </td>
                  <td className={tdCell}>
                    <span style={badge(d.activo ? '#27AE60' : '#E74C3C')}>
                      {d.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TablaScroll>
      </div>
    </div>
  )
}
