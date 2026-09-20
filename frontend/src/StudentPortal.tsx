/**
 * StudentPortal.tsx
 * Portal Estudiantil — Educar Para Transformar
 * Stack: React + TypeScript + backend Node/Express
 *
 * Variables de entorno (.env):
 *   VITE_API_URL=http://localhost:4000
 *
 * Logo: colocar /public/logo.png con el logo del centro
 * Fuente: agregar en index.html →
 *   <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet">
 */

import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, qs } from './lib/api'
import { CambiarPassword } from './features/cuenta/CambiarPassword'
import type { RecorridoTransporte, ServiciosAlumno } from './types'
import { esTutor as esRolTutor, getSession, logout, onAuthChange } from './lib/auth'
import type { Perfil } from './lib/auth'

// ═══════════════════════════════════════════════════════════════
//  TIPOS — coinciden con el schema de la base de datos
// ═══════════════════════════════════════════════════════════════
interface Alumno {
  id_alumno: number
  nombre: string
  apellido: string
  dni: string
  obra_social: string | null
  id_curso: number | null
  cursos: { nivel: string; grado_anio: string; division: string } | null
}

interface Calificacion {
  id_calificacion: number
  trimestre: number
  tipo_evaluacion: string
  nota: number
  fecha_carga: string
  descripcion: string | null
  asignaciones: { materias: { nombre: string } }
}

interface Cuota {
  id_cuota: number
  mes: number
  anio: number
  monto_base: number
  recargo: number
  descuento: number
  fecha_vencimiento: string
  estado: 'Pendiente' | 'Pagada' | 'Vencida' | 'En mora'
}

interface Notificacion {
  id_notificacion: number
  titulo: string
  mensaje: string
  tipo: string
  leida: boolean
  fecha_envio: string
}

interface HorarioHoy {
  id_horario: number
  hora_inicio: string
  hora_fin: string
  aula: string | null
  asignaciones: {
    materias: { nombre: string }
    docentes: { nombre: string; apellido: string }
  }
}

interface AsistenciaStats {
  presentes: number
  ausentes: number
  tarde: number
  justificados: number
  total: number
}

interface ActividadEx {
  id_actividad: number
  nombre: string
  tipo: string
  descripcion: string | null
  cupo_maximo: number
  inscriptos: number
  inscripto: boolean
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════
const MESES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
]
const DIAS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
]

const diaActual = () => DIAS[new Date().getDay()]

