import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ID_USUARIO, iniciarSesionComo, prismaFalso } from './ayudas.js'

vi.mock('../src/lib/prisma.js', async () => ({ prisma: (await import('./ayudas.js')).prismaFalso }))

const { app } = await import('../src/app.js')

/** Lo que se le pidió a Prisma en una llamada, pasado por JSON: las fechas quedan como texto ISO. */
const consultaDe = (mock: { mock: { calls: unknown[][] } }, llamada = 0) => JSON.parse(JSON.stringify(mock.mock.calls[llamada][0]))
const haceDias = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
const dia = (texto: string) => new Date(`${texto}T00:00:00Z`)

const ALUMNO = { id_alumno: 7, nombre: 'Lucía', apellido: 'Acosta', dni: '47002118', fecha_nacimiento: new Date('2016-03-04'), obra_social: null, nro_obra_social: null, telefono_emergencia: null, nombre_contacto_emergencia: null, cursos: null }

beforeEach(() => {
  vi.clearAllMocks()
  prismaFalso.alumno.findUnique.mockResolvedValue(ALUMNO)
  prismaFalso.alumno.findFirst.mockResolvedValue(null)
  prismaFalso.certificadoAptitud.findMany.mockResolvedValue([])
  prismaFalso.certificadoAptitud.findFirst.mockResolvedValue(null)
  prismaFalso.certificadoAptitud.create.mockImplementation(async ({ data }: { data: object }) => ({ id_certificado: 3, ...data }))
  prismaFalso.certificadoAptitud.update.mockImplementation(async ({ data }: { data: object }) => ({ id_certificado: 3, ...data }))
  prismaFalso.auditoriaSalud.create.mockResolvedValue({})
})

const como = (rol: string) => iniciarSesionComo(rol)
const familiaDe7 = () => {
  const token = como('Padre')
  prismaFalso.alumno.findFirst.mockResolvedValue({ id_alumno: 7 })
  return token
}

type Metodo = 'get' | 'put' | 'post'
const pedir = (metodo: Metodo, ruta: string, token?: string, cuerpo?: object) => {
  const pedido = metodo === 'get' ? request(app).get(ruta) : metodo === 'put' ? request(app).put(ruta) : request(app).post(ruta)
  return (token ? pedido.set('Authorization', token) : pedido).send(cuerpo ?? {})
}

const RUTAS: [Metodo, string][] = [
  ['get', '/api/salud/alumnos/7/aptitud'],
  ['post', '/api/salud/alumnos/7/aptitud'],
  ['put', '/api/salud/aptitud/3'],
  ['get', '/api/salud/aptitud/pendientes'],
]

describe('permisos', () => {
  it.each(RUTAS)('%s %s sin sesión devuelve 401', async (metodo, ruta) => {
    expect((await pedir(metodo, ruta)).status).toBe(401)
  })

  it.each(['Enfermero', 'Admin', 'Directivo'])('%s ve el estado de aptitud de un alumno', async (rol) => {
    expect((await pedir('get', '/api/salud/alumnos/7/aptitud', como(rol))).status).toBe(200)
  })

  it('la familia del alumno ve el estado de aptitud de su hijo, y una familia ajena no', async () => {
    expect((await pedir('get', '/api/salud/alumnos/7/aptitud', familiaDe7())).status).toBe(200)
    const ajena = como('Padre')
    prismaFalso.alumno.findFirst.mockResolvedValue(null)
    expect((await pedir('get', '/api/salud/alumnos/7/aptitud', ajena)).status).toBe(403)
  })

  it('un Docente no ve los certificados: ve el estado en el resumen', async () => {
    expect((await pedir('get', '/api/salud/alumnos/7/aptitud', como('Docente'))).status).toBe(403)
    expect(prismaFalso.certificadoAptitud.findMany).not.toHaveBeenCalled()
  })

  it.each(['Padre', 'Alumno', 'Docente'])('%s no puede cargar ni corregir un certificado, ni ver los pendientes', async (rol) => {
    const token = rol === 'Padre' ? familiaDe7() : como(rol)
    expect((await pedir('post', '/api/salud/alumnos/7/aptitud', token, { fecha_emision: haceDias(5) })).status).toBe(403)
    expect((await pedir('put', '/api/salud/aptitud/3', token, { fecha_emision: haceDias(5) })).status).toBe(403)
    expect((await pedir('get', '/api/salud/aptitud/pendientes', token)).status).toBe(403)
    expect(prismaFalso.certificadoAptitud.create).not.toHaveBeenCalled()
    expect(prismaFalso.certificadoAptitud.update).not.toHaveBeenCalled()
  })
})

