/**
 * Cliente HTTP del backend (reemplaza al cliente de Supabase).
 *
 * Todas las llamadas devuelven `{ data, error }`, igual que hacía Supabase,
 * para que los componentes manejen los errores de la misma forma. El token de
 * sesión se guarda en localStorage y se envía en cada request.
 */

/**
 * Por defecto la API está en el mismo dominio que el frontend (`/api`): en
 * producción el backend sirve ambos, y en desarrollo Vite hace de proxy.
 * VITE_API_URL solo hace falta si el backend se aloja en otro dominio.
 */
export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

const TOKEN_KEY = 'ept_token'

export interface ApiError {
  message: string
  code?: string
  status: number
}

export type ApiResult<T> =
  | { data: T; error: null }
  | { data: null; error: ApiError }

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // localStorage no disponible (modo privado): la sesión dura lo que la pestaña
  }
}

/** Se ejecuta cuando el backend rechaza el token (sesión vencida o usuario desactivado). */
let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let payload: BodyInit | undefined
  if (body instanceof FormData) {
    payload = body
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  let res: Response
  try {
    res = await fetch(`${API_URL}/api${path}`, { method, headers, body: payload })
  } catch {
    return {
      data: null,
      error: { message: 'No se pudo conectar con el servidor', status: 0 },
    }
  }

  const json = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    if (token && (res.status === 401 || json?.code === 'USUARIO_INACTIVO')) {
      onUnauthorized?.()
    }
    return {
      data: null,
      error: {
        message: json?.error ?? `Error ${res.status}`,
        code: json?.code,
        status: res.status,
      },
    }
  }
  return { data: json as T, error: null }
}

/** Arma un query string ignorando valores vacíos: qs({ a: 1, b: '' }) → '?a=1' */
export function qs(params: Record<string, string | number | boolean | null | undefined>) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T = null>(path: string) => request<T>('DELETE', path),
}
