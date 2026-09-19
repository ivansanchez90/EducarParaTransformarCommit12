/**
 * Notificaciones in-app a las familias.
 *
 * Cada notificación de un alumno se dirige a su padre/tutor si lo tiene, o al
 * propio alumno si no. (El envío de emails de la antigua Edge Function
 * `enviar-notificacion` estaba desactivado y no se migró.)
 */
import { prisma } from '../lib/prisma.js'

export interface ItemNotificacion {
  id_alumno: number
  titulo: string
  mensaje: string
}

export async function notificarFamilias(items: ItemNotificacion[], tipo: string): Promise<number> {
  if (items.length === 0) return 0
  const ids = [...new Set(items.map((i) => i.id_alumno))]
  const alumnos = await prisma.alumno.findMany({
    where: { id_alumno: { in: ids } },
    select: { id_alumno: true, id_usuario: true, id_usuario_padre: true },
  })

  const destinoPorAlumno = new Map<number, string>()
  for (const a of alumnos) {
    const destino = a.id_usuario_padre ?? a.id_usuario
    if (destino) destinoPorAlumno.set(a.id_alumno, destino)
  }

  const data = items
    .filter((i) => destinoPorAlumno.has(i.id_alumno))
    .map((i) => ({
      id_usuario_destino: destinoPorAlumno.get(i.id_alumno)!,
      titulo: i.titulo,
      mensaje: i.mensaje,
      tipo,
    }))

  if (data.length) await prisma.notificacion.createMany({ data })
  return data.length
}
