import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { HttpError } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { firmarToken, requireAuth } from '../middleware/auth.js'

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

/** Perfil del usuario logueado (reemplaza a supabase.auth.getSession + select de usuarios). */
authRouter.get('/me', requireAuth, (req, res) => {
  res.json(req.user)
})
