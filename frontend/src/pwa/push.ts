/**
 * Avisos push (PWA): pide permiso, suscribe el navegador con la clave VAPID
 * del backend y guarda la suscripción (`POST /api/push/suscribir`). El aviso
 * en sí lo muestra el service worker (`public/sw-push.js`); acá solo se
 * arma y se da de baja la suscripción.
 */
import { api, API_URL } from '../lib/api'

export type EstadoPush = 'no-soportado' | 'denegado' | 'inactivo' | 'activo'

function soportado() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** La API de suscripción pide la clave VAPID como bytes, no como texto. */
function base64UrlAUint8Array(base64Url: string): BufferSource {
  const base64 = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const binario = atob(base64)
  return Uint8Array.from(binario, (c) => c.charCodeAt(0)).buffer
}

async function suscripcionActual(): Promise<PushSubscription | null> {
  if (!soportado()) return null
  const registro = await navigator.serviceWorker.ready
  return registro.pushManager.getSubscription()
}

/** Estado actual, para elegir el botón sin pedir permiso todavía. */
export async function estadoPush(): Promise<EstadoPush> {
  if (!soportado()) return 'no-soportado'
  if (Notification.permission === 'denied') return 'denegado'
  const sub = await suscripcionActual()
  return sub ? 'activo' : 'inactivo'
}

/** Pide permiso, suscribe el navegador y guarda la suscripción en el backend. Devuelve el mensaje de error, o `null` si activó bien. */
export async function activarPush(): Promise<string | null> {
  if (!soportado()) return 'Este navegador no admite avisos push'

  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') return 'Diste el permiso de notificaciones como denegado'

  const { data } = await api.get<{ clave: string | null }>('/push/clave-publica')
  if (!data?.clave) return 'Los avisos push no están configurados en el servidor'

  try {
    const registro = await navigator.serviceWorker.ready
    const sub =
      (await registro.pushManager.getSubscription()) ??
      (await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlAUint8Array(data.clave),
      }))

    const { error } = await api.post('/push/suscribir', sub.toJSON())
    return error ? error.message : null
  } catch {
    // El navegador puede rechazar la suscripción (política propia, modo
    // incógnito, etc.) sin que se pueda distinguir el motivo de antemano.
    return 'No se pudo activar los avisos en este navegador'
  }
}

async function borrarSuscripcion(sub: PushSubscription, tokenAlSalir?: string): Promise<void> {
  try {
    if (tokenAlSalir) {
      await fetch(`${API_URL}/api/push/desuscribir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlSalir}` },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      })
    } else {
      await api.post('/push/desuscribir', { endpoint: sub.endpoint })
    }
  } catch {
    // Sin conexión al cerrar sesión: la suscripción vieja se descarta igual localmente.
  }
  try {
    await sub.unsubscribe()
  } catch {
    // Ya se borró del backend; si el navegador falla acá, queda para la próxima limpieza.
  }
}

/** Cancela la suscripción de este navegador (botón "Desactivar avisos"). */
export async function desactivarPush(): Promise<void> {
  try {
    const sub = await suscripcionActual()
    if (sub) await borrarSuscripcion(sub)
  } catch {
    // El navegador no dejó consultar la suscripción actual: no hay más para hacer acá.
  }
}

/**
 * Cierre de sesión en un teléfono compartido: borra la suscripción del
 * usuario que se va, para que no le sigan llegando avisos de otro (ver
 * `backend/src/routes/push.ts`). Recibe el token ya capturado por `logout()`
 * porque `desuscribir` necesita sesión y el token se borra antes de que esto termine.
 */
export async function desuscribirPushAlSalir(token: string): Promise<void> {
  try {
    const sub = await suscripcionActual()
    if (sub) await borrarSuscripcion(sub, token)
  } catch {
    // El navegador no dejó consultar la suscripción actual: no hay más para hacer acá.
  }
}