describe('GET /api/salud/alumnos/:id/aptitud', () => {
  it('sin certificados, la aptitud falta', async () => {
    const res = await pedir('get', '/api/salud/alumnos/7/aptitud', como('Enfermero'))
    expect(res.body).toEqual({ aptitud: { estado: 'Faltante', vigente_hasta: null, dias_restantes: null, por_vencer: false }, certificados: [] })
  })

  it('con certificados, trae el estado según el que vence más tarde y la lista con quién lo cargó', async () => {
    prismaFalso.certificadoAptitud.findMany.mockResolvedValue([
      { id_certificado: 5, id_alumno: 7, fecha_emision: dia('2026-09-01'), fecha_vencimiento: dia('2999-09-01'), observaciones: 'Apto', registra: { nombre: 'Ana', apellido: 'Gómez' } },
      { id_certificado: 2, id_alumno: 7, fecha_emision: dia('2025-01-10'), fecha_vencimiento: dia('2026-01-10'), observaciones: null, registra: null },
    ])
    const res = await pedir('get', '/api/salud/alumnos/7/aptitud', como('Enfermero'))
    expect(res.body.aptitud).toMatchObject({ estado: 'Vigente', vigente_hasta: '2999-09-01' })
    expect(res.body.certificados.map((c: { registrado_por: string | null; fecha_emision: string }) => [c.fecha_emision, c.registrado_por])).toEqual([
      ['2026-09-01', 'Gómez, Ana'],
      ['2025-01-10', null],
    ])
    expect(consultaDe(prismaFalso.certificadoAptitud.findMany).orderBy).toEqual([{ fecha_vencimiento: 'desc' }, { id_certificado: 'desc' }])
  })

  it('un alumno que no existe devuelve 404', async () => {
    prismaFalso.alumno.findUnique.mockResolvedValue(null)
    expect((await pedir('get', '/api/salud/alumnos/99/aptitud', como('Enfermero'))).status).toBe(404)
  })
})

describe('POST /api/salud/alumnos/:id/aptitud', () => {
  const cargar = (cuerpo: object) => pedir('post', '/api/salud/alumnos/7/aptitud', como('Enfermero'), cuerpo)

  it('carga el certificado con el vencimiento a un año, quién lo cargó y la auditoría de alta', async () => {
    const emision = haceDias(5)
    const res = await cargar({ fecha_emision: emision, observaciones: 'Apto para todo deporte' })
    expect(res.status).toBe(201)

    const { data } = consultaDe(prismaFalso.certificadoAptitud.create)
    expect(data).toMatchObject({ id_alumno: 7, observaciones: 'Apto para todo deporte', id_usuario_registra: ID_USUARIO })
    expect(data.fecha_emision.slice(0, 10)).toBe(emision)
    const anio = Number(emision.slice(0, 4)) + 1
    expect(data.fecha_vencimiento.slice(0, 10)).toBe(`${anio}${emision.slice(4)}`.replace(`${anio}-02-29`, `${anio}-02-28`))

    const auditoria = consultaDe(prismaFalso.auditoriaSalud.create).data
    expect(auditoria).toMatchObject({ id_alumno: 7, entidad: 'Certificado de aptitud', accion: 'Alta', id_registro: 3, id_usuario: ID_USUARIO })
    expect(auditoria.cambios.fecha_emision).toEqual({ antes: null, despues: emision })
  })

  it.each([
    ['sin fecha de emisión', {}],
    ['con una fecha futura', { fecha_emision: '2999-01-01' }],
    ['con una fecha que no existe', { fecha_emision: '2026-99-99' }],
    ['de un certificado que ya venció', { fecha_emision: '2020-01-01' }],
    ['con observaciones de más de 500 caracteres', { fecha_emision: haceDias(5), observaciones: 'x'.repeat(501) }],
  ])('devuelve 400 %s, sin guardar nada', async (_caso, cuerpo) => {
    expect((await cargar(cuerpo)).status).toBe(400)
    expect(prismaFalso.certificadoAptitud.create).not.toHaveBeenCalled()
    expect(prismaFalso.auditoriaSalud.create).not.toHaveBeenCalled()
  })

  it('dos certificados emitidos el mismo día devuelven 409', async () => {
    prismaFalso.certificadoAptitud.findFirst.mockResolvedValue({ id_certificado: 1 })
    const res = await cargar({ fecha_emision: haceDias(5) })
    expect(res.status).toBe(409)
    expect(res.body.error).toContain('ya tiene un certificado emitido el')
    expect(prismaFalso.certificadoAptitud.create).not.toHaveBeenCalled()
  })

  it('un alumno que no existe devuelve 404', async () => {
    prismaFalso.alumno.findUnique.mockResolvedValue(null)
    expect((await cargar({ fecha_emision: haceDias(5) })).status).toBe(404)
  })

  it('el certificado y su auditoría se guardan juntos, en una transacción', async () => {
    await cargar({ fecha_emision: haceDias(5) })
    expect(prismaFalso.$transaction).toHaveBeenCalledTimes(1)
  })
})

