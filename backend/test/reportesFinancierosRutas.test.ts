import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '../src/generated/prisma/client.js'
import { iniciarSesionComo, prismaFalso } from './ayudas.js'

vi.mock('../src/lib/prisma.js', async () => ({ prisma: (await import('./ayudas.js')).prismaFalso }))

const { app } = await import('../src/app.js')

const dinero = (n: number) => new Prisma.Decimal(n)

/** Lo que se le pidió a Prisma en la primera llamada, pasado por JSON: las fechas quedan como texto ISO. */
const consultaDe = (mock: { mock: { calls: unknown[][] } }) => JSON.parse(JSON.stringify(mock.mock.calls[0][0]))

const factura = (id_alumno: number, mes: number, total: number, saldo: number, vence: string, nombre: string, apellido: string) => ({
  id_alumno,
  mes,
  numero: id_alumno * 100 + mes,
  total: dinero(total),
  saldo: dinero(saldo),
  fecha_vencimiento: new Date(vence),
  alumnos: { nombre, apellido, cursos: { nivel: 'Primario', grado_anio: '3', division: 'A' } },
})

// Ana pagó todo; Beto debe octubre (vence en el futuro) y septiembre (vencida).
const FACTURAS = [
  factura(1, 9, 50000, 0, '2026-09-10', 'Ana', 'Acosta'),
  factura(1, 10, 50000, 0, '2026-10-10', 'Ana', 'Acosta'),
  factura(2, 9, 50000, 50000, '2000-09-10', 'Beto', 'Benítez'),
  factura(2, 10, 50000, 20000, '2999-10-10', 'Beto', 'Benítez'),
]

beforeEach(() => {
  vi.clearAllMocks()
  prismaFalso.pago.findMany.mockResolvedValue([])
  prismaFalso.factura.findMany.mockResolvedValue(FACTURAS)
})

const RUTAS = ['/api/reportes/ingresos', '/api/reportes/pagos-completos', '/api/reportes/pagos-incompletos']

describe.each(RUTAS)('%s: quién puede pedirlo', (ruta) => {
  it('sin sesión devuelve 401', async () => {
    expect((await request(app).get(ruta)).status).toBe(401)
  })

  it.each(['Padre', 'Alumno', 'Docente'])('%s recibe 403', async (rol) => {
    expect((await request(app).get(ruta).set('Authorization', iniciarSesionComo(rol))).status).toBe(403)
  })

  it.each(['Admin', 'Directivo'])('%s lo recibe', async (rol) => {
    expect((await request(app).get(ruta).set('Authorization', iniciarSesionComo(rol))).status).toBe(200)
  })
})

