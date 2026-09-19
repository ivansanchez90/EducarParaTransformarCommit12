/**
 * Dashboard del panel: saludo, tarjetas de estadísticas (solo Admin) y
 * accesos rápidos a las secciones de navegación según el rol.
 */
import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import type { UsuarioPanel } from '../../types'
import { NAV_ADMIN, NAV_DOCENTE } from '../../constants'
import { card } from '../../ui/styles'

export function Dashboard({
  esAdmin,
  perfil,
  onIr,
}: {
  esAdmin: boolean
  perfil: UsuarioPanel
  onIr: (key: string) => void
}) {
  const [stats, setStats] = useState({
    alumnos: 0,
    docentes: 0,
    inscripciones: 0,
    cuotasPendientes: 0,
  })

  useEffect(() => {
    if (!esAdmin) return
    api.get<typeof stats>('/dashboard/stats').then(({ data }) => {
      if (data) setStats(data)
    })
  }, [esAdmin])

  const statItems = esAdmin
    ? [
        {
          icon: '🎓',
          label: 'Alumnos activos',
          value: stats.alumnos,
          color: '#5B35C5',
        },
        {
          icon: '👨‍🏫',
          label: 'Docentes activos',
          value: stats.docentes,
          color: '#2980B9',
        },
        {
          icon: '📋',
          label: 'Inscripciones pendientes',
          value: stats.inscripciones,
          color: '#E67E22',
        },
        {
          icon: '💳',
          label: 'Cuotas sin pagar',
          value: stats.cuotasPendientes,
          color: '#E74C3C',
        },
      ]
    : []

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 6px' }}>
          Bienvenido/a, {perfil.nombre} 👋
        </h2>
        <p style={{ color: '#6B6B8A', margin: 0, fontSize: 14 }}>
          {new Date().toLocaleDateString('es-AR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {esAdmin && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4,1fr)',
            gap: 16,
            marginBottom: 28,
          }}
        >
          {statItems.map((s) => (
            <div
              key={s.label}
              className={card}
              style={{ borderTop: `3px solid ${s.color}` }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: 30, fontWeight: 900, color: s.color }}>
                {s.value}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: '#6B6B8A',
                  fontWeight: 700,
                  marginTop: 4,
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={card}>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Accesos rápidos
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {(esAdmin ? NAV_ADMIN : NAV_DOCENTE)
            .filter((n) => n.key !== 'dashboard')
            .map((item) => (
              <div
                key={item.key}
                onClick={() => onIr(item.key)}
                className='bg-white rounded-card px-5 py-4 shadow-card border border-border cursor-pointer min-w-[140px] text-center transition-all duration-200 flex-1 hover:-translate-y-[3px] hover:shadow-card-hover'
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>{item.icon}</div>
                <div
                  style={{ fontSize: 13, fontWeight: 800, color: '#5B35C5' }}
                >
                  {item.label}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
