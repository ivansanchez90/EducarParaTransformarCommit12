/**
 * Facturación mensual (administración) y PDF de la factura (administración y
 * la familia del alumno).
 *
 * Las rutas de las familias sobre facturas (órdenes de pago, comprobantes)
 * viven en `portalFinanzas.ts`; las dos se montan en /api/facturas.
 */
import { Router } from 'express'
import { HttpError, fecha, hoyISO, id, lista, numOrNull } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { ROLES_ADMIN, assertAccesoAlumno, esStaff, requireAuth, requireRole } from '../middleware/auth.js'
import { estadoFactura } from '../services/facturacion/estado.js'
import { generarFacturas } from '../services/facturacion/generar.js'
import { crearPeriodo } from '../services/facturacion/periodo.js'
import { pdfFactura } from '../services/facturacion/pdf.js'

export const facturasRouter = Router()
facturasRouter.use(requireAuth)

/** Genera las facturas del mes: `{ anio, mes }` → `{ generadas, omitidas, errores[] }`. */
facturasRouter.post('/generar', requireRole(...ROLES_ADMIN), async (req, res) => {
  const resultado = await generarFacturas(Number(req.body?.anio), Number(req.body?.mes))
  res.status(201).json(resultado)
})

/**
 * Facturas de un mes con sus ítems: ?anio=2026&mes=11, y opcional
 * ?estado=Vencida,Pago parcial. El estado se calcula con el saldo y la fecha
 * de hoy.
 */
facturasRouter.get('/', requireRole(...ROLES_ADMIN), async (req, res) => {
  const { anio, mes } = crearPeriodo(numOrNull(req.query.anio) ?? NaN, numOrNull(req.query.mes) ?? NaN)
  const estados = lista(req.query.estado)
  const hoy = fecha(hoyISO())!
  const facturas = await prisma.factura.findMany({
    where: { anio, mes },
    include: {
      items: { orderBy: { id_item: 'asc' } },
      alumnos: {
        select: { nombre: true, apellido: true, dni: true, cursos: { select: { nivel: true, grado_anio: true, division: true } } },
      },
    },
    orderBy: [{ alumnos: { apellido: 'asc' } }, { alumnos: { nombre: 'asc' } }],
  })
  const conEstado = facturas.map((f) => ({
    ...f,
    estado: estadoFactura(
      { total: f.total.toNumber(), saldo: f.saldo.toNumber(), fecha_vencimiento: f.fecha_vencimiento },
      hoy,
    ),
  }))
  res.json(estados ? conEstado.filter((f) => estados.includes(f.estado)) : conEstado)
})

/**
 * PDF de la factura: la administración o la familia del alumno. Los docentes
 * no ven datos de pagos (`assertAccesoAlumno` deja pasar a todo el personal).
 */
facturasRouter.get('/:id/pdf', async (req, res) => {
  const idFactura = id(req.params.id)
  const factura = await prisma.factura.findUnique({ where: { id_factura: idFactura }, select: { id_alumno: true } })
  if (!factura) throw new HttpError(404, 'Factura no encontrada')
  if (!ROLES_ADMIN.includes(req.user!.rol)) {
    if (esStaff(req.user!)) throw new HttpError(403, 'No tenés permisos para esta acción')
    await assertAccesoAlumno(req.user!, factura.id_alumno)
  }

  const { archivo, pdf } = await pdfFactura(idFactura)
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${archivo}.pdf"`)
  res.send(pdf)
})
