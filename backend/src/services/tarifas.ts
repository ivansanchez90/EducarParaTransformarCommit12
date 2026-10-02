/**
 * Precios por concepto con vigencia.
 *
 * Una tarifa rige desde `vigente_desde` hasta que empieza otra del mismo
 * concepto y referencia. Cambiar un precio es cargar una tarifa nueva: las
 * facturas guardan su importe, así que las ya emitidas no cambian.
 *
 * Lo usan la pantalla de tarifas, la facturación (T08) y el portal (T19).
 */
import type { Tarifa } from '../generated/prisma/client.js'
import { prisma } from '../lib/prisma.js'

export const CONCEPTOS_TARIFA = ['Cuota', 'Deporte', 'Transporte', 'Comedor'] as const
export type ConceptoTarifa = (typeof CONCEPTOS_TARIFA)[number]

/** Qué se cobra: concepto + nivel (Cuota) o id de actividad/recorrido (Deporte/Transporte). */
export interface ReferenciaTarifa {
  concepto: string
  nivel?: string | null
  id_referencia?: number | null
}

export function claveTarifa({ concepto, nivel, id_referencia }: ReferenciaTarifa): string {
  return `${concepto}|${nivel ?? ''}|${id_referencia ?? ''}`
}

/**
 * Tarifas vigentes en `fecha`, por clave: para cada concepto y referencia, la
 * de `vigente_desde` más reciente que no sea posterior a `fecha`.
 */
export async function tarifasVigentes(fecha: Date): Promise<Map<string, Tarifa>> {
  const tarifas = await prisma.tarifa.findMany({
    where: { vigente_desde: { lte: fecha } },
    orderBy: [{ vigente_desde: 'desc' }, { id_tarifa: 'desc' }],
  })
  const vigentes = new Map<string, Tarifa>()
  for (const t of tarifas) {
    const clave = claveTarifa(t)
    if (!vigentes.has(clave)) vigentes.set(clave, t)
  }
  return vigentes
}

/** Niveles educativos que existen en los cursos activos (la cuota se cobra por nivel). */
export async function nivelesEducativos(): Promise<string[]> {
  const cursos = await prisma.curso.findMany({
    where: { activo: true },
    select: { nivel: true },
    distinct: ['nivel'],
    orderBy: { nivel: 'asc' },
  })
  return cursos.map((c) => c.nivel)
}

export interface ItemCobrable extends ReferenciaTarifa {
  nombre: string
}

/**
 * Todo lo que se puede cobrar hoy: un ítem por nivel, por deporte activo,
 * por recorrido activo y el comedor.
 */
export async function itemsCobrables(): Promise<ItemCobrable[]> {
  const [niveles, deportes, recorridos] = await Promise.all([
    nivelesEducativos(),
    prisma.actividadExtracurricular.findMany({
      where: { tipo: 'Deporte', activo: true },
      select: { id_actividad: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.recorridoTransporte.findMany({
      where: { activo: true },
      select: { id_recorrido: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
  ])
  return [
    ...niveles.map((nivel) => ({ concepto: 'Cuota', nivel, nombre: `Cuota ${nivel}` })),
    ...deportes.map((d) => ({ concepto: 'Deporte', id_referencia: d.id_actividad, nombre: d.nombre })),
    ...recorridos.map((r) => ({ concepto: 'Transporte', id_referencia: r.id_recorrido, nombre: r.nombre })),
    { concepto: 'Comedor', nombre: 'Comedor' },
  ]
}
