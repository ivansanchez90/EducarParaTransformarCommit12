/**
 * Sesión del usuario (reemplaza a supabase.auth).
 *
 * - login(): valida credenciales en el backend y guarda el token.
 * - getSession(): devuelve el perfil del usuario logueado o null. Sin conexión
 *   (la app instalada se abre sin señal) usa el último perfil conocido, así la
 *   sesión no se pierde por abrirla en modo avión.
 * - logout(): borra el token y avisa a los suscriptores.
 * - onAuthChange(): suscripción a cambios de sesión (también entre pestañas).
 */
import { api, getToken, setToken, setUnauthorizedHandler } from './api'
import type { ApiError, ApiResult } from './api'
import type { UsuarioPanel } from '../types'
import { desuscribirPushAlSalir } from '../pwa/push'

export type Perfil = UsuarioPanel

const PERFIL_KEY = 'ept_perfil'

/**
 * Último perfil que devolvió el backend. Solo nombre, email y rol: alcanza para
 * dibujar la app sin conexión. Se borra al cerrar sesión, como el token.
 */
function recordarPerfil(perfil: Perfil | null) {
  try {
    if (perfil) {
      // El backend manda más datos (teléfono, foto); se guarda solo lo que usa la app.
      const { id_usuario, nombre, apellido, email, rol, activo } = perfil
      localStorage.setItem(PERFIL_KEY, JSON.stringify({ id_usuario, nombre, apellido, email, rol, activo }))
    } else {
      localStorage.removeItem(PERFIL_KEY)
    }
  } catch {
    // localStorage no disponible: sin conexión se vuelve al login, como antes
  }
}

function perfilRecordado(): Perfil | null {
  try {
    const guardado = localStorage.getItem(PERFIL_KEY)
    return guardado ? (JSON.parse(guardado) as Perfil) : null
  } catch {
    return null
  }
}

type Listener = (perfil: Perfil | null) => void
const listeners = new Set<Listener>()

function emitir(perfil: Perfil | null) {
  listeners.forEach((l) => l(perfil))
}

export async function login(
  email: string,
  password: string,
): Promise<ApiResult<Perfil>> {
  const res = await api.post<{ token: string; usuario: Perfil }>('/auth/login', {
    email,
    password,
  })
  if (res.error) return { data: null, error: res.error }
  setToken(res.data.token)
  recordarPerfil(res.data.usuario)
  emitir(res.data.usuario)
  return { data: res.data.usuario, error: null }
}

export async function getSession(): Promise<Perfil | null> {
  if (!getToken()) return null
  const { data, error } = await api.get<Perfil>('/auth/me')
  if (data) {
    recordarPerfil(data)
    return data
  }
  // Sin señal o con el servidor caído no se sabe si el token venció: se sigue
  // con el último perfil y el backend lo valida cuando vuelva la conexión.
  // Un 401 ya cerró la sesión (ver `setUnauthorizedHandler`).
  if (error.status === 0 || error.status >= 500) return perfilRecordado()
  return null
}

/** Cambia la contraseña del usuario logueado. Devuelve el error si lo hay. */
export async function cambiarPassword(
  actual: string,
  nueva: string,
): Promise<ApiError | null> {
  const { error } = await api.post('/auth/password', { actual, nueva })
  return error
}

export function logout() {
  // Se captura el token antes de borrarlo: desuscribir pide sesión.
  const token = getToken()
  if (token) void desuscribirPushAlSalir(token)
  setToken(null)
  recordarPerfil(null)
  emitir(null)
}

export function onAuthChange(listener: Listener): () => void {
  listeners.add(listener)
  // Cerrar sesión en otra pestaña también cierra esta.
  const onStorage = (e: StorageEvent) => {
    if (e.key === 'ept_token' && !e.newValue) listener(null)
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

// Token vencido o usuario desactivado: se cierra la sesión automáticamente.
setUnauthorizedHandler(logout)

/** true para los roles de padre/madre/tutor. */
export const esTutor = (rol: string | null | undefined) =>
  !!rol && /padre|tutor/i.test(rol)
