import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ID_USUARIO, iniciarSesionComo, prismaFalso } from './ayudas.js'

vi.mock('../src/lib/prisma.js', async () => ({ prisma: (await import('./ayudas.js')).prismaFalso }))

const { app } = await import('../src/app.js')

/** Lo que se le pidió a Prisma en la primera llamada, pasado por JSON: las fechas quedan como texto ISO. */
const consultaDe = (mock: { mock: { calls: unknown[][] } }, llamada = 0) => JSON.parse(JSON.stringify(mock.mock.calls[llamada][0]))

const ALUMNO = {
  id_alumno: 7,
  nombre: 'Lucía',
  apellido: 'Acosta',
  dni: '47002118',
  fecha_nacimiento: new Date('2016-03-04'),
  obra_social: 'OSDE',
  nro_obra_social: '123',
  telefono_emergencia: '3794-111222',
  nombre_contacto_emergencia: 'Marta Acosta',
  cursos: { nivel: 'Primario', grado_anio: '3', division: 'A' },
}

const FICHA = {
  id_ficha: 1,
  id_alumno: 7,
  grupo_sanguineo: 'A+',
  alergias: 'Polen',
  alergias_criticas: 'Maní',
  medicacion: null,
  condiciones: null,
  observaciones: null,
  updated_at: new Date('2026-10-01T12:00:00Z'),
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaFalso.alumno.findUnique.mockResolvedValue(ALUMNO)
  prismaFalso.alumno.findFirst.mockResolvedValue(null)
  prismaFalso.fichaMedica.findUnique.mockResolvedValue(FICHA)
  prismaFalso.fichaMedica.create.mockImplementation(async ({ data }: { data: object }) => ({ id_ficha: 1, ...data }))
  prismaFalso.fichaMedica.update.mockImplementation(async ({ data }: { data: object }) => ({ ...FICHA, ...data }))
  prismaFalso.atencionEnfermeria.findMany.mockResolvedValue([])
  prismaFalso.atencionEnfermeria.create.mockImplementation(async ({ data }: { data: object }) => ({ id_atencion: 9, familia_avisada: false, ...data }))
  prismaFalso.auditoriaSalud.create.mockResolvedValue({})
  prismaFalso.auditoriaSalud.findMany.mockResolvedValue([])
})

const como = (rol: string) => iniciarSesionComo(rol)
/** Una familia dueña del alumno 7. */
const familiaDe7 = () => {
  const token = como('Padre')
  prismaFalso.alumno.findFirst.mockResolvedValue({ id_alumno: 7 })
  return token
}

type Metodo = 'get' | 'put' | 'post'
const pedir = (metodo: Metodo, ruta: string, token?: string, cuerpo?: object) => {
  const pedido = request(app)[metodo](ruta)
  return (token ? pedido.set('Authorization', token) : pedido).send(cuerpo ?? {})
}

const RUTAS: [Metodo, string][] = [
  ['get', '/api/salud/alumnos'],
  ['get', '/api/salud/alumnos/7/ficha'],
  ['put', '/api/salud/alumnos/7/ficha'],
  ['get', '/api/salud/alumnos/7/atenciones'],
  ['post', '/api/salud/alumnos/7/atenciones'],
  ['put', '/api/salud/atenciones/9'],
  ['get', '/api/salud/alumnos/7/auditoria'],
  ['get', '/api/salud/alumnos/7/resumen'],
]

describe('sin sesión', () => {
  it.each(RUTAS)('%s %s devuelve 401', async (metodo, ruta) => {
    expect((await pedir(metodo, ruta)).status).toBe(401)
  })
})

