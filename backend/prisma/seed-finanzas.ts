/**
 * Parte financiera del seed de demostración: tarifas, facturas de los últimos dos meses,
 * órdenes de pago y comprobantes de transferencia en todos sus estados, con los pagos
 * aprobados imputados a los ítems. Sirve para probar el portal, la bandeja de comprobantes
 * y los reportes sin cargar nada a mano.
 *
 * Las facturas no se inventan: se generan con el mismo motor que usa el botón "Generar
 * facturas" (`generarFacturas`) y los pagos se aplican con `aplicarPago`, así la demo cumple
 * los mismos invariantes que producción (total = suma de ítems, saldo = suma de saldos).
 *
 * Las cuotas viejas (tabla `cuotas`) llegan hasta dos meses antes del actual: son el
 * historial anterior al sistema de facturas, como el que dejó la migración de T01.
 */
import fs from 'node:fs'
import type { PrismaClient } from '../src/generated/prisma/client.js'

interface AlumnoDemo {
  id_alumno: number
  id_padre: string
}

interface Contexto {
  prisma: PrismaClient
  anio: number
  mesActual: number
  alumnos: AlumnoDemo[]
  /** Usuario que revisa los comprobantes (la directora). */
  idRevisor: string
  /** Generadores del seed (el mismo random reproducible). */
  azar: () => number
  entre: (min: number, max: number) => number
  fecha: (anio: number, mes: number, dia: number) => Date
}

// Cuánto cuesta cada cosa al empezar el ciclo. El comedor sube en el mes actual para mostrar
// que un cambio de precio no toca las facturas ya emitidas.
const CUOTA_POR_NIVEL: Record<string, number> = { Inicial: 70000, Primario: 85000, Secundario: 100000 }
const PRECIO_DEPORTE = [12000, 12500, 14000, 15000, 16500]
const PRECIO_TRANSPORTE = [8000, 9500, 11000, 12500]
const PRECIO_COMEDOR = 22000
const PRECIO_COMEDOR_NUEVO = 24500

const ARCHIVO_COMPROBANTE = 'demo-comprobante.png'
// Un PNG de 1×1 píxel: alcanza para que la descarga del comprobante de demo funcione.
const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

type Escenario = 'pagada' | 'parcial' | 'revision' | 'rechazada' | 'sinPago'

/** Cómo se reparten las facturas de un mes: el mes ya vencido está más pago que el que recién corre. */
const REPARTO: { pagada: number; parcial: number; revision: number; rechazada: number } = { pagada: 0.6, parcial: 0.12, revision: 0.08, rechazada: 0.05 }
const REPARTO_MES_ACTUAL = { pagada: 0.35, parcial: 0.05, revision: 0.1, rechazada: 0.03 }

function escenarioDe(azar: number, reparto: typeof REPARTO): Escenario {
  if (azar < reparto.pagada) return 'pagada'
  if (azar < reparto.pagada + reparto.parcial) return 'parcial'
  if (azar < reparto.pagada + reparto.parcial + reparto.revision) return 'revision'
  if (azar < reparto.pagada + reparto.parcial + reparto.revision + reparto.rechazada) return 'rechazada'
  return 'sinPago'
}

const MOTIVOS_RECHAZO = ['La imagen no se ve', 'El importe no coincide con la transferencia', 'No encontramos la transferencia en la cuenta']

async function cargarTarifas({ prisma, anio, mesActual, fecha }: Contexto) {
  const [niveles, deportes, recorridos] = await Promise.all([
    prisma.curso.findMany({ distinct: ['nivel'], select: { nivel: true } }),
    prisma.actividadExtracurricular.findMany({ where: { tipo: 'Deporte' }, select: { id_actividad: true }, orderBy: { id_actividad: 'asc' } }),
    prisma.recorridoTransporte.findMany({ select: { id_recorrido: true }, orderBy: { id_recorrido: 'asc' } }),
  ])
  const inicio = fecha(anio, 3, 1)
  const tarifas = [
    ...niveles.map((n) => ({ concepto: 'Cuota', nivel: n.nivel, id_referencia: null, importe: CUOTA_POR_NIVEL[n.nivel] ?? 85000, vigente_desde: inicio })),
    ...deportes.map((d, i) => ({ concepto: 'Deporte', nivel: null, id_referencia: d.id_actividad, importe: PRECIO_DEPORTE[i % PRECIO_DEPORTE.length], vigente_desde: inicio })),
    ...recorridos.map((r, i) => ({ concepto: 'Transporte', nivel: null, id_referencia: r.id_recorrido, importe: PRECIO_TRANSPORTE[i % PRECIO_TRANSPORTE.length], vigente_desde: inicio })),
    { concepto: 'Comedor', nivel: null, id_referencia: null, importe: PRECIO_COMEDOR, vigente_desde: inicio },
  ]
  // Un aumento del comedor desde el mes actual (si el ciclo ya está en marcha).
  if (mesActual >= 4) tarifas.push({ concepto: 'Comedor', nivel: null, id_referencia: null, importe: PRECIO_COMEDOR_NUEVO, vigente_desde: fecha(anio, mesActual, 1) })
  await prisma.tarifa.createMany({ data: tarifas })
}

/**
 * Registra, sobre una factura, lo que hizo la familia según el escenario: sube un comprobante y,
 * si la administración lo aprobó, aplica el pago con el motor real (imputación a los ítems).
 */
