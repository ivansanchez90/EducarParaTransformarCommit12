/**
 * Tarifas: precio de la cuota por nivel, de cada deporte, de cada recorrido de
 * transporte y del comedor, con la fecha desde la que rigen.
 *
 * Una tarifa que ya empezó a regir no se edita ni se borra: para cambiar el
 * precio se carga una nueva con la fecha desde la que vale. Así queda el
 * historial y se ve qué precio se usó en cada mes.
 */
import { Router } from 'express'
import type { Tarifa } from '../generated/prisma/client.js'
import { HttpError, fecha, fechaObligatoria, hoyISO, id, numOrNull, textOrNull } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { ROLES_ADMIN, requireAuth, requireRole } from '../middleware/auth.js'
import {
  CONCEPTOS_TARIFA,
  claveTarifa,
  itemsCobrables,
  nivelesEducativos,
  tarifasVigentes,
  type ReferenciaTarifa,
} from '../services/tarifas.js'

export const tarifasRouter = Router()
tarifasRouter.use(requireAuth, requireRole(...ROLES_ADMIN))

/** Vigente = la que rige hoy · Programada = empieza más adelante · Anterior = reemplazada. */
type EstadoTarifa = 'Vigente' | 'Programada' | 'Anterior'

const hoy = () => fecha(hoyISO())!

/** Nombre de lo que se cobra, para mostrar ("Cuota Primario", "Fútbol", "Recorrido Norte"). */
async function nombresDeReferencias(tarifas: Tarifa[]): Promise<(t: Tarifa) => string> {
  const ids = (concepto: string) =>
    [...new Set(tarifas.filter((t) => t.concepto === concepto && t.id_referencia).map((t) => t.id_referencia!))]
  const [actividades, recorridos] = await Promise.all([
    prisma.actividadExtracurricular.findMany({
      where: { id_actividad: { in: ids('Deporte') } },
      select: { id_actividad: true, nombre: true },
    }),
    prisma.recorridoTransporte.findMany({
      where: { id_recorrido: { in: ids('Transporte') } },
      select: { id_recorrido: true, nombre: true },
    }),
  ])
  const deporte = new Map(actividades.map((a) => [a.id_actividad, a.nombre]))
  const recorrido = new Map(recorridos.map((r) => [r.id_recorrido, r.nombre]))
  return (t) => {
    if (t.concepto === 'Cuota') return `Cuota ${t.nivel}`
    if (t.concepto === 'Deporte') return deporte.get(t.id_referencia!) ?? `Deporte #${t.id_referencia}`
    if (t.concepto === 'Transporte') return recorrido.get(t.id_referencia!) ?? `Recorrido #${t.id_referencia}`
    return t.concepto
  }
}

/** Listado con el nombre de lo que se cobra y el estado. Filtro opcional: ?concepto=Deporte */
tarifasRouter.get('/', async (req, res) => {
  const concepto = textOrNull(req.query.concepto) ?? undefined
  const [tarifas, vigentes] = await Promise.all([
    prisma.tarifa.findMany({
      where: { concepto },
      orderBy: [{ concepto: 'asc' }, { nivel: 'asc' }, { id_referencia: 'asc' }, { vigente_desde: 'desc' }],
    }),
    tarifasVigentes(hoy()),
  ])
  const nombre = await nombresDeReferencias(tarifas)
  const desdeHoy = hoy().getTime()
  res.json(
    tarifas.map((t) => {
      const estado: EstadoTarifa =
        vigentes.get(claveTarifa(t))?.id_tarifa === t.id_tarifa
          ? 'Vigente'
          : t.vigente_desde.getTime() > desdeHoy
            ? 'Programada'
            : 'Anterior'
      return { ...t, referencia: nombre(t), estado }
    }),
  )
})

/**
 * Lo que necesita el formulario: niveles, deportes y recorridos para elegir,
 * y la lista de lo que hoy no tiene precio (la facturación no lo podría cobrar).
 */
tarifasRouter.get('/opciones', async (_req, res) => {
  const [items, vigentes] = await Promise.all([itemsCobrables(), tarifasVigentes(hoy())])
  const deConcepto = (concepto: string) =>
    items.filter((i) => i.concepto === concepto).map((i) => ({ id: i.id_referencia!, nombre: i.nombre }))
  res.json({
    niveles: items.filter((i) => i.concepto === 'Cuota').map((i) => i.nivel!),
    deportes: deConcepto('Deporte'),
    recorridos: deConcepto('Transporte'),
    sin_precio: items.filter((i) => !vigentes.has(claveTarifa(i))),
  })
})