describe('GET /api/reportes/ingresos', () => {
  const pedir = (consulta = '') => request(app).get(`/api/reportes/ingresos${consulta}`).set('Authorization', iniciarSesionComo('Admin'))

  it('consulta los pagos entre los días de Argentina pedidos, el último inclusive', async () => {
    await pedir('?desde=2026-10-01&hasta=2026-10-31')
    const { where } = consultaDe(prismaFalso.pago.findMany)
    expect(where.fecha_pago.gte).toBe('2026-10-01T03:00:00.000Z')
    expect(where.fecha_pago.lt).toBe('2026-11-01T03:00:00.000Z')
  })

  it('sin fechas toma desde el 1 de enero de este año hasta hoy', async () => {
    const res = await pedir()
    const anio = new Date().getFullYear()
    expect(res.body.filtros[0]).toBe(`Desde: 01/01/${anio}`)
    expect(consultaDe(prismaFalso.pago.findMany).where.fecha_pago.gte).toBe(`${anio}-01-01T03:00:00.000Z`)
  })

  it.each([
    ['una fecha que no existe', '?desde=2026-99-99'],
    ['un texto que no es fecha', '?hasta=ayer'],
    ['un rango al revés', '?desde=2026-10-31&hasta=2026-10-01'],
  ])('devuelve 400 con %s, sin consultar la base', async (_caso, consulta) => {
    expect((await pedir(consulta)).status).toBe(400)
    expect(prismaFalso.pago.findMany).not.toHaveBeenCalled()
  })

  it('arma el documento con el total, los períodos y los métodos de pago', async () => {
    prismaFalso.pago.findMany.mockResolvedValue([
      { fecha_pago: new Date('2026-10-05T15:00:00Z'), monto_pagado: dinero(62500), metodo_pago: 'Transferencia' },
      { fecha_pago: new Date('2026-09-10T15:00:00Z'), monto_pagado: dinero(30000), metodo_pago: 'Efectivo' },
    ])
    const res = await pedir('?desde=2026-09-01&hasta=2026-10-31')
    expect(res.body.titulo).toBe('Ingresos por período')
    expect(res.body.bloques[0].items).toEqual([['Total ingresado', '$ 92.500,00'], ['Cantidad de pagos', '2']])
    expect(res.body.bloques[1].filas.map((f: { periodo: string }) => f.periodo)).toEqual(['Septiembre 2026', 'Octubre 2026'])
    expect(res.body.bloques[2].filas.map((f: { metodo: string }) => f.metodo)).toEqual(['Transferencia', 'Efectivo'])
  })

  it('con agrupar=dia agrupa por día', async () => {
    prismaFalso.pago.findMany.mockResolvedValue([{ fecha_pago: new Date('2026-10-05T15:00:00Z'), monto_pagado: dinero(100), metodo_pago: 'Transferencia' }])
    const res = await pedir('?desde=2026-10-01&hasta=2026-10-31&agrupar=dia')
    expect(res.body.bloques[1].titulo).toBe('Ingresos por día')
    expect(res.body.bloques[1].filas[0].periodo).toBe('05/10/2026')
  })

  it('sin pagos devuelve tablas vacías y total cero', async () => {
    const res = await pedir('?desde=2026-10-01&hasta=2026-10-31')
    expect(res.status).toBe(200)
    expect(res.body.bloques[0].items[0]).toEqual(['Total ingresado', '$ 0,00'])
    expect(res.body.bloques[1].filas).toEqual([])
  })

  it('con formato=csv se descarga un CSV con el título y con el total', async () => {
    const res = await pedir('?formato=csv')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="ingresos-\d{4}-\d{2}-\d{2}\.csv"/)
    expect(res.text).toContain('Ingresos por período')
    expect(res.text).toContain('Total ingresado')
  })

  it('con formato=pdf se descarga un PDF', async () => {
    const res = await request(app)
      .get('/api/reportes/ingresos?formato=pdf')
      .set('Authorization', iniciarSesionComo('Admin'))
      .buffer(true)
      .parse((r, cb) => {
        const trozos: Buffer[] = []
        r.on('data', (t: Buffer) => trozos.push(t))
        r.on('end', () => cb(null, Buffer.concat(trozos)))
      })
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('application/pdf')
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-')
  })
})

