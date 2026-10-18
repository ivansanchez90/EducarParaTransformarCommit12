import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '../src/generated/prisma/client.js'
import { ID_USUARIO, iniciarSesionComo, prismaFalso, usuarioConRol } from './ayudas.js'

vi.mock('../src/lib/prisma.js', async () => ({ prisma: (await import('./ayudas.js')).prismaFalso }))

const { app } = await import('../src/app.js')

type Fn = ReturnType<typeof vi.fn>
// Lo que estas rutas leen y `ayudas.ts` no trae.
const falso = prismaFalso as unknown as {
  usuario: { findUnique: Fn; update: Fn }
  docente: { findUnique: Fn; findMany: Fn; update: Fn }
  materia: { findUnique: Fn }
  curso: { findUnique: Fn }
  asignacion: { findMany: Fn; findUnique: Fn; update: Fn }
  horario: { findMany: Fn }
}

// La transacción usa su propio doble, para no mezclarse con el usuario de la sesión.
const tx = {
  $queryRaw: vi.fn(),
  usuario: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  docente: { create: vi.fn(), update: vi.fn() },
  asignacion: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  horario: { updateMany: vi.fn() },
}

/** La sesión es de un Admin y, además, `usuario.findUnique` por email responde lo que diga `emails`. */
function sesionAdmin(emails: Record<string, { id_usuario: string }> = {}) {
  const token = iniciarSesionComo('Admin')
  falso.usuario.findUnique.mockImplementation(async ({ where }: { where: { id_usuario?: string; email?: string } }) =>
    where.id_usuario ? usuarioConRol('Admin') : (emails[where.email ?? ''] ?? null),
  )
  return token
}

const ALTA = {
  nombre: 'Paula',
  apellido: 'Díaz',
  dni: '30.123.456',
  especialidad: 'Matemática',
  titulo: 'Profesorado',
  email: 'Paula.Diaz@educar.local',
  telefono: '3794-111111',
  fecha_ingreso: '2026-03-01',
  password: 'secreta1',
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaFalso.$transaction.mockImplementation(async (funcion: (t: unknown) => unknown) => funcion(tx))
  falso.docente = { findUnique: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]), update: vi.fn() }
  falso.materia = { findUnique: vi.fn() }
  falso.curso = { findUnique: vi.fn() }
  falso.asignacion = { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn(), update: vi.fn() }
  falso.horario = { findMany: vi.fn().mockResolvedValue([]) }
  tx.usuario.findUnique.mockResolvedValue(null)
  tx.usuario.create.mockResolvedValue({ id_usuario: 'nuevo-usuario', nombre: 'Paula', apellido: 'Díaz' })
  tx.docente.update.mockResolvedValue({ id_docente: 15 })
})