async function simularCobro(ctx: Contexto, factura: { id_factura: number; saldo: number; items: { id_item: number; saldo: number }[] }, idPadre: string, escenario: Escenario, mes: number) {
  const { prisma, anio, azar, entre, fecha } = ctx
  if (escenario === 'sinPago') return

  const hoy = new Date()
  const diaMaximo = mes === hoy.getUTCMonth() + 1 ? Math.min(hoy.getUTCDate(), 28) : 9
  const transferencia = fecha(anio, mes, entre(1, Math.max(1, diaMaximo)))
  const cargado = new Date(transferencia.getTime() + 12 * 3600 * 1000)
  const revisado = new Date(Math.min(Date.now(), cargado.getTime() + 26 * 3600 * 1000))

  // El pago parcial es la mitad del saldo, redondeada a pesos.
  const importe = escenario === 'parcial' ? Math.max(1, Math.round(factura.saldo / 2)) : factura.saldo

  // Muchas familias pagan desde la orden de pago; el parcial es una transferencia suelta. La orden se
  // emite con el servicio real, así una factura con beca sale con su total neto, como en producción.
  let idOrden: number | null = null
  if (escenario !== 'parcial' && azar() < 0.55) {
    const { crearOrdenPago } = await import('../src/services/ordenPago.js')
    const orden = await crearOrdenPago(factura.id_factura, factura.items.filter((i) => i.saldo > 0).map((i) => i.id_item), idPadre)
    await prisma.ordenPago.update({ where: { id_orden: orden.id_orden }, data: { fecha: cargado } })
    idOrden = orden.id_orden
  }

  const aprobado = escenario === 'pagada' || escenario === 'parcial'
  const datos = {
    id_factura: factura.id_factura,
    id_orden: idOrden,
    archivo: ARCHIVO_COMPROBANTE,
    importe,
    fecha_transferencia: transferencia,
    estado: aprobado ? 'Aprobado' : escenario === 'rechazada' ? 'Rechazado' : 'En revisión',
    motivo_rechazo: escenario === 'rechazada' ? MOTIVOS_RECHAZO[entre(0, MOTIVOS_RECHAZO.length - 1)] : null,
    id_usuario_carga: idPadre,
    fecha_carga: cargado,
    id_usuario_revisa: escenario === 'revision' ? null : ctx.idRevisor,
    fecha_revision: escenario === 'revision' ? null : revisado,
  }

  if (!aprobado) {
    await prisma.comprobanteTransferencia.create({ data: datos })
    return
  }
  const { aplicarPago } = await import('../src/services/saldos.js')
  await prisma.$transaction(async (tx) => {
    const comprobante = await tx.comprobanteTransferencia.create({ data: datos })
    await aplicarPago(tx, {
      id_factura: factura.id_factura,
      importe,
      id_comprobante: comprobante.id_comprobante,
      id_orden: idOrden,
      fecha_pago: revisado,
      id_usuario_registra: ctx.idRevisor,
    })
  })
}

/** Facturas del mes con sus ítems, listas para recorrer. */
async function facturasDelMes(prisma: PrismaClient, anio: number, mes: number) {
  const facturas = await prisma.factura.findMany({
    where: { anio, mes },
    select: { id_factura: true, id_alumno: true, saldo: true, items: { select: { id_item: true, saldo: true }, orderBy: { id_item: 'asc' } } },
    orderBy: { id_alumno: 'asc' },
  })
  return facturas.map((f) => ({
    id_factura: f.id_factura,
    id_alumno: f.id_alumno,
    saldo: f.saldo.toNumber(),
    items: f.items.map((i) => ({ id_item: i.id_item, saldo: i.saldo.toNumber() })),
  }))
}

export interface ResumenFinanzas {
  facturas: number
  errores: number
  comprobantes: number
}

/**
 * Carga tarifas, factura el mes anterior y el actual y simula los cobros. Se llama una vez,
 * al final de la carga del seed, cuando ya existen alumnos, cursos, servicios y vigencias.
 */
export async function cargarFinanzas(ctx: Contexto): Promise<ResumenFinanzas> {
  const { prisma, anio, mesActual, alumnos } = ctx

  await cargarTarifas(ctx)

  // El comprobante de demo que todos los registros apuntan: la descarga lo encuentra en el bucket privado.
  fs.mkdirSync('uploads/comprobantes', { recursive: true })
  fs.writeFileSync('uploads/comprobantes/demo-comprobante.png', Buffer.from(PNG_1X1, 'base64'))

  // Las dependencias de la app (que exigen JWT_SECRET) se cargan recién acá, y se cierran al terminar.
  process.env.JWT_SECRET ??= 'seed-demo'
  const { generarFacturas } = await import('../src/services/facturacion/generar.js')
  const { prisma: clienteApp } = await import('../src/lib/prisma.js')

  const padreDe = new Map(alumnos.map((a) => [a.id_alumno, a.id_padre]))
  // Se factura el mes anterior (ya vencido) y el actual; antes del inicio de clases no hay nada que facturar.
  const meses = [mesActual - 1, mesActual].filter((m) => m >= 3 && m <= 12)
  const resumen: ResumenFinanzas = { facturas: 0, errores: 0, comprobantes: 0 }

  try {
    for (const mes of meses) {
      const resultado = await generarFacturas(anio, mes)
      resumen.facturas += resultado.generadas
      resumen.errores += resultado.errores.length
      const reparto = mes === mesActual ? REPARTO_MES_ACTUAL : REPARTO
      for (const factura of await facturasDelMes(prisma, anio, mes)) {
        const idPadre = padreDe.get(factura.id_alumno)
        if (!idPadre || factura.saldo <= 0) continue
        const escenario = escenarioDe(ctx.azar(), reparto)
        await simularCobro(ctx, factura, idPadre, escenario, mes)
        if (escenario !== 'sinPago') resumen.comprobantes += 1
      }
    }
  } finally {
    await clienteApp.$disconnect()
  }
  return resumen
}