describe('permisos por rol', () => {
  // Qué puede cada rol, con una familia ajena y un docente como los casos que más importan.
  it.each([
    ['Enfermero', 200],
    ['Admin', 200],
    ['Directivo', 200],
  ])('%s ve la ficha completa', async (rol, estado) => {
    expect((await pedir('get', '/api/salud/alumnos/7/ficha', como(rol))).status).toBe(estado)
  })

  it('la familia del alumno ve la ficha y las atenciones de su hijo', async () => {
    const token = familiaDe7()
    expect((await pedir('get', '/api/salud/alumnos/7/ficha', token)).status).toBe(200)
    expect((await pedir('get', '/api/salud/alumnos/7/atenciones', token)).status).toBe(200)
  })

  it('una familia ajena recibe 403 en la ficha y en las atenciones', async () => {
    const token = como('Padre')
    prismaFalso.alumno.findFirst.mockResolvedValue(null)
    expect((await pedir('get', '/api/salud/alumnos/7/ficha', token)).status).toBe(403)
    expect((await pedir('get', '/api/salud/alumnos/7/atenciones', token)).status).toBe(403)
    expect(prismaFalso.fichaMedica.findUnique).not.toHaveBeenCalled()
  })

  it('el tutor se comprueba contra el alumno pedido', async () => {
    await pedir('get', '/api/salud/alumnos/7/ficha', familiaDe7())
    expect(consultaDe(prismaFalso.alumno.findFirst).where).toEqual({ id_alumno: 7, id_usuario_padre: ID_USUARIO })
  })

  it('un Docente NO ve la ficha ni las atenciones: recibe 403 sin consultar nada', async () => {
    const token = como('Docente')
    expect((await pedir('get', '/api/salud/alumnos/7/ficha', token)).status).toBe(403)
    expect((await pedir('get', '/api/salud/alumnos/7/atenciones', token)).status).toBe(403)
    expect(prismaFalso.fichaMedica.findUnique).not.toHaveBeenCalled()
    expect(prismaFalso.atencionEnfermeria.findMany).not.toHaveBeenCalled()
  })

  it('un Docente recibe 403 aunque figure como tutor del alumno: la regla del rol no depende del vínculo', async () => {
    const token = como('Docente')
    prismaFalso.alumno.findFirst.mockResolvedValue({ id_alumno: 7 })
    expect((await pedir('get', '/api/salud/alumnos/7/ficha', token)).status).toBe(403)
    expect((await pedir('get', '/api/salud/alumnos/7/atenciones', token)).status).toBe(403)
  })

  it('el propio alumno no ve la ficha: es de la familia', async () => {
    const token = como('Alumno')
    expect((await pedir('get', '/api/salud/alumnos/7/ficha', token)).status).toBe(403)
  })

  it.each(['Padre', 'Alumno', 'Docente'])('%s no puede cargar ni corregir nada', async (rol) => {
    const token = rol === 'Padre' ? familiaDe7() : como(rol)
    expect((await pedir('put', '/api/salud/alumnos/7/ficha', token, { alergias: 'x' })).status).toBe(403)
    expect((await pedir('post', '/api/salud/alumnos/7/atenciones', token, { motivo: 'x' })).status).toBe(403)
    expect((await pedir('put', '/api/salud/atenciones/9', token, { motivo: 'x' })).status).toBe(403)
    expect(prismaFalso.fichaMedica.create).not.toHaveBeenCalled()
    expect(prismaFalso.atencionEnfermeria.create).not.toHaveBeenCalled()
  })

  it.each(['Padre', 'Alumno', 'Docente'])('%s no puede buscar alumnos ni ver la auditoría', async (rol) => {
    const token = rol === 'Padre' ? familiaDe7() : como(rol)
    expect((await pedir('get', '/api/salud/alumnos', token)).status).toBe(403)
    expect((await pedir('get', '/api/salud/alumnos/7/auditoria', token)).status).toBe(403)
  })

  it('un usuario desactivado no entra, ni siquiera siendo Enfermero', async () => {
    const token = iniciarSesionComo('Enfermero', false)
    expect((await pedir('get', '/api/salud/alumnos/7/ficha', token)).status).toBe(403)
  })
})

