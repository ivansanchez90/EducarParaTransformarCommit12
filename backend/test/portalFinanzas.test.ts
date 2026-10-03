import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '../src/generated/prisma/client.js'
import { iniciarSesionComo, prismaFalso } from './ayudas.js'

vi.mock('../src/lib/prisma.js', async () => ({ prisma: (await import('./ayudas.js')).prismaFalso }))

const { app } = await import('../src/app.js')

const dinero = (n: number) => new Prisma.Decimal(n)

/** Una factura como la devuelve Prisma, con vencimiento lejano (pasado o futuro) para fijar el estado. */
function factura(id_factura: number, { total, saldo, vence }: { total: number; saldo: number; vence: string }) {
  return {
    id_factura,
    id_alumno: 7,
    anio: 2026,
    mes: id_factura,
    numero: id_factura,
    fecha_emision: new Date('2026-09-01'),
    fecha_vencimiento: new Date(vence),
    total: dinero(total),
    saldo: dinero(saldo),
    items: [],
    comprobantes: [],
  }
}

const VENCIDA = factura(1, { total: 1000, saldo: 1000, vence: '2000-01-10' })
const PARCIAL = factura(2, { total: 1000, saldo: 400, vence: '2999-01-10' })
const PENDIENTE = factura(3, { total: 1000, saldo: 1000, vence: '2999-01-10' })
const PAGADA = factura(4, { total: 1000, saldo: 0, vence: '2000-01-10' })

beforeEach(() => {
  vi.clearAllMocks()
  prismaFalso.factura.findMany.mockResolvedValue([VENCIDA, PARCIAL, PENDIENTE, PAGADA])
  prismaFalso.pago.findMany.mockResolvedValue([])
})

const RUTAS = ['/api/alumnos/7/facturas', '/api/alumnos/7/pagos']

describe.each(RUTAS)('%s: quién puede verlo', (ruta) => {
  it('sin sesión devuelve 401', async () => {
    const res = await request(app).get(ruta)
    expect(res.status).toBe(401)
  })

  it('una familia ajena recibe 403', async () => {
    const token = iniciarSesionComo('Padre')
    prismaFalso.alumno.findFirst.mockResolvedValue(null)
    const res = await request(app).get(ruta).set('Authorization', token)
    expect(res.status).toBe(403)
  })

  it('un Docente recibe 403 sin consultar la pertenencia ni los datos', async () => {
    const token = iniciarSesionComo('Docente')
    const res = await request(app).get(ruta).set('Authorization', token)
    expect(res.status).toBe(403)
    expect(prismaFalso.alumno.findFirst).not.toHaveBeenCalled()
    expect(prismaFalso.factura.findMany).not.toHaveBeenCalled()
    expect(prismaFalso.pago.findMany).not.toHaveBeenCalled()
  })

  it.each(['Admin', 'Directivo'])('%s lo ve sin consultar la pertenencia', async (rol) => {
    const token = iniciarSesionComo(rol)
    const res = await request(app).get(ruta).set('Authorization', token)
    expect(res.status).toBe(200)
    expect(prismaFalso.alumno.findFirst).not.toHaveBeenCalled()
  })

  it('la familia del alumno lo ve', async () => {
    const token = iniciarSesionComo('Padre')
    prismaFalso.alumno.findFirst.mockResolvedValue({ id_alumno: 7 })
    const res = await request(app).get(ruta).set('Authorization', token)
    expect(res.status).toBe(200)
  })

  it('un id inválido devuelve 400', async () => {
    const token = iniciarSesionComo('Admin')
    const res = await request(app).get(ruta.replace('/7/', '/abc/')).set('Authorization', token)
    expect(res.status).toBe(400)
  })
})

describe('GET /api/alumnos/:id/facturas', () => {
  const pedir = (consulta = '') => {
    const token = iniciarSesionComo('Admin')
    return request(app).get(`/api/alumnos/7/facturas${consulta}`).set('Authorization', token)
  }

  it('calcula el estado de cada factura con su saldo y su vencimiento', async () => {
    const res = await pedir()
    expect(res.body.map((f: { estado: string }) => f.estado)).toEqual(['Vencida', 'Pago parcial', 'Pendiente', 'Pagada'])
  })

  it('devuelve los importes como números', async () => {
    const res = await pedir()
    expect(res.body[1].total).toBe(1000)
    expect(res.body[1].saldo).toBe(400)
  })

  it('filtra por estado con ?estado=', async () => {
    const res = await pedir('?estado=Vencida,Pago%20parcial')
    expect(res.body.map((f: { id_factura: number }) => f.id_factura)).toEqual([1, 2])
  })

  it('pide solo las facturas del alumno, de la más reciente a la más antigua', async () => {
    await pedir()
    const consulta = prismaFalso.factura.findMany.mock.calls[0][0]
    expect(consulta.where).toEqual({ id_alumno: 7 })
    expect(consulta.orderBy).toEqual([{ anio: 'desc' }, { mes: 'desc' }])
  })

  it('trae los comprobantes sin el nombre del archivo', async () => {
    await pedir()
    const { include } = prismaFalso.factura.findMany.mock.calls[0][0]
    expect(Object.keys(include.comprobantes.select)).not.toContain('archivo')
  })
})

describe('GET /api/alumnos/:id/pagos', () => {
  const pedir = () => {
    const token = iniciarSesionComo('Admin')
    return request(app).get('/api/alumnos/7/pagos').set('Authorization', token)
  }

  it('incluye los pagos de facturas y los registrados sobre cuotas anteriores', async () => {
    await pedir()
    const { where } = prismaFalso.pago.findMany.mock.calls[0][0]
    expect(where).toEqual({ OR: [{ facturas: { id_alumno: 7 } }, { cuotas: { id_alumno: 7 } }] })
  })

  it('arma el período desde la factura o, si no hay, desde la cuota', async () => {
    prismaFalso.pago.findMany.mockResolvedValue([
      {
        id_pago: 1,
        fecha_pago: new Date('2026-10-05T12:00:00Z'),
        monto_pagado: dinero(600),
        metodo_pago: 'Transferencia',
        nro_comprobante: null,
        facturas: { id_factura: 2, numero: 2, anio: 2026, mes: 10 },
        cuotas: null,
      },
      {
        id_pago: 2,
        fecha_pago: new Date('2026-03-05T12:00:00Z'),
        monto_pagado: dinero(500),
        metodo_pago: 'Efectivo',
        nro_comprobante: 'A-1',
        facturas: null,
        cuotas: { anio: 2026, mes: 3 },
      },
    ])
    const res = await pedir()
    expect(res.body[0]).toMatchObject({ monto_pagado: 600, periodo: { anio: 2026, mes: 10 }, factura: { id_factura: 2 } })
    expect(res.body[1]).toMatchObject({ monto_pagado: 500, metodo_pago: 'Efectivo', periodo: { anio: 2026, mes: 3 }, factura: null })
    expect(res.body[0].fecha_pago).toBe('2026-10-05')
  })

  it('un alumno sin pagos devuelve una lista vacía', async () => {
    const res = await pedir()
    expect(res.body).toEqual([])
  })
})
