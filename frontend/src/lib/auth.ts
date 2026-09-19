/**
 * Sesión del usuario (reemplaza a supabase.auth).
 *
 * - login(): valida credenciales en el backend y guarda el token.
 * - getSession(): devuelve el perfil del usuario logueado o null.
 * - logout(): borra el token y avisa a los suscriptores.
 * - onAuthChange(): suscripción a cambios de sesión (también entre pestañas).
 */
import { api, getToken, setToken, setUnauthorizedHandler } from './api'
import type { ApiResult } from './api'
import type { UsuarioPanel } from '../types'

export type Perfil = UsuarioPanel

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
  emitir(res.data.usuario)
  return { data: res.data.usuario, error: null }
}

export async function getSession(): Promise<Perfil | null> {
  if (!getToken()) return null
  const { data } = await api.get<Perfil>('/auth/me')
  return data
}

export function logout() {
  setToken(null)
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