describe('resumen para docentes', () => {
  it.each(['Docente', 'Enfermero', 'Admin', 'Directivo'])('%s ve el resumen', async (rol) => {
    expect((await pedir('get', '/api/salud/alumnos/7/resumen', como(rol))).status).toBe(200)
  })

  it('el resumen trae solo las alergias críticas y el contacto de emergencia, nada más', async () => {
    const res = await pedir('get', '/api/salud/alumnos/7/resumen', como('Docente'))
    expect(res.body).toEqual({
      id_alumno: 7,
      alergias_criticas: 'Maní',
      nombre_contacto_emergencia: 'Marta Acosta',
      telefono_emergencia: '3794-111222',
      ficha_cargada: true,
    })
    const texto = JSON.stringify(res.body)
    for (const dato of ['Polen', 'A+', 'OSDE', '47002118']) expect(texto).not.toContain(dato)
  })

  it('pide a la base solo las alergias críticas de la ficha', async () => {
    await pedir('get', '/api/salud/alumnos/7/resumen', como('Docente'))
    expect(consultaDe(prismaFalso.fichaMedica.findUnique).select).toEqual({ alergias_criticas: true })
  })

  it('sin ficha cargada avisa que no hay y deja las alergias en null', async () => {
    prismaFalso.fichaMedica.findUnique.mockResolvedValue(null)
    const res = await pedir('get', '/api/salud/alumnos/7/resumen', como('Docente'))
    expect(res.body).toMatchObject({ alergias_criticas: null, ficha_cargada: false })
  })

  it('una familia o un alumno no usan el resumen: ven la ficha', async () => {
    expect((await pedir('get', '/api/salud/alumnos/7/resumen', familiaDe7())).status).toBe(403)
    expect((await pedir('get', '/api/salud/alumnos/7/resumen', como('Alumno'))).status).toBe(403)
  })

  it('un alumno que no existe devuelve 404', async () => {
    prismaFalso.alumno.findUnique.mockResolvedValue(null)
    expect((await pedir('get', '/api/salud/alumnos/99/resumen', como('Docente'))).status).toBe(404)
  })
})

