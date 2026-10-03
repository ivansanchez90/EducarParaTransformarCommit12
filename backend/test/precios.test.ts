import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { iniciarSesionComo, prismaFalso } from './ayudas.js'

vi.mock('../src/lib/prisma.js', async () => ({ prisma: (await import('./ayudas.js')).prismaFalso }))

const { app } = await import('../src/app.js')

/** Una tarifa como la devuelve Prisma: el importe es un Decimal con `toNumber()`. */
const tarifa = (concepto: string, importe: number, id_referencia: number | null = null) => ({
  concepto,
  nivel: null,
  id_referencia,
  importe: { toNumber: () => importe },
})

const actividad = (id_actividad: number, tipo: string) => ({
  id_actividad,
  nombre: `Actividad ${id_actividad}`,
  tipo,
  descripcion: null,
  cupo_maximo: 20,
  activo: true,
  horarios: [],
  docentes: null,
  _count: { inscripciones_actividades: 3 },
})

const recorrido = (id_recorrido: number) => ({
  id_recorrido,
  nombre: `Recorrido ${id_recorrido}`,
  activo: true,
  capacidad: 30,
  _count: { inscripciones_transporte: 4 },
})

beforeEach(() => {
  vi.clearAllMocks()
  prismaFalso.tarifa.findMany.mockResolvedValue([])
})

describe('precios de los servicios para la familia', () => {
  it('los deportes traen su precio vigente; con otra tarifa o sin ella, null', async () => {
    const token = iniciarSesionComo('Padre')
    prismaFalso.actividadExtracurricular.findMany.mockResolvedValue([actividad(1, 'Deporte'), actividad(2, 'Deporte')])
    prismaFalso.tarifa.findMany.mockResolvedValue([tarifa('Deporte', 12500, 1), tarifa('Deporte', 99999, 7)])

    const res = await request(app).get('/api/actividades').set('Authorization', token)
    expect(res.status).toBe(200)
    expect(res.body.map((a: { precio: number | null }) => a.precio)).toEqual([12500, null])
  })

  it('un idioma no tiene precio aparte aunque exista una tarifa con su id', async () => {
    const token = iniciarSesionComo('Padre')
    prismaFalso.actividadExtracurricular.findMany.mockResolvedValue([actividad(1, 'Idioma')])
    prismaFalso.tarifa.findMany.mockResolvedValue([tarifa('Deporte', 12500, 1)])

    const res = await request(app).get('/api/actividades').set('Authorization', token)
    expect(res.body[0].precio).toBeNull()
  })

  it('los recorridos traen su precio vigente, o null si no hay tarifa', async () => {
    const token = iniciarSesionComo('Padre')
    prismaFalso.recorridoTransporte.findMany.mockResolvedValue([recorrido(1), recorrido(2)])
    prismaFalso.tarifa.findMany.mockResolvedValue([tarifa('Transporte', 8000, 2)])

    const res = await request(app).get('/api/recorridos').set('Authorization', token)
    expect(res.status).toBe(200)
    expect(res.body.map((r: { precio: number | null }) => r.precio)).toEqual([null, 8000])
  })

  it('los servicios del alumno traen el precio de su recorrido y el del comedor', async () => {
    const token = iniciarSesionComo('Padre')
    prismaFalso.alumno.findFirst.mockResolvedValue({ id_alumno: 7 })
    prismaFalso.inscripcionTransporte.findUnique.mockResolvedValue({ id_recorrido: 2, recorridos_transporte: {} })
    prismaFalso.inscripcionComedor.findUnique.mockResolvedValue(null)
    prismaFalso.tarifa.findMany.mockResolvedValue([tarifa('Transporte', 8000, 2), tarifa('Comedor', 15000)])

    const res = await request(app).get('/api/servicios/7').set('Authorization', token)
    expect(res.status).toBe(200)
    expect(res.body.precio_transporte).toBe(8000)
    expect(res.body.precio_comedor).toBe(15000)
  })

  it('sin transporte o sin tarifa de comedor, los precios son null', async () => {
    const token = iniciarSesionComo('Padre')
    prismaFalso.alumno.findFirst.mockResolvedValue({ id_alumno: 7 })
    prismaFalso.inscripcionTransporte.findUnique.mockResolvedValue(null)
    prismaFalso.inscripcionComedor.findUnique.mockResolvedValue(null)

    const res = await request(app).get('/api/servicios/7').set('Authorization', token)
    expect(res.body.precio_transporte).toBeNull()
    expect(res.body.precio_comedor).toBeNull()
  })

  it('solo cuenta lo que rige hoy: no pide tarifas posteriores a la fecha de hoy', async () => {
    const token = iniciarSesionComo('Padre')
    prismaFalso.recorridoTransporte.findMany.mockResolvedValue([recorrido(1)])
    await request(app).get('/api/recorridos').set('Authorization', token)

    const { where } = prismaFalso.tarifa.findMany.mock.calls[0][0]
    expect(where.vigente_desde.lte).toBeInstanceOf(Date)
    expect(where.vigente_desde.lte.getTime()).toBeLessThanOrEqual(Date.now())
  })

  it('el precio de otro alumno no se ve: una familia ajena recibe 403', async () => {
    const token = iniciarSesionComo('Padre')
    prismaFalso.alumno.findFirst.mockResolvedValue(null)
    const res = await request(app).get('/api/servicios/99').set('Authorization', token)
    expect(res.status).toBe(403)
  })
})
