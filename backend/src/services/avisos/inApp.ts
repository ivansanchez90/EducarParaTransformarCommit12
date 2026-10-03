/** Canal in-app (y push, que manda `notificarFamilias`). */
import { notificarFamilias } from '../notificaciones.js'
import type { Observador } from './eventos.js'
import { textoAviso, textoDeuda } from './mensajes.js'

export const observadorInApp: Observador = {
  nombre: 'in-app y push',
  async notificar(evento) {
    if (evento.tipo === 'ComprobanteValidado') {
      const { titulo, mensaje } = textoAviso(evento)
      await notificarFamilias([{ id_alumno: evento.id_alumno, titulo, mensaje }], 'Pago')
      return
    }
    // Deuda: un aviso por hijo, y solo la primera vez (un reintento del email no lo repite).
    if (!evento.primeraVez) return
    await notificarFamilias(
      evento.alumnos.map((a) => ({ id_alumno: a.id_alumno, ...textoDeuda(a) })),
      'Pago',
    )
  },
}
