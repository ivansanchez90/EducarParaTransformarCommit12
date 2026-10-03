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

/** Factura vencida con saldo, para el aviso de deuda. */
export interface FacturaAdeudada {
  numero: number
  anio: number
  mes: number
  fecha_vencimiento: Date
  saldo: number
  /** Solo los ítems que deben algo (la beca pendiente, en negativo). */
  items: { descripcion: string; saldo: number }[]
}

/**
 * Una familia tiene facturas vencidas con saldo (T18, el día 20). Un aviso por
 * familia con lo que debe cada hijo.
 */
export interface DeudaDetectada {
  tipo: 'DeudaDetectada'
  /** Mes del aviso. */
  anio: number
  mes: number
  familia: { id_usuario: string; email: string; nombre: string }
  alumnos: { id_alumno: number; nombre: string; facturas: FacturaAdeudada[] }[]
  total: number
  /** `false` en un reintento del email: el aviso in-app y push ya se mandó. */
  primeraVez: boolean
}

export type EventoFinanzas = ComprobanteValidado | DeudaDetectada

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

export interface ResultadoCanal {
  canal: string
  ok: boolean
  error?: string
}

/**
 * Avisa a todos los observadores y devuelve cómo le fue a cada canal (el aviso
 * de deuda lo usa para registrar si salió el email). Nunca lanza: los errores
 * de cada canal van al log.
 */
export async function publicar(evento: EventoFinanzas): Promise<ResultadoCanal[]> {
  const actuales = [...observadores]
  const resultados = await Promise.allSettled(actuales.map((o) => o.notificar(evento)))
  return resultados.map((r, i) => {
    if (r.status === 'fulfilled') return { canal: actuales[i].nombre, ok: true }
    console.error(`Aviso ${evento.tipo} por ${actuales[i].nombre} falló:`, r.reason)
    return { canal: actuales[i].nombre, ok: false, error: r.reason instanceof Error ? r.reason.message : String(r.reason) }
  })
}
