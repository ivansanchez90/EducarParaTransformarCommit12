/**
 * AdminPanel.tsx
 * Panel de administración — Educar Para Transformar
 * Roles: Admin / Directivo → acceso completo
 *        Docente           → solo sus secciones
 *
 * Este archivo es solo el "shell": autenticación, layout (header + sidebar) y
 * enrutado entre secciones. Cada sección vive en su propio módulo en `features/`.
 *
 * En el celular (debajo de `md`) el shell cambia según el rol: Admin/Directivo
 * tienen 21 módulos, así que el menú lateral se convierte en un panel
 * deslizable que abre un botón ☰; Docente tiene 6, así que usa `BottomNav`.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSession, logout, onAuthChange } from './lib/auth'
import type { UsuarioPanel } from './types'
import { NAV_ADMIN, NAV_DOCENTE } from './constants'
import { AvatarMenu, BottomNav, type NavItem } from './ui/components'
import { conBottomNav, safeAreaBottom, safeAreaX, touchTarget } from './ui/styles'

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

/** Ítem del menú lateral, en escritorio o en el panel deslizable del celular. */
function ItemMenu({
  item,
  activo,
  onClick,
}: {
  item: NavItem
  activo: boolean
  onClick: () => void
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      aria-current={activo ? 'page' : undefined}
      className={`w-full flex items-center gap-2.5 px-5 py-[11px] text-[13px] text-left bg-transparent border-0 border-l-[3px] cursor-pointer font-[inherit] ${
        activo
          ? 'font-extrabold text-purple-700 bg-purpleLight border-l-purple-700'
          : 'font-semibold text-textMuted border-l-transparent'
      }`}
    >
      <span aria-hidden='true'>{item.icon}</span>
      <span>{item.label}</span>
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export default function AdminPanel() {
  const navigate = useNavigate()
  const [perfil, setPerfil] = useState<UsuarioPanel | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [activeNav, setActiveNav] = useState('dashboard')
  const [cambiandoPassword, setCambiandoPassword] = useState(false)
  const [menuAbierto, setMenuAbierto] = useState(false)
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

  useEffect(() => {
    if (!menuAbierto) return
    const alApretar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuAbierto(false)
    }
    document.addEventListener('keydown', alApretar)
    return () => {
      document.removeEventListener('keydown', alApretar)
    }
  }, [menuAbierto])

  if (!authChecked || !perfil) return null

  if (!['Admin', 'Directivo', 'Docente'].includes(perfil.rol)) {
    return (
      <div className='flex items-center justify-center min-h-screen font-sans'>
        <div className='text-center'>
          <div className='text-5xl mb-4'>🚫</div>
          <div className='text-lg font-extrabold text-red'>Sin acceso</div>
          <p className='text-textMuted'>Tu usuario no tiene permisos para este panel.</p>
          <button className='bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer' onClick={logout}>
            Salir
          </button>
        </div>
      </div>
    )
  }

  const esAdmin = ['Admin', 'Directivo'].includes(perfil.rol)
  const navItems = esAdmin ? NAV_ADMIN : NAV_DOCENTE
  const initials = `${perfil.nombre[0]}${perfil.apellido[0]}`

  const elegirNav = (key: string) => {
    setActiveNav(key)
    setMenuAbierto(false)
  }

  return (
    <div className='font-sans bg-bg min-h-screen text-text'>
      {/* ── HEADER ── */}
      <header
        className={`bg-white border-b-[3px] border-purple-700 px-4 md:px-7 h-16 md:h-[68px] flex items-center justify-between sticky top-0 z-[100] shadow-[0_2px_16px_rgba(91,53,197,0.08)] ${safeAreaX}`}
      >
        <div className='flex items-center gap-2 md:gap-2.5 min-w-0'>
          {esAdmin && (
            <button
              type='button'
              onClick={() => {
                setMenuAbierto(true)
              }}
              aria-label='Abrir menú'
              aria-haspopup='menu'
              aria-expanded={menuAbierto}
              className={`md:hidden ${touchTarget} flex items-center justify-center text-2xl bg-transparent border-0 cursor-pointer`}
            >
              ☰
            </button>
          )}
          <img
            src='/logo.png'
            alt='Logo'
            className='h-9 md:h-[46px] shrink-0'
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
          <div className='min-w-0'>
            <div className='text-[11px] md:text-xs font-black text-purple-700 uppercase tracking-[0.04em] truncate'>
              Educar Para Transformar
            </div>
            <div className='text-[10px] text-textMuted hidden sm:block'>Panel {perfil.rol}</div>
          </div>
        </div>
        <AvatarMenu
          iniciales={initials}
          nombre={`${perfil.nombre} ${perfil.apellido}`}
          detalle={perfil.rol}
          opciones={[
            {
              key: 'password',
              icon: '🔑',
              label: 'Mi contraseña',
              onClick: () => {
                setCambiandoPassword(true)
              },
            },
            {
              key: 'inicio',
              icon: '🏠',
              label: 'Inicio',
              onClick: () => {
                navigate('/')
              },
            },
            { key: 'salir', icon: '🚪', label: 'Salir', onClick: logout },
          ]}
        />
      </header>

      <div className='flex min-h-[calc(100vh-64px)] md:min-h-[calc(100vh-68px)]'>
        {/* ── SIDEBAR (escritorio) ── */}
        <aside className='hidden md:block w-[220px] bg-white border-r border-border py-5 shrink-0'>
          <div className='text-[10px] font-extrabold text-textMuted uppercase tracking-[0.1em] px-5 pb-3.5 mb-1.5 border-b border-border'>
            Menú
          </div>
          {navItems.map((item) => (
            <ItemMenu
              key={item.key}
              item={item}
              activo={activeNav === item.key}
              onClick={() => {
                setActiveNav(item.key)
              }}
            />
          ))}
        </aside>

        {/* ── MENÚ DESLIZABLE (celular, solo Admin/Directivo: 21 módulos no entran en una barra inferior) ── */}
        {esAdmin && menuAbierto && (
          <>
            <div
              className='fixed inset-0 z-[120] bg-text/30 md:hidden'
              onClick={() => {
                setMenuAbierto(false)
              }}
              aria-hidden='true'
            />
            <aside
              role='dialog'
              aria-label='Menú de navegación'
              className={`fixed inset-y-0 left-0 z-[130] w-[80vw] max-w-[280px] bg-white py-5 overflow-y-auto md:hidden ${safeAreaBottom}`}
            >
              <div className='flex items-center justify-between px-5 pb-3.5 mb-1.5 border-b border-border'>
                <span className='text-[10px] font-extrabold text-textMuted uppercase tracking-[0.1em]'>Menú</span>
                <button
                  type='button'
                  onClick={() => {
                    setMenuAbierto(false)
                  }}
                  aria-label='Cerrar menú'
                  className={`${touchTarget} flex items-center justify-center text-xl bg-transparent border-0 cursor-pointer`}
                >
                  ✕
                </button>
              </div>
              {navItems.map((item) => (
                <ItemMenu
                  key={item.key}
                  item={item}
                  activo={activeNav === item.key}
                  onClick={() => {
                    elegirNav(item.key)
                  }}
                />
              ))}
            </aside>
          </>
        )}

        {/* ── CONTENIDO ── */}
        <main className={`flex-1 p-4 md:p-7 overflow-y-auto ${safeAreaX} ${esAdmin ? '' : conBottomNav}`}>
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

      {/* ── NAVEGACIÓN INFERIOR (celular, solo Docente: 6 módulos entran en la barra) ── */}
      {!esAdmin && <BottomNav items={NAV_DOCENTE} activo={activeNav} onSelect={setActiveNav} />}

      {cambiandoPassword && (
        <CambiarPassword
          onClose={() => {
            setCambiandoPassword(false)
          }}
        />
      )}
    </div>
  )
}
