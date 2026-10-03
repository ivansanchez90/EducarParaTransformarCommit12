import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '../src/generated/prisma/client.js'
import { ID_USUARIO, iniciarSesionComo, prismaFalso } from './ayudas.js'

vi.mock('../src/lib/prisma.js', async () => ({ prisma: (await import('./ayudas.js')).prismaFalso }))

const { app } = await import('../src/app.js')

const dinero = (n: number) => new Prisma.Decimal(n)

const CUOTA = { id_item: 1, concepto: 'Cuota', descripcion: 'Cuota Primaria', saldo: dinero(50000) }
const DEPORTE = { id_item: 2, concepto: 'Deporte', descripcion: 'Natación', saldo: dinero(12500) }
const PAGADO = { id_item: 3, concepto: 'Comedor', descripcion: 'Comedor', saldo: dinero(0) }

/** La orden como la devuelve `ordenPago.create`, con el detalle de cada ítem. */
const ordenCreada = {
  id_orden: 5,
  id_factura: 3,
  numero: 12,
  fecha: new Date('2026-10-03T15:00:00Z'),
  total: dinero(62500),
  items: [
    { id_item: 1, importe: dinero(50000), items: { concepto: 'Cuota', descripcion: 'Cuota Primaria' } },
    { id_item: 2, importe: dinero(12500), items: { concepto: 'Deporte', descripcion: 'Natación' } },
  ],
}

const ordenConFactura = {
  ...ordenCreada,
  facturas: {
    numero: 3,
    anio: 2026,
    mes: 10,
    fecha_vencimiento: new Date('2026-10-10'),
    alumnos: {
      nombre: 'Lucía',
      apellido: 'Acosta',
      dni: '47002118',
      cursos: { nivel: 'Primaria', grado_anio: 3, division: 'A' },
      padre: { nombre: 'Marta', apellido: 'Acosta' },
    },
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaFalso.factura.findUnique.mockResolvedValue({ id_alumno: 7 })
  prismaFalso.itemFactura.findMany.mockResolvedValue([CUOTA, DEPORTE])
  prismaFalso.ordenPago.create.mockResolvedValue(ordenCreada)
  // La ruta del PDF consulta la orden dos veces: primero para el permiso, después con todo el detalle.
  prismaFalso.ordenPago.findUnique.mockImplementation(async (args: { include?: unknown }) =>
    args.include ? ordenConFactura : { facturas: { id_alumno: 7 } },
  )
})

function emitir(token: string | null, cuerpo: unknown = { items: [1, 2] }, idFactura = 3) {
  const pedido = request(app).post(`/api/facturas/${idFactura}/ordenes-pago`)
  return (token ? pedido.set('Authorization', token) : pedido).send(cuerpo as object)
}

