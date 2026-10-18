import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '../src/generated/prisma/client.js'
import { iniciarSesionComo, prismaFalso } from './ayudas.js'

vi.mock('../src/lib/prisma.js', async () => ({ prisma: (await import('./ayudas.js')).prismaFalso }))

const { app } = await import('../src/app.js')

const dinero = (n: number) => new Prisma.Decimal(n)
const hora = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`)

/** Lo que se le pidió a Prisma en la primera llamada, pasado por JSON: las fechas quedan como texto ISO. */
const consultaDe = (mock: { mock: { calls: unknown[][] } }) => JSON.parse(JSON.stringify(mock.mock.calls[0][0]))

const item = (id_referencia: number, id_alumno: number, apellido: string, mes: number, importe: number, saldo: number, vence = '2999-10-10') => ({
  id_referencia,
  importe: dinero(importe),
  saldo: dinero(saldo),
  facturas: {
    anio: 2026,
    mes,
    fecha_vencimiento: new Date(vence),
    id_alumno,
    alumnos: { nombre: 'Ana', apellido, cursos: { nivel: 'Primario', grado_anio: '3', division: 'A' } },
  },
})

const ACTIVIDADES = [
  {
    id_actividad: 1,
    nombre: 'Fútbol',
    horarios: [
      { dia_semana: 'Miércoles', hora_inicio: hora('17:00'), hora_fin: hora('18:30') },
      { dia_semana: 'Lunes', hora_inicio: hora('17:00'), hora_fin: hora('18:30') },
    ],
    docentes: { usuarios: { nombre: 'Marta', apellido: 'Gómez' } },
  },
  { id_actividad: 2, nombre: 'Natación', horarios: [], docentes: null },
]

const RECORRIDOS = [{ id_recorrido: 7, nombre: 'Recorrido Norte', zona: 'Barrio Norte', hora_ida: hora('07:00'), hora_vuelta: hora('13:30') }]

beforeEach(() => {
  vi.clearAllMocks()
  prismaFalso.actividadExtracurricular.findMany.mockResolvedValue(ACTIVIDADES)
  prismaFalso.recorridoTransporte.findMany.mockResolvedValue(RECORRIDOS)
  prismaFalso.itemFactura.findMany.mockResolvedValue([])
})

const RUTAS = ['/api/reportes/pagos-deportes', '/api/reportes/pagos-transporte']

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

describe.each(RUTAS)('%s: período', (ruta) => {
  const pedir = (consulta = '') => request(app).get(`${ruta}${consulta}`).set('Authorization', iniciarSesionComo('Admin'))

  it('filtra los ítems por año y mes de la factura y por nivel del alumno', async () => {
    const res = await pedir('?anio=2026&mes=10&nivel=Primario')
    const { where } = consultaDe(prismaFalso.itemFactura.findMany)
    expect(where.facturas).toEqual({ anio: 2026, mes: 10, alumnos: { cursos: { nivel: 'Primario' } } })
    expect(res.body.filtros[0]).toBe('Período: Octubre 2026')
  })

  it('sin mes toma todo el año, y sin año el de hoy', async () => {
    const res = await pedir()
    const anio = new Date().getFullYear()
    expect(consultaDe(prismaFalso.itemFactura.findMany).where.facturas).toEqual({ anio })
    expect(res.body.filtros[0]).toBe(`Período: Año ${anio}`)
  })

  it.each([['?mes=0'], ['?mes=13'], ['?mes=abc'], ['?anio=1999']])('devuelve 400 con %s, sin consultar la base', async (consulta) => {
    expect((await pedir(consulta)).status).toBe(400)
    expect(prismaFalso.itemFactura.findMany).not.toHaveBeenCalled()
  })

  it('con formato=csv se descarga un CSV', async () => {
    const res = await pedir('?formato=csv')
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="pagos-(deportes|transporte)-\d{4}-\d{2}-\d{2}\.csv"/)
  })

  it('con formato=pdf se descarga un PDF', async () => {
    const res = await pedir('?formato=pdf')
      .buffer(true)
      .parse((r, cb) => {
        const trozos: Buffer[] = []
        r.on('data', (t: Buffer) => trozos.push(t))
        r.on('end', () => cb(null, Buffer.concat(trozos)))
      })
    expect(res.headers['content-type']).toContain('application/pdf')
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-')
  })
})

describe('GET /api/reportes/pagos-deportes', () => {
  const pedir = (consulta = '') => request(app).get(`/api/reportes/pagos-deportes${consulta}`).set('Authorization', iniciarSesionComo('Admin'))

  it('solo pide ítems de deporte; sin filtros de actividad no los restringe a las actividades existentes', async () => {
    await pedir()
    const { where } = consultaDe(prismaFalso.itemFactura.findMany)
    expect(where.concepto).toBe('Deporte')
    expect(where.id_referencia).toEqual({ not: null })
  })

  it('arma el resumen por deporte, con profesor y horario, y el detalle por alumno', async () => {
    prismaFalso.itemFactura.findMany.mockResolvedValue([
      item(1, 1, 'Acosta', 10, 15000, 0),
      item(1, 2, 'Benítez', 10, 15000, 15000, '2000-10-10'),
      item(2, 1, 'Acosta', 10, 20000, 5000),
    ])
    const res = await pedir('?anio=2026&mes=10')
    expect(res.body.titulo).toBe('Pagos de deportes')
    expect(res.body.bloques[0].items).toEqual([
      ['Alumnos', '2'],
      ['Total facturado', '$ 50.000,00'],
      ['Total pagado', '$ 30.000,00'],
      ['Saldo', '$ 20.000,00'],
    ])
    expect(res.body.bloques[1].filas).toEqual([
      {
        deporte: 'Fútbol',
        profesor: 'Gómez, Marta',
        horario: 'Lunes 17:00–18:30 · Miércoles 17:00–18:30',
        alumnos: 2,
        facturado: '$ 30.000,00',
        pagado: '$ 15.000,00',
        saldo: '$ 15.000,00',
      },
      { deporte: 'Natación', profesor: 'Sin asignar', horario: 'Sin horario', alumnos: 1, facturado: '$ 20.000,00', pagado: '$ 15.000,00', saldo: '$ 5.000,00' },
    ])
    expect(res.body.bloques[2].filas[1]).toEqual({
      servicio: 'Fútbol',
      alumno: 'Benítez, Ana',
      legajo: 2,
      curso: '3° A',
      nivel: 'Primario',
      periodo: 'Octubre 2026',
      facturado: '$ 15.000,00',
      pagado: '$ 0,00',
      saldo: '$ 15.000,00',
      estado: 'Vencida',
    })
  })

  it('filtra por deporte, profesor y horario, y pide solo los ítems de esas actividades', async () => {
    prismaFalso.actividadExtracurricular.findMany.mockResolvedValue([ACTIVIDADES[0]])
    const res = await pedir('?id_actividad=1&id_docente=4&dia=Lunes&hora=17:00')
    const actividades = consultaDe(prismaFalso.actividadExtracurricular.findMany).where
    expect(actividades).toEqual({
      id_actividad: 1,
      id_docente: 4,
      horarios: { some: { dia_semana: 'Lunes', hora_inicio: '1970-01-01T17:00:00.000Z' } },
    })
    expect(consultaDe(prismaFalso.itemFactura.findMany).where.id_referencia).toEqual({ in: [1] })
    expect(res.body.filtros).toEqual([
      `Período: Año ${new Date().getFullYear()}`,
      'Deporte: Fútbol',
      'Nivel educativo: Todos',
      'Horario: Lunes 17:00',
      'Profesor: Gómez, Marta',
    ])
  })

  it('si ninguna actividad cumple los filtros, no trae ítems', async () => {
    prismaFalso.actividadExtracurricular.findMany.mockResolvedValue([])
    const res = await pedir('?dia=Domingo')
    expect(consultaDe(prismaFalso.itemFactura.findMany).where.id_referencia).toEqual({ in: [] })
    expect(res.body.bloques[2].filas).toEqual([])
  })

  it('un ítem de un deporte borrado aparece igual, con su id', async () => {
    prismaFalso.itemFactura.findMany.mockResolvedValue([item(9, 1, 'Acosta', 10, 100, 0)])
    const res = await pedir()
    expect(res.body.bloques[1].filas[0].deporte).toBe('Deporte 9 (dado de baja)')
  })

  it.each([
    ['un día que no existe', '?dia=Feriado'],
    ['una hora inválida', '?hora=17'],
    ['un id de deporte inválido', '?id_actividad=abc'],
    ['un id de profesor inválido', '?id_docente=-1'],
  ])('devuelve 400 con %s, sin consultar la base', async (_caso, consulta) => {
    expect((await pedir(consulta)).status).toBe(400)
    expect(prismaFalso.actividadExtracurricular.findMany).not.toHaveBeenCalled()
    expect(prismaFalso.itemFactura.findMany).not.toHaveBeenCalled()
  })
})

describe('GET /api/reportes/pagos-transporte', () => {
  const pedir = (consulta = '') => request(app).get(`/api/reportes/pagos-transporte${consulta}`).set('Authorization', iniciarSesionComo('Admin'))

  it('solo pide ítems de transporte del recorrido elegido', async () => {
    const res = await pedir('?id_recorrido=7')
    expect(consultaDe(prismaFalso.recorridoTransporte.findMany).where).toEqual({ id_recorrido: 7 })
    const { where } = consultaDe(prismaFalso.itemFactura.findMany)
    expect(where.concepto).toBe('Transporte')
    expect(where.id_referencia).toEqual({ in: [7] })
    expect(res.body.filtros[1]).toBe('Recorrido: Recorrido Norte')
  })

  it('arma el resumen por recorrido, con zona y horario, y el detalle por alumno', async () => {
    prismaFalso.itemFactura.findMany.mockResolvedValue([item(7, 1, 'Acosta', 9, 30000, 0), item(7, 1, 'Acosta', 10, 30000, 30000)])
    const res = await pedir('?anio=2026')
    expect(res.body.titulo).toBe('Pagos de transporte')
    expect(res.body.bloques[1].filas).toEqual([
      { recorrido: 'Recorrido Norte', zona: 'Barrio Norte', horario: '07:00 / 13:30', alumnos: 1, facturado: '$ 60.000,00', pagado: '$ 30.000,00', saldo: '$ 30.000,00' },
    ])
    expect(res.body.bloques[2].columnas[0].label).toBe('Recorrido')
    expect(res.body.bloques[2].filas.map((f: { periodo: string; estado: string }) => `${f.periodo} ${f.estado}`)).toEqual([
      'Septiembre 2026 Pagada',
      'Octubre 2026 Pendiente',
    ])
  })

  it('un id de recorrido inválido devuelve 400', async () => {
    expect((await pedir('?id_recorrido=abc')).status).toBe(400)
  })
})