describe('PUT /api/salud/aptitud/:id', () => {
  const emision = haceDias(40)
  const ACTUAL = { id_certificado: 3, id_alumno: 7, fecha_emision: dia(emision), fecha_vencimiento: dia(`${Number(emision.slice(0, 4)) + 1}${emision.slice(4)}`.replace(/-02-29$/, '-02-28')), observaciones: null }
  const corregir = (cuerpo: object) => pedir('put', '/api/salud/aptitud/3', como('Enfermero'), cuerpo)

  beforeEach(() => {
    prismaFalso.certificadoAptitud.findUnique.mockResolvedValue(ACTUAL)
  })

  it('corrige la emisión, vuelve a calcular el vencimiento y audita el antes y el después', async () => {
    const nueva = haceDias(10)
    const res = await corregir({ fecha_emision: nueva })
    expect(res.status).toBe(200)
    expect(consultaDe(prismaFalso.certificadoAptitud.update).where).toEqual({ id_certificado: 3 })
    const auditoria = consultaDe(prismaFalso.auditoriaSalud.create).data
    expect(auditoria).toMatchObject({ id_alumno: 7, entidad: 'Certificado de aptitud', accion: 'Modificación', id_registro: 3 })
    expect(auditoria.cambios.fecha_emision).toEqual({ antes: emision, despues: nueva })
    expect(Object.keys(auditoria.cambios)).toContain('fecha_vencimiento')
  })

  it('corregir solo las observaciones audita solo eso', async () => {
    await corregir({ fecha_emision: emision, observaciones: 'Con restricción en natación' })
    expect(Object.keys(consultaDe(prismaFalso.auditoriaSalud.create).data.cambios)).toEqual(['observaciones'])
  })

  it('sin cambios no toca la base ni deja auditoría', async () => {
    expect((await corregir({ fecha_emision: emision })).status).toBe(200)
    expect(prismaFalso.certificadoAptitud.update).not.toHaveBeenCalled()
    expect(prismaFalso.auditoriaSalud.create).not.toHaveBeenCalled()
  })

  it('un certificado que no existe devuelve 404', async () => {
    prismaFalso.certificadoAptitud.findUnique.mockResolvedValue(null)
    expect((await corregir({ fecha_emision: haceDias(10) })).status).toBe(404)
  })

  it('cambiarlo a un día en que ya hay otro certificado devuelve 409, y no cuenta contra sí mismo', async () => {
    prismaFalso.certificadoAptitud.findFirst.mockResolvedValue({ id_certificado: 9 })
    expect((await corregir({ fecha_emision: haceDias(10) })).status).toBe(409)
    expect(consultaDe(prismaFalso.certificadoAptitud.findFirst).where.NOT).toEqual({ id_certificado: 3 })
    expect(prismaFalso.certificadoAptitud.update).not.toHaveBeenCalled()
  })

  it('la corrección también valida la fecha', async () => {
    expect((await corregir({ fecha_emision: '2999-01-01' })).status).toBe(400)
    expect((await corregir({ fecha_emision: '2020-01-01' })).status).toBe(400)
    expect(prismaFalso.certificadoAptitud.update).not.toHaveBeenCalled()
  })

  it('no hay forma de borrar un certificado', async () => {
    const res = await request(app).delete('/api/salud/aptitud/3').set('Authorization', como('Admin'))
    expect(res.status).toBe(404)
  })
})

