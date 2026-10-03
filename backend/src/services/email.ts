/**
 * Envío de emails con nodemailer por el SMTP de Gmail.
 *
 * Gmail pide una "contraseña de aplicación" (Cuenta de Google → Seguridad →
 * Verificación en dos pasos → Contraseñas de aplicaciones), no la contraseña
 * de la cuenta. Sin SMTP_USER y SMTP_PASS el envío queda apagado, como el
 * push sin claves VAPID: la app funciona igual y el motivo sale en el log.
 *
 * Quien envía decide qué hacer si falla: las tareas programadas registran cada
 * envío en `envios_email` para reintentar sin duplicar.
 */
import nodemailer, { type Transporter } from 'nodemailer'
import { config } from '../lib/config.js'

export interface Adjunto {
  nombre: string
  contenido: Buffer
  tipo?: string
}

export interface Email {
  para: string
  asunto: string
  html: string
  /** Versión en texto plano; si falta, el cliente de correo muestra el HTML. */
  texto?: string
  adjuntos?: Adjunto[]
}

function crearTransporte(): Transporter | null {
  if (!config.smtpUser || !config.smtpPass) {
    console.warn('Envío de emails apagado: faltan SMTP_USER y SMTP_PASS.')
    return null
  }
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    // 465 = SSL desde el inicio; 587 = STARTTLS.
    secure: config.smtpPort === 465,
    auth: { user: config.smtpUser, pass: config.smtpPass },
  })
}

const transporte = crearTransporte()

export const emailHabilitado = transporte !== null

/** Escapa un texto para meterlo en el HTML de un email (nombres, motivos, descripciones). */
export const escaparHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const remitente = config.mailFrom || `Educar para Transformar <${config.smtpUser}>`

/**
 * Envía un email. Devuelve `false` si el envío está apagado; si el servidor
 * lo rechaza, lanza el error de nodemailer.
 */
export async function enviarEmail(email: Email): Promise<boolean> {
  if (!transporte) return false
  await transporte.sendMail({
    from: remitente,
    to: email.para,
    subject: email.asunto,
    html: email.html,
    text: email.texto,
    attachments: email.adjuntos?.map((a) => ({
      filename: a.nombre,
      content: a.contenido,
      contentType: a.tipo,
    })),
  })
  return true
}

/**
 * Prueba la conexión y el login con Gmail al arrancar, para que una
 * contraseña de aplicación mal cargada se vea en el log y no recién el último
 * día hábil del mes. No detiene la app.
 */
export async function verificarEmail(): Promise<void> {
  if (!transporte) return
  try {
    await transporte.verify()
    console.log(`Envío de emails activo (${config.smtpUser}).`)
  } catch (err) {
    console.error(
      'No se pudo conectar con el servidor de email. Revisar SMTP_USER y SMTP_PASS ' +
        '(tiene que ser una contraseña de aplicación de Google).',
      err instanceof Error ? err.message : err,
    )
  }
}
