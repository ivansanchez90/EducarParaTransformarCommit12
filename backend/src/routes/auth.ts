import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { HttpError } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { firmarToken, requireAuth } from '../middleware/auth.js'
import { pedirRecuperacion, recuperacionDisponible, restablecerPassword } from '../services/recuperacion.js'

export const authRouter = Router()

authRouter.post('/login', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const password = String(req.body?.password ?? '')
  if (!email || !password) throw new HttpError(400, 'Email y contraseña son obligatorios')

  const usuario = await prisma.usuario.findUnique({
    where: { email },
    omit: { password_hash: false },
  })
  const ok = usuario && (await bcrypt.compare(password, usuario.password_hash))
  if (!usuario || !ok) throw new HttpError(401, 'Credenciales incorrectas')
  if (!usuario.activo) {
    throw new HttpError(403, 'Tu usuario está desactivado. Contactá a la institución.', 'USUARIO_INACTIVO')
  }

  const { password_hash: _hash, ...perfil } = usuario
  res.json({ token: firmarToken(usuario.id_usuario), usuario: perfil })
})

/** Cambia la contraseña del usuario logueado (pide la actual como control). */
authRouter.post('/password', requireAuth, async (req, res) => {
  const actual = String(req.body?.actual ?? '')
  const nueva = String(req.body?.nueva ?? '')
  if (nueva.length < 6) throw new HttpError(400, 'La contraseña nueva debe tener al menos 6 caracteres')
  if (nueva === actual) throw new HttpError(400, 'La contraseña nueva debe ser distinta de la actual')

  const usuario = await prisma.usuario.findUnique({
    where: { id_usuario: req.user!.id_usuario },
    omit: { password_hash: false },
  })
  if (!usuario || !(await bcrypt.compare(actual, usuario.password_hash))) {
    throw new HttpError(400, 'La contraseña actual no es correcta')
  }

  await prisma.usuario.update({
    where: { id_usuario: usuario.id_usuario },
    data: { password_hash: await bcrypt.hash(nueva, 10) },
  })
  res.json({ ok: true })
})

/**
 * Pide el enlace para elegir una contraseña nueva (T20). Responde siempre lo
 * mismo, exista o no el email, y sin esperar el envío: ni la respuesta ni el
 * tiempo que tarda dicen si el email está registrado.
 */
authRouter.post('/recuperar', (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  if (!email) throw new HttpError(400, 'Ingresá tu email')
  if (!recuperacionDisponible()) {
    throw new HttpError(503, 'La recuperación por email no está disponible. Pedile a la institución que te cambie la contraseña.')
  }
  pedirRecuperacion(email).catch((err: unknown) => {
    console.error('Error al mandar el email de recuperación:', err)
  })
  res.json({ ok: true })
})

/** Elige la contraseña nueva con el token del enlace (vale 30 minutos y una sola vez). */
authRouter.post('/restablecer', async (req, res) => {
  await restablecerPassword(String(req.body?.token ?? ''), String(req.body?.password ?? ''))
  res.json({ ok: true })
})

/** Perfil del usuario logueado (reemplaza a supabase.auth.getSession + select de usuarios). */
authRouter.get('/me', requireAuth, (req, res) => {
  res.json(req.user)
})
