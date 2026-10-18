import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hora as horaDeLaConsulta } from '../src/lib/http.js'
import { iniciarSesionComo, prismaFalso } from './ayudas.js'

vi.mock('../src/lib/prisma.js', async () => ({ prisma: (await import('./ayudas.js')).prismaFalso }))

const { app } = await import('../src/app.js')

// Lo que estas rutas leen y `ayudas.ts` no trae.
const falso = prismaFalso as unknown as {
  inscripcionActividad: { findMany: ReturnType<typeof vi.fn> }
  docente: { findUnique: ReturnType<typeof vi.fn> }
  asignacion: { findMany: ReturnType<typeof vi.fn> }
}

const hora = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`)
const franja = (dia_semana: string, inicio: string, fin: string) => ({ dia_semana, hora_inicio: hora(inicio), hora_fin: hora(fin) })

const FUTBOL = {
  nombre: 'Fútbol',
  tipo: 'Deporte',
  horarios: [franja('Miércoles', '18:30', '19:30'), franja('Lunes', '18:30', '19:30')],
  docentes: { usuarios: { nombre: 'Paula', apellido: 'Díaz' } },
}

const inscripcion = (deporte: typeof FUTBOL, apellido: string, nombre: string, id_alumno: number) => ({
  fecha_inscripcion: new Date('2026-03-01T15:00:00Z'),
  actividades_extracurriculares: deporte,
  alumnos: { id_alumno, nombre, apellido, cursos: { nivel: 'Primario', grado_anio: '5', division: 'A' } },
})

const pedir = (query = '') => request(app).get(`/api/reportes/alumnos-por-deporte${query}`).set('Authorization', iniciarSesionComo('Admin'))

describe('GET /api/reportes/alumnos-por-deporte', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    falso.inscripcionActividad = { findMany: vi.fn().mockResolvedValue([inscripcion(FUTBOL, 'Acosta', 'Valentina', 12)]) }
    falso.docente = { findUnique: vi.fn().mockResolvedValue({ usuarios: { nombre: 'Paula', apellido: 'Díaz' } }) }
  })

  it('muestra el profesor a cargo y los horarios del deporte de lunes a domingo', async () => {
    const res = await pedir()
    expect(res.status).toBe(200)
    const tabla = res.body.bloques[0]
    expect(tabla.columnas.map((c: { key: string }) => c.key)).toEqual(['actividad', 'profesor', 'horario', 'alumno', 'legajo', 'curso', 'nivel'])
    expect(tabla.filas[0]).toEqual({
      actividad: 'Fútbol',
      profesor: 'Díaz, Paula',
      horario: 'Lunes 18:30–19:30 · Miércoles 18:30–19:30',
      alumno: 'Acosta, Valentina',
      legajo: 12,
      curso: '5° A',
      nivel: 'Primario',
    })
    expect(res.body.orientacion).toBe('landscape')
  })

  it('un deporte sin profesor ni horarios lo dice', async () => {
    falso.inscripcionActividad.findMany.mockResolvedValue([inscripcion({ ...FUTBOL, horarios: [], docentes: null } as unknown as typeof FUTBOL, 'Acosta', 'Valentina', 12)])
    const fila = (await pedir()).body.bloques[0].filas[0]
    expect(fila.profesor).toBe('Sin asignar')
    expect(fila.horario).toBe('Sin horario')
  })

  it('filtra por día, hora de inicio y profesor sobre la actividad, y los muestra en los filtros', async () => {
    const res = await pedir('?dia=Lunes&hora=18:30&id_docente=3&nivel=Primario')
    expect(res.status).toBe(200)
    const { where } = falso.inscripcionActividad.findMany.mock.calls[0][0]
    expect(where.actividades_extracurriculares).toEqual({
      tipo: 'Deporte',
      id_docente: 3,
      horarios: { some: { dia_semana: 'Lunes', hora_inicio: hora('18:30') } },
    })
    expect(where.alumnos).toEqual({ activo: true, cursos: { nivel: 'Primario' } })
    expect(res.body.filtros).toContain('Horario: Lunes 18:30')
    expect(res.body.filtros).toContain('Profesor: Díaz, Paula')
  })

  it('solo el día: cualquier franja de ese día', async () => {
    await pedir('?dia=Martes')
    const { where } = falso.inscripcionActividad.findMany.mock.calls[0][0]
    expect(where.actividades_extracurriculares.horarios).toEqual({ some: { dia_semana: 'Martes', hora_inicio: undefined } })
  })

  it('sin filtros de horario ni profesor no restringe la actividad más que por tipo', async () => {
    const res = await pedir()
    const { where } = falso.inscripcionActividad.findMany.mock.calls[0][0]
    expect(where.actividades_extracurriculares).toEqual({ tipo: 'Deporte', id_docente: undefined, horarios: undefined })
    expect(res.body.filtros).toContain('Horario: Todos')
    expect(res.body.filtros).toContain('Profesor: Todos')
    expect(falso.docente.findUnique).not.toHaveBeenCalled()
  })

  it('ordena por actividad y por apellido y nombre del alumno', async () => {
    await pedir()
    expect(falso.inscripcionActividad.findMany.mock.calls[0][0].orderBy).toEqual([
      { actividades_extracurriculares: { nombre: 'asc' } },
      { alumnos: { apellido: 'asc' } },
      { alumnos: { nombre: 'asc' } },
    ])
  })

  it.each([['?dia=Feriado'], ['?hora=25:00'], ['?hora=24:00'], ['?hora=18:60'], ['?hora=tarde'], ['?id_docente=abc']])('%s da 400 sin consultar la base', async (query) => {
    const res = await pedir(query)
    expect(res.status).toBe(400)
    expect(falso.inscripcionActividad.findMany).not.toHaveBeenCalled()
  })

  it('el CSV trae las columnas nuevas', async () => {
    const res = await pedir('?formato=csv')
    expect(res.status).toBe(200)
    expect(res.text).toContain('Profesor a cargo')
    expect(res.text).toContain('Lunes 18:30–19:30 · Miércoles 18:30–19:30')
  })

  it('un docente no puede pedirlo', async () => {
    const res = await request(app).get('/api/reportes/alumnos-por-deporte').set('Authorization', iniciarSesionComo('Docente'))
    expect(res.status).toBe(403)
  })
})

describe('GET /api/reportes/alumno/:id (ficha)', () => {
  it('las actividades del alumno muestran profesor y horarios', async () => {
    falso.asignacion = { findMany: vi.fn().mockResolvedValue([]) }
    prismaFalso.alumno.findUnique.mockResolvedValue({
      id_alumno: 12,
      nombre: 'Valentina',
      apellido: 'Acosta',
      dni: '47000000',
      fecha_nacimiento: new Date('2015-05-05T00:00:00Z'),
      activo: true,
      obra_social: null,
      cursos: { id_curso: 7, nivel: 'Primario', grado_anio: '5', division: 'A' },
      padre: null,
      inscripciones_actividades: [{ actividades_extracurriculares: FUTBOL }],
      transporte: null,
      comedor: null,
    })
    const res = await request(app).get('/api/reportes/alumno/12').set('Authorization', iniciarSesionComo('Admin'))
    expect(res.status).toBe(200)
    const actividades = res.body.bloques.find((b: { titulo?: string }) => b.titulo === 'Actividades extracurriculares')
    expect(actividades.filas[0]).toEqual({
      actividad: 'Fútbol',
      tipo: 'Deporte',
      profesor: 'Díaz, Paula',
      horario: 'Lunes 18:30–19:30 · Miércoles 18:30–19:30',
    })
  })
})

describe('hora()', () => {
  it('acepta HH:MM y HH:MM:SS del día', () => {
    expect(horaDeLaConsulta('00:00').toISOString()).toBe('1970-01-01T00:00:00.000Z')
    expect(horaDeLaConsulta('23:59').toISOString()).toBe('1970-01-01T23:59:00.000Z')
    expect(horaDeLaConsulta('18:30:15').toISOString()).toBe('1970-01-01T18:30:15.000Z')
  })

  it.each(['25:00', '24:00', '18:60', '18:30:60', '9:00', 'tarde', ''])('"%s" es 400, no una fecha inválida', (valor) => {
    expect(() => horaDeLaConsulta(valor)).toThrow(expect.objectContaining({ status: 400 }))
  })
})