describe('POST /api/docentes', () => {
  const alta = (body: Record<string, unknown>, token = sesionAdmin()) => request(app).post('/api/docentes').set('Authorization', token).send(body)

  it('crea el usuario con rol Docente y completa el legajo (DNI sin puntos, email en minúsculas)', async () => {
    const res = await alta(ALTA)
    expect(res.status).toBe(201)
    const usuario = tx.usuario.create.mock.calls[0][0].data
    expect(usuario).toMatchObject({ email: 'paula.diaz@educar.local', nombre: 'Paula', apellido: 'Díaz', rol: 'Docente' })
    expect(usuario.password_hash).not.toBe('secreta1')
    expect(tx.usuario.update).toHaveBeenCalledWith({ where: { id_usuario: 'nuevo-usuario' }, data: { telefono: '3794-111111' } })
    // crearUsuario() deja la fila del docente y la ruta la completa con el legajo.
    expect(tx.docente.create).toHaveBeenCalledWith({ data: { id_usuario: 'nuevo-usuario', dni: null } })
    expect(tx.docente.update.mock.calls[0][0].where).toEqual({ id_usuario: 'nuevo-usuario' })
    expect(tx.docente.update.mock.calls[0][0].data).toEqual({
      dni: '30123456',
      especialidad: 'Matemática',
      titulo: 'Profesorado',
      fecha_ingreso: new Date('2026-03-01T00:00:00Z'),
    })
  })

  it('un DNI que ya tiene otro profesor da 409 con el mensaje de la HU, sin crear nada', async () => {
    falso.docente.findUnique.mockResolvedValue({ id_docente: 3 })
    const res = await alta(ALTA)
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('Ya existe un profesor registrado con ese DNI')
    expect(tx.usuario.create).not.toHaveBeenCalled()
  })

  it('si dos altas con el mismo DNI llegan juntas, la que rechaza la base también da ese 409', async () => {
    tx.docente.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dni repetido', { code: 'P2002', clientVersion: 'x', meta: { target: ['dni'] } }),
    )
    const res = await alta(ALTA)
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('DNI_DUPLICADO')
  })

  it('un correo que ya usa otro usuario da 409', async () => {
    tx.usuario.findUnique.mockResolvedValue({ id_usuario: 'otro' })
    const res = await alta(ALTA)
    expect(res.status).toBe(409)
    expect(res.body.error).toContain('paula.diaz@educar.local')
  })

  it.each([
    ['sin nombre', { nombre: '' }, 'Nombre y apellido'],
    ['sin correo', { email: '' }, 'correo es obligatorio'],
    ['correo inválido', { email: 'paula' }, 'no es válido'],
    ['DNI con letras', { dni: '30A12345' }, '7 u 8 números'],
    ['DNI corto', { dni: '12345' }, '7 u 8 números'],
    ['contraseña corta', { password: '123' }, 'al menos 6'],
    ['fecha inválida', { fecha_ingreso: 'ayer' }, 'Fecha inválida'],
  ])('%s da 400 sin consultar la base', async (_caso, cambio, mensaje) => {
    const res = await alta({ ...ALTA, ...cambio })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain(mensaje)
    expect(falso.docente.findUnique).not.toHaveBeenCalled()
  })

  it.each(['Docente', 'Padre', 'Alumno'])('%s no puede crear docentes (403)', async (rol) => {
    const res = await alta(ALTA, iniciarSesionComo(rol))
    expect(res.status).toBe(403)
  })
})

