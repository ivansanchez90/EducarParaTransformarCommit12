/**
 * Calendario de días hábiles para las tareas programadas.
 *
 * Las fechas se manejan como día calendario de Argentina ({ anio, mes, dia }),
 * no como instantes: el email del "último día hábil" depende de qué día es en
 * Buenos Aires, no en UTC (a las 21 h de Argentina ya es el día siguiente en UTC).
 *
 * Este módulo no lee la configuración ni la base, para poder probarlo solo.
 */

export const ZONA_ARGENTINA = 'America/Argentina/Buenos_Aires'

export interface Dia {
  anio: number
  /** 1 = enero … 12 = diciembre */
  mes: number
  dia: number
}

/**
 * Feriados nacionales (en la fecha en que se cumplen, con los traslados ya
 * aplicados) y días no laborables con fines turísticos, en los que los bancos
 * no operan. Fuente: argentina.gob.ar/jefatura/feriados-nacionales-<año>.
 *
 * Los "puentes" turísticos de cada año se publican hacia fin del año anterior:
 * agregarlos acá cuando salgan. Un año que no figura en esta tabla se trata
 * como si no tuviera feriados (solo cuentan los fines de semana) y se avisa
 * en el log.
 */
const FERIADOS: Record<number, string[]> = {
  2026: [
    '01-01', // Año Nuevo
    '02-16', '02-17', // Carnaval
    '03-23', // Día no laborable con fines turísticos
    '03-24', // Día de la Memoria por la Verdad y la Justicia
    '04-02', // Malvinas y Jueves Santo
    '04-03', // Viernes Santo
    '05-01', // Día del Trabajador
    '05-25', // Revolución de Mayo
    '06-15', // Güemes (trasladado del 17/06)
    '06-20', // Belgrano
    '07-09', // Independencia
    '07-10', // Día no laborable con fines turísticos
    '08-17', // San Martín
    '10-12', // Diversidad Cultural
    '11-23', // Soberanía Nacional (trasladado del 20/11)
    '12-07', // Día no laborable con fines turísticos
    '12-08', // Inmaculada Concepción
    '12-25', // Navidad
  ],
  // Faltan los días no laborables con fines turísticos (todavía no publicados).
  2027: [
    '01-01', // Año Nuevo
    '02-08', '02-09', // Carnaval
    '03-24', // Día de la Memoria por la Verdad y la Justicia
    '03-25', // Jueves Santo (no laborable)
    '03-26', // Viernes Santo
    '04-02', // Malvinas
    '05-01', // Día del Trabajador
    '05-25', // Revolución de Mayo
    '06-20', // Belgrano
    '06-21', // Güemes (trasladado del 17/06)
    '07-09', // Independencia
    '08-16', // San Martín (trasladado del 17/08)
    '10-11', // Diversidad Cultural (trasladado del 12/10)
    '11-20', // Soberanía Nacional
    '12-08', // Inmaculada Concepción
    '12-25', // Navidad
  ],
}

const dos = (n: number) => String(n).padStart(2, '0')

/** Año, mes y día que muestra el calendario en `zona` en ese instante. */
export function diaEnZona(instante: Date, zona: string = ZONA_ARGENTINA): Dia {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instante)
  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)!.value)
  return { anio: valor('year'), mes: valor('month'), dia: valor('day') }
}

/** `true` si el año tiene sus feriados cargados en la tabla. */
export function hayFeriadosCargados(anio: number): boolean {
  return anio in FERIADOS
}

export function esFeriado({ anio, mes, dia }: Dia): boolean {
  return FERIADOS[anio]?.includes(`${dos(mes)}-${dos(dia)}`) ?? false
}

/** 0 = domingo … 6 = sábado. Se calcula en UTC para no depender de la zona del servidor. */
function diaDeLaSemana({ anio, mes, dia }: Dia): number {
  return new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay()
}

export function esDiaHabil(fecha: Dia): boolean {
  const semana = diaDeLaSemana(fecha)
  return semana !== 0 && semana !== 6 && !esFeriado(fecha)
}

/** Cantidad de días del mes (`mes` de 1 a 12). */
export function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate()
}

/**
 * Último día hábil del mes: el último que no es sábado, domingo ni feriado.
 * `esHabil` se reemplaza solo en las pruebas.
 */
export function ultimoDiaHabil(anio: number, mes: number, esHabil: (fecha: Dia) => boolean = esDiaHabil): Dia {
  for (let dia = diasDelMes(anio, mes); dia >= 1; dia--) {
    const fecha = { anio, mes, dia }
    if (esHabil(fecha)) return fecha
  }
  // Imposible con un calendario real: un mes siempre tiene días de semana sin feriado.
  throw new Error(`El mes ${mes}/${anio} no tiene días hábiles`)
}

export function esUltimoDiaHabil(fecha: Dia): boolean {
  return ultimoDiaHabil(fecha.anio, fecha.mes).dia === fecha.dia
}
