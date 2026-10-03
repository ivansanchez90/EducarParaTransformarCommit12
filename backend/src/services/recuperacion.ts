/**
 * Recuperar la contraseña por email (T20).
 *
 * El enlace lleva un token aleatorio de 32 bytes; en la base se guarda solo su
 * SHA-256, así una copia de la base no sirve para entrar. Vale 30 minutos y una
 * sola vez: al usarlo se marca `usado_at` con un update condicional, que
 * también impide usarlo dos veces a la vez. Pedir un enlace nuevo anula los
 * anteriores, y se mandan como mucho 3 por hora a cada usuario.
 *
 * El enlace se arma con PUBLIC_URL y nunca con la cabecera Host del pedido:
 * si no, alguien podría hacer que el email apunte a su propio sitio.
 */
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { config } from '../lib/config.js'
import { HttpError } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { emailHabilitado, enviarEmail, escaparHtml as e } from './email.js'

export const VALIDEZ_MINUTOS = 30
export const MAXIMO_POR_HORA = 3
export const LARGO_MINIMO_PASSWORD = 6

export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex')

/** La recuperación necesita el email y la URL pública (para armar el enlace). */
export const recuperacionDisponible = () => emailHabilitado && Boolean(config.publicUrl)

export function emailRecuperacion(nombre: string, enlace: string) {
  const texto = [
    `Hola ${nombre}:`,
    '',
    'Recibimos un pedido para cambiar la contraseña de tu usuario. Entrá a este enlace para elegir una nueva:',
    '',
    enlace,
    '',
    `El enlace vale por ${VALIDEZ_MINUTOS} minutos y se puede usar una sola vez.`,
    'Si no lo pediste, ignorá este email: tu contraseña no cambia.',
  ].join('\n')
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;color:#1A1A2E">
<h2 style="color:#5B35C5;margin:0 0 12px">Recuperar tu contraseña</h2>
<p style="font-size:15px;line-height:1.5;margin:0 0 8px">Hola ${e(nombre)}:</p>
<p style="font-size:15px;line-height:1.5;margin:0 0 16px">Recibimos un pedido para cambiar la contraseña de tu usuario. Tocá el botón para elegir una nueva:</p>
<p style="margin:0 0 16px"><a href="${e(enlace)}" style="display:inline-block;background:#5B35C5;color:#fff;font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:10px">Elegir una contraseña nueva</a></p>
<p style="font-size:13px;line-height:1.5;color:#6B6B80;margin:0 0 8px">El enlace vale por ${VALIDEZ_MINUTOS} minutos y se puede usar una sola vez. Si el botón no funciona, copiá esta dirección en el navegador:<br>${e(enlace)}</p>
<p style="font-size:13px;line-height:1.5;color:#6B6B80;margin:0">Si no lo pediste, ignorá este email: tu contraseña no cambia.</p>
</div>`
  return { asunto: 'Recuperar tu contraseña · Educar para Transformar', html, texto }
}

/**
 * Crea el enlace y lo manda por email, si el email es de un usuario activo y no
 * pidió demasiados en la última hora. No dice si el email existe: la ruta
 * responde siempre lo mismo.
 */
export async function pedirRecuperacion(email: string, ahora = new Date()): Promise<'enviado' | 'ignorado'> {
  const usuario = await prisma.usuario.findUnique({
    where: { email },
    select: { id_usuario: true, nombre: true, email: true, activo: true },
  })
  if (!usuario?.activo) return 'ignorado'

  const haceUnaHora = new Date(ahora.getTime() - 60 * 60 * 1000)
  const recientes = await prisma.tokenRecuperacion.count({
    where: { id_usuario: usuario.id_usuario, created_at: { gt: haceUnaHora } },
  })
  if (recientes >= MAXIMO_POR_HORA) return 'ignorado'

  const token = crypto.randomBytes(32).toString('base64url')
  await prisma.$transaction([
    // Un enlace nuevo anula los anteriores que no se usaron.
    prisma.tokenRecuperacion.updateMany({
      where: { id_usuario: usuario.id_usuario, usado_at: null },
      data: { usado_at: ahora },
    }),
    prisma.tokenRecuperacion.create({
      data: {
        id_usuario: usuario.id_usuario,
        token_hash: hashToken(token),
        expira_at: new Date(ahora.getTime() + VALIDEZ_MINUTOS * 60 * 1000),
      },
    }),
  ])

  const enlace = `${config.publicUrl}/restablecer?token=${token}`
  await enviarEmail({ para: usuario.email, ...emailRecuperacion(usuario.nombre, enlace) })
  return 'enviado'
}

/** Cambia la contraseña con el token del enlace y lo deja usado. */
export async function restablecerPassword(token: string, password: string, ahora = new Date()): Promise<void> {
  if (password.length < LARGO_MINIMO_PASSWORD) {
    throw new HttpError(400, `La contraseña nueva debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres`)
  }
  const invalido = new HttpError(400, 'El enlace no es válido o ya venció. Pedí uno nuevo desde "¿Olvidaste tu contraseña?".')
  if (!token) throw invalido

  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.$transaction(async (tx) => {
    const tokenHash = hashToken(token)
    // Tomarlo: solo si no se usó y no venció (y una sola vez, aunque lleguen dos pedidos a la vez).
    const { count } = await tx.tokenRecuperacion.updateMany({
      where: { token_hash: tokenHash, usado_at: null, expira_at: { gt: ahora } },
      data: { usado_at: ahora },
    })
    if (count === 0) throw invalido
    const { usuarios } = await tx.tokenRecuperacion.findUniqueOrThrow({
      where: { token_hash: tokenHash },
      select: { usuarios: { select: { id_usuario: true, activo: true } } },
    })
    if (!usuarios.activo) throw invalido
    await tx.usuario.update({ where: { id_usuario: usuarios.id_usuario }, data: { password_hash: passwordHash } })
  })
}