/** Valida concepto y referencia: cada concepto lleva exactamente la referencia que le corresponde. */
async function referenciaValida(body: Record<string, unknown>) {
  const concepto = String(body.concepto ?? '')
  if (!(CONCEPTOS_TARIFA as readonly string[]).includes(concepto)) throw new HttpError(400, 'Concepto inválido')

  if (concepto === 'Cuota') {
    const nivel = textOrNull(body.nivel)
    if (!nivel) throw new HttpError(400, 'Elegí el nivel educativo de la cuota')
    if (!(await nivelesEducativos()).includes(nivel)) throw new HttpError(400, `No hay cursos activos del nivel ${nivel}`)
    return { concepto, nivel, id_referencia: null }
  }
  if (concepto === 'Comedor') return { concepto, nivel: null, id_referencia: null }

  const idReferencia = numOrNull(body.id_referencia)
  if (!idReferencia) throw new HttpError(400, concepto === 'Deporte' ? 'Elegí el deporte' : 'Elegí el recorrido')
  if (concepto === 'Deporte') {
    const actividad = await prisma.actividadExtracurricular.findUnique({
      where: { id_actividad: idReferencia },
      select: { tipo: true },
    })
    if (actividad?.tipo !== 'Deporte') throw new HttpError(400, 'El deporte no existe')
  } else {
    const recorrido = await prisma.recorridoTransporte.findUnique({ where: { id_recorrido: idReferencia } })
    if (!recorrido) throw new HttpError(400, 'El recorrido no existe')
  }
  return { concepto, nivel: null, id_referencia: idReferencia }
}

function importeValido(valor: unknown): number {
  const importe = Number(valor)
  if (!(importe > 0) || importe >= 1e10) throw new HttpError(400, 'El importe debe ser mayor a 0')
  if (Math.round(importe * 100) !== importe * 100) throw new HttpError(400, 'El importe admite hasta 2 decimales')
  return importe
}

/** Dos tarifas de lo mismo no pueden empezar el mismo día: no se sabría cuál rige. */
async function assertSinDuplicado(ref: ReferenciaTarifa, desde: Date, excepto?: number) {
  const duplicada = await prisma.tarifa.findFirst({
    where: {
      concepto: ref.concepto,
      nivel: ref.nivel ?? null,
      id_referencia: ref.id_referencia ?? null,
      vigente_desde: desde,
      id_tarifa: excepto ? { not: excepto } : undefined,
    },
    select: { id_tarifa: true },
  })
  if (duplicada) {
    throw new HttpError(409, 'Ya hay una tarifa de ese concepto que empieza ese mismo día. Editala en lugar de cargar otra.')
  }
}

tarifasRouter.post('/', async (req, res) => {
  const body = req.body ?? {}
  const ref = await referenciaValida(body)
  const importe = importeValido(body.importe)
  const desde = fechaObligatoria(body.vigente_desde, 'fecha desde la que rige')
  await assertSinDuplicado(ref, desde)
  const tarifa = await prisma.tarifa.create({ data: { ...ref, importe, vigente_desde: desde } })
  res.status(201).json(tarifa)
})

/** Solo una tarifa programada (que todavía no rige) se puede corregir o borrar. */
async function tarifaProgramada(idTarifa: number) {
  const tarifa = await prisma.tarifa.findUnique({ where: { id_tarifa: idTarifa } })
  if (!tarifa) throw new HttpError(404, 'Tarifa no encontrada')
  if (tarifa.vigente_desde.getTime() <= hoy().getTime()) {
    throw new HttpError(
      409,
      'Esta tarifa ya está en vigencia y no se puede modificar. Para cambiar el precio, cargá una tarifa nueva con la fecha desde la que rige.',
    )
  }
  return tarifa
}

/** Corrige importe y fecha de una tarifa programada (el concepto y la referencia no cambian). */
tarifasRouter.put('/:id', async (req, res) => {
  const actual = await tarifaProgramada(id(req.params.id))
  const body = req.body ?? {}
  const importe = importeValido(body.importe)
  const desde = fechaObligatoria(body.vigente_desde, 'fecha desde la que rige')
  await assertSinDuplicado(actual, desde, actual.id_tarifa)
  const tarifa = await prisma.tarifa.update({
    where: { id_tarifa: actual.id_tarifa },
    data: { importe, vigente_desde: desde },
  })
  res.json(tarifa)
})

tarifasRouter.delete('/:id', async (req, res) => {
  const tarifa = await tarifaProgramada(id(req.params.id))
  await prisma.tarifa.delete({ where: { id_tarifa: tarifa.id_tarifa } })
  res.status(204).end()
})
