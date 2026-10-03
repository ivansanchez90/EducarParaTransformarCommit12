/**
 * Bandeja de comprobantes (T14): permisos, validaciones, doble revisión y aviso
 * a la familia. La imputación se prueba aparte (`saldos.test.ts`) y el flujo
 * completo, contra una base real (ver PLAN-P3.md).
 */
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { iniciarSesionComo, prismaFalso } from './ayudas.js'

const dobles = vi.hoisted(() => ({
  tx: {
    comprobanteTransferencia: { updateMany: vi.fn(), findUnique: vi.fn() },
  },
  comprobanteTransferencia: { findMany: vi.fn(), findUnique: vi.fn() },
  factura: { findUnique: vi.fn() },
  aplicarPago: vi.fn(),
  publicar: vi.fn(),
}))

vi.mock('../src/lib/prisma.js', async () => ({
  prisma: {
    ...(await import('./ayudas.js')).prismaFalso,
    comprobanteTransferencia: dobles.comprobanteTransferencia,
    factura: dobles.factura,
    $transaction: (fn: (tx: unknown) => unknown) => fn(dobles.tx),
  },
}))
vi.mock('../src/services/saldos.js', () => ({ aplicarPago: dobles.aplicarPago }))
vi.mock('../src/services/avisos/index.js', () => ({ publicar: dobles.publicar }))

const { app } = await import('../src/app.js')

const COMPROBANTE = {
  estado: 'Aprobado',
  importe: { toString: () => '50000' },
  id_factura: 3,
  id_orden: 8,
  fecha_transferencia: new Date('2026-11-05T00:00:00Z'),
  facturas: { numero: 41, anio: 2026, mes: 11, id_alumno: 7, alumnos: { nombre: 'Ana', apellido: 'Pérez' } },
}

beforeEach(() => {
  vi.clearAllMocks()
  dobles.comprobanteTransferencia.findMany.mockResolvedValue([])
  dobles.tx.comprobanteTransferencia.updateMany.mockResolvedValue({ count: 1 })
  dobles.tx.comprobanteTransferencia.findUnique.mockResolvedValue(COMPROBANTE)
  dobles.aplicarPago.mockResolvedValue({ pago: { id_pago: 1 }, saldo: 30000, estado: 'Pago parcial' })
  dobles.factura.findUnique.mockResolvedValue({ saldo: 80000 })
})

const RUTAS: ['get' | 'patch', string][] = [
  ['get', '/api/comprobantes?estado=En revisión'],
  ['patch', '/api/comprobantes/1/aprobar'],
  ['patch', '/api/comprobantes/1/rechazar'],
]

describe('permisos', () => {
  it.each(RUTAS)('%s %s sin sesión → 401', async (metodo, ruta) => {
    expect((await request(app)[metodo](ruta)).status).toBe(401)
  })

  it.each(['Padre', 'Alumno', 'Docente'])('%s → 403 en toda la bandeja', async (rol) => {
    const token = iniciarSesionComo(rol)
    for (const [metodo, ruta] of RUTAS) {
      const res = await request(app)[metodo](ruta).set('Authorization', token).send({ importe: 1, motivo: 'x' })
      expect(res.status, `${rol} ${ruta}`).toBe(403)
    }
    expect(dobles.aplicarPago).not.toHaveBeenCalled()
  })
})

