/**
 * Gestión administrativa y comercial: cuotas, pagos, becas, sueldos y compras.
 */
import { Router } from 'express'
import { HttpError, fecha, hoyISO, id, lista, numOrNull, textOrNull } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { nombreApellido } from '../lib/selects.js'
import { ROLES_ADMIN, requireAuth, requireRole } from '../middleware/auth.js'
import { notificarFamilias } from '../services/notificaciones.js'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Tarjeta de débito', 'Tarjeta de crédito', 'Cheque', 'Otro']
const DESTINOS_INSUMO = [
  'Laboratorio de computación',
  'Laboratorio de física',
  'Laboratorio de química',
  'Enfermería',
]

function mesAnio(body: Record<string, unknown>) {
  const mes = Number(body.mes)
  const anio = Number(body.anio)
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) throw new HttpError(400, 'Mes inválido')
  if (!Number.isInteger(anio) || anio < 2000) throw new HttpError(400, 'Año inválido')
  return { mes, anio }
}

// ── Cuotas ─────────────────────────────────────────────────────

export const cuotasRouter = Router()
cuotasRouter.use(requireAuth, requireRole(...ROLES_ADMIN))

/** Listado con filtros opcionales: ?estado=Pendiente,Vencida&anio=2026&mes=3&limit=50&orden=asc */
cuotasRouter.get('/', async (req, res) => {
  const estados = lista(req.query.estado)
  const cuotas = await prisma.cuota.findMany({
    where: {
      estado: estados ? { in: estados } : undefined,
      anio: numOrNull(req.query.anio) ?? undefined,
      mes: numOrNull(req.query.mes) ?? undefined,
    },
    include: { alumnos: nombreApellido },
    orderBy: { fecha_vencimiento: req.query.orden === 'asc' ? 'asc' : 'desc' },
    take: numOrNull(req.query.limit) ?? undefined,
  })
  res.json(cuotas)
})

/**
 * Genera las cuotas de un mes para todos los alumnos activos, aplicando el
 * descuento de las becas activas. Si la cuota ya existe se actualiza.
 */
cuotasRouter.post('/generar', async (req, res) => {
  const { mes, anio } = mesAnio(req.body ?? {})
  const montoBase = Number(req.body?.monto_base)
  if (!(montoBase > 0)) throw new HttpError(400, 'El monto base debe ser mayor a 0')

  const alumnos = await prisma.alumno.findMany({ where: { activo: true }, select: { id_alumno: true } })
  if (alumnos.length === 0) throw new HttpError(400, 'No hay alumnos activos.')

  const becas = await prisma.beca.findMany({ where: { activo: true }, select: { id_alumno: true, porcentaje: true } })
  const becaPorAlumno = new Map(becas.map((b) => [b.id_alumno, b.porcentaje.toNumber()]))
  const vencimiento = new Date(Date.UTC(anio, mes - 1, 10)) // vence el 10 de cada mes

  await prisma.$transaction(
    alumnos.map((a) => {
      const descuento = Math.round((montoBase * (becaPorAlumno.get(a.id_alumno) ?? 0)) / 100)
      const datos = { monto_base: montoBase, recargo: 0, descuento, fecha_vencimiento: vencimiento }
      return prisma.cuota.upsert({
        where: { id_alumno_mes_anio: { id_alumno: a.id_alumno, mes, anio } },
        create: { id_alumno: a.id_alumno, mes, anio, estado: 'Pendiente', ...datos },
        update: datos,
      })
    }),
  )
  res.status(201).json({ generadas: alumnos.length })
})