describe('PUT /api/docentes/:id', () => {
  const editar = (body: Record<string, unknown>, emails = {}) =>
    request(app).put('/api/docentes/15').set('Authorization', sesionAdmin(emails)).send(body)
  const { password: _p, ...EDICION } = ALTA

  beforeEach(() => {
    falso.docente.findUnique.mockImplementation(async ({ where }: { where: { id_docente?: number; dni?: string } }) =>
      where.id_docente === 15 ? { id_usuario: 'usuario-15' } : null,
    )
  })

  it('actualiza el usuario (nombre, correo, teléfono) y el legajo en una transacción', async () => {
    const res = await editar(EDICION)
    expect(res.status).toBe(200)
    expect(tx.usuario.update).toHaveBeenCalledWith({
      where: { id_usuario: 'usuario-15' },
      data: { nombre: 'Paula', apellido: 'Díaz', email: 'paula.diaz@educar.local', telefono: '3794-111111' },
    })
    expect(tx.docente.update.mock.calls[0][0].where).toEqual({ id_docente: 15 })
  })

  it('puede conservar su propio DNI y su propio correo', async () => {
    falso.docente.findUnique.mockImplementation(async ({ where }: { where: { id_docente?: number; dni?: string } }) =>
      where.id_docente === 15 || where.dni === '30123456' ? { id_docente: 15, id_usuario: 'usuario-15' } : null,
    )
    const res = await editar(EDICION, { 'paula.diaz@educar.local': { id_usuario: 'usuario-15' } })
    expect(res.status).toBe(200)
  })

  it('el DNI de otro profesor da 409', async () => {
    falso.docente.findUnique.mockImplementation(async ({ where }: { where: { id_docente?: number; dni?: string } }) =>
      where.id_docente === 15 ? { id_usuario: 'usuario-15' } : { id_docente: 4 },
    )
    const res = await editar(EDICION)
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('Ya existe un profesor registrado con ese DNI')
    expect(tx.usuario.update).not.toHaveBeenCalled()
  })

  it('el correo de otro usuario da 409', async () => {
    const res = await editar(EDICION, { 'paula.diaz@educar.local': { id_usuario: 'otro' } })
    expect(res.status).toBe(409)
    expect(tx.usuario.update).not.toHaveBeenCalled()
  })

  it('un docente que no existe da 404', async () => {
    const res = await request(app).put('/api/docentes/99').set('Authorization', sesionAdmin()).send(EDICION)
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/docentes/:id (estado)', () => {
  const cambiar = (body: Record<string, unknown>) => request(app).patch('/api/docentes/15').set('Authorization', sesionAdmin()).send(body)
  const docente = (activo: boolean, materias: number) => ({
    activo,
    id_usuario: 'usuario-15',
    usuarios: { nombre: 'Paula', apellido: 'Díaz' },
    asignaciones: Array.from({ length: materias }, (_, i) => ({ id_asignacion: i + 1 })),
  })

  it('la baja de un docente con materias a cargo pide confirmar (409) y no cambia nada', async () => {
    falso.docente.findUnique.mockResolvedValue(docente(true, 2))
    const res = await cambiar({ activo: false })
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('DOCENTE_CON_ASIGNACIONES')
    expect(res.body.error).toContain('Paula Díaz tiene 2 materias a cargo')
    expect(tx.docente.update).not.toHaveBeenCalled()
  })

  it('confirmada, da de baja al docente y a su usuario (ya no entra al sistema)', async () => {
    falso.docente.findUnique.mockResolvedValue(docente(true, 2))
    const res = await cambiar({ activo: false, confirmar: true })
    expect(res.status).toBe(200)
    expect(tx.usuario.update).toHaveBeenCalledWith({ where: { id_usuario: 'usuario-15' }, data: { activo: false } })
    expect(tx.docente.update.mock.calls[0][0].data).toEqual({ activo: false })
  })

  it('sin materias a cargo, la baja no pide confirmación; reactivar tampoco', async () => {
    falso.docente.findUnique.mockResolvedValue(docente(true, 0))
    expect((await cambiar({ activo: false })).status).toBe(200)
    falso.docente.findUnique.mockResolvedValue(docente(false, 3))
    expect((await cambiar({ activo: true })).status).toBe(200)
  })

  it('no se puede dar de baja el propio usuario', async () => {
    falso.docente.findUnique.mockResolvedValue({ ...docente(true, 0), id_usuario: ID_USUARIO })
    const res = await cambiar({ activo: false })
    expect(res.status).toBe(400)
  })

  it('activo tiene que ser true o false', async () => {
    expect((await cambiar({ activo: 'no' })).status).toBe(400)
  })
})

describe('POST /api/asignaciones (una materia, un profesor por curso)', () => {
  const asignar = (body: Record<string, unknown> = {}) =>
    request(app)
      .post('/api/asignaciones')
      .set('Authorization', sesionAdmin())
      .send({ id_docente: 15, id_materia: 2, id_curso: 7, ...body })

  beforeEach(() => {
    falso.docente.findUnique.mockResolvedValue({ activo: true, usuarios: { nombre: 'Paula', apellido: 'Díaz' } })
    falso.materia.findUnique.mockResolvedValue({ nombre: 'Matemática', activo: true })
    falso.curso.findUnique.mockResolvedValue({ grado_anio: '5', division: 'A', nivel: 'Primario', activo: true })
    ;(prismaFalso as unknown as { periodoAcademico: { findFirst: Fn } }).periodoAcademico = { findFirst: vi.fn().mockResolvedValue({ id_periodo: 1 }) }
    tx.asignacion.findFirst.mockResolvedValue(null)
    tx.asignacion.create.mockResolvedValue({ id_asignacion: 50 })
  })

  it('sin profesor en ese curso, la asigna', async () => {
    const res = await asignar()
    expect(res.status).toBe(201)
    expect(tx.asignacion.create).toHaveBeenCalledWith({ data: { id_docente: 15, id_materia: 2, id_curso: 7, id_periodo: 1 } })
    expect(tx.asignacion.update).not.toHaveBeenCalled()
  })

  it('si ya la dicta otro, avisa con 409 quién la dicta y qué pasa al reemplazarlo', async () => {
    tx.asignacion.findFirst.mockResolvedValue({ id_asignacion: 8, id_docente: 4, docentes: { usuarios: { nombre: 'Luis', apellido: 'Gómez' } } })
    const res = await asignar()
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('MATERIA_CON_PROFESOR')
    expect(res.body.error).toContain('Matemática de 5° A (Primario) ya la dicta Luis Gómez')
    expect(res.body.error).toContain('pasa a dictarla Paula Díaz: los horarios pasan a Paula Díaz')
    expect(res.body.error).toContain('quedan registradas con Luis Gómez')
    expect(tx.asignacion.create).not.toHaveBeenCalled()
  })

  it('con reemplazar, cierra la anterior y le pasa los horarios a la nueva', async () => {
    tx.asignacion.findFirst.mockResolvedValue({ id_asignacion: 8, id_docente: 4, docentes: { usuarios: { nombre: 'Luis', apellido: 'Gómez' } } })
    const res = await asignar({ reemplazar: true })
    expect(res.status).toBe(201)
    expect(tx.asignacion.update).toHaveBeenCalledWith({ where: { id_asignacion: 8 }, data: { activo: false } })
    expect(tx.horario.updateMany).toHaveBeenCalledWith({ where: { id_asignacion: 8 }, data: { id_asignacion: 50 } })
  })

  it('la misma materia y curso al mismo docente da 409, aun con reemplazar', async () => {
    tx.asignacion.findFirst.mockResolvedValue({ id_asignacion: 8, id_docente: 15, docentes: { usuarios: null } })
    const res = await asignar({ reemplazar: true })
    expect(res.status).toBe(409)
    expect(res.body.error).toContain('ya está asignada a este docente')
    expect(tx.asignacion.create).not.toHaveBeenCalled()
  })

  it('bloquea el curso para que dos asignaciones simultáneas no pasen las dos', async () => {
    await asignar()
    expect(tx.$queryRaw).toHaveBeenCalled()
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.asignacion.findFirst.mock.invocationCallOrder[0])
  })

  it.each([
    ['un docente dado de baja', () => falso.docente.findUnique.mockResolvedValue({ activo: false, usuarios: null }), 'docente'],
    ['una materia dada de baja', () => falso.materia.findUnique.mockResolvedValue({ nombre: 'X', activo: false }), 'materia'],
    ['un curso que no existe', () => falso.curso.findUnique.mockResolvedValue(null), 'curso'],
  ])('a %s da 400', async (_caso, preparar, palabra) => {
    preparar()
    const res = await asignar()
    expect(res.status).toBe(400)
    expect(res.body.error).toContain(palabra)
  })
})

describe('PATCH /api/asignaciones/:id', () => {
  const quitar = (body: Record<string, unknown>) => request(app).patch('/api/asignaciones/8').set('Authorization', sesionAdmin()).send(body)

  it('cierra la asignación', async () => {
    falso.asignacion.findUnique.mockResolvedValue({ activo: true })
    falso.asignacion.update.mockResolvedValue({ id_asignacion: 8, activo: false })
    const res = await quitar({ activo: false })
    expect(res.status).toBe(200)
    expect(falso.asignacion.update).toHaveBeenCalledWith({ where: { id_asignacion: 8 }, data: { activo: false } })
  })

  it('solo se puede cerrar (400) y una que no existe da 404', async () => {
    expect((await quitar({ activo: true })).status).toBe(400)
    falso.asignacion.findUnique.mockResolvedValue(null)
    expect((await quitar({ activo: false })).status).toBe(404)
  })
})

describe('GET /api/horarios', () => {
  it('no muestra los horarios de asignaciones cerradas', async () => {
    const res = await request(app).get('/api/horarios?id_curso=7').set('Authorization', sesionAdmin())
    expect(res.status).toBe(200)
    expect(falso.horario.findMany.mock.calls[0][0].where.asignaciones).toEqual({ id_curso: 7, activo: true })
  })
})

const hora = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`)
const asignacion = (id_docente: number, apellido: string, materia: string, nivel: string, grado_anio: string) => ({
  id_docente,
  docentes: { usuarios: { nombre: 'X', apellido } },
  materias: { nombre: materia },
  cursos: { nivel, grado_anio, division: 'A' },
})

describe('GET /api/reportes/docentes-por-nivel', () => {
  it('agrupa por nivel y docente, con las materias y los cursos sin repetir y en orden', async () => {
    falso.asignacion.findMany.mockResolvedValue([
      asignacion(1, 'Pérez', 'Matemática', 'Secundario', '2'),
      asignacion(1, 'Pérez', 'Matemática', 'Primario', '6'),
      asignacion(1, 'Pérez', 'Física', 'Secundario', '1'),
      asignacion(1, 'Pérez', 'Matemática', 'Secundario', '1'),
      asignacion(2, 'Álvarez', 'Lengua', 'Primario', '5'),
    ])
    const res = await request(app).get('/api/reportes/docentes-por-nivel').set('Authorization', sesionAdmin())
    expect(res.status).toBe(200)
    expect(res.body.bloques[0].filas).toEqual([
      { nivel: 'Primario', profesor: 'Álvarez, X', legajo: 2, materias: 'Lengua', cursos: '5° A' },
      { nivel: 'Primario', profesor: 'Pérez, X', legajo: 1, materias: 'Matemática', cursos: '6° A' },
      { nivel: 'Secundario', profesor: 'Pérez, X', legajo: 1, materias: 'Física y Matemática', cursos: '1° A y 2° A' },
    ])
  })

  it('filtra por nivel y solo cuenta docentes y asignaciones activas', async () => {
    await request(app).get('/api/reportes/docentes-por-nivel?nivel=Primario').set('Authorization', sesionAdmin())
    expect(falso.asignacion.findMany.mock.calls[0][0].where).toEqual({ activo: true, docentes: { activo: true }, cursos: { nivel: 'Primario' } })
  })
})

describe('GET /api/reportes/docente/:id', () => {
  it('muestra los cursos a cargo por nivel y los horarios ordenados por día y hora', async () => {
    falso.docente.findUnique.mockResolvedValue({
      id_docente: 15,
      dni: '30123456',
      especialidad: 'Matemática',
      titulo: null,
      fecha_ingreso: new Date('2020-03-01T00:00:00Z'),
      activo: true,
      usuarios: { nombre: 'Paula', apellido: 'Díaz', email: 'p@educar.local', telefono: null },
      asignaciones: [
        { materias: { nombre: 'Matemática' }, cursos: { nivel: 'Secundario', grado_anio: '1', division: 'A' }, horarios: [{ dia_semana: 'Lunes', hora_inicio: hora('10:00'), hora_fin: hora('11:00'), aula: 'Aula 3' }] },
        { materias: { nombre: 'Matemática' }, cursos: { nivel: 'Primario', grado_anio: '6', division: 'A' }, horarios: [{ dia_semana: 'Martes', hora_inicio: hora('08:00'), hora_fin: hora('09:00'), aula: null }, { dia_semana: 'Lunes', hora_inicio: hora('08:00'), hora_fin: hora('09:00'), aula: 'Aula 1' }] },
      ],
      actividades: [{ nombre: 'Ajedrez', tipo: 'Deporte', horarios: [{ dia_semana: 'Martes', hora_inicio: hora('14:00'), hora_fin: hora('15:30') }], docentes: null }],
    })
    const res = await request(app).get('/api/reportes/docente/15').set('Authorization', sesionAdmin())
    expect(res.status).toBe(200)
    const [datos, cursos, horarios, actividades] = res.body.bloques
    expect(datos.items).toContainEqual(['DNI', '30123456'])
    expect(datos.items).toContainEqual(['Fecha de ingreso', '01/03/2020'])
    expect(cursos.filas.map((f: { nivel: string }) => f.nivel)).toEqual(['Primario', 'Secundario'])
    expect(horarios.filas.map((f: { horario: string }) => f.horario)).toEqual(['Lunes 08:00–09:00', 'Lunes 10:00–11:00', 'Martes 08:00–09:00'])
    expect(horarios.filas[2]).toEqual({ horario: 'Martes 08:00–09:00', curso: '6° A (Primario)', materia: 'Matemática', aula: '—' })
    expect(actividades.filas).toEqual([{ actividad: 'Ajedrez', tipo: 'Deporte', horario: 'Martes 14:00–15:30' }])
  })

  it('un docente que no existe da 404', async () => {
    falso.docente.findUnique.mockResolvedValue(null)
    expect((await request(app).get('/api/reportes/docente/99').set('Authorization', sesionAdmin())).status).toBe(404)
  })
})
