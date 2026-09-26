import { Router } from 'express'
import { config } from '../lib/config.js'
import { HttpError } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { pushHabilitado } from '../services/push.js'

export const pushRouter = Router()
pushRouter.use(requireAuth)

/** Clave pública VAPID para `pushManager.subscribe`; `null` si el push está apagado. */
pushRouter.get('/clave-publica', (_req, res) => {
  res.json({ clave: pushHabilitado ? config.vapidPublicKey : null })
})

/** Valida el `PushSubscription.toJSON()` que manda el navegador. */
function suscripcionDelBody(body: unknown) {
  const b = (body ?? {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }
  const { endpoint } = b
  const p256dh = b.keys?.p256dh
  const auth = b.keys?.auth
  if (
    typeof endpoint !== 'string' ||
    !endpoint.startsWith('https://') ||
    endpoint.length > 1000 ||
    typeof p256dh !== 'string' ||
    typeof auth !== 'string' ||
    p256dh.length > 200 ||
    auth.length > 100
  ) {
    throw new HttpError(400, 'Suscripción push inválida')
  }
  return { endpoint, p256dh, auth }
}

/**
 * Guarda la suscripción del navegador para el usuario logueado. Si el mismo
 * navegador ya estaba suscripto con otro usuario (teléfono compartido), pasa
 * a este: cada teléfono recibe los avisos de quien inició sesión por última vez.
 */
pushRouter.post('/suscribir', async (req, res) => {
  if (!pushHabilitado) throw new HttpError(503, 'Los avisos push no están configurados')
  const { endpoint, p256dh, auth } = suscripcionDelBody(req.body)
  const datos = {
    id_usuario: req.user!.id_usuario,
    p256dh,
    auth,
    user_agent: req.get('user-agent')?.slice(0, 300) ?? null,
  }
  await prisma.pushSuscripcion.upsert({
    where: { endpoint },
    create: { endpoint, ...datos },
    update: datos,
  })
  res.status(201).json({ ok: true })
})

/**
 * Borra la suscripción de este navegador. El frontend la llama al cerrar
 * sesión o al desactivar los avisos, para que un teléfono compartido no siga
 * recibiendo los avisos del usuario anterior.
 */
pushRouter.post('/desuscribir', async (req, res) => {
  const endpoint = (req.body as { endpoint?: unknown } | undefined)?.endpoint
  if (typeof endpoint !== 'string') throw new HttpError(400, 'Falta el endpoint')
  const { count } = await prisma.pushSuscripcion.deleteMany({
    where: { endpoint, id_usuario: req.user!.id_usuario },
  })
  res.json({ borradas: count })
})
