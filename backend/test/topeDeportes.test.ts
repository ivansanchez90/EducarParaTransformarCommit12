import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { iniciarSesionComo, prismaFalso } from './ayudas.js'

vi.mock('../src/lib/prisma.js', async () => ({ prisma: (await import('./ayudas.js')).prismaFalso }))

const { app } = await import('../src/app.js')

// Caso de prueba CP-HU2-01 (Unidad 5): un alumno con 2 deportes no puede inscribirse a un tercero.
// Esta suite es también la de regresión de esa regla: se corre cada vez que cambia la inscripción a actividades.

const tx = {
  $queryRaw: vi.fn(),
  actividadExtracurricular: { findUnique: vi.fn() },
  inscripcionActividad: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  vigenciaServicio: { findFirst: vi.fn(), create: vi.fn() },
  certificadoAptitud: { findFirst: vi.fn() },
}

const BASQUET = {
  nombre: 'Básquet',
  tipo: 'Deporte',
  cupo_maximo: 20,
  activo: true,
  horarios: [],
  _count: { inscripciones_actividades: 0 },
}

/** Deportes en los que ya está el alumno, como los devuelve el `findMany` de la ruta. */
const inscriptoEn = (...deportes: { nombre: string; activo?: boolean }[]) =>
  deportes.map((d) => ({ actividades_extracurriculares: { nombre: d.nombre, activo: d.activo ?? true, horarios: [] } }))

describe('Regla de negocio HU2: máximo 2 deportes por alumno', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaFalso.$transaction.mockImplementation(async (funcion: (t: unknown) => unknown) => funcion(tx))
    tx.$queryRaw.mockResolvedValue([{ '?column?': 1 }])
    tx.actividadExtracurricular.findUnique.mockResolvedValue(BASQUET)
    tx.inscripcionActividad.findUnique.mockResolvedValue(null)
    tx.inscripcionActividad.create.mockResolvedValue({ id_inscripcion_act: 1, id_actividad: 7, id_alumno: 4 })
    tx.certificadoAptitud.findFirst.mockResolvedValue({ fecha_vencimiento: new Date('2999-01-01') })
  })

  const inscribir = () =>
    request(app).post('/api/actividades/7/inscripciones').set('Authorization', iniciarSesionComo('Admin')).send({ id_alumno: 4 })

  it('rechaza el tercer deporte con 409 TOPE_DEPORTES y nombra los dos deportes actuales', async () => {
    tx.inscripcionActividad.findMany.mockResolvedValue(inscriptoEn({ nombre: 'Atletismo' }, { nombre: 'Natación' }))

    const res = await inscribir()

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('TOPE_DEPORTES')
    expect(res.body.error).toContain('ya está inscripto en 2 deportes (Atletismo y Natación)')
    expect(res.body.error).toContain('primero dalo de baja de alguno de ellos')
    expect(tx.inscripcionActividad.create).not.toHaveBeenCalled()
  })

  it('el segundo deporte sí se acepta (límite inferior del tope)', async () => {
    tx.inscripcionActividad.findMany.mockResolvedValue(inscriptoEn({ nombre: 'Atletismo' }))

    const res = await inscribir()

    expect(res.status).toBe(201)
    expect(tx.inscripcionActividad.create).toHaveBeenCalledWith({ data: { id_actividad: 7, id_alumno: 4 } })
  })

  it('un deporte desactivado sigue contando y el mensaje avisa que la baja la hace administración', async () => {
    tx.inscripcionActividad.findMany.mockResolvedValue(inscriptoEn({ nombre: 'Atletismo' }, { nombre: 'Danza', activo: false }))

    const res = await inscribir()

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('TOPE_DEPORTES')
    expect(res.body.error).toContain('Danza [desactivado]')
    expect(res.body.error).toContain('esa baja hay que pedírsela a la administración')
  })

  it('el tope vale para todos los roles: la familia recibe el mismo rechazo', async () => {
    const token = iniciarSesionComo('Padre')
    prismaFalso.alumno.findFirst.mockResolvedValue({ id_alumno: 4 })
    tx.inscripcionActividad.findMany.mockResolvedValue(inscriptoEn({ nombre: 'Atletismo' }, { nombre: 'Natación' }))

    const res = await request(app).post('/api/actividades/7/inscripciones').set('Authorization', token).send({ id_alumno: 4 })

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('TOPE_DEPORTES')
  })

  it('un idioma no cuenta para el tope de deportes', async () => {
    tx.actividadExtracurricular.findUnique.mockResolvedValue({ ...BASQUET, nombre: 'Inglés', tipo: 'Idioma' })
    tx.inscripcionActividad.findMany.mockResolvedValue(inscriptoEn({ nombre: 'Atletismo' }, { nombre: 'Natación' }))

    const res = await inscribir()

    expect(res.status).toBe(201)
  })
})
