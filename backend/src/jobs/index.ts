/**
 * Tareas programadas (node-cron) que corren dentro del backend, en hora de
 * Argentina.
 *
 * Cada tarea se dispara con una expresión cron y, si tiene `corresponde`,
 * solo se ejecuta los días en que devuelve `true`. Así el email del último día
 * hábil se programa todos los días a la misma hora y la tarea decide si hoy
 * es el día (cron no sabe de feriados).
 *
 * Una tarea puede correr dos veces (reinicio del backend, dos instancias): por
 * eso cada envío se registra en `envios_email` con restricción única, y no
 * acá. Si una tarea falla, el error queda en el log y el backend sigue.
 */
import cron from 'node-cron'
import { config } from '../lib/config.js'
import { diaEnZona, hayFeriadosCargados, type Dia } from './calendario.js'

export interface TareaProgramada {
  nombre: string
  /** Expresión cron, en hora de Argentina. Ej.: '0 9 * * *' = todos los días a las 9. */
  expresion: string
  /** Si devuelve `false`, ese día la tarea no se ejecuta. */
  corresponde?: (hoy: Dia) => boolean
  ejecutar: (hoy: Dia) => Promise<unknown>
}

export type ResultadoTarea = 'omitida' | 'ejecutada' | 'fallida'

/**
 * Las tareas del sistema. Se suman en T17 (email del último día hábil, con
 * `corresponde: esUltimoDiaHabil`) y en T18 (aviso de deuda del día 20).
 */
export const TAREAS: TareaProgramada[] = []

/** Ejecuta una tarea para el día de Argentina que corresponde a `instante`. */
export async function correrTarea(tarea: TareaProgramada, instante = new Date()): Promise<ResultadoTarea> {
  const hoy = diaEnZona(instante, config.zonaHoraria)
  if (tarea.corresponde && !tarea.corresponde(hoy)) return 'omitida'
  const inicio = Date.now()
  try {
    await tarea.ejecutar(hoy)
    console.log(`Tarea "${tarea.nombre}" terminada en ${Date.now() - inicio} ms.`)
    return 'ejecutada'
  } catch (err) {
    console.error(`Falló la tarea "${tarea.nombre}":`, err)
    return 'fallida'
  }
}

/** Programa las tareas. Se llama una vez, al arrancar el servidor. */
export function iniciarTareas(tareas: TareaProgramada[] = TAREAS): void {
  if (!config.tareasProgramadas) {
    console.warn('Tareas programadas apagadas (TAREAS_PROGRAMADAS=false).')
    return
  }
  const anio = diaEnZona(new Date(), config.zonaHoraria).anio
  if (!hayFeriadosCargados(anio)) {
    console.warn(
      `No hay feriados cargados para ${anio} en jobs/calendario.ts: ` +
        'el último día hábil se calcula solo con los fines de semana.',
    )
  }
  for (const tarea of tareas) {
    cron.schedule(tarea.expresion, (ctx) => correrTarea(tarea, ctx.date), {
      name: tarea.nombre,
      timezone: config.zonaHoraria,
      noOverlap: true,
    })
  }
  if (tareas.length) console.log(`Tareas programadas: ${tareas.map((t) => t.nombre).join(', ')}.`)
}
