/**
 * Avisos a las familias por los eventos de la facturación (patrón Observer).
 *
 * Una ruta publica un evento (`publicar`) y cada observador suscripto decide qué
 * mandar por su canal: in-app y push (`inApp.ts`) y email (`email.ts`). Un canal
 * que falla queda en el log y no frena a los demás ni revierte la operación,
 * que ya se guardó antes de publicar. Para sumar un canal alcanza con escribir
 * su observador y suscribirlo en `index.ts`.
 */

/** El admin aprobó o rechazó un comprobante de transferencia (T14). */
export interface ComprobanteValidado {
  tipo: 'ComprobanteValidado'
  aprobado: boolean
  id_alumno: number
  /** "Nombre Apellido" del alumno. */
  alumno: string
  factura: { numero: number; anio: number; mes: number; saldo: number }
  /** Aprobado: lo que se acreditó. Rechazado: lo que declaró la familia. */
  importe: number
  motivo?: string | null
}

/** T17 suma `FacturaEmitida` y T18 `DeudaDetectada`. */
export type EventoFinanzas = ComprobanteValidado

export interface Observador {
  nombre: string
  notificar: (evento: EventoFinanzas) => Promise<void>
}

const observadores: Observador[] = []

/** Suscribe un observador; devuelve la función para desuscribirlo. */
export function suscribir(observador: Observador): () => void {
  observadores.push(observador)
  return () => {
    const i = observadores.indexOf(observador)
    if (i >= 0) observadores.splice(i, 1)
  }
}

/** Avisa a todos los observadores. Nunca lanza: los errores de cada canal van al log. */
export async function publicar(evento: EventoFinanzas): Promise<void> {
  const actuales = [...observadores]
  const resultados = await Promise.allSettled(actuales.map((o) => o.notificar(evento)))
  resultados.forEach((r, i) => {
    if (r.status === 'rejected') console.error(`Aviso ${evento.tipo} por ${actuales[i].nombre} falló:`, r.reason)
  })
}
