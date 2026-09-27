/**
 * Avisos push (PWA): llegan al teléfono aunque la app esté cerrada.
 *
 * Complementan a las notificaciones in-app: `notificarFamilias` primero guarda
 * la notificación y después, sin esperar, manda el push. Si el push falla o
 * está apagado (faltan las claves VAPID), la notificación igual queda en el
 * portal.
 */
import webpush from 'web-push'
import { config } from '../lib/config.js'
import { prisma } from '../lib/prisma.js'

/** Lo que recibe el service worker del frontend en el evento `push`. */
export interface PayloadPush {
  titulo: string
  mensaje: string
  tipo: string
  /** Pantalla que se abre al tocar el aviso. */
  url: string
}

export interface SuscripcionPush {
  endpoint: string
  p256dh: string
  auth: string
}

/**
 * Configura `web-push`. Una clave o un `VAPID_SUBJECT` mal cargados no deben
 * tumbar la app (el contenedor no arrancaría): el push queda apagado y el
 * motivo sale en el log.
 */
function configurarPush(): boolean {
  if (!config.vapidPublicKey || !config.vapidPrivateKey) {
    console.warn('Avisos push apagados: faltan VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY.')
    return false
  }
  try {
    webpush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey)
    return true
  } catch (err) {
    console.error(
      'Avisos push apagados: configuración VAPID inválida. Revisar VAPID_PUBLIC_KEY, ' +
        'VAPID_PRIVATE_KEY y VAPID_SUBJECT (tiene que empezar con "mailto:" o "https:").',
      err instanceof Error ? err.message : err,
    )
    return false
  }
}

export const pushHabilitado = configurarPush()

/**
 * Envía un aviso a cada suscripción y devuelve los endpoints que el servicio
 * de push dio por vencidos (404/410: el usuario desinstaló la app o revocó el
 * permiso), para borrarlos.
 */
export async function enviarASuscripciones(
  suscripciones: SuscripcionPush[],
  payload: PayloadPush,
): Promise<string[]> {
  const cuerpo = JSON.stringify(payload)
  const resultados = await Promise.allSettled(
    suscripciones.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        cuerpo,
        // Si el teléfono está apagado, el aviso espera hasta un día.
        { TTL: 60 * 60 * 24 },
      ),
    ),
  )
  const vencidos: string[] = []
  resultados.forEach((r, i) => {
    if (r.status === 'fulfilled') return
    const status = (r.reason as { statusCode?: number }).statusCode
    if (status === 404 || status === 410) vencidos.push(suscripciones[i].endpoint)
    else console.error('No se pudo enviar un aviso push:', status ?? r.reason)
  })
  return vencidos
}

/** Manda un aviso a todos los navegadores suscriptos de cada usuario. */
export async function enviarPushAUsuarios(
  avisos: { id_usuario: string; payload: PayloadPush }[],
): Promise<void> {
  if (!pushHabilitado || avisos.length === 0) return
  const ids = [...new Set(avisos.map((a) => a.id_usuario))]
  const suscripciones = await prisma.pushSuscripcion.findMany({
    where: { id_usuario: { in: ids } },
    select: { id_usuario: true, endpoint: true, p256dh: true, auth: true },
  })
  if (suscripciones.length === 0) return

  const vencidos = (
    await Promise.all(
      avisos.map((a) =>
        enviarASuscripciones(
          suscripciones.filter((s) => s.id_usuario === a.id_usuario),
          a.payload,
        ),
      ),
    )
  ).flat()
  if (vencidos.length) {
    await prisma.pushSuscripcion.deleteMany({ where: { endpoint: { in: [...new Set(vencidos)] } } })
  }
}
