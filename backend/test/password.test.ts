import bcrypt from 'bcryptjs'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ID_USUARIO, iniciarSesionComo, prismaFalso, usuarioConRol } from './ayudas.js'

vi.mock('../src/lib/prisma.js', async () => ({ prisma: (await import('./ayudas.js')).prismaFalso }))

const { app } = await import('../src/app.js')

const ACTUAL = 'clave-actual'
const NUEVA = 'clave-nueva-123'
// Costo mínimo: acá solo importa que el hash se pueda verificar, no que sea lento de adivinar.
const HASH_ACTUAL = bcrypt.hashSync(ACTUAL, 4)

/**
 * Inicia sesión con ese rol. `requireAuth` lee al usuario sin el hash; el endpoint
 * lo pide con `omit: { password_hash: false }` y recibe también el hash guardado.
 */
function sesionComo(rol: string, activo = true): string {
  const token = iniciarSesionComo(rol, activo)
  prismaFalso.usuario.findUnique.mockImplementation(async (args: { omit?: { password_hash?: boolean } }) =>
    args.omit?.password_hash === false
      ? { ...usuarioConRol(rol, activo), password_hash: HASH_ACTUAL }
      : usuarioConRol(rol, activo),
  )
  return token
}

const cambiar = (token: string, cuerpo: Record<string, unknown>) =>
  request(app).post('/api/auth/password').set('Authorization', token).send(cuerpo)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/auth/password', () => {
  it('sin sesión devuelve 401 y no toca la base', async () => {
    const res = await request(app).post('/api/auth/password').send({ actual: ACTUAL, nueva: NUEVA })
    expect(res.status).toBe(401)
    expect(prismaFalso.usuario.update).not.toHaveBeenCalled()
  })

  it('un usuario desactivado no puede cambiarla', async () => {
    const token = sesionComo('Padre', false)
    const res = await cambiar(token, { actual: ACTUAL, nueva: NUEVA })
    expect(res.status).toBe(403)
    expect(prismaFalso.usuario.update).not.toHaveBeenCalled()
  })

  it.each([
    ['la nueva tiene menos de 6 caracteres', { actual: ACTUAL, nueva: '12345' }, 'al menos 6 caracteres'],
    ['falta la nueva', { actual: ACTUAL }, 'al menos 6 caracteres'],
    ['la nueva es igual a la actual', { actual: ACTUAL, nueva: ACTUAL }, 'distinta de la actual'],
    ['la actual no es correcta', { actual: 'otra-clave', nueva: NUEVA }, 'actual no es correcta'],
    ['falta la actual', { nueva: NUEVA }, 'actual no es correcta'],
  ])('devuelve 400 si %s, sin cambiar nada', async (_caso, cuerpo, mensaje) => {
    const token = sesionComo('Padre')
    const res = await cambiar(token, cuerpo)
    expect(res.status).toBe(400)
    expect(res.body.error).toContain(mensaje)
    expect(prismaFalso.usuario.update).not.toHaveBeenCalled()
  })

  it.each(['Admin', 'Directivo', 'Docente', 'Padre', 'Alumno'])('%s puede cambiar su contraseña', async (rol) => {
    const token = sesionComo(rol)
    const res = await cambiar(token, { actual: ACTUAL, nueva: NUEVA })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })

  it('guarda solo el hash de la nueva, para el usuario logueado', async () => {
    const token = sesionComo('Padre')
    await cambiar(token, { actual: ACTUAL, nueva: NUEVA })

    expect(prismaFalso.usuario.update).toHaveBeenCalledTimes(1)
    const { where, data } = prismaFalso.usuario.update.mock.calls[0][0]
    expect(where).toEqual({ id_usuario: ID_USUARIO })
    expect(data.password_hash).not.toBe(NUEVA)
    expect(bcrypt.compareSync(NUEVA, data.password_hash)).toBe(true)
    expect(bcrypt.compareSync(ACTUAL, data.password_hash)).toBe(false)
  })

  it('la respuesta no filtra ningún hash', async () => {
    const token = sesionComo('Padre')
    const res = await cambiar(token, { actual: ACTUAL, nueva: NUEVA })
    expect(JSON.stringify(res.body)).not.toContain('password_hash')
    expect(JSON.stringify(res.body)).not.toContain(HASH_ACTUAL)
  })

  it('no permite cambiar la contraseña de otro usuario enviando su id', async () => {
    const token = sesionComo('Padre')
    await cambiar(token, { actual: ACTUAL, nueva: NUEVA, id_usuario: '22222222-2222-4222-8222-222222222222' })
    expect(prismaFalso.usuario.update.mock.calls[0][0].where).toEqual({ id_usuario: ID_USUARIO })
  })
})
