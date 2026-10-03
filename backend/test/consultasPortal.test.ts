import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '../src/generated/prisma/client.js'
import { iniciarSesionComo, prismaFalso } from './ayudas.js'

vi.mock('../src/lib/prisma.js', async () => ({ prisma: (await import('./ayudas.js')).prismaFalso }))

const { app } = await import('../src/app.js')

const dinero = (n: number) => new Prisma.Decimal(n)

/** Lo que se le pidió a Prisma en la primera llamada, pasado por JSON: las fechas quedan como texto ISO. */
const consultaDe = (mock: { mock: { calls: unknown[][] } }) => JSON.parse(JSON.stringify(mock.mock.calls[0][0]))

beforeEach(() => {
  vi.clearAllMocks()
  prismaFalso.factura.findMany.mockResolvedValue([])
  prismaFalso.comprobanteTransferencia.findMany.mockResolvedValue([])
})

const RUTAS = ['/api/alumnos/7/comprobantes', '/api/alumnos/7/deuda']

describe.each(RUTAS)('%s: quién puede verlo', (ruta) => {
  it('sin sesión devuelve 401', async () => {
    expect((await request(app).get(ruta)).status).toBe(401)
  })

  it('una familia ajena recibe 403', async () => {
    const token = iniciarSesionComo('Padre')
    prismaFalso.alumno.findFirst.mockResolvedValue(null)
    expect((await request(app).get(ruta).set('Authorization', token)).status).toBe(403)
  })

  it('un Docente recibe 403 sin consultar nada', async () => {
    const token = iniciarSesionComo('Docente')
    expect((await request(app).get(ruta).set('Authorization', token)).status).toBe(403)
    expect(prismaFalso.factura.findMany).not.toHaveBeenCalled()
    expect(prismaFalso.comprobanteTransferencia.findMany).not.toHaveBeenCalled()
  })

  it.each(['Admin', 'Directivo'])('%s lo ve', async (rol) => {
    expect((await request(app).get(ruta).set('Authorization', iniciarSesionComo(rol))).status).toBe(200)
  })

  it('la familia del alumno lo ve', async () => {
    const token = iniciarSesionComo('Padre')
    prismaFalso.alumno.findFirst.mockResolvedValue({ id_alumno: 7 })
    expect((await request(app).get(ruta).set('Authorization', token)).status).toBe(200)
  })

  it('un id inválido devuelve 400', async () => {
    const token = iniciarSesionComo('Admin')
    expect((await request(app).get(ruta.replace('/7/', '/abc/')).set('Authorization', token)).status).toBe(400)
  })
})

describe('GET /api/alumnos/:id/facturas con rango de fechas (T15)', () => {
  const pedir = (consulta: string) =>
    request(app).get(`/api/alumnos/7/facturas${consulta}`).set('Authorization', iniciarSesionComo('Admin'))

  it('sin rango no filtra por fecha de emisión', async () => {
    await pedir('')
    expect(consultaDe(prismaFalso.factura.findMany).where).toEqual({ id_alumno: 7 })
  })

  it('filtra por fecha de emisión entre desde y hasta, inclusivos', async () => {
    const res = await pedir('?desde=2026-03-01&hasta=2026-10-31')
    expect(res.status).toBe(200)
    const { fecha_emision } = consultaDe(prismaFalso.factura.findMany).where
    expect(fecha_emision.gte.slice(0, 10)).toBe('2026-03-01')
    expect(fecha_emision.lte.slice(0, 10)).toBe('2026-10-31')
  })

  it('acepta solo desde o solo hasta', async () => {
    await pedir('?desde=2026-03-01')
    expect(Object.keys(consultaDe(prismaFalso.factura.findMany).where.fecha_emision)).toEqual(['gte'])
    vi.clearAllMocks()
    await pedir('?hasta=2026-10-31')
    expect(Object.keys(consultaDe(prismaFalso.factura.findMany).where.fecha_emision)).toEqual(['lte'])
  })

  it('se combina con el filtro por estado', async () => {
    prismaFalso.factura.findMany.mockResolvedValue([
      { id_factura: 1, total: dinero(100), saldo: dinero(100), fecha_vencimiento: new Date('2000-01-10'), items: [], comprobantes: [] },
      { id_factura: 2, total: dinero(100), saldo: dinero(0), fecha_vencimiento: new Date('2000-01-10'), items: [], comprobantes: [] },
    ])
    const res = await pedir('?desde=2026-03-01&estado=Vencida')
    expect(res.body.map((f: { id_factura: number }) => f.id_factura)).toEqual([1])
  })

  it.each([
    ['una fecha que no existe', '?desde=2026-99-99'],
    ['un texto que no es fecha', '?hasta=ayer'],
    ['un rango al revés', '?desde=2026-10-31&hasta=2026-03-01'],
  ])('devuelve 400 con %s, sin consultar la base', async (_caso, consulta) => {
    const res = await pedir(consulta)
    expect(res.status).toBe(400)
    expect(prismaFalso.factura.findMany).not.toHaveBeenCalled()
  })
})