/** Marca como vencidas las cuotas pendientes pasadas de fecha y notifica a las familias. */
cuotasRouter.post('/procesar-vencimientos', async (_req, res) => {
  const vencidas = await prisma.cuota.findMany({
    where: { estado: 'Pendiente', fecha_vencimiento: { lt: fecha(hoyISO())! } },
    select: { id_cuota: true, id_alumno: true, mes: true, anio: true },
  })
  if (vencidas.length === 0) {
    res.json({ vencidas: 0 })
    return
  }
  await prisma.cuota.updateMany({
    where: { id_cuota: { in: vencidas.map((c) => c.id_cuota) } },
    data: { estado: 'Vencida' },
  })
  await notificarFamilias(
    vencidas.map((c) => ({
      id_alumno: c.id_alumno,
      titulo: 'Cuota vencida',
      mensaje: `La cuota de ${MESES[c.mes - 1]} ${c.anio} se encuentra vencida. Te pedimos regularizar el pago.`,
    })),
    'Cuota',
  )
  res.json({ vencidas: vencidas.length })
})

/** Historial de pagos (más recientes primero). Filtro opcional: ?id_cuota=N */
cuotasRouter.get('/pagos', async (req, res) => {
  const pagos = await prisma.pago.findMany({
    where: { id_cuota: numOrNull(req.query.id_cuota) ?? undefined },
    include: {
      cuotas: { select: { mes: true, anio: true, alumnos: nombreApellido } },
      usuarios: nombreApellido,
    },
    orderBy: [{ fecha_pago: 'desc' }, { id_pago: 'desc' }],
    take: Math.min(numOrNull(req.query.limit) ?? 100, 500),
  })
  // En `pagos`, fecha_pago es fecha y hora (en `cuotas` es solo fecha): se
  // envía el ISO completo para que el serializador no la recorte.
  res.json(pagos.map((p) => ({ ...p, fecha_pago: p.fecha_pago?.toISOString() ?? null })))
})

/**
 * Registra el pago de una cuota: la marca como pagada y deja el movimiento en
 * el historial de `pagos` (monto, método y quién lo registró), todo junto.
 */
cuotasRouter.patch('/:id/pago', async (req, res) => {
  const idCuota = id(req.params.id)
  const metodo = String(req.body?.metodo_pago ?? '')
  if (!METODOS_PAGO.includes(metodo)) throw new HttpError(400, 'Método de pago inválido')
  const hoy = hoyISO()
  const diaPago = textOrNull(req.body?.fecha_pago) ?? hoy

  const cuota = await prisma.$transaction(async (tx) => {
    // Bloquea la cuota para que dos registros simultáneos no generen dos pagos.
    await tx.$queryRaw`SELECT 1 FROM cuotas WHERE id_cuota = ${idCuota} FOR UPDATE`
    const actual = await tx.cuota.findUnique({ where: { id_cuota: idCuota } })
    if (!actual) throw new HttpError(404, 'Cuota no encontrada')
    if (actual.estado === 'Pagada') throw new HttpError(409, 'La cuota ya está pagada')

    const monto = actual.monto_base.plus(actual.recargo ?? 0).minus(actual.descuento ?? 0)
    await tx.pago.create({
      data: {
        id_cuota: idCuota,
        // Pago de hoy: fecha y hora reales. Pago con otra fecha: mediodía de ese
        // día, para que no se corra al día anterior al mostrarlo en hora local.
        fecha_pago: diaPago === hoy ? new Date() : new Date(`${diaPago}T12:00:00Z`),
        monto_pagado: monto,
        metodo_pago: metodo,
        nro_comprobante: textOrNull(req.body?.nro_comprobante),
        observaciones: textOrNull(req.body?.observaciones),
        id_usuario_registra: req.user!.id_usuario,
      },
    })
    return tx.cuota.update({
      where: { id_cuota: idCuota },
      data: { estado: 'Pagada', fecha_pago: fecha(diaPago), metodo_pago: metodo },
    })
  })
  res.json(cuota)
})

// ── Becas ──────────────────────────────────────────────────────

export const becasRouter = Router()
becasRouter.use(requireAuth, requireRole(...ROLES_ADMIN))

