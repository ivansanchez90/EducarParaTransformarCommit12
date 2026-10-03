/** Canal in-app (y push, que manda `notificarFamilias`). */
import { notificarFamilias } from '../notificaciones.js'
import type { Observador } from './eventos.js'
import { textoAviso } from './mensajes.js'

export const observadorInApp: Observador = {
  nombre: 'in-app y push',
  async notificar(evento) {
    const { titulo, mensaje } = textoAviso(evento)
    await notificarFamilias([{ id_alumno: evento.id_alumno, titulo, mensaje }], 'Pago')
  },
}
