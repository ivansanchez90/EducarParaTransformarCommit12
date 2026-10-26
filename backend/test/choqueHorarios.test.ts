import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buscarChoque, textoFranja, type Franja } from '../src/services/choqueHorarios.js'
import { iniciarSesionComo, prismaFalso } from './ayudas.js'

vi.mock('../src/lib/prisma.js', async () => ({ prisma: (await import('./ayudas.js')).prismaFalso }))

const { app } = await import('../src/app.js')

const hora = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`)
const franja = (dia_semana: string, inicio: string, fin: string): Franja => ({ dia_semana, hora_inicio: hora(inicio), hora_fin: hora(fin) })

const ATLETISMO = { nombre: 'Atletismo', horarios: [franja('Lunes', '17:00', '18:00'), franja('Miércoles', '17:00', '18:00')] }
const NATACION = { nombre: 'Natación', horarios: [franja('Martes', '17:00', '18:00')] }

describe('buscarChoque', () => {
  it('encuentra la franja que se pisa el mismo día y dice con qué deporte', () => {
    const choque = buscarChoque([franja('Miércoles', '17:30', '18:30')], [NATACION, ATLETISMO])
    expect(choque).toEqual({ deporte: 'Atletismo', nueva: franja('Miércoles', '17:30', '18:30'), existente: ATLETISMO.horarios[1] })
  })

  it('una franja dentro de otra también choca', () => {
    expect(buscarChoque([franja('Lunes', '17:15', '17:45')], [ATLETISMO])?.deporte).toBe('Atletismo')
  })

  it('dos franjas que solo se tocan no chocan', () => {
    expect(buscarChoque([franja('Lunes', '18:00', '19:00'), franja('Lunes', '16:00', '17:00')], [ATLETISMO])).toBeNull()
  })

  it('a la misma hora pero otro día no chocan', () => {
    expect(buscarChoque([franja('Jueves', '17:00', '18:00')], [ATLETISMO, NATACION])).toBeNull()
  })

  it('sin horarios cargados no hay choque', () => {
    expect(buscarChoque([], [ATLETISMO])).toBeNull()
    expect(buscarChoque([franja('Lunes', '17:00', '18:00')], [{ nombre: 'Ajedrez', horarios: [] }])).toBeNull()
  })

  it('arma el texto de la franja', () => {
    expect(textoFranja(franja('Lunes', '18:30', '19:30'))).toBe('Lunes 18:30–19:30')
  })
})

// Lo que la ruta de inscripción lee dentro de la transacción.
const tx = {
  $queryRaw: vi.fn(),
  actividadExtracurricular: { findUnique: vi.fn() },
  inscripcionActividad: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  vigenciaServicio: { findFirst: vi.fn(), create: vi.fn() },
  certificadoAptitud: { findFirst: vi.fn() },
}

const FUTBOL = {
  nombre: 'Fútbol',
  tipo: 'Deporte',
  cupo_maximo: 22,
  activo: true,
  horarios: [franja('Lunes', '17:30', '18:30')],
  _count: { inscripciones_actividades: 3 },
}

/** Deportes en los que ya está el alumno, como los devuelve el `findMany` de la ruta. */
const inscriptoEn = (...deportes: { nombre: string; horarios: Franja[] }[]) =>
  deportes.map((d) => ({ actividades_extracurriculares: { ...d, activo: true } }))

describe('POST /api/actividades/:id/inscripciones', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaFalso.$transaction.mockImplementation(async (funcion: (t: unknown) => unknown) => funcion(tx))
    tx.$queryRaw.mockResolvedValue([{ '?column?': 1 }])
    tx.actividadExtracurricular.findUnique.mockResolvedValue(FUTBOL)
    tx.inscripcionActividad.findUnique.mockResolvedValue(null)
    tx.inscripcionActividad.create.mockResolvedValue({ id_inscripcion_act: 9, id_actividad: 6, id_alumno: 4 })
    tx.vigenciaServicio.findFirst.mockResolvedValue(null)
    // Para anotarse a un deporte hace falta el certificado de aptitud física vigente (ver aptitud.test.ts).
    tx.certificadoAptitud.findFirst.mockResolvedValue({ fecha_vencimiento: new Date('2999-01-01') })
  })

  const inscribir = (token: string) => request(app).post('/api/actividades/6/inscripciones').set('Authorization', token).send({ id_alumno: 4 })

  it('rechaza con 409 un deporte que se pisa con otro del alumno, y dice cuál y en qué franja', async () => {
    tx.inscripcionActividad.findMany.mockResolvedValue(inscriptoEn(ATLETISMO))
    const res = await inscribir(iniciarSesionComo('Admin'))
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('CHOQUE_HORARIO')
    expect(res.body.error).toContain('Fútbol se superpone con Atletismo')
    expect(res.body.error).toContain('Lunes 17:30–18:30 y Lunes 17:00–18:00')
    expect(tx.inscripcionActividad.create).not.toHaveBeenCalled()
    expect(tx.vigenciaServicio.create).not.toHaveBeenCalled()
  })

  it('la familia recibe el mismo rechazo para su hijo', async () => {
    const token = iniciarSesionComo('Padre')
    prismaFalso.alumno.findFirst.mockResolvedValue({ id_alumno: 4 })
    tx.inscripcionActividad.findMany.mockResolvedValue(inscriptoEn(ATLETISMO))
    const res = await inscribir(token)
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('CHOQUE_HORARIO')
  })

  it('inscribe si el otro deporte es en otro horario', async () => {
    tx.inscripcionActividad.findMany.mockResolvedValue(inscriptoEn(NATACION))
    const res = await inscribir(iniciarSesionComo('Admin'))
    expect(res.status).toBe(201)
    expect(tx.inscripcionActividad.create).toHaveBeenCalledWith({ data: { id_actividad: 6, id_alumno: 4 } })
  })

  it('el tope de 2 deportes se sigue controlando antes que el horario', async () => {
    tx.inscripcionActividad.findMany.mockResolvedValue(inscriptoEn(ATLETISMO, NATACION))
    const res = await inscribir(iniciarSesionComo('Admin'))
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('TOPE_DEPORTES')
  })

  it('un idioma no se controla contra los horarios de los deportes', async () => {
    tx.actividadExtracurricular.findUnique.mockResolvedValue({ ...FUTBOL, nombre: 'Inglés', tipo: 'Idioma' })
    tx.inscripcionActividad.findMany.mockResolvedValue(inscriptoEn(ATLETISMO))
    const res = await inscribir(iniciarSesionComo('Admin'))
    expect(res.status).toBe(201)
    expect(tx.inscripcionActividad.findMany).not.toHaveBeenCalled()
  })
})

describe('PUT /api/actividades/:id (horarios de un deporte)', () => {
  const actividadFalsa = prismaFalso.actividadExtracurricular as unknown as { update: ReturnType<typeof vi.fn> }
  const inscripcionesFalsas = prismaFalso as unknown as { inscripcionActividad: { findMany: ReturnType<typeof vi.fn> } }

  beforeEach(() => {
    vi.clearAllMocks()
    actividadFalsa.update = vi.fn().mockResolvedValue({ id_actividad: 6, nombre: 'Fútbol' })
    inscripcionesFalsas.inscripcionActividad = { findMany: vi.fn() }
  })

  const editar = (horarios: { dia_semana: string; hora_inicio: string; hora_fin: string }[], tipo = 'Deporte') =>
    request(app)
      .put('/api/actividades/6')
      .set('Authorization', iniciarSesionComo('Admin'))
      .send({ nombre: 'Fútbol', tipo, cupo_maximo: 22, horarios })

  const otroDeporteDe = (apellido: string, nombre: string, deporte: { nombre: string; horarios: Franja[] }) => ({
    alumnos: { apellido, nombre },
    actividades_extracurriculares: deporte,
  })

  it('rechaza un horario que dejaría a un inscripto con dos clases a la vez, y no guarda nada', async () => {
    inscripcionesFalsas.inscripcionActividad.findMany.mockResolvedValue([
      otroDeporteDe('Pérez', 'Ana', ATLETISMO),
      otroDeporteDe('Gómez', 'Luis', NATACION),
    ])
    const res = await editar([{ dia_semana: 'Lunes', hora_inicio: '17:30', hora_fin: '18:30' }])
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('CHOQUE_HORARIO')
    expect(res.body.error).toContain('un alumno inscripto: Pérez, Ana (Atletismo, Lunes 17:00–18:00)')
    expect(res.body.error).toContain('cambiá antes a ese alumno de deporte')
    expect(res.body.error).not.toContain('Gómez')
    expect(actividadFalsa.update).not.toHaveBeenCalled()
    // Solo mira los otros deportes de los inscriptos en este.
    expect(inscripcionesFalsas.inscripcionActividad.findMany.mock.calls[0][0].where).toEqual({
      id_actividad: { not: 6 },
      actividades_extracurriculares: { tipo: 'Deporte' },
      alumnos: { inscripciones_actividades: { some: { id_actividad: 6 } } },
    })
  })

  it('con muchos afectados nombra tres y cuenta el resto', async () => {
    inscripcionesFalsas.inscripcionActividad.findMany.mockResolvedValue(
      ['A', 'B', 'C', 'D', 'E'].map((n) => otroDeporteDe(n, 'X', ATLETISMO)),
    )
    const res = await editar([{ dia_semana: 'Miércoles', hora_inicio: '16:30', hora_fin: '17:30' }])
    expect(res.status).toBe(409)
    expect(res.body.error).toContain('5 alumnos inscriptos')
    expect(res.body.error).toContain('y 2 más')
    expect(res.body.error).toContain('a esos alumnos de deporte')
  })

  it('guarda los horarios si no chocan con ningún inscripto', async () => {
    inscripcionesFalsas.inscripcionActividad.findMany.mockResolvedValue([otroDeporteDe('Pérez', 'Ana', ATLETISMO)])
    const res = await editar([{ dia_semana: 'Lunes', hora_inicio: '18:00', hora_fin: '19:00' }])
    expect(res.status).toBe(200)
    expect(actividadFalsa.update).toHaveBeenCalled()
  })

  it('sin horarios en el pedido no controla nada (no se tocan los que hay)', async () => {
    const res = await request(app)
      .put('/api/actividades/6')
      .set('Authorization', iniciarSesionComo('Admin'))
      .send({ nombre: 'Fútbol', tipo: 'Deporte', cupo_maximo: 22 })
    expect(res.status).toBe(200)
    expect(inscripcionesFalsas.inscripcionActividad.findMany).not.toHaveBeenCalled()
  })

  it('los horarios de un idioma no se controlan', async () => {
    const res = await editar([{ dia_semana: 'Lunes', hora_inicio: '17:30', hora_fin: '18:30' }], 'Idioma')
    expect(res.status).toBe(200)
    expect(inscripcionesFalsas.inscripcionActividad.findMany).not.toHaveBeenCalled()
  })
})