describe('ficha médica', () => {
  const ficha = (cuerpo: object) => pedir('put', '/api/salud/alumnos/7/ficha', como('Enfermero'), cuerpo)

  it('la primera vez crea la ficha y deja una auditoría de alta con lo cargado', async () => {
    prismaFalso.fichaMedica.findUnique.mockResolvedValue(null)
    const res = await ficha({ grupo_sanguineo: 'A+', alergias_criticas: 'Maní', alergias: '' })
    expect(res.status).toBe(200)
    expect(prismaFalso.fichaMedica.create).toHaveBeenCalledTimes(1)

    const auditoria = consultaDe(prismaFalso.auditoriaSalud.create).data
    expect(auditoria).toMatchObject({ id_alumno: 7, entidad: 'Ficha médica', accion: 'Alta', id_usuario: ID_USUARIO })
    expect(auditoria.cambios).toEqual({ grupo_sanguineo: { antes: null, despues: 'A+' }, alergias_criticas: { antes: null, despues: 'Maní' } })
  })

  it('al modificarla guarda solo lo que cambió, con el antes y el después', async () => {
    const res = await ficha({ ...FICHA, alergias: 'Polen y ácaros' })
    expect(res.status).toBe(200)
    expect(prismaFalso.fichaMedica.update).toHaveBeenCalledTimes(1)
    const auditoria = consultaDe(prismaFalso.auditoriaSalud.create).data
    expect(auditoria).toMatchObject({ entidad: 'Ficha médica', accion: 'Modificación', id_registro: 1 })
    expect(auditoria.cambios).toEqual({ alergias: { antes: 'Polen', despues: 'Polen y ácaros' } })
  })

  it('si no cambió nada no toca la base ni deja auditoría', async () => {
    const res = await ficha({ ...FICHA })
    expect(res.status).toBe(200)
    expect(prismaFalso.fichaMedica.update).not.toHaveBeenCalled()
    expect(prismaFalso.auditoriaSalud.create).not.toHaveBeenCalled()
  })

  it('borrar un dato también es un cambio y queda auditado', async () => {
    await ficha({ ...FICHA, alergias_criticas: '' })
    expect(consultaDe(prismaFalso.auditoriaSalud.create).data.cambios).toEqual({ alergias_criticas: { antes: 'Maní', despues: null } })
  })

  it('la ficha y su auditoría se guardan juntas, en una transacción', async () => {
    await ficha({ alergias: 'Nueces' })
    expect(prismaFalso.$transaction).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['un grupo sanguíneo inválido', { grupo_sanguineo: 'Z+' }],
    ['un texto de más de 1000 caracteres', { observaciones: 'x'.repeat(1001) }],
  ])('devuelve 400 con %s, sin guardar nada', async (_caso, cuerpo) => {
    expect((await ficha(cuerpo)).status).toBe(400)
    expect(prismaFalso.fichaMedica.create).not.toHaveBeenCalled()
    expect(prismaFalso.fichaMedica.update).not.toHaveBeenCalled()
    expect(prismaFalso.auditoriaSalud.create).not.toHaveBeenCalled()
  })

  it('un alumno que no existe devuelve 404', async () => {
    prismaFalso.alumno.findUnique.mockResolvedValue(null)
    expect((await ficha({ alergias: 'x' })).status).toBe(404)
  })

  it('la ficha de lectura trae los datos del alumno y la ficha', async () => {
    const res = await pedir('get', '/api/salud/alumnos/7/ficha', como('Enfermero'))
    expect(res.body.alumno).toMatchObject({ dni: '47002118', obra_social: 'OSDE', nombre_contacto_emergencia: 'Marta Acosta' })
    expect(res.body.ficha).toMatchObject({ grupo_sanguineo: 'A+', alergias_criticas: 'Maní' })
  })

  it('un alumno sin ficha devuelve ficha en null', async () => {
    prismaFalso.fichaMedica.findUnique.mockResolvedValue(null)
    expect((await pedir('get', '/api/salud/alumnos/7/ficha', como('Enfermero'))).body.ficha).toBeNull()
  })

  it('un id inválido devuelve 400', async () => {
    expect((await pedir('get', '/api/salud/alumnos/abc/ficha', como('Enfermero'))).status).toBe(400)
  })
})

