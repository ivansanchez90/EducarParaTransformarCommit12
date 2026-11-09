/**
 * Tarjeta "Familia" del legajo (`GET /api/alumnos/:id/familia`): el tutor del alumno y
 * sus hermanos. La ve el personal, docentes incluidos; las familias no.
 */
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { iniciarSesionComo, prismaFalso } from './ayudas.js'

vi.mock('../src/lib/prisma.js', async () => ({ prisma: (await import('./ayudas.js')).prismaFalso }))

const { app } = await import('../src/app.js')

const ID_TUTOR = '22222222-2222-4222-8222-222222222222'
const tutor = { id_usuario: ID_TUTOR, nombre: 'Juan', apellido: 'Pérez', email: 'juan@familia.test', telefono: '11 4444-5555', activo: true }
const hermano = { id_alumno: 8, nombre: 'Sofía', apellido: 'Pérez', activo: true, cursos: { nivel: 'Primario', grado_anio: '2', division: 'A' } }

const pedir = (token: string, idAlumno = 7) => request(app).get(`/api/alumnos/${idAlumno}/familia`).set('Authorization', token)

describe('GET /api/alumnos/:id/familia', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('un docente ve al tutor y a los hermanos (sin el propio alumno)', async () => {
    const token = iniciarSesionComo('Docente')
    prismaFalso.alumno.findUnique.mockResolvedValue({ id_usuario_padre: ID_TUTOR, padre: tutor })
    prismaFalso.alumno.findMany.mockResolvedValue([hermano])

    const res = await pedir(token)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ tutor, hermanos: [hermano] })
    expect(prismaFalso.alumno.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id_usuario_padre: ID_TUTOR, id_alumno: { not: 7 } } }),
    )
  })

  it('sin tutor vinculado devuelve tutor null y no busca hermanos', async () => {
    const token = iniciarSesionComo('Admin')
    prismaFalso.alumno.findUnique.mockResolvedValue({ id_usuario_padre: null, padre: null })

    const res = await pedir(token)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ tutor: null, hermanos: [] })
    expect(prismaFalso.alumno.findMany).not.toHaveBeenCalled()
  })

  it('404 si el alumno no existe', async () => {
    const token = iniciarSesionComo('Directivo')
    prismaFalso.alumno.findUnique.mockResolvedValue(null)
    expect((await pedir(token, 999)).status).toBe(404)
  })

  it.each(['Padre', 'Alumno', 'Enfermero'])('%s no la puede ver (403)', async (rol) => {
    const res = await pedir(iniciarSesionComo(rol))
    expect(res.status).toBe(403)
    expect(prismaFalso.alumno.findUnique).not.toHaveBeenCalled()
  })
})