describe('POST /api/facturas/:id/ordenes-pago', () => {
  it('sin sesión devuelve 401', async () => {
    expect((await emitir(null)).status).toBe(401)
  })

  it('un Docente recibe 403 y una familia ajena también', async () => {
    expect((await emitir(iniciarSesionComo('Docente'))).status).toBe(403)
    const familia = iniciarSesionComo('Padre')
    prismaFalso.alumno.findFirst.mockResolvedValue(null)
    expect((await emitir(familia)).status).toBe(403)
    expect(prismaFalso.ordenPago.create).not.toHaveBeenCalled()
  })

  it('una factura que no existe devuelve 404', async () => {
    const token = iniciarSesionComo('Admin')
    prismaFalso.factura.findUnique.mockResolvedValue(null)
    expect((await emitir(token)).status).toBe(404)
  })

  it.each([
    ['falta la lista', {}],
    ['la lista está vacía', { items: [] }],
    ['no es una lista', { items: '1,2' }],
    ['hay un id que no es número', { items: [1, 'a'] }],
    ['hay un id negativo', { items: [-1] }],
    ['hay un id en cero', { items: [0] }],
  ])('devuelve 400 si %s', async (_caso, cuerpo) => {
    const token = iniciarSesionComo('Padre')
    prismaFalso.alumno.findFirst.mockResolvedValue({ id_alumno: 7 })
    const res = await emitir(token, cuerpo)
    expect(res.status).toBe(400)
    expect(prismaFalso.ordenPago.create).not.toHaveBeenCalled()
  })

  it('devuelve 400 si algún ítem no es de la factura', async () => {
    const token = iniciarSesionComo('Admin')
    prismaFalso.itemFactura.findMany.mockResolvedValue([CUOTA])
    const res = await emitir(token, { items: [1, 99] })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('no es de esta factura')
  })

  it('devuelve 400 si un ítem ya no tiene saldo, y dice cuál', async () => {
    const token = iniciarSesionComo('Admin')
    prismaFalso.itemFactura.findMany.mockResolvedValue([CUOTA, PAGADO])
    const res = await emitir(token, { items: [1, 3] })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Comedor')
    expect(prismaFalso.ordenPago.create).not.toHaveBeenCalled()
  })

  it('la familia del alumno emite la orden por el saldo de los ítems', async () => {
    const token = iniciarSesionComo('Padre')
    prismaFalso.alumno.findFirst.mockResolvedValue({ id_alumno: 7 })
    const res = await emitir(token)

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ id_orden: 5, numero: 12, total: 62500, alias: null })
    expect(res.body.items).toEqual([
      { id_item: 1, importe: 50000, concepto: 'Cuota', descripcion: 'Cuota Primaria' },
      { id_item: 2, importe: 12500, concepto: 'Deporte', descripcion: 'Natación' },
    ])

    const { data } = prismaFalso.ordenPago.create.mock.calls[0][0]
    expect(data.id_factura).toBe(3)
    expect(data.id_usuario).toBe(ID_USUARIO)
    expect(data.total.toNumber()).toBe(62500)
    expect(data.items.create.map((i: { id_item: number; importe: Prisma.Decimal }) => [i.id_item, i.importe.toNumber()])).toEqual([
      [1, 50000],
      [2, 12500],
    ])
  })

  it('busca solo ítems de esa factura y no repite los ids', async () => {
    const token = iniciarSesionComo('Admin')
    await emitir(token, { items: [1, 1, 2] })
    const { where } = prismaFalso.itemFactura.findMany.mock.calls[0][0]
    expect(where).toEqual({ id_factura: 3, id_item: { in: [1, 2] } })
  })

  it.each(['Admin', 'Directivo'])('%s también puede emitirla', async (rol) => {
    const res = await emitir(iniciarSesionComo(rol))
    expect(res.status).toBe(201)
  })
})

describe('GET /api/ordenes-pago/:id/pdf', () => {
  const pedir = (token: string | null) => {
    const pedido = request(app).get('/api/ordenes-pago/5/pdf').buffer(true).parse((res, cb) => {
      const trozos: Buffer[] = []
      res.on('data', (t: Buffer) => trozos.push(t))
      res.on('end', () => cb(null, Buffer.concat(trozos)))
    })
    return token ? pedido.set('Authorization', token) : pedido
  }

  it('sin sesión devuelve 401', async () => {
    expect((await pedir(null)).status).toBe(401)
  })

  it('un Docente y una familia ajena reciben 403', async () => {
    expect((await pedir(iniciarSesionComo('Docente'))).status).toBe(403)
    const familia = iniciarSesionComo('Padre')
    prismaFalso.alumno.findFirst.mockResolvedValue(null)
    expect((await pedir(familia)).status).toBe(403)
  })

  it('una orden que no existe devuelve 404', async () => {
    const token = iniciarSesionComo('Admin')
    prismaFalso.ordenPago.findUnique.mockResolvedValue(null)
    expect((await pedir(token)).status).toBe(404)
  })

  it('la familia del alumno baja un PDF con el número de la orden en el nombre', async () => {
    const token = iniciarSesionComo('Padre')
    prismaFalso.alumno.findFirst.mockResolvedValue({ id_alumno: 7 })
    const res = await pedir(token)

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('application/pdf')
    expect(res.headers['content-disposition']).toContain('orden-de-pago-00000012.pdf')
    expect(Buffer.isBuffer(res.body)).toBe(true)
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-')
  })

  it('el Admin también lo baja', async () => {
    expect((await pedir(iniciarSesionComo('Admin'))).status).toBe(200)
  })
})