describe('GET /api/reportes/pagos-completos y pagos-incompletos', () => {
  const pedir = (ruta: string, consulta = '') => request(app).get(`/api/reportes/${ruta}${consulta}`).set('Authorization', iniciarSesionComo('Admin'))
  const alumnosDe = (body: { bloques: { filas?: { alumno: string }[] }[] }) => (body.bloques[1].filas ?? []).map((f) => f.alumno)

  it('completos: solo los alumnos con todas las facturas del año pagadas', async () => {
    const res = await pedir('pagos-completos', '?anio=2026')
    expect(alumnosDe(res.body)).toEqual(['Acosta, Ana'])
    expect(res.body.bloques[0].items).toEqual([['Alumnos', '1'], ['Total facturado', '$ 100.000,00'], ['Total pagado', '$ 100.000,00']])
  })

  it('incompletos: los que tienen saldo, con lo adeudado y las facturas vencidas', async () => {
    const res = await pedir('pagos-incompletos', '?anio=2026')
    expect(alumnosDe(res.body)).toEqual(['Benítez, Beto'])
    expect(res.body.bloques[0].items).toContainEqual(['Total adeudado', '$ 70.000,00'])
    expect(res.body.bloques[1].filas[0]).toMatchObject({ facturado: '$ 100.000,00', pagado: '$ 30.000,00', adeudado: '$ 70.000,00', vencidas: 1 })
    expect(res.body.bloques[1].columnas.map((c: { key: string }) => c.key)).toEqual(expect.arrayContaining(['adeudado', 'vencidas']))
  })

  it('completos no muestra las columnas de deuda', async () => {
    const res = await pedir('pagos-completos', '?anio=2026')
    expect(res.body.bloques[1].columnas.map((c: { key: string }) => c.key)).not.toContain('adeudado')
  })

  it('filtra las facturas del año y del nivel pedidos', async () => {
    await pedir('pagos-incompletos', '?anio=2025&nivel=Primario')
    const { where } = consultaDe(prismaFalso.factura.findMany)
    expect(where.anio).toBe(2025)
    expect(where.alumnos).toEqual({ cursos: { nivel: 'Primario' } })
  })

  it('sin año toma el de hoy', async () => {
    const res = await pedir('pagos-completos')
    expect(consultaDe(prismaFalso.factura.findMany).where.anio).toBe(new Date().getFullYear())
    expect(res.body.filtros[0]).toBe(`Año: ${new Date().getFullYear()}`)
  })

  it.each([['abc'], ['1999'], ['2101'], ['2026.5']])('devuelve 400 con el año %s, sin consultar la base', async (anio) => {
    const res = await pedir('pagos-completos', `?anio=${anio}`)
    expect(res.status).toBe(400)
    expect(prismaFalso.factura.findMany).not.toHaveBeenCalled()
  })

  it('un id_alumno inválido devuelve 400', async () => {
    expect((await pedir('pagos-completos', '?id_alumno=abc')).status).toBe(400)
  })

  it('con id_alumno baja al detalle de las facturas de ese alumno', async () => {
    prismaFalso.factura.findMany.mockResolvedValue(FACTURAS.filter((f) => f.id_alumno === 2))
    const res = await pedir('pagos-incompletos', '?anio=2026&id_alumno=2')
    expect(consultaDe(prismaFalso.factura.findMany).where.id_alumno).toBe(2)
    expect(res.body.titulo).toBe('Pagos incompletos · detalle del alumno')
    expect(res.body.subtitulo).toBe('Benítez, Beto')
    expect(res.body.bloques[0].filas).toEqual([
      { periodo: 'Septiembre 2026', factura: '00000209', total: '$ 50.000,00', pagado: '$ 0,00', saldo: '$ 50.000,00', estado: 'Vencida' },
      { periodo: 'Octubre 2026', factura: '00000210', total: '$ 50.000,00', pagado: '$ 30.000,00', saldo: '$ 20.000,00', estado: 'Pago parcial' },
    ])
  })

  it('el detalle de completos muestra solo las facturas pagadas', async () => {
    prismaFalso.factura.findMany.mockResolvedValue(FACTURAS.filter((f) => f.id_alumno === 2).concat(factura(2, 8, 50000, 0, '2026-08-10', 'Beto', 'Benítez')))
    const res = await pedir('pagos-completos', '?anio=2026&id_alumno=2')
    expect(res.body.bloques[0].filas.map((f: { periodo: string }) => f.periodo)).toEqual(['Agosto 2026'])
  })

  it('con formato=csv se descarga un CSV', async () => {
    const res = await pedir('pagos-incompletos', '?anio=2026&formato=csv')
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.headers['content-disposition']).toContain('pagos-incompletos-')
    expect(res.text).toContain('Benítez, Beto')
  })
})