becasRouter.get('/', async (_req, res) => {
  const becas = await prisma.beca.findMany({
    include: { alumnos: nombreApellido },
    orderBy: [{ fecha_otorgamiento: 'desc' }, { id_beca: 'desc' }],
  })
  res.json(becas)
})

/** Otorga o actualiza la beca de un alumno (una beca por alumno). */
becasRouter.put('/', async (req, res) => {
  const idAlumno = id(req.body?.id_alumno)
  const porcentaje = Number(req.body?.porcentaje)
  if (!(porcentaje > 0 && porcentaje <= 100)) throw new HttpError(400, 'El porcentaje debe estar entre 1 y 100')
  const datos = { porcentaje, motivo: textOrNull(req.body?.motivo), activo: true }
  const beca = await prisma.beca.upsert({
    where: { id_alumno: idAlumno },
    create: { id_alumno: idAlumno, ...datos },
    update: datos,
  })
  res.json(beca)
})

becasRouter.patch('/:id', async (req, res) => {
  const beca = await prisma.beca.update({
    where: { id_beca: id(req.params.id) },
    data: { activo: typeof req.body?.activo === 'boolean' ? req.body.activo : undefined },
  })
  res.json(beca)
})

becasRouter.delete('/:id', async (req, res) => {
  await prisma.beca.delete({ where: { id_beca: id(req.params.id) } })
  res.status(204).end()
})

// ── Sueldos ────────────────────────────────────────────────────

export const sueldosRouter = Router()
sueldosRouter.use(requireAuth, requireRole(...ROLES_ADMIN))

sueldosRouter.get('/', async (_req, res) => {
  const sueldos = await prisma.sueldo.findMany({
    include: { usuarios: { select: { nombre: true, apellido: true, rol: true } } },
    orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
  })
  res.json(sueldos)
})

sueldosRouter.post('/', async (req, res) => {
  const { mes, anio } = mesAnio(req.body ?? {})
  const monto = Number(req.body?.monto)
  if (!(monto >= 0)) throw new HttpError(400, 'Monto inválido')
  const sueldo = await prisma.sueldo.create({
    data: { id_usuario: String(req.body?.id_usuario), mes, anio, monto, estado: 'Pendiente' },
  })
  res.status(201).json(sueldo)
})

sueldosRouter.patch('/:id/pagar', async (req, res) => {
  const sueldo = await prisma.sueldo.update({
    where: { id_sueldo: id(req.params.id) },
    data: { estado: 'Pagado', fecha_pago: fecha(hoyISO()) },
  })
  res.json(sueldo)
})

// ── Compras de insumos ─────────────────────────────────────────

export const comprasRouter = Router()
comprasRouter.use(requireAuth, requireRole(...ROLES_ADMIN))

comprasRouter.get('/', async (_req, res) => {
  const compras = await prisma.compraInsumo.findMany({
    orderBy: [{ fecha_compra: 'desc' }, { id_compra: 'desc' }],
  })
  res.json(compras)
})

comprasRouter.post('/', async (req, res) => {
  const body = req.body ?? {}
  if (!DESTINOS_INSUMO.includes(body.destino)) throw new HttpError(400, 'Destino inválido')
  const cantidad = Number(body.cantidad)
  const monto = Number(body.monto)
  if (!(cantidad > 0) || !(monto >= 0)) throw new HttpError(400, 'Cantidad o monto inválidos')
  const compra = await prisma.compraInsumo.create({
    data: {
      descripcion: String(body.descripcion ?? ''),
      destino: body.destino,
      cantidad,
      monto,
      proveedor: textOrNull(body.proveedor),
      fecha_compra: fecha(body.fecha_compra) ?? undefined,
    },
  })
  res.status(201).json(compra)
})

comprasRouter.delete('/:id', async (req, res) => {
  await prisma.compraInsumo.delete({ where: { id_compra: id(req.params.id) } })
  res.status(204).end()
})