describe('GET /api/comprobantes', () => {
  it('filtra por estado; los pendientes, del más viejo al más nuevo', async () => {
    const token = iniciarSesionComo('Directivo')
    const res = await request(app).get('/api/comprobantes?estado=En revisión').set('Authorization', token)
    expect(res.status).toBe(200)
    const consulta = dobles.comprobanteTransferencia.findMany.mock.calls[0][0]
    expect(consulta.where).toEqual({ estado: { in: ['En revisión'] } })
    expect(consulta.orderBy).toEqual({ fecha_carga: 'asc' })
    // El nombre del archivo en disco no sale de la API.
    expect(consulta.select.archivo).toBeUndefined()
  })

  it('un estado que no existe → 400', async () => {
    const res = await request(app).get('/api/comprobantes?estado=Pagado').set('Authorization', iniciarSesionComo('Admin'))
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/comprobantes/:id/aprobar', () => {
  it('crea el pago con la fecha de la transferencia, imputa según la orden y avisa a la familia', async () => {
    const res = await request(app)
      .patch('/api/comprobantes/5/aprobar')
      .set('Authorization', iniciarSesionComo('Admin'))
      .send({ importe: '50000,50' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ estado: 'Aprobado', factura: { saldo: 30000, estado: 'Pago parcial' } })

    const [where] = dobles.tx.comprobanteTransferencia.updateMany.mock.calls.map((c) => c[0].where)
    expect(where).toEqual({ id_comprobante: 5, estado: 'En revisión' })
    expect(dobles.aplicarPago.mock.calls[0][1]).toMatchObject({
      id_factura: 3,
      importe: 50000.5,
      id_comprobante: 5,
      id_orden: 8,
      fecha_pago: new Date('2026-11-05T15:00:00Z'),
    })
    expect(dobles.publicar).toHaveBeenCalledWith({
      tipo: 'ComprobanteValidado',
      aprobado: true,
      id_alumno: 7,
      alumno: 'Ana Pérez',
      factura: { numero: 41, anio: 2026, mes: 11, saldo: 30000 },
      importe: 50000.5,
    })
  })

  it.each([undefined, '', 0, -10, 'abc', 10.555])('importe %s → 400 sin tocar la base', async (importe) => {
    const res = await request(app)
      .patch('/api/comprobantes/5/aprobar')
      .set('Authorization', iniciarSesionComo('Admin'))
      .send({ importe })
    expect(res.status).toBe(400)
    expect(dobles.tx.comprobanteTransferencia.updateMany).not.toHaveBeenCalled()
  })

  it('un comprobante ya revisado → 409, sin pago ni aviso', async () => {
    dobles.tx.comprobanteTransferencia.updateMany.mockResolvedValue({ count: 0 })
    const res = await request(app)
      .patch('/api/comprobantes/5/aprobar')
      .set('Authorization', iniciarSesionComo('Admin'))
      .send({ importe: 100 })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('El comprobante ya está aprobado')
    expect(dobles.aplicarPago).not.toHaveBeenCalled()
    expect(dobles.publicar).not.toHaveBeenCalled()
  })

  it('un comprobante que no existe → 404', async () => {
    dobles.tx.comprobanteTransferencia.updateMany.mockResolvedValue({ count: 0 })
    dobles.tx.comprobanteTransferencia.findUnique.mockResolvedValue(null)
    const res = await request(app)
      .patch('/api/comprobantes/99/aprobar')
      .set('Authorization', iniciarSesionComo('Admin'))
      .send({ importe: 100 })
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/comprobantes/:id/rechazar', () => {
  it('guarda el motivo y avisa a la familia', async () => {
    const res = await request(app)
      .patch('/api/comprobantes/5/rechazar')
      .set('Authorization', iniciarSesionComo('Admin'))
      .send({ motivo: '  El importe no coincide con el banco  ' })
    expect(res.status).toBe(200)
    expect(dobles.tx.comprobanteTransferencia.updateMany.mock.calls[0][0].data).toMatchObject({
      estado: 'Rechazado',
      motivo_rechazo: 'El importe no coincide con el banco',
    })
    expect(dobles.aplicarPago).not.toHaveBeenCalled()
    expect(dobles.publicar).toHaveBeenCalledWith(
      expect.objectContaining({ aprobado: false, importe: 50000, motivo: 'El importe no coincide con el banco' }),
    )
  })

  it.each([undefined, '', '   ', 'x'.repeat(301)])('motivo %s → 400', async (motivo) => {
    const res = await request(app)
      .patch('/api/comprobantes/5/rechazar')
      .set('Authorization', iniciarSesionComo('Admin'))
      .send({ motivo })
    expect(res.status).toBe(400)
    expect(dobles.tx.comprobanteTransferencia.updateMany).not.toHaveBeenCalled()
  })

  it('no se puede rechazar uno ya aprobado → 409', async () => {
    dobles.tx.comprobanteTransferencia.updateMany.mockResolvedValue({ count: 0 })
    const res = await request(app)
      .patch('/api/comprobantes/5/rechazar')
      .set('Authorization', iniciarSesionComo('Admin'))
      .send({ motivo: 'Duplicado' })
    expect(res.status).toBe(409)
  })
})

describe('la descarga del archivo sigue abierta a la familia', () => {
  it('un Padre no recibe el 403 de la bandeja en /api/comprobantes/:id/archivo', async () => {
    dobles.comprobanteTransferencia.findUnique.mockResolvedValue({ archivo: 'no-existe.pdf', facturas: { id_alumno: 7 } })
    prismaFalso.alumno.findFirst.mockResolvedValue({ id_alumno: 7 })
    const res = await request(app).get('/api/comprobantes/1/archivo').set('Authorization', iniciarSesionComo('Padre'))
    // Pasa los permisos y llega a buscar el archivo (no está en el disco de prueba).
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('El archivo del comprobante no está disponible')
  })
})
