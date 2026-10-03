/**
 * EmailObserver: manda el aviso por email a la familia del alumno (el
 * padre/tutor, o el propio alumno si no tiene), con el mismo texto que el aviso
 * in-app. Sin SMTP configurado no hace nada (ver `services/email.ts`).
 */
import { prisma } from '../../lib/prisma.js'
import { emailHabilitado, enviarEmail } from '../email.js'
import type { Observador } from './eventos.js'
import { textoAviso } from './mensajes.js'

const escapar = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** Email de la familia del alumno, el mismo destino que las notificaciones in-app. */
export async function emailDeLaFamilia(idAlumno: number): Promise<string | null> {
  const alumno = await prisma.alumno.findUnique({
    where: { id_alumno: idAlumno },
    select: {
      padre: { select: { email: true, activo: true } },
      usuarios: { select: { email: true, activo: true } },
    },
  })
  const destino = alumno?.padre ?? alumno?.usuarios ?? null
  return destino?.activo ? destino.email : null
}

export function htmlAviso(titulo: string, mensaje: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;color:#1A1A2E">
<h2 style="color:#5B35C5;margin:0 0 12px">${escapar(titulo)}</h2>
<p style="font-size:15px;line-height:1.5;margin:0 0 16px">${escapar(mensaje)}</p>
<p style="font-size:12px;color:#6B6B80;margin:0">Educar para Transformar · Este es un aviso automático, no hace falta responderlo.</p>
</div>`
}

export const emailObserver: Observador = {
  nombre: 'email',
  async notificar(evento) {
    if (!emailHabilitado) return
    const para = await emailDeLaFamilia(evento.id_alumno)
    if (!para) return
    const { titulo, mensaje } = textoAviso(evento)
    await enviarEmail({ para, asunto: `${titulo} · Educar para Transformar`, html: htmlAviso(titulo, mensaje), texto: mensaje })
  },
}