describe('atenciones', () => {
  const registrar = (cuerpo: object) => pedir('post', '/api/salud/alumnos/7/atenciones', como('Enfermero'), cuerpo)

  it('registra la atención con quien la cargó y deja la auditoría de alta', async () => {
    const res = await registrar({ motivo: 'Dolor de cabeza', descripcion: 'Desde la mañana', tratamiento: 'Reposo' })
    expect(res.status).toBe(201)
    const { data } = consultaDe(prismaFalso.atencionEnfermeria.create)
    expect(data).toMatchObject({ id_alumno: 7, motivo: 'Dolor de cabeza', tratamiento: 'Reposo', id_usuario_registra: ID_USUARIO })
    expect(data).not.toHaveProperty('fecha_hora')
    const auditoria = consultaDe(prismaFalso.auditoriaSalud.create).data
    expect(auditoria).toMatchObject({ entidad: 'Atención', accion: 'Alta', id_registro: 9, id_usuario: ID_USUARIO })
    expect(auditoria.cambios.motivo).toEqual({ antes: null, despues: 'Dolor de cabeza' })
  })

  it('respeta la fecha y hora que cargó enfermería, si es pasada', async () => {
    await registrar({ motivo: 'Caída en el recreo', fecha_hora: '2026-10-20T10:30:00Z' })
    expect(consultaDe(prismaFalso.atencionEnfermeria.create).data.fecha_hora).toBe('2026-10-20T10:30:00.000Z')
  })

  it.each([
    ['sin motivo', {}],
    ['con una fecha futura', { motivo: 'x', fecha_hora: '2999-01-01T10:00:00Z' }],
    ['con una fecha inválida', { motivo: 'x', fecha_hora: 'ayer' }],
    ['con un motivo de más de 200 caracteres', { motivo: 'x'.repeat(201) }],
  ])('devuelve 400 %s, sin guardar nada', async (_caso, cuerpo) => {
    expect((await registrar(cuerpo)).status).toBe(400)
    expect(prismaFalso.atencionEnfermeria.create).not.toHaveBeenCalled()
    expect(prismaFalso.auditoriaSalud.create).not.toHaveBeenCalled()
  })

  it('un alumno que no existe devuelve 404', async () => {
    prismaFalso.alumno.findUnique.mockResolvedValue(null)
    expect((await registrar({ motivo: 'x' })).status).toBe(404)
  })

  it('la lista trae las atenciones del alumno, de la más reciente a la más antigua, con quién la registró', async () => {
    prismaFalso.atencionEnfermeria.findMany.mockResolvedValue([
      { id_atencion: 9, id_alumno: 7, fecha_hora: new Date('2026-10-20T10:30:00Z'), motivo: 'Caída', descripcion: null, tratamiento: null, familia_avisada: true, registra: { nombre: 'Ana', apellido: 'Gómez' } },
      { id_atencion: 8, id_alumno: 7, fecha_hora: new Date('2026-10-01T09:00:00Z'), motivo: 'Fiebre', descripcion: null, tratamiento: null, familia_avisada: false, registra: null },
    ])
    const res = await pedir('get', '/api/salud/alumnos/7/atenciones', como('Enfermero'))
    const consulta = consultaDe(prismaFalso.atencionEnfermeria.findMany)
    expect(consulta.where).toEqual({ id_alumno: 7 })
    expect(consulta.orderBy).toEqual([{ fecha_hora: 'desc' }, { id_atencion: 'desc' }])
    expect(res.body.map((a: { registrada_por: string | null }) => a.registrada_por)).toEqual(['Gómez, Ana', null])
    expect(res.body[0]).not.toHaveProperty('registra')
  })

  describe('corrección', () => {
    const ACTUAL = { id_atencion: 9, id_alumno: 7, fecha_hora: new Date('2026-10-20T10:30:00Z'), motivo: 'Caída', descripcion: null, tratamiento: null }
    const corregir = (cuerpo: object) => pedir('put', '/api/salud/atenciones/9', como('Enfermero'), cuerpo)

    beforeEach(() => {
      prismaFalso.atencionEnfermeria.findUnique.mockResolvedValue(ACTUAL)
      prismaFalso.atencionEnfermeria.update.mockImplementation(async ({ data }: { data: object }) => ({ ...ACTUAL, ...data }))
    })

    it('guarda la corrección y audita solo lo que cambió', async () => {
      const res = await corregir({ motivo: 'Caída', tratamiento: 'Hielo' })
      expect(res.status).toBe(200)
      const auditoria = consultaDe(prismaFalso.auditoriaSalud.create).data
      expect(auditoria).toMatchObject({ id_alumno: 7, entidad: 'Atención', accion: 'Modificación', id_registro: 9 })
      expect(auditoria.cambios).toEqual({ tratamiento: { antes: null, despues: 'Hielo' } })
    })

    it('sin cambios no toca la base ni deja auditoría', async () => {
      expect((await corregir({ motivo: 'Caída' })).status).toBe(200)
      expect(prismaFalso.atencionEnfermeria.update).not.toHaveBeenCalled()
      expect(prismaFalso.auditoriaSalud.create).not.toHaveBeenCalled()
    })

    it('una atención que no existe devuelve 404', async () => {
      prismaFalso.atencionEnfermeria.findUnique.mockResolvedValue(null)
      expect((await corregir({ motivo: 'x' })).status).toBe(404)
    })

    it('sigue pidiendo el motivo', async () => {
      expect((await corregir({ motivo: '' })).status).toBe(400)
      expect(prismaFalso.atencionEnfermeria.update).not.toHaveBeenCalled()
    })
  })

  it('no hay forma de borrar una atención', async () => {
    const res = await request(app).delete('/api/salud/atenciones/9').set('Authorization', como('Admin'))
    expect(res.status).toBe(404)
  })
})