const formatFecha = (dateStr: string) => {
  const d = new Date(dateStr)
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`
}

// Dynamic color helpers — kept as JS functions because they return
// computed values from runtime data (nota number / estado string).
const notaColor = (nota: number) => {
  if (nota >= 8) return '#27AE60'
  if (nota >= 6) return '#E67E22'
  return '#E74C3C'
}

const CUOTA_COLOR: Record<string, string> = {
  Pendiente: '#E67E22',
  Pagada: '#27AE60',
  Vencida: '#E74C3C',
  'En mora': '#C0392B',
}

const NOTIF_COLOR: Record<string, string> = {
  General: '#5B35C5',
  Asistencia: '#E67E22',
  Calificación: '#27AE60',
  Cuota: '#E74C3C',
  Novedad: '#2980B9',
  Urgente: '#C0392B',
}

// ═══════════════════════════════════════════════════════════════
//  SECCIONES DE NAVEGACIÓN
// ═══════════════════════════════════════════════════════════════
const NAV_ITEMS = [
  { key: 'inicio', icon: '🏠', label: 'Inicio' },
  { key: 'asistencias', icon: '📅', label: 'Asistencias' },
  { key: 'calificaciones', icon: '📊', label: 'Calificaciones' },
  { key: 'cuotas', icon: '💳', label: 'Cuotas' },
  { key: 'horario', icon: '🕐', label: 'Mi Horario' },
  { key: 'actividades', icon: '🎨', label: 'Extracurriculares' },
  { key: 'servicios', icon: '🚌', label: 'Transporte y comedor' },
  { key: 'notificaciones', icon: '🔔', label: 'Notificaciones' },
]

// ═══════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export default function StudentPortal() {
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [hijos, setHijos] = useState<Alumno[]>([])
  const [alumno, setAlumno] = useState<Alumno | null>(null)
  const [calificaciones, setCalificaciones] = useState<Calificacion[]>([])
  const [cuotas, setCuotas] = useState<Cuota[]>([])
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [horarioHoy, setHorarioHoy] = useState<HorarioHoy[]>([])
  const [asistStats, setAsistStats] = useState<AsistenciaStats | null>(null)
  const [actividades, setActividades] = useState<ActividadEx[]>([])
  const [actMsg, setActMsg] = useState('')
  const [servicios, setServicios] = useState<ServiciosAlumno | null>(null)
  const [recorridos, setRecorridos] = useState<RecorridoTransporte[]>([])
  const [servMsg, setServMsg] = useState('')
  const [activeNav, setActiveNav] = useState('inicio')
  const [cambiandoPassword, setCambiandoPassword] = useState(false)
  const [loading, setLoading] = useState(true)

  // Un padre/tutor ve los datos de su hijo/a; un estudiante, los propios.
  // El backend resuelve cuáles alumnos corresponden al usuario logueado.
  const esTutor = esRolTutor(perfil?.rol)

  // ── Auth ────────────────────────────────────────────────────
  useEffect(() => {
    getSession().then((p) => {
      setPerfil(p)
      setAuthChecked(true)
    })
    return onAuthChange(setPerfil)
  }, [])

  useEffect(() => {
    if (!perfil) {
      setLoading(false)
      return
    }
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id_usuario])

  // ── Data loading ─────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true)
    const { data: alumnosData } = await api.get<Alumno[]>('/alumnos/mios')
    const lista = alumnosData ?? []
    setHijos(lista)
    const activo = lista[0] ?? null
    setAlumno(activo)
    await loadDatosAlumno(activo)
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadDatosAlumno(a: Alumno | null) {
    await Promise.all([
      loadNotificaciones(),
      a ? loadCalificaciones(a.id_alumno) : Promise.resolve(),
      a ? loadCuotas(a.id_alumno) : Promise.resolve(),
      a ? loadHorarioHoy(a.id_curso) : Promise.resolve(),
      a ? loadAsistencias(a.id_alumno) : Promise.resolve(),
      a ? loadActividades(a.id_alumno) : Promise.resolve(),
      a ? loadServicios(a.id_alumno) : Promise.resolve(),
      loadRecorridos(),
    ])
  }

  async function seleccionarHijo(id: number) {
    const a = hijos.find((h) => h.id_alumno === id) ?? null
    setAlumno(a)
    setLoading(true)
    await loadDatosAlumno(a)
    setLoading(false)
  }

  async function loadActividades(idAlumno: number) {
    // El backend agrega `inscriptos` (conteo) e `inscripto` (si este alumno está anotado).
    const { data } = await api.get<ActividadEx[]>(
      `/actividades${qs({ id_alumno: idAlumno })}`,
    )
    setActividades(data ?? [])
  }

  async function inscribirseActividad(id_actividad: number) {
    setActMsg('')
    if (!alumno) {
      setActMsg('No se encontró el legajo del alumno.')
      return
    }
    const { error } = await api.post(
      `/actividades/${id_actividad}/inscripciones`,
      { id_alumno: alumno.id_alumno },
    )
    if (error) {
      setActMsg(
        error.message.includes('Cupo completo')
          ? 'No hay cupo disponible en esta actividad.'
          : 'No se pudo completar la inscripción: ' + error.message,
      )
    }
    await loadActividades(alumno.id_alumno)
  }

  async function cancelarActividad(id_actividad: number) {
    setActMsg('')
    if (!alumno) return
    await api.delete(
      `/actividades/${id_actividad}/inscripciones/${alumno.id_alumno}`,
    )
    await loadActividades(alumno.id_alumno)
  }

  async function loadRecorridos() {
    const { data } = await api.get<RecorridoTransporte[]>('/recorridos')
    setRecorridos(data ?? [])
  }

  async function loadServicios(idAlumno: number) {
    const { data } = await api.get<ServiciosAlumno>(`/servicios/${idAlumno}`)
    setServicios(data)
  }

  /** Inscribe al hijo en un recorrido (o lo cambia por otro). */
  async function elegirRecorrido(idRecorrido: number) {
    if (!alumno) return
    setServMsg('')
    const { error } = await api.put(`/servicios/${alumno.id_alumno}/transporte`, {
      id_recorrido: idRecorrido,
    })
    if (error) setServMsg(error.message)
    await loadServicios(alumno.id_alumno)
    await loadRecorridos()
  }

  async function bajaTransporte() {
    if (!alumno) return
    setServMsg('')
    await api.delete(`/servicios/${alumno.id_alumno}/transporte`)
    await loadServicios(alumno.id_alumno)
    await loadRecorridos()
  }

  async function alternarComedor() {
    if (!alumno) return
    setServMsg('')
    const { error } = servicios?.comedor
      ? await api.delete(`/servicios/${alumno.id_alumno}/comedor`)
      : await api.put(`/servicios/${alumno.id_alumno}/comedor`, {})
    if (error) setServMsg(error.message)
    await loadServicios(alumno.id_alumno)
  }

  async function loadCalificaciones(idAlumno: number) {
    const { data } = await api.get<Calificacion[]>(
      `/alumnos/${idAlumno}/calificaciones?limit=20`,
    )
    setCalificaciones(data ?? [])
  }

  async function loadCuotas(idAlumno: number) {
    const { data } = await api.get<Cuota[]>(
      `/alumnos/${idAlumno}/cuotas${qs({ estado: 'Pendiente,Vencida,En mora' })}`,
    )
    setCuotas(data ?? [])
  }

  async function loadNotificaciones() {
    const { data } = await api.get<Notificacion[]>('/notificaciones?limit=20')
    if (data) setNotificaciones(data)
  }

  async function loadHorarioHoy(idCurso: number | null) {
    if (!idCurso) {
      setHorarioHoy([])
      return
    }
    const { data } = await api.get<HorarioHoy[]>(
      `/horarios${qs({ id_curso: idCurso, dia: diaActual() })}`,
    )
    setHorarioHoy(data ?? [])
  }

  async function loadAsistencias(idAlumno: number) {
    const { data } = await api.get<{ estado: string }[]>(
      `/alumnos/${idAlumno}/asistencias`,
    )
    if (!data) return
    const stats: AsistenciaStats = {
      presentes: 0,
      ausentes: 0,
      tarde: 0,
      justificados: 0,
      total: data.length,
    }
    data.forEach((a) => {
      if (a.estado === 'Presente') stats.presentes++
      if (a.estado === 'Ausente') stats.ausentes++
      if (a.estado === 'Tarde') stats.tarde++
      if (a.estado === 'Justificado') stats.justificados++
    })
    setAsistStats(stats)
  }

  async function marcarLeida(id: number) {
    await api.patch(`/notificaciones/${id}/leida`)
    setNotificaciones((prev) =>
      prev.map((n) => (n.id_notificacion === id ? { ...n, leida: true } : n)),
    )
  }

  async function marcarTodasLeidas() {
    await api.patch('/notificaciones/leidas')
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })))
  }
  const navigate = useNavigate()

  // ── Derived values ───────────────────────────────────────────
  const promedio = calificaciones.length
    ? (
        calificaciones.reduce((acc, c) => acc + c.nota, 0) /
        calificaciones.length
      ).toFixed(1)
    : '—'

  const pctAsistencia =
    asistStats && asistStats.total > 0
      ? Math.round((asistStats.presentes / asistStats.total) * 100)
      : null

  const notifNoLeidas = notificaciones.filter((n) => !n.leida).length
  const initials = alumno ? `${alumno.nombre[0]}${alumno.apellido[0]}` : '?'

  // ── Render guards ────────────────────────────────────────────
  if (!authChecked) return null

  if (!perfil) {
    navigate('/login', { replace: true })
    return null
  }

  if (loading) {
    return (
      <div className="font-[Nunito,_'Segoe_UI',_sans-serif] bg-bg min-h-screen text-text flex items-center justify-center">
        <div className='text-center text-purple-700'>
          <div className='text-[36px] mb-3 animate-spin'>⟳</div>
          <p className='font-extrabold'>Cargando tu portal...</p>
        </div>
      </div>
    )
  }

  // Usuario autenticado pero sin alumno/hijos vinculados
  if (!alumno) {
    return (
      <div className="font-[Nunito,_'Segoe_UI',_sans-serif] bg-bg min-h-screen text-text flex items-center justify-center">
        <div className='text-center max-w-[420px] p-6'>
          <div className='text-[44px] mb-3'>🔍</div>
          <div className='text-lg font-black text-purple-700'>
            No hay datos para mostrar
          </div>
          <p className='text-sm text-textMuted leading-relaxed'>
            {esTutor
              ? 'Tu usuario de padre/tutor no tiene alumnos vinculados. Comunicate con la administración del centro educativo.'
              : 'Tu usuario no está vinculado a un legajo de alumno. Comunicate con la administración del centro educativo.'}
          </p>
          <button
            className='mt-3 bg-transparent border border-border rounded-[8px] px-3.5 py-[7px] text-xs font-bold text-textMuted cursor-pointer font-[inherit]'
            onClick={logout}
          >
            Salir
          </button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════
  //  RENDER PRINCIPAL
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="font-[Nunito,_'Segoe_UI',_sans-serif] bg-bg min-h-screen text-text">
      {/* ── HEADER ── */}
      <header className='bg-white border-b-[3px] border-b-purple-700 px-8 flex items-center justify-between h-[70px] sticky top-0 z-[100] shadow-[0_2px_16px_rgba(91,53,197,0.08)]'>
        <div className='flex items-center gap-3'>
          <Link to='/'>
            <img
              src='/logo.png'
              alt='Educar Para Transformar'
              className='h-[50px] w-auto'
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          </Link>
          <div className='flex flex-col'>
            <span className='text-[13px] font-black text-purple-700 tracking-[0.04em] uppercase leading-tight'>
              Educar Para Transformar
            </span>
            <span className='text-[10px] text-textMuted tracking-[0.1em] uppercase'>
              Centro Educativo
            </span>
          </div>
        </div>

        <div className='flex items-center gap-[18px]'>
          {/* Campana notificaciones */}
          <div
            className='relative cursor-pointer'
            onClick={() => setActiveNav('notificaciones')}
            title='Ver notificaciones'
          >
            <span className='text-[22px]'>🔔</span>
            {notifNoLeidas > 0 && (
              <span className='absolute -top-1.5 -right-1.5 bg-red text-white rounded-full w-[18px] h-[18px] text-[10px] font-black flex items-center justify-center'>
                {notifNoLeidas}
              </span>
            )}
          </div>

          {/* Avatar */}
          <div
            className='w-[38px] h-[38px] rounded-full bg-gradient-to-br from-purple-700 to-purpleMid text-white flex items-center justify-center font-black text-sm cursor-pointer shrink-0'
            title={alumno ? `${alumno.nombre} ${alumno.apellido}` : ''}
          >
            {initials}
          </div>

          {/* Nombre / perfil */}
          {alumno && (
            <div className='flex flex-col'>
              {esTutor && (
                <span className='text-[10px] font-extrabold text-purple-700 uppercase tracking-[0.06em]'>
                  Perfil padre/tutor · viendo a
                </span>
              )}
              {esTutor && hijos.length > 1 ? (
                <select
                  value={alumno.id_alumno}
                  onChange={(e) => seleccionarHijo(Number(e.target.value))}
                  className='text-[13px] font-extrabold text-text border border-border rounded-[8px] px-2 py-1 font-[inherit] cursor-pointer'
                >
                  {hijos.map((h) => (
                    <option key={h.id_alumno} value={h.id_alumno}>
                      {h.nombre} {h.apellido}
                    </option>
                  ))}
                </select>
              ) : (
                <span className='text-[13px] font-extrabold text-text'>
                  {alumno.nombre} {alumno.apellido}
                </span>
              )}
            </div>
          )}

          <button
            className='bg-transparent border border-border rounded-[8px] px-3.5 py-[7px] text-xs font-bold text-textMuted cursor-pointer font-[inherit]'
            onClick={() => setCambiandoPassword(true)}
          >
            🔑 Mi contraseña
          </button>

          {/* Volver al inicio */}
          <button
            className='bg-transparent border border-border rounded-[8px] px-3.5 py-[7px] text-xs font-bold text-textMuted cursor-pointer font-[inherit]'
            onClick={() => navigate('/')}
          >
            ← Inicio
          </button>

          {/* Logout */}
          <button
            className='bg-transparent border border-border rounded-[8px] px-3.5 py-[7px] text-xs font-bold text-textMuted cursor-pointer font-[inherit]'
            onClick={logout}
          >
            Salir
          </button>
        </div>
      </header>

      <div className='flex min-h-[calc(100vh-70px)]'>
        {/* ── SIDEBAR ── */}
        <aside className='w-[230px] bg-white border-r border-border py-5 shrink-0'>
          <span className='text-[10px] text-textMuted font-extrabold uppercase tracking-[0.1em] px-6 pb-4 block border-b border-border mb-2'>
            Portal Estudiantil
          </span>
          {NAV_ITEMS.map((item) => (
            <div
              key={item.key}
              className={`flex items-center gap-2.5 px-6 py-[11px] cursor-pointer text-sm font-semibold transition-all duration-150 border-l-[3px]
                ${
                  activeNav === item.key
                    ? 'text-purple-700 bg-purpleLight border-l-purple-700 font-extrabold'
                    : 'text-textMuted border-l-transparent hover:text-purple-700 hover:bg-purpleLight'
                }`}
              onClick={() => setActiveNav(item.key)}
            >
              <span>{item.icon}</span>
              <span className='flex-1'>{item.label}</span>
              {item.key === 'notificaciones' && notifNoLeidas > 0 && (
                <span className='bg-purple-700 text-white rounded-[20px] px-2 py-px text-[11px] font-black'>
                  {notifNoLeidas}
                </span>
              )}
              {item.key === 'cuotas' && cuotas.length > 0 && (
                <span className='bg-red text-white rounded-[20px] px-2 py-px text-[11px] font-black'>
                  {cuotas.length}
                </span>
              )}
            </div>
          ))}
        </aside>

        {/* ── CONTENIDO PRINCIPAL ── */}
        <main className='flex-1 p-7 overflow-y-auto'>
          {/* ━━━━━ INICIO ━━━━━ */}
          {activeNav === 'inicio' && (
            <>
              {/* Banner bienvenida */}
              <div className='bg-gradient-to-br from-purple-700 to-purpleMid rounded-[20px] px-8 py-7 text-white mb-6 relative overflow-hidden'>
                <div className='absolute -right-[30px] -top-[30px] w-[200px] h-[200px] rounded-full bg-white/5' />
                <div className='relative'>
                  <div className='text-2xl font-black mb-1.5'>
                    {esTutor
                      ? `Portal de ${alumno?.nombre} ${alumno?.apellido}`
                      : `Bienvenido/a, ${alumno?.nombre} 👋`}
                  </div>
                  <div className='text-[13px] opacity-85'>
                    {new Date().toLocaleDateString('es-AR', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                  {alumno?.cursos && (
                    <div className='inline-block bg-white/20 rounded-[20px] px-3.5 py-1 text-xs font-bold mt-3.5'>
                      {alumno.cursos.nivel} · {alumno.cursos.grado_anio}{' '}
                      División {alumno.cursos.division}
                    </div>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className='grid grid-cols-4 gap-3.5 mb-6'>
                {/* Asistencia */}
                <div className='bg-white rounded-[14px] px-5 py-[18px] shadow-[0_2px_12px_rgba(91,53,197,0.06)] border border-border'>
                  <div className='w-10 h-10 rounded-[10px] flex items-center justify-center text-xl mb-2.5 bg-purpleLight'>
                    📅
                  </div>
                  <div
                    className='text-[26px] font-black leading-none'
                    style={{
                      color:
                        pctAsistencia !== null && pctAsistencia < 75
                          ? '#E74C3C'
                          : '#27AE60',
                    }}
                  >
                    {pctAsistencia !== null ? `${pctAsistencia}%` : '—'}
                  </div>
                  <div className='text-[11px] text-textMuted font-bold mt-1'>
                    Asistencia
                  </div>
                </div>
                {/* Promedio */}
                <div className='bg-white rounded-[14px] px-5 py-[18px] shadow-[0_2px_12px_rgba(91,53,197,0.06)] border border-border'>
                  <div className='w-10 h-10 rounded-[10px] flex items-center justify-center text-xl mb-2.5 bg-[#27AE601A]'>
                    📊
                  </div>
                  <div className='text-[26px] font-black leading-none text-purple-700'>
                    {promedio}
                  </div>
                  <div className='text-[11px] text-textMuted font-bold mt-1'>
                    Promedio general
                  </div>
                </div>
                {/* Cuotas */}
                <div className='bg-white rounded-[14px] px-5 py-[18px] shadow-[0_2px_12px_rgba(91,53,197,0.06)] border border-border'>
                  <div className='w-10 h-10 rounded-[10px] flex items-center justify-center text-xl mb-2.5 bg-[#E74C3C1A]'>
                    💳
                  </div>
                  <div
                    className='text-[26px] font-black leading-none'
                    style={{ color: cuotas.length > 0 ? '#E74C3C' : '#27AE60' }}
                  >
                    {cuotas.length}
                  </div>
                  <div className='text-[11px] text-textMuted font-bold mt-1'>
                    Cuotas pendientes
                  </div>
                </div>
                {/* Notificaciones */}
                <div className='bg-white rounded-[14px] px-5 py-[18px] shadow-[0_2px_12px_rgba(91,53,197,0.06)] border border-border'>
                  <div className='w-10 h-10 rounded-[10px] flex items-center justify-center text-xl mb-2.5 bg-[#E67E221A]'>
                    🔔
                  </div>
                  <div
                    className='text-[26px] font-black leading-none'
                    style={{ color: notifNoLeidas > 0 ? '#E67E22' : '#6B6B8A' }}
                  >
                    {notifNoLeidas}
                  </div>
                  <div className='text-[11px] text-textMuted font-bold mt-1'>
                    Notificaciones nuevas
                  </div>
                </div>
              </div>

              {/* Horario hoy + Notificaciones */}
              <div className='grid grid-cols-2 gap-[18px] mb-[18px]'>
                {/* Clases de hoy */}
                <div className='bg-white rounded-card p-6 shadow-card border border-border'>
                  <div className='text-[15px] font-extrabold text-text mb-5 flex items-center gap-2'>
                    🕐 Clases de hoy · {diaActual()}
                  </div>
                  {horarioHoy.length === 0 ? (
                    <div className='flex items-center justify-center py-8 text-textMuted text-[13px]'>
                      No hay clases programadas para hoy
                    </div>
                  ) : (
                    horarioHoy.map((h) => (
                      <div
                        key={h.id_horario}
                        className='flex items-center gap-3.5 py-3.5 border-b border-border'
                      >
                        <div className='bg-purpleLight text-purple-700 rounded-[10px] px-3 py-1.5 text-xs font-extrabold min-w-[96px] text-center shrink-0'>
                          {h.hora_inicio.slice(0, 5)}
                          <br />
                          {h.hora_fin.slice(0, 5)}
                        </div>
                        <div className='w-[3px] h-11 rounded-[4px] shrink-0 bg-purple-700' />
                        <div>
                          <div className='font-extrabold text-sm'>
                            {h.asignaciones?.materias?.nombre}
                          </div>
                          <div className='text-xs text-textMuted mt-0.5'>
                            Prof. {h.asignaciones?.docentes?.apellido} ·{' '}
                            {h.aula ?? 'Aula s/d'}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Notificaciones recientes */}
                <div className='bg-white rounded-card p-6 shadow-card border border-border'>
                  <div className='text-[15px] font-extrabold text-text mb-5 flex items-center gap-2'>
                    🔔 Notificaciones recientes
                  </div>
                  {notificaciones.slice(0, 5).length === 0 ? (
                    <div className='flex items-center justify-center py-8 text-textMuted text-[13px]'>
                      Sin notificaciones
                    </div>
                  ) : (
                    notificaciones.slice(0, 5).map((n) => (
                      <div
                        key={n.id_notificacion}
                        className={`flex gap-3 items-start py-3 border-b border-border cursor-pointer transition-opacity ${n.leida ? 'opacity-60' : 'opacity-100'}`}
                        onClick={() =>
                          !n.leida && marcarLeida(n.id_notificacion)
                        }
                      >
                        <div
                          className='w-[9px] h-[9px] rounded-full mt-[5px] shrink-0'
                          style={{
                            background: n.leida
                              ? '#E8E6F5'
                              : (NOTIF_COLOR[n.tipo] ?? '#5B35C5'),
                          }}
                        />
                        <div className='flex-1'>
                          <div
                            className={`text-[13px] ${n.leida ? 'font-semibold' : 'font-extrabold'}`}
                          >
                            {n.titulo}
                          </div>
                          <div className='text-[11px] text-textMuted mt-0.5'>
                            {formatFecha(n.fecha_envio)}
                          </div>
                        </div>
                        <span
                          className='inline-block rounded-[20px] px-2.5 py-[3px] text-[11px] font-extrabold'
                          style={{
                            background:
                              (NOTIF_COLOR[n.tipo] ?? '#5B35C5') + '1A',
                            color: NOTIF_COLOR[n.tipo] ?? '#5B35C5',
                          }}
                        >
                          {n.tipo}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Últimas calificaciones */}
              <div className='bg-white rounded-card p-6 shadow-card border border-border'>
                <div className='text-[15px] font-extrabold text-text mb-5 flex items-center gap-2'>
                  📊 Últimas calificaciones
                </div>
                {calificaciones.length === 0 ? (
                  <div className='flex items-center justify-center py-8 text-textMuted text-[13px]'>
                    Sin calificaciones registradas
                  </div>
                ) : (
                  <table className='w-full border-collapse'>
                    <thead>
                      <tr>
                        {['Materia', 'Tipo', 'Trimestre', 'Fecha', 'Nota'].map(
                          (h) => (
                            <th
                              key={h}
                              className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 border-b-2 border-border'
                            >
                              {h}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {calificaciones.slice(0, 6).map((c) => (
                        <tr key={c.id_calificacion}>
                          <td className='py-[11px] text-[13px] border-b border-border align-middle font-extrabold'>
                            {c.asignaciones?.materias?.nombre}
                          </td>
                          <td className='py-[11px] text-[13px] border-b border-border align-middle'>
                            <span
                              className='inline-block rounded-[20px] px-2.5 py-[3px] text-[11px] font-extrabold'
                              style={{
                                background: '#5B35C51A',
                                color: '#5B35C5',
                              }}
                            >
                              {c.tipo_evaluacion}
                            </span>
                          </td>
                          <td className='py-[11px] text-[13px] border-b border-border align-middle text-textMuted'>
                            Trimestre {c.trimestre}
                          </td>
                          <td className='py-[11px] text-[13px] border-b border-border align-middle text-textMuted'>
                            {formatFecha(c.fecha_carga)}
                          </td>
                          <td className='py-[11px] text-[13px] border-b border-border align-middle'>
                            <div
                              className='w-[38px] h-[38px] rounded-full flex items-center justify-center font-black text-sm shrink-0'
                              style={{
                                background: notaColor(c.nota) + '1A',
                                color: notaColor(c.nota),
                              }}
                            >
                              {c.nota}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {/* ━━━━━ ASISTENCIAS ━━━━━ */}
          {activeNav === 'asistencias' && (
            <div className='bg-white rounded-card p-6 shadow-card border border-border'>
              <div className='text-[15px] font-extrabold text-text mb-5 flex items-center gap-2'>
                📅 Mis Asistencias
              </div>
              {!asistStats ? (
                <div className='flex items-center justify-center py-8 text-textMuted text-[13px]'>
                  Cargando...
                </div>
              ) : (
                <>
                  {/* Counters */}
                  <div className='grid grid-cols-5 gap-3 mb-7'>
                    {[
                      {
                        label: 'Presentes',
                        value: asistStats.presentes,
                        color: '#27AE60',
                      },
                      {
                        label: 'Ausentes',
                        value: asistStats.ausentes,
                        color: '#E74C3C',
                      },
                      {
                        label: 'Tarde',
                        value: asistStats.tarde,
                        color: '#E67E22',
                      },
                      {
                        label: 'Justific.',
                        value: asistStats.justificados,
                        color: '#2980B9',
                      },
                      {
                        label: 'Total',
                        value: asistStats.total,
                        color: '#5B35C5',
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className='bg-white rounded-[14px] px-5 py-[18px] shadow-[0_2px_12px_rgba(91,53,197,0.06)] border border-border text-center'
                        style={{ borderTop: `3px solid ${item.color}` }}
                      >
                        <div
                          className='text-[26px] font-black leading-none'
                          style={{ color: item.color }}
                        >
                          {item.value}
                        </div>
                        <div className='text-[11px] text-textMuted font-bold mt-1'>
                          {item.label}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Barra de progreso */}
                  <div className='mb-2'>
                    <div className='flex justify-between text-[13px] font-extrabold mb-2.5'>
                      <span>Porcentaje de asistencia</span>
                      <span
                        style={{
                          color:
                            pctAsistencia !== null && pctAsistencia < 75
                              ? '#E74C3C'
                              : '#27AE60',
                        }}
                      >
                        {pctAsistencia ?? 0}%
                      </span>
                    </div>
                    <div className='bg-border rounded-[8px] h-3.5 overflow-hidden'>
                      <div
                        className='h-full rounded-[8px] transition-[width] duration-[0.8s] ease-in-out'
                        style={{
                          width: `${pctAsistencia ?? 0}%`,
                          background:
                            pctAsistencia !== null && pctAsistencia < 75
                              ? 'linear-gradient(90deg, #E74C3C, #E67E22)'
                              : 'linear-gradient(90deg, #5B35C5, #27AE60)',
                        }}
                      />
                    </div>
                    {pctAsistencia !== null && pctAsistencia < 75 && (
                      <div className='mt-3 bg-red/[0.07] border border-red/25 rounded-[10px] px-3.5 py-2.5 text-red font-bold text-[13px]'>
                        ⚠️ Tu asistencia está por debajo del 75% mínimo
                        requerido. Por favor comunicate con la institución.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ━━━━━ CALIFICACIONES ━━━━━ */}
          {activeNav === 'calificaciones' && (
            <div className='bg-white rounded-card p-6 shadow-card border border-border'>
              <div className='flex justify-between items-center mb-5'>
                <div className='text-[15px] font-extrabold text-text flex items-center gap-2'>
                  📊 Todas mis Calificaciones
                </div>
                {calificaciones.length > 0 && (
                  <div className='bg-purpleLight text-purple-700 rounded-[12px] px-[18px] py-2 font-black text-base'>
                    Promedio: {promedio}
                  </div>
                )}
              </div>
              {calificaciones.length === 0 ? (
                <div className='flex items-center justify-center py-8 text-textMuted text-[13px]'>
                  Sin calificaciones registradas
                </div>
              ) : (
                <table className='w-full border-collapse'>
                  <thead>
                    <tr>
                      {[
                        'Materia',
                        'Tipo',
                        'Trimestre',
                        'Fecha',
                        'Descripción',
                        'Nota',
                      ].map((h) => (
                        <th
                          key={h}
                          className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 border-b-2 border-border'
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {calificaciones.map((c) => (
                      <tr key={c.id_calificacion}>
                        <td className='py-[11px] text-[13px] border-b border-border align-middle font-extrabold'>
                          {c.asignaciones?.materias?.nombre}
                        </td>
                        <td className='py-[11px] text-[13px] border-b border-border align-middle'>
                          <span
                            className='inline-block rounded-[20px] px-2.5 py-[3px] text-[11px] font-extrabold'
                            style={{
                              background: '#5B35C51A',
                              color: '#5B35C5',
                            }}
                          >
                            {c.tipo_evaluacion}
                          </span>
                        </td>
                        <td className='py-[11px] text-[13px] border-b border-border align-middle text-textMuted'>
                          T{c.trimestre}
                        </td>
                        <td className='py-[11px] text-[13px] border-b border-border align-middle text-textMuted'>
                          {formatFecha(c.fecha_carga)}
                        </td>
                        <td className='py-[11px] text-[13px] border-b border-border align-middle text-textMuted'>
                          {c.descripcion ?? '—'}
                        </td>
                        <td className='py-[11px] text-[13px] border-b border-border align-middle'>
                          <div
                            className='w-[38px] h-[38px] rounded-full flex items-center justify-center font-black text-sm shrink-0'
                            style={{
                              background: notaColor(c.nota) + '1A',
                              color: notaColor(c.nota),
                            }}
                          >
                            {c.nota}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ━━━━━ CUOTAS ━━━━━ */}
          {activeNav === 'cuotas' && (
            <div className='bg-white rounded-card p-6 shadow-card border border-border'>
              <div className='text-[15px] font-extrabold text-text mb-5 flex items-center gap-2'>
                💳 Mis Cuotas Pendientes
              </div>
              {cuotas.length === 0 ? (
                <div className='flex flex-col items-center justify-center py-8 text-textMuted text-[13px] gap-2.5'>
                  <span className='text-[44px]'>✅</span>
                  <span className='text-green font-extrabold text-[15px]'>
                    ¡Estás al día con todas tus cuotas!
                  </span>
                </div>
              ) : (
                <>
                  <div className='bg-red/[0.06] border border-red/[0.19] rounded-[12px] px-4 py-3 mb-5 text-[13px] text-red font-bold'>
                    ⚠️ Tenés {cuotas.length} cuota{cuotas.length > 1 ? 's' : ''}{' '}
                    sin abonar. Regularizá tu situación para evitar recargos.
                  </div>
                  <table className='w-full border-collapse'>
                    <thead>
                      <tr>
                        {[
                          'Período',
                          'Monto base',
                          'Recargo',
                          'Total a pagar',
                          'Vencimiento',
                          'Estado',
                        ].map((h) => (
                          <th
                            key={h}
                            className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 border-b-2 border-border'
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cuotas.map((c) => (
                        <tr key={c.id_cuota}>
                          <td className='py-[11px] text-[13px] border-b border-border align-middle font-extrabold'>
                            {MESES[c.mes - 1]} {c.anio}
                          </td>
                          <td className='py-[11px] text-[13px] border-b border-border align-middle'>
                            ${c.monto_base.toLocaleString('es-AR')}
                          </td>
                          <td
                            className='py-[11px] text-[13px] border-b border-border align-middle'
                            style={{
                              color: c.recargo > 0 ? '#E74C3C' : '#6B6B8A',
                            }}
                          >
                            {c.recargo > 0
                              ? `+$${c.recargo.toLocaleString('es-AR')}`
                              : '—'}
                          </td>
                          <td className='py-[11px] text-[13px] border-b border-border align-middle font-black text-purple-700'>
                            $
                            {(
                              c.monto_base +
                              c.recargo -
                              c.descuento
                            ).toLocaleString('es-AR')}
                          </td>
                          <td className='py-[11px] text-[13px] border-b border-border align-middle text-textMuted'>
                            {formatFecha(c.fecha_vencimiento)}
                          </td>
                          <td className='py-[11px] text-[13px] border-b border-border align-middle'>
                            <span
                              className='inline-block rounded-[20px] px-2.5 py-[3px] text-[11px] font-extrabold'
                              style={{
                                background:
                                  (CUOTA_COLOR[c.estado] ?? '#6B6B8A') + '1A',
                                color: CUOTA_COLOR[c.estado] ?? '#6B6B8A',
                              }}
                            >
                              {c.estado}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}

          {/* ━━━━━ HORARIO ━━━━━ */}
          {activeNav === 'horario' && (
            <div className='bg-white rounded-card p-6 shadow-card border border-border'>
              <div className='text-[15px] font-extrabold text-text mb-5 flex items-center gap-2'>
                🕐 Mi Horario de hoy · {diaActual()}
              </div>
              {horarioHoy.length === 0 ? (
                <div className='flex flex-col items-center justify-center py-8 text-textMuted text-[13px] gap-2.5'>
                  <span className='text-[36px]'>🎉</span>
                  <span className='font-bold text-textMuted'>
                    No tenés clases registradas para hoy
                  </span>
                </div>
              ) : (
                horarioHoy.map((h) => (
                  <div
                    key={h.id_horario}
                    className='flex items-center gap-3.5 py-3.5 border-b border-border'
                  >
                    <div className='bg-purpleLight text-purple-700 rounded-[10px] px-3 py-1.5 text-[13px] font-extrabold min-w-[96px] text-center shrink-0 leading-[1.5]'>
                      {h.hora_inicio.slice(0, 5)}
                      <br />
                      {h.hora_fin.slice(0, 5)}
                    </div>
                    <div className='w-1 h-[52px] rounded-[4px] shrink-0 bg-purple-700' />
                    <div>
                      <div className='font-black text-[15px]'>
                        {h.asignaciones?.materias?.nombre}
                      </div>
                      <div className='text-[13px] text-textMuted mt-0.5'>
                        Prof. {h.asignaciones?.docentes?.nombre}{' '}
                        {h.asignaciones?.docentes?.apellido}
                      </div>
                      <div className='text-xs text-textMuted mt-0.5'>
                        📍 {h.aula ?? 'Aula a confirmar'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ━━━━━ ACTIVIDADES ━━━━━ */}
          {activeNav === 'actividades' && (
            <div className='bg-white rounded-card p-6 shadow-card border border-border'>
              <div className='text-[15px] font-extrabold text-text mb-5 flex items-center gap-2'>
                🎨 Servicios extracurriculares
              </div>
              <p className='text-[13px] text-textMuted m-0 mb-5 leading-relaxed'>
                Inscribite a los talleres de idiomas y a las disciplinas
                deportivas. Las actividades sin cupo disponible quedan
                bloqueadas.
              </p>

              {actMsg && (
                <div className='bg-[#E74C3C12] border border-red/25 rounded-[8px] px-3.5 py-2.5 text-xs text-red font-bold mb-4'>
                  ⚠️ {actMsg}
                </div>
              )}

              {(['Idioma', 'Deporte'] as const).map((tipo) => {
                const items = actividades.filter((a) => a.tipo === tipo)
                if (items.length === 0) return null
                return (
                  <div key={tipo} className='mb-6'>
                    <div className='text-xs font-black text-purple-700 uppercase tracking-[0.08em] mb-3'>
                      {tipo === 'Idioma'
                        ? '🗣️ Idiomas'
                        : '⚽ Disciplinas deportivas'}
                    </div>
                    <div className='grid grid-cols-2 gap-3'>
                      {items.map((a) => {
                        const disponibles = a.cupo_maximo - a.inscriptos
                        const completo = disponibles <= 0
                        return (
                          <div
                            key={a.id_actividad}
                            className='border border-border rounded-[12px] p-4 flex flex-col gap-2'
                          >
                            <div className='flex justify-between items-start gap-2'>
                              <span className='text-[15px] font-black'>
                                {a.nombre}
                              </span>
                              {a.inscripto && (
                                <span
                                  className='inline-block rounded-[20px] px-2.5 py-[3px] text-[11px] font-extrabold'
                                  style={{
                                    background: '#27AE601A',
                                    color: '#27AE60',
                                  }}
                                >
                                  Inscripto
                                </span>
                              )}
                            </div>
                            {a.descripcion && (
                              <span className='text-xs text-textMuted'>
                                {a.descripcion}
                              </span>
                            )}
                            <span
                              className='text-xs font-extrabold'
                              style={{
                                color: completo ? '#E74C3C' : '#27AE60',
                              }}
                            >
                              {completo
                                ? 'Cupo completo'
                                : `${disponibles} de ${a.cupo_maximo} cupos disponibles`}
                            </span>
                            {a.inscripto ? (
                              <button
                                className='mt-1 bg-transparent border border-red rounded-[8px] px-3.5 py-[7px] text-xs font-bold text-red cursor-pointer font-[inherit]'
                                onClick={() =>
                                  cancelarActividad(a.id_actividad)
                                }
                              >
                                Cancelar inscripción
                              </button>
                            ) : (
                              <button
                                disabled={completo}
                                className={`mt-1 border rounded-[8px] px-3.5 py-[7px] text-xs font-bold font-[inherit] transition-all
                                  ${
                                    completo
                                      ? 'bg-border border-border text-textMuted cursor-not-allowed'
                                      : 'bg-purple-700 border-purple-700 text-white cursor-pointer'
                                  }`}
                                onClick={() =>
                                  inscribirseActividad(a.id_actividad)
                                }
                              >
                                {completo ? 'Sin cupo' : 'Inscribirme'}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {actividades.length === 0 && (
                <div className='flex items-center justify-center py-8 text-textMuted text-[13px]'>
                  No hay actividades disponibles por el momento.
                </div>
              )}
            </div>
          )}

          {/* ━━━━━ NOTIFICACIONES ━━━━━ */}
          {/* ━━━━━ SERVICIOS: TRANSPORTE Y COMEDOR ━━━━━ */}
          {activeNav === 'servicios' && (
            <div className='bg-white rounded-card p-6 shadow-card border border-border'>
              <div className='text-[15px] font-extrabold text-text mb-5 flex items-center gap-2'>
                🚌 Transporte y comedor
              </div>
              <p className='text-[13px] text-textMuted m-0 mb-5 leading-relaxed'>
                {esTutor
                  ? 'Elegí el recorrido del transporte escolar y el servicio de comedor para tu hijo/a. Podés cambiarlos cuando lo necesites.'
                  : 'Estos son los servicios que tenés asignados. Para modificarlos, hablá con tu familia o con la administración.'}
              </p>

              {servMsg && (
                <div className='bg-[#E74C3C12] border border-red/25 rounded-[8px] px-3.5 py-2.5 text-xs text-red font-bold mb-4'>
                  ⚠️ {servMsg}
                </div>
              )}

              {/* Comedor */}
              <div className='border border-border rounded-[12px] p-4 mb-5 flex justify-between items-center gap-4 flex-wrap'>
                <div>
                  <div className='text-[15px] font-black mb-1'>🍽️ Comedor</div>
                  <div className='text-[13px] text-textMuted'>
                    {servicios?.comedor
                      ? 'Inscripto en el servicio de comedor.'
                      : 'No utiliza el servicio de comedor.'}
                  </div>
                </div>
                {esTutor && (
                  <button
                    className={
                      servicios?.comedor
                        ? 'bg-transparent border border-red rounded-[8px] px-4 py-2 text-xs font-extrabold text-red cursor-pointer font-[inherit]'
                        : 'bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn px-4 py-2 text-xs font-extrabold cursor-pointer font-[inherit]'
                    }
                    onClick={alternarComedor}
                  >
                    {servicios?.comedor ? 'Dar de baja' : 'Inscribir al comedor'}
                  </button>
                )}
              </div>

              {/* Transporte */}
              <div className='text-xs font-black text-purple-700 uppercase tracking-[0.08em] mb-3'>
                🚌 Transporte escolar
              </div>

              {servicios?.transporte ? (
                <div className='border border-purple-700/30 bg-purpleLight rounded-[12px] p-4 mb-4 flex justify-between items-center gap-4 flex-wrap'>
                  <div>
                    <div className='text-[15px] font-black'>
                      {servicios.transporte.recorridos_transporte.nombre}
                    </div>
                    <div className='text-[13px] text-textMuted'>
                      {servicios.transporte.recorridos_transporte.zona ?? 'Sin zona'} · Ida{' '}
                      {(servicios.transporte.recorridos_transporte.hora_ida ?? '—').slice(0, 5)} · Vuelta{' '}
                      {(servicios.transporte.recorridos_transporte.hora_vuelta ?? '—').slice(0, 5)}
                    </div>
                    {servicios.transporte.observaciones && (
                      <div className='text-[12px] text-textMuted mt-1'>
                        {servicios.transporte.observaciones}
                      </div>
                    )}
                  </div>
                  {esTutor && (
                    <button
                      className='bg-transparent border border-red rounded-[8px] px-4 py-2 text-xs font-extrabold text-red cursor-pointer font-[inherit]'
                      onClick={bajaTransporte}
                    >
                      Dar de baja
                    </button>
                  )}
                </div>
              ) : (
                <div className='text-[13px] text-textMuted mb-4'>
                  El alumno no utiliza el transporte escolar.
                </div>
              )}

              {esTutor && (
                <div className='grid grid-cols-2 gap-3'>
                  {recorridos.map((r) => {
                    const actual =
                      servicios?.transporte?.recorridos_transporte.id_recorrido === r.id_recorrido
                    const lleno = r.capacidad !== null && r.inscriptos >= r.capacidad && !actual
                    return (
                      <div
                        key={r.id_recorrido}
                        className='border border-border rounded-[12px] p-4 flex flex-col gap-2'
                      >
                        <div className='flex justify-between items-start gap-2'>
                          <span className='text-[15px] font-black'>{r.nombre}</span>
                          <span
                            className='inline-block rounded-[20px] px-2.5 py-[3px] text-[11px] font-extrabold'
                            style={{
                              background: lleno ? '#E74C3C1A' : '#27AE601A',
                              color: lleno ? '#E74C3C' : '#27AE60',
                            }}
                          >
                            {r.capacidad !== null
                              ? `${r.capacidad - r.inscriptos} lugar(es)`
                              : 'Sin límite'}
                          </span>
                        </div>
                        <div className='text-[12px] text-textMuted'>
                          {r.zona ?? 'Sin zona'} · Ida {(r.hora_ida ?? '—').slice(0, 5)} · Vuelta{' '}
                          {(r.hora_vuelta ?? '—').slice(0, 5)}
                        </div>
                        {r.paradas && (
                          <div className='text-[11px] text-textMuted whitespace-pre-line'>
                            {r.paradas}
                          </div>
                        )}
                        <button
                          disabled={lleno || actual}
                          className={
                            actual
                              ? 'bg-[#27AE601A] text-[#27AE60] border-0 rounded-btn py-2 text-xs font-extrabold font-[inherit] cursor-default'
                              : lleno
                                ? 'bg-border text-textMuted border-0 rounded-btn py-2 text-xs font-extrabold font-[inherit] cursor-not-allowed'
                                : 'bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-2 text-xs font-extrabold cursor-pointer font-[inherit]'
                          }
                          onClick={() => elegirRecorrido(r.id_recorrido)}
                        >
                          {actual ? 'Recorrido actual' : lleno ? 'Sin lugares' : 'Elegir este recorrido'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {activeNav === 'notificaciones' && (
            <div className='bg-white rounded-card p-6 shadow-card border border-border'>
              <div className='flex justify-between items-center mb-5'>
                <div className='text-[15px] font-extrabold text-text flex items-center gap-2'>
                  🔔 Todas mis Notificaciones
                </div>
                {notifNoLeidas > 0 && (
                  <button
                    className='bg-transparent border border-purple-700 rounded-[8px] px-3.5 py-[7px] text-xs font-bold text-purple-700 cursor-pointer font-[inherit]'
                    onClick={marcarTodasLeidas}
                  >
                    Marcar todas como leídas
                  </button>
                )}
              </div>
              {notificaciones.length === 0 ? (
                <div className='flex items-center justify-center py-8 text-textMuted text-[13px]'>
                  Sin notificaciones
                </div>
              ) : (
                notificaciones.map((n) => (
                  <div
                    key={n.id_notificacion}
                    className={`flex gap-3 items-start py-3 border-b border-border cursor-pointer transition-opacity ${n.leida ? 'opacity-[0.55]' : 'opacity-100'}`}
                    onClick={() => !n.leida && marcarLeida(n.id_notificacion)}
                  >
                    <div
                      className='w-[9px] h-[9px] rounded-full mt-[6px] shrink-0'
                      style={{
                        background: n.leida
                          ? '#E8E6F5'
                          : (NOTIF_COLOR[n.tipo] ?? '#5B35C5'),
                      }}
                    />
                    <div className='flex-1'>
                      <div className='flex items-center gap-2 mb-1'>
                        <span
                          className={`text-sm ${n.leida ? 'font-semibold' : 'font-black'}`}
                        >
                          {n.titulo}
                        </span>
                        <span
                          className='inline-block rounded-[20px] px-2.5 py-[3px] text-[11px] font-extrabold'
                          style={{
                            background:
                              (NOTIF_COLOR[n.tipo] ?? '#5B35C5') + '1A',
                            color: NOTIF_COLOR[n.tipo] ?? '#5B35C5',
                          }}
                        >
                          {n.tipo}
                        </span>
                      </div>
                      <p className='text-[13px] text-textMuted m-0 leading-relaxed'>
                        {n.mensaje}
                      </p>
                      <span className='text-[11px] text-textMuted mt-1 block'>
                        {formatFecha(n.fecha_envio)}
                      </span>
                    </div>
                    {!n.leida && (
                      <span className='text-[11px] text-purple-700 font-extrabold shrink-0'>
                        Marcar leída
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </main>
      </div>

      {cambiandoPassword && (
        <CambiarPassword onClose={() => setCambiandoPassword(false)} />
      )}
    </div>
  )
}
