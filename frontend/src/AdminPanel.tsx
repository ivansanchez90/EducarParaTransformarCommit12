/**
 * AdminPanel.tsx
 * Panel de administración — Educar Para Transformar
 * Roles: Admin / Directivo → acceso completo
 *        Docente           → solo sus secciones
 *
 * Este archivo es solo el "shell": autenticación, layout (header + sidebar) y
 * enrutado entre secciones. Cada sección vive en su propio módulo en `features/`.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSession, logout, onAuthChange } from './lib/auth'
import type { UsuarioPanel } from './types'
import { NAV_ADMIN, NAV_DOCENTE } from './constants'

import { Dashboard } from './features/dashboard/Dashboard'
import { GestionUsuarios } from './features/usuarios/GestionUsuarios'
import { GestionAlumnos } from './features/alumnos/GestionAlumnos'
import { GestionDocentes } from './features/docentes/GestionDocentes'
import { GestionCursos } from './features/cursos/GestionCursos'
import { GestionMaterias } from './features/materias/GestionMaterias'
import { GestionAsignaciones } from './features/asignaciones/GestionAsignaciones'
import { GestionCuotas } from './features/cuotas/GestionCuotas'
import { RegistrarPagos } from './features/pagos/RegistrarPagos'
import { GestionBecas } from './features/becas/GestionBecas'
import { GestionSueldos } from './features/sueldos/GestionSueldos'
import { GestionCompras } from './features/compras/GestionCompras'
import { GestionInscripciones } from './features/inscripciones/GestionInscripciones'
import { GestionActividades } from './features/actividades/GestionActividades'
import { GestionReservas } from './features/reservas/GestionReservas'
import { GestionServicios } from './features/servicios/GestionServicios'
import { GestionReportes } from './features/reportes/GestionReportes'
import { CambiarPassword } from './features/cuenta/CambiarPassword'
import { GestionMensajes } from './features/mensajes/GestionMensajes'
import { GestionNoticias } from './features/noticias/GestionNoticias'
import { GestionEmpleos } from './features/empleos/GestionEmpleos'
import { GestionPostulaciones } from './features/postulaciones/GestionPostulaciones'
import { GestionGaleria } from './features/galeria/GestionGaleria'
import { TomarAsistencia } from './features/asistencia/TomarAsistencia'
import { CargarCalificaciones } from './features/calificaciones/CargarCalificaciones'
import { GestionAmonestaciones } from './features/amonestaciones/GestionAmonestaciones'
import { LegajosDocente } from './features/legajos-docente/LegajosDocente'

// ═══════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export default function AdminPanel() {
  const navigate = useNavigate()
  const [perfil, setPerfil] = useState<UsuarioPanel | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [activeNav, setActiveNav] = useState('dashboard')
  const [cambiandoPassword, setCambiandoPassword] = useState(false)
  // La sesión devuelve el perfil completo (el backend ya rechaza a los
  // usuarios desactivados), así que no hace falta una segunda consulta.
  useEffect(() => {
    getSession().then((p) => {
      setPerfil(p)
      setAuthChecked(true)
    })
    return onAuthChange(setPerfil)
  }, [])

  useEffect(() => {
    if (authChecked && !perfil) navigate('/login', { replace: true })
  }, [authChecked, perfil, navigate])

  if (!authChecked || !perfil) return null

  if (!['Admin', 'Directivo', 'Docente'].includes(perfil.rol)) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontFamily: "'Nunito',sans-serif",
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#E74C3C' }}>
            Sin acceso
          </div>
          <p style={{ color: '#6B6B8A' }}>
            Tu usuario no tiene permisos para este panel.
          </p>
          <button
            className='bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer'
            onClick={logout}
          >
            Salir
          </button>
        </div>
      </div>
    )
  }

  const esAdmin = ['Admin', 'Directivo'].includes(perfil.rol)
  const navItems = esAdmin ? NAV_ADMIN : NAV_DOCENTE
  const initials = `${perfil.nombre[0]}${perfil.apellido[0]}`

  return (
    <div
      style={{
        fontFamily: "'Nunito','Segoe UI',sans-serif",
        background: '#F5F4FB',
        minHeight: '100vh',
        color: '#1A1A2E',
      }}
    >
      {/* ── HEADER ── */}
      <header
        style={{
          background: '#FFFFFF',
          borderBottom: `3px solid ${'#5B35C5'}`,
          padding: '0 28px',
          height: 68,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 2px 16px rgba(91,53,197,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src='/logo.png'
            alt='Logo'
            style={{ height: 46 }}
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 900,
                color: '#5B35C5',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Educar Para Transformar
            </div>
            <div style={{ fontSize: 10, color: '#6B6B8A' }}>
              Panel {perfil.rol}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: `linear-gradient(135deg,${'#5B35C5'},${'#7B55E8'})`,
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: 13,
            }}
          >
            {initials}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800 }}>
              {perfil.nombre} {perfil.apellido}
            </div>
            <div style={{ fontSize: 11, color: '#6B6B8A' }}>{perfil.rol}</div>
          </div>
          <button
            className='bg-transparent border border-border rounded-[8px] px-3.5 py-[7px] text-xs font-bold text-textMuted cursor-pointer font-[inherit]'
            onClick={() => setCambiandoPassword(true)}
          >
            🔑 Mi contraseña
          </button>
          <button
            className='bg-transparent border border-border rounded-[8px] px-3.5 py-[7px] text-xs font-bold text-textMuted cursor-pointer font-[inherit]'
            onClick={() => navigate('/')}
          >
            ← Inicio
          </button>
          <button
            className='bg-purpleLight text-purple-700 border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer !py-[7px] !px-[14px] !text-xs'
            onClick={logout}
          >
            Salir
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 68px)' }}>
        {/* ── SIDEBAR ── */}
        <aside
          style={{
            width: 220,
            background: '#FFFFFF',
            borderRight: `1px solid ${'#E8E6F5'}`,
            padding: '20px 0',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: '#6B6B8A',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              padding: '0 20px 14px',
              borderBottom: `1px solid ${'#E8E6F5'}`,
              marginBottom: 6,
            }}
          >
            Menú
          </div>
          {navItems.map((item) => (
            <div
              key={item.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '11px 20px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeNav === item.key ? 800 : 600,
                color: activeNav === item.key ? '#5B35C5' : '#6B6B8A',
                background: activeNav === item.key ? '#EEE9FF' : 'none',
                borderLeft:
                  activeNav === item.key
                    ? `3px solid ${'#5B35C5'}`
                    : '3px solid transparent',
                transition: 'all 0.15s',
              }}
              onClick={() => setActiveNav(item.key)}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </aside>

        {/* ── CONTENIDO ── */}
        <main style={{ flex: 1, padding: 28, overflowY: 'auto' }}>
          {activeNav === 'dashboard' && (
            <Dashboard
              esAdmin={esAdmin}
              perfil={perfil}
              onIr={setActiveNav}
            />
          )}
          {activeNav === 'usuarios' && esAdmin && (
            <GestionUsuarios rolActor={perfil.rol} />
          )}
          {activeNav === 'alumnos' && esAdmin && <GestionAlumnos />}
          {activeNav === 'docentes' && esAdmin && <GestionDocentes />}
          {activeNav === 'cursos' && esAdmin && <GestionCursos />}
          {activeNav === 'materias' && esAdmin && <GestionMaterias />}
          {activeNav === 'asignaciones' && esAdmin && <GestionAsignaciones />}
          {activeNav === 'cuotas' && esAdmin && <GestionCuotas />}
          {activeNav === 'pagos' && esAdmin && <RegistrarPagos />}
          {activeNav === 'becas' && esAdmin && <GestionBecas />}
          {activeNav === 'sueldos' && esAdmin && <GestionSueldos />}
          {activeNav === 'compras' && esAdmin && <GestionCompras />}
          {activeNav === 'inscripciones' && esAdmin && <GestionInscripciones />}
          {activeNav === 'mensajes' && esAdmin && <GestionMensajes />}
          {activeNav === 'actividades' && esAdmin && <GestionActividades />}
          {activeNav === 'reservas' && <GestionReservas />}
          {activeNav === 'servicios' && esAdmin && <GestionServicios />}
          {activeNav === 'reportes' && esAdmin && <GestionReportes />}
          {activeNav === 'noticias' && esAdmin && (
            <GestionNoticias />
          )}
          {activeNav === 'empleos' && esAdmin && <GestionEmpleos />}
          {activeNav === 'postulaciones' && esAdmin && <GestionPostulaciones />}
          {activeNav === 'galeria' && esAdmin && (
            <GestionGaleria />
          )}
          {activeNav === 'asistencia' && !esAdmin && (
            <TomarAsistencia />
          )}
          {activeNav === 'calificaciones' && !esAdmin && (
            <CargarCalificaciones />
          )}
          {activeNav === 'amonestaciones' && !esAdmin && (
            <GestionAmonestaciones />
          )}
          {activeNav === 'legajos' && !esAdmin && (
            <LegajosDocente />
          )}
        </main>
      </div>

      {cambiandoPassword && (
        <CambiarPassword onClose={() => setCambiandoPassword(false)} />
      )}
    </div>
  )
}