describe('GET /api/alumnos/:id/comprobantes (T15)', () => {
  const pedir = (consulta = '') =>
    request(app).get(`/api/alumnos/7/comprobantes${consulta}`).set('Authorization', iniciarSesionComo('Admin'))

  it('pide solo los comprobantes de las facturas del alumno, del más reciente al más antiguo', async () => {
    await pedir()
    const consulta = consultaDe(prismaFalso.comprobanteTransferencia.findMany)
    expect(consulta.where).toEqual({ facturas: { id_alumno: 7 } })
    expect(consulta.orderBy).toEqual([{ fecha_transferencia: 'desc' }, { id_comprobante: 'desc' }])
  })

  it('filtra por la fecha de la transferencia y por estado', async () => {
    await pedir('?desde=2026-10-01&hasta=2026-10-31&estado=En%20revisi%C3%B3n,Aprobado')
    const { where } = consultaDe(prismaFalso.comprobanteTransferencia.findMany)
    expect(where.fecha_transferencia.gte.slice(0, 10)).toBe('2026-10-01')
    expect(where.fecha_transferencia.lte.slice(0, 10)).toBe('2026-10-31')
    expect(where.estado).toEqual({ in: ['En revisión', 'Aprobado'] })
  })

  it('un rango al revés devuelve 400', async () => {
    const res = await pedir('?desde=2026-10-31&hasta=2026-10-01')
    expect(res.status).toBe(400)
    expect(prismaFalso.comprobanteTransferencia.findMany).not.toHaveBeenCalled()
  })

  it('no trae el nombre del archivo en disco', async () => {
    await pedir()
    const { select } = consultaDe(prismaFalso.comprobanteTransferencia.findMany)
    expect(Object.keys(select)).not.toContain('archivo')
  })

  it('devuelve la factura y la orden de cada comprobante, con los importes como números', async () => {
    prismaFalso.comprobanteTransferencia.findMany.mockResolvedValue([
      {
        id_comprobante: 9,
        estado: 'Aprobado',
        importe: dinero(62500),
        fecha_transferencia: new Date('2026-10-03'),
        fecha_carga: new Date('2026-10-03T15:00:00Z'),
        motivo_rechazo: null,
        facturas: { id_factura: 3, numero: 3, anio: 2026, mes: 10 },
        ordenes_pago: { id_orden: 5, numero: 12 },
      },
      {
        id_comprobante: 8,
        estado: 'Rechazado',
        importe: dinero(1000),
        fecha_transferencia: new Date('2026-10-01'),
        fecha_carga: new Date('2026-10-01T15:00:00Z'),
        motivo_rechazo: 'La imagen no se ve',
        facturas: { id_factura: 3, numero: 3, anio: 2026, mes: 10 },
        ordenes_pago: null,
      },
    ])
    const res = await pedir()
    expect(res.body[0]).toMatchObject({ id_comprobante: 9, importe: 62500, fecha_transferencia: '2026-10-03', factura: { numero: 3 }, orden: { numero: 12 } })
    expect(res.body[1]).toMatchObject({ estado: 'Rechazado', motivo_rechazo: 'La imagen no se ve', orden: null })
    expect(res.body[0]).not.toHaveProperty('facturas')
  })
})

describe('GET /api/alumnos/:id/deuda (T16)', () => {
  const pedir = () => request(app).get('/api/alumnos/7/deuda').set('Authorization', iniciarSesionComo('Admin'))

  it('sin facturas con saldo, la deuda es cero', async () => {
    const res = await pedir()
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ total: 0, facturas: [] })
  })

  it('pide las facturas del alumno que tienen saldo, de la más antigua a la más reciente', async () => {
    await pedir()
    const consulta = consultaDe(prismaFalso.factura.findMany)
    expect(consulta.where).toEqual({ id_alumno: 7, saldo: { gt: 0 } })
    expect(consulta.orderBy).toEqual([{ anio: 'asc' }, { mes: 'asc' }])
  })

  it('devuelve la deuda por ítem y período, con el total y el estado de cada factura', async () => {
    prismaFalso.factura.findMany.mockResolvedValue([
      {
        id_factura: 1,
        numero: 1,
        anio: 2026,
        mes: 9,
        fecha_vencimiento: new Date('2000-09-10'),
        total: dinero(60000),
        saldo: dinero(50000),
        items: [{ id_item: 1, concepto: 'Cuota', id_referencia: null, descripcion: 'Cuota Primaria', importe: dinero(60000), saldo: dinero(50000) }],
      },
      {
        id_factura: 2,
        numero: 2,
        anio: 2026,
        mes: 10,
        fecha_vencimiento: new Date('2999-10-10'),
        total: dinero(77500),
        saldo: dinero(77500),
        items: [
          { id_item: 2, concepto: 'Cuota', id_referencia: null, descripcion: 'Cuota Primaria', importe: dinero(65000), saldo: dinero(65000) },
          { id_item: 3, concepto: 'Deporte', id_referencia: 4, descripcion: 'Natación', importe: dinero(12500), saldo: dinero(12500) },
        ],
      },
    ])
    const res = await pedir()
    expect(res.body.total).toBe(127500)
    expect(res.body.facturas.map((f: { estado: string; saldo: number }) => [f.estado, f.saldo])).toEqual([
      ['Vencida', 50000],
      ['Pendiente', 77500],
    ])
    expect(res.body.facturas[1].items.map((i: { descripcion: string; saldo: number }) => [i.descripcion, i.saldo])).toEqual([
      ['Cuota Primaria', 65000],
      ['Natación', 12500],
    ])
  })
})