describe('GET /api/salud/aptitud/pendientes', () => {
  it('pide los alumnos activos inscriptos a un deporte que no tienen un certificado que venza de hoy en adelante', async () => {
    prismaFalso.alumno.findMany.mockResolvedValue([])
    await pedir('get', '/api/salud/aptitud/pendientes', como('Enfermero'))
    const { where } = consultaDe(prismaFalso.alumno.findMany)
    expect(where.activo).toBe(true)
    expect(where.inscripciones_actividades).toEqual({ some: { actividades_extracurriculares: { tipo: 'Deporte' } } })
    expect(where.certificados_aptitud.none.fecha_vencimiento.gte).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/)
  })

  it('distingue al que nunca tuvo certificado del que lo tiene vencido, y lista sus deportes', async () => {
    prismaFalso.alumno.findMany.mockResolvedValue([
      { id_alumno: 7, nombre: 'Lucía', apellido: 'Acosta', dni: '1', cursos: null, inscripciones_actividades: [{ actividades_extracurriculares: { nombre: 'Natación' } }, { actividades_extracurriculares: { nombre: 'Fútbol' } }], certificados_aptitud: [] },
      { id_alumno: 8, nombre: 'Beto', apellido: 'Díaz', dni: '2', cursos: null, inscripciones_actividades: [{ actividades_extracurriculares: { nombre: 'Atletismo' } }], certificados_aptitud: [{ fecha_vencimiento: dia('2020-05-04') }] },
    ])
    const res = await pedir('get', '/api/salud/aptitud/pendientes', como('Enfermero'))
    expect(res.body.map((a: { estado: string; vigente_hasta: string | null; deportes: string[] }) => [a.estado, a.vigente_hasta, a.deportes])).toEqual([
      ['Faltante', null, ['Natación', 'Fútbol']],
      ['Vencido', '2020-05-04', ['Atletismo']],
    ])
    expect(res.body[0]).not.toHaveProperty('inscripciones_actividades')
    expect(res.body[0]).not.toHaveProperty('certificados_aptitud')
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

const FUTBOL = { nombre: 'Fútbol', tipo: 'Deporte', cupo_maximo: 22, activo: true, horarios: [], _count: { inscripciones_actividades: 3 } }
const dosDeportes = [{ actividades_extracurriculares: { nombre: 'Atletismo', horarios: [], activo: true } }, { actividades_extracurriculares: { nombre: 'Natación', horarios: [], activo: true } }]

describe('inscripción a un deporte: exige certificado de aptitud vigente', () => {
  beforeEach(() => {
    prismaFalso.$transaction.mockImplementation(async (funcion: (t: unknown) => unknown) => funcion(tx))
    tx.$queryRaw.mockResolvedValue([{ '?column?': 1 }])
    tx.actividadExtracurricular.findUnique.mockResolvedValue(FUTBOL)
    tx.inscripcionActividad.findUnique.mockResolvedValue(null)
    tx.inscripcionActividad.findMany.mockResolvedValue([])
    tx.inscripcionActividad.create.mockResolvedValue({ id_inscripcion_act: 9, id_actividad: 6, id_alumno: 4 })
    tx.vigenciaServicio.findFirst.mockResolvedValue(null)
    tx.certificadoAptitud.findFirst.mockResolvedValue({ fecha_vencimiento: dia('2999-01-01') })
  })

  const inscribir = (token: string) => request(app).post('/api/actividades/6/inscripciones').set('Authorization', token).send({ id_alumno: 4 })
  const noSeInscribio = () => {
    expect(tx.inscripcionActividad.create).not.toHaveBeenCalled()
    expect(tx.vigenciaServicio.create).not.toHaveBeenCalled()
  }

  it('con el certificado vigente se inscribe', async () => {
    const res = await inscribir(como('Admin'))
    expect(res.status).toBe(201)
    expect(tx.inscripcionActividad.create).toHaveBeenCalledTimes(1)
  })

  it('sin ningún certificado devuelve 409 con el código APTITUD_FISICA y dice qué hacer', async () => {
    tx.certificadoAptitud.findFirst.mockResolvedValue(null)
    const res = await inscribir(como('Admin'))
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('APTITUD_FISICA')
    expect(res.body.error).toContain('certificado de aptitud física vigente')
    expect(res.body.error).toContain('Todavía no tiene ninguno cargado')
    expect(res.body.error).toContain('Presentalo en enfermería')
    noSeInscribio()
  })

  it('con el certificado vencido devuelve 409 y dice cuándo venció', async () => {
    tx.certificadoAptitud.findFirst.mockResolvedValue({ fecha_vencimiento: dia('2020-05-04') })
    const res = await inscribir(como('Admin'))
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('APTITUD_FISICA')
    expect(res.body.error).toContain('El último venció el 04/05/2020')
    noSeInscribio()
  })

  it('un certificado que vence hoy todavía sirve', async () => {
    tx.certificadoAptitud.findFirst.mockResolvedValue({ fecha_vencimiento: dia(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })) })
    expect((await inscribir(como('Admin'))).status).toBe(201)
  })

  it('la familia recibe el mismo rechazo para su hijo', async () => {
    tx.certificadoAptitud.findFirst.mockResolvedValue(null)
    const token = como('Padre')
    prismaFalso.alumno.findFirst.mockResolvedValue({ id_alumno: 4 })
    const res = await inscribir(token)
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('APTITUD_FISICA')
  })

  it('el certificado es del alumno: se busca el del alumno que se inscribe, el último en vencer', async () => {
    await inscribir(como('Admin'))
    const consulta = consultaDe(tx.certificadoAptitud.findFirst as unknown as { mock: { calls: unknown[][] } })
    expect(consulta.where).toEqual({ id_alumno: 4 })
    expect(consulta.orderBy).toEqual({ fecha_vencimiento: 'desc' })
  })

  it('se pide antes que el tope de dos deportes: sin certificado, el primer motivo es el certificado', async () => {
    tx.certificadoAptitud.findFirst.mockResolvedValue(null)
    tx.inscripcionActividad.findMany.mockResolvedValue(dosDeportes)
    const res = await inscribir(como('Admin'))
    expect(res.body.code).toBe('APTITUD_FISICA')
  })

  it('con el certificado vigente, el tope de dos deportes se sigue controlando', async () => {
    tx.inscripcionActividad.findMany.mockResolvedValue(dosDeportes)
    const res = await inscribir(como('Admin'))
    expect(res.body.code).toBe('TOPE_DEPORTES')
  })

  it('un idioma no pide certificado: ni siquiera se consulta', async () => {
    tx.actividadExtracurricular.findUnique.mockResolvedValue({ ...FUTBOL, nombre: 'Inglés', tipo: 'Idioma' })
    tx.certificadoAptitud.findFirst.mockResolvedValue(null)
    const res = await inscribir(como('Admin'))
    expect(res.status).toBe(201)
    expect(tx.certificadoAptitud.findFirst).not.toHaveBeenCalled()
  })

  it('los alumnos ya inscriptos no se tocan: el control es solo para inscripciones nuevas', async () => {
    // Dar de baja una inscripción existente no pide certificado.
    prismaFalso.$transaction.mockImplementation(async (funcion: (t: unknown) => unknown) => funcion({ inscripcionActividad: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) }, vigenciaServicio: { updateMany: vi.fn() } }))
    const res = await request(app).delete('/api/actividades/6/inscripciones/4').set('Authorization', como('Admin'))
    expect(res.status).toBe(204)
    expect(tx.certificadoAptitud.findFirst).not.toHaveBeenCalled()
  })
})
