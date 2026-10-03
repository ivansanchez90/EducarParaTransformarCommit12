/** Canales suscriptos a los eventos de la facturación. Las rutas importan `publicar` de acá. */
import { emailObserver } from './email.js'
import { suscribir } from './eventos.js'
import { observadorInApp } from './inApp.js'

suscribir(observadorInApp)
suscribir(emailObserver)

export { publicar } from './eventos.js'
export type { EventoFinanzas } from './eventos.js'