describe('búsqueda de alumnos y auditoría', () => {
  it('busca por nombre, apellido o DNI, solo entre los activos', async () => {
    prismaFalso.alumno.findMany.mockResolvedValue([])
    await pedir('get', '/api/salud/alumnos?buscar=acosta', como('Enfermero'))
    const { where } = consultaDe(prismaFalso.alumno.findMany)
    expect(where.activo).toBe(true)
    expect(where.OR).toEqual([
      { nombre: { contains: 'acosta', mode: 'insensitive' } },
      { apellido: { contains: 'acosta', mode: 'insensitive' } },
      { dni: { contains: 'acosta' } },
    ])
  })

  it('sin texto trae a todos los activos, con un tope', async () => {
    prismaFalso.alumno.findMany.mockResolvedValue([])
    await pedir('get', '/api/salud/alumnos', como('Enfermero'))
    const consulta = consultaDe(prismaFalso.alumno.findMany)
    expect(consulta.where).toEqual({ activo: true })
    expect(consulta.take).toBe(100)
  })

  it('marca quién tiene ficha, quién tiene alergias críticas y cuándo fue la última atención, sin exponer la ficha', async () => {
    prismaFalso.alumno.findMany.mockResolvedValue([
      { id_alumno: 7, nombre: 'Lucía', apellido: 'Acosta', dni: '1', cursos: null, ficha_medica: { alergias_criticas: 'Maní' }, atenciones_enfermeria: [{ fecha_hora: new Date('2026-10-20T10:30:00Z') }] },
      { id_alumno: 8, nombre: 'Beto', apellido: 'Díaz', dni: '2', cursos: null, ficha_medica: null, atenciones_enfermeria: [] },
    ])
    const res = await pedir('get', '/api/salud/alumnos', como('Enfermero'))
    expect(res.body[0]).toMatchObject({ tiene_ficha: true, tiene_alergias_criticas: true, ultima_atencion: '2026-10-20T10:30:00.000Z' })
    expect(res.body[1]).toMatchObject({ tiene_ficha: false, tiene_alergias_criticas: false, ultima_atencion: null })
    expect(JSON.stringify(res.body)).not.toContain('Maní')
  })

  it('la auditoría trae quién, cuándo y qué cambió, de lo más reciente a lo más antiguo', async () => {
    prismaFalso.auditoriaSalud.findMany.mockResolvedValue([
      { id_auditoria: 2, id_alumno: 7, entidad: 'Ficha médica', id_registro: 1, accion: 'Modificación', cambios: { alergias: { antes: 'Polen', despues: 'Polen y maní' } }, fecha_hora: new Date('2026-10-22T12:00:00Z'), usuarios: { nombre: 'Ana', apellido: 'Gómez', rol: 'Enfermero' } },
    ])
    const res = await pedir('get', '/api/salud/alumnos/7/auditoria', como('Directivo'))
    expect(consultaDe(prismaFalso.auditoriaSalud.findMany).orderBy).toEqual([{ fecha_hora: 'desc' }, { id_auditoria: 'desc' }])
    expect(res.body[0]).toMatchObject({ usuario: 'Gómez, Ana', rol: 'Enfermero', accion: 'Modificación', cambios: { alergias: { antes: 'Polen', despues: 'Polen y maní' } } })
  })
})
