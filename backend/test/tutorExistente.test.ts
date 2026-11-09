/**
 * Aprobación de la solicitud de un segundo hijo: el tutor ya tiene usuario, se
 * reutiliza sin tocar sus datos y la respuesta avisa lo que la solicitud trae
 * distinto (nombre, teléfono) o si la cuenta no es de tutor.
 */
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { diferenciasTutor } from '../src/services/usuarios.js'
import { firmarToken, prismaFalso, usuarioConRol } from './ayudas.js'

vi.mock('../src/lib/prisma.js', async () => ({ prisma: (await import('./ayudas.js')).prismaFalso }))

const { app } = await import('../src/app.js')

const tutor = (cambios: Partial<{ nombre: string; apellido: string; telefono: string | null; rol: string }> = {}) => ({
  nombre: 'Juan',
  apellido: 'Pérez',
  telefono: null,
  rol: 'Padre',
  ...cambios,
})

describe('diferenciasTutor', () => {
  it('no avisa nada si coinciden, sin importar mayúsculas ni espacios de más', () => {
    expect(diferenciasTutor(tutor(), { nombre_tutor: '  juan   PÉREZ ', telefono_tutor: null })).toEqual([])
  })

  it('compara el nombre completo: un nombre compuesto no se toma como distinto', () => {
    const usuario = tutor({ nombre: 'Juan Manuel', apellido: 'Cantero' })
    expect(diferenciasTutor(usuario, { nombre_tutor: 'Juan Manuel Cantero', telefono_tutor: null })).toEqual([])
  })

  it('avisa si el nombre cambió, con lo registrado y lo de la solicitud', () => {
    expect(diferenciasTutor(tutor(), { nombre_tutor: 'Juan Pablo Pérez', telefono_tutor: null })).toEqual([
      { campo: 'Nombre', registrado: 'Juan Pérez', solicitud: 'Juan Pablo Pérez' },
    ])
  })

  it('el teléfono se compara por dígitos y solo si el usuario tiene uno', () => {
    const datos = { nombre_tutor: 'Juan Pérez', telefono_tutor: '11 4444-5555' }
    expect(diferenciasTutor(tutor(), datos)).toEqual([])
    expect(diferenciasTutor(tutor({ telefono: '(11) 4444 5555' }), datos)).toEqual([])
    expect(diferenciasTutor(tutor({ telefono: '11 4444-0000' }), datos)).toEqual([
      { campo: 'Teléfono', registrado: '11 4444-0000', solicitud: '11 4444-5555' },
    ])
  })

  it('avisa si la cuenta no es de padre o tutor', () => {
    expect(diferenciasTutor(tutor({ rol: 'Docente' }), { nombre_tutor: 'Juan Pérez', telefono_tutor: null })).toEqual([
      { campo: 'Rol', registrado: 'Docente', solicitud: 'Padre' },
    ])
    expect(diferenciasTutor(tutor({ rol: 'Tutor' }), { nombre_tutor: 'Juan Pérez', telefono_tutor: null })).toEqual([])
  })
})

describe('POST /api/inscripciones/:id/aprobar con un tutor que ya tiene usuario', () => {
  const ID_TUTOR = '22222222-2222-4222-8222-222222222222'
  const usuarioTutor = { id_usuario: ID_TUTOR, ...tutor({ telefono: '11 4444-0000' }) }

  beforeEach(() => {
    vi.clearAllMocks()
    prismaFalso.$transaction.mockImplementation(async (funcion: (tx: unknown) => unknown) => funcion(prismaFalso))
    // La sesión es del admin; el email de la solicitud es el del tutor que ya existe.
    prismaFalso.usuario.findUnique.mockImplementation(async (args: { where: { email?: string } }) => {
      if (args.where.email === 'juan@familia.test') return usuarioTutor
      if (args.where.email) return { id_usuario: '33333333-3333-4333-8333-333333333333' }
      return usuarioConRol('Admin')
    })
    prismaFalso.inscripcion.findUnique.mockResolvedValue({
      id_inscripcion: 7,
      id_alumno_creado: null,
      nombre_aspirante: 'Sofía',
      apellido_aspirante: 'Pérez',
      dni_aspirante: '50111222',
      fecha_nacimiento_aspirante: new Date('2018-03-01'),
      nombre_tutor: 'Juan Pablo Pérez',
      email_tutor: 'Juan@Familia.test',
      telefono_tutor: '11 5555-6666',
    })
    prismaFalso.alumno.findUnique.mockResolvedValue(null)
    prismaFalso.alumno.create.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      id_alumno: 99,
      ...args.data,
    }))
    prismaFalso.inscripcion.update.mockResolvedValue({})
  })

  it('vincula al hijo con el tutor, no le cambia los datos y avisa lo que difiere', async () => {
    const res = await request(app)
      .post('/api/inscripciones/7/aprobar')
      .set('Authorization', `Bearer ${firmarToken()}`)
      .send({})

    expect(res.status).toBe(201)
    expect(prismaFalso.alumno.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ id_usuario_padre: ID_TUTOR }) }),
    )
    expect(prismaFalso.usuario.update).not.toHaveBeenCalled()
    expect(res.body.accesos.tutor).toEqual({
      id_usuario: ID_TUTOR,
      email: 'Juan@Familia.test',
      creado: false,
      diferencias: [
        { campo: 'Nombre', registrado: 'Juan Pérez', solicitud: 'Juan Pablo Pérez' },
        { campo: 'Teléfono', registrado: '11 4444-0000', solicitud: '11 5555-6666' },
      ],
    })
  })
})
