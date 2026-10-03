/** Recuperar la contraseña por email (T20). */
import bcrypt from 'bcryptjs'
import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const dobles = vi.hoisted(() => {
  const anterior = process.env.PUBLIC_URL
  // config.ts lee PUBLIC_URL al importarse: el enlace del email se arma con ella.
  process.env.PUBLIC_URL = 'https://app.test'
  const prisma = {
    usuario: { findUnique: vi.fn(), update: vi.fn() },
    tokenRecuperacion: { count: vi.fn(), updateMany: vi.fn(), create: vi.fn(), findUniqueOrThrow: vi.fn() },
    $transaction: vi.fn(),
  }
  return { anterior, prisma, emailHabilitado: true, enviarEmail: vi.fn() }
})

vi.mock('../src/lib/prisma.js', () => ({ prisma: dobles.prisma }))
vi.mock('../src/services/email.js', async (original) => ({
  ...(await original<typeof import('../src/services/email.js')>()),
  get emailHabilitado() {
    return dobles.emailHabilitado
  },
  enviarEmail: dobles.enviarEmail,
}))

const { hashToken, pedirRecuperacion, restablecerPassword } = await import('../src/services/recuperacion.js')
const { app } = await import('../src/app.js')

afterAll(() => {
  if (dobles.anterior === undefined) delete process.env.PUBLIC_URL
  else process.env.PUBLIC_URL = dobles.anterior
})

const AHORA = new Date('2026-11-05T15:00:00Z')
const USUARIO = { id_usuario: 'u1', nombre: 'María', email: 'maria@familia.test', activo: true }
const { prisma } = dobles

/** El token que viajó en el enlace del último email. */
const tokenDelEmail = () => /restablecer\?token=([\w-]+)/.exec(dobles.enviarEmail.mock.calls.at(-1)![0].texto)![1]

beforeEach(() => {
  vi.clearAllMocks()
  dobles.emailHabilitado = true
  prisma.usuario.findUnique.mockResolvedValue(USUARIO)
  prisma.tokenRecuperacion.count.mockResolvedValue(0)
  prisma.tokenRecuperacion.updateMany.mockResolvedValue({ count: 1 })
  prisma.tokenRecuperacion.findUniqueOrThrow.mockResolvedValue({ usuarios: { id_usuario: 'u1', activo: true } })
  prisma.$transaction.mockImplementation((arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(prisma),
  )
})

describe('pedirRecuperacion', () => {
  it('manda un enlace que vale 30 minutos; en la base queda solo el hash del token', async () => {
    expect(await pedirRecuperacion('maria@familia.test', AHORA)).toBe('enviado')

    const email = dobles.enviarEmail.mock.calls[0][0]
    expect(email.para).toBe('maria@familia.test')
    expect(email.asunto).toBe('Recuperar tu contraseña · Educar para Transformar')
    expect(email.texto).toContain('https://app.test/restablecer?token=')
    expect(email.texto).toContain('vale por 30 minutos y se puede usar una sola vez')

    const token = tokenDelEmail()
    expect(token.length).toBeGreaterThanOrEqual(43) // 32 bytes en base64url
    const creado = prisma.tokenRecuperacion.create.mock.calls[0][0].data
    expect(creado).toEqual({ id_usuario: 'u1', token_hash: hashToken(token), expira_at: new Date('2026-11-05T15:30:00Z') })
    expect(creado.token_hash).not.toBe(token)
  })

  it('un enlace nuevo anula los anteriores sin usar', async () => {
    await pedirRecuperacion('maria@familia.test', AHORA)
    expect(prisma.tokenRecuperacion.updateMany).toHaveBeenCalledWith({
      where: { id_usuario: 'u1', usado_at: null },
      data: { usado_at: AHORA },
    })
  })

  it('un email que no existe o de un usuario desactivado no hace nada', async () => {
    prisma.usuario.findUnique.mockResolvedValueOnce(null)
    expect(await pedirRecuperacion('nadie@x.test', AHORA)).toBe('ignorado')
    prisma.usuario.findUnique.mockResolvedValueOnce({ ...USUARIO, activo: false })
    expect(await pedirRecuperacion('maria@familia.test', AHORA)).toBe('ignorado')
    expect(prisma.tokenRecuperacion.create).not.toHaveBeenCalled()
    expect(dobles.enviarEmail).not.toHaveBeenCalled()
  })

  it('como mucho 3 enlaces por hora', async () => {
    prisma.tokenRecuperacion.count.mockResolvedValue(3)
    expect(await pedirRecuperacion('maria@familia.test', AHORA)).toBe('ignorado')
    expect(prisma.tokenRecuperacion.count.mock.calls[0][0].where.created_at).toEqual({ gt: new Date('2026-11-05T14:00:00Z') })
    expect(dobles.enviarEmail).not.toHaveBeenCalled()
  })
})

describe('restablecerPassword', () => {
  it('con un token vigente cambia la contraseña (con bcrypt) y lo deja usado', async () => {
    await restablecerPassword('token-del-enlace', 'nueva123', AHORA)
    expect(prisma.tokenRecuperacion.updateMany).toHaveBeenCalledWith({
      where: { token_hash: hashToken('token-del-enlace'), usado_at: null, expira_at: { gt: AHORA } },
      data: { usado_at: AHORA },
    })
    const { where, data } = prisma.usuario.update.mock.calls[0][0]
    expect(where).toEqual({ id_usuario: 'u1' })
    expect(data.password_hash).toMatch(/^\$2[ab]\$/)
    expect(await bcrypt.compare('nueva123', data.password_hash)).toBe(true)
  })

  it('un token usado, vencido o inventado no cambia nada', async () => {
    prisma.tokenRecuperacion.updateMany.mockResolvedValue({ count: 0 })
    await expect(restablecerPassword('usado', 'nueva123', AHORA)).rejects.toThrow('El enlace no es válido o ya venció')
    expect(prisma.usuario.update).not.toHaveBeenCalled()
  })

  it('una contraseña corta se rechaza sin gastar el enlace', async () => {
    await expect(restablecerPassword('token', '12345', AHORA)).rejects.toThrow('al menos 6 caracteres')
    expect(prisma.tokenRecuperacion.updateMany).not.toHaveBeenCalled()
  })

  it('sin token, o de un usuario desactivado, no cambia nada', async () => {
    await expect(restablecerPassword('', 'nueva123', AHORA)).rejects.toThrow('El enlace no es válido')
    prisma.tokenRecuperacion.findUniqueOrThrow.mockResolvedValue({ usuarios: { id_usuario: 'u1', activo: false } })
    await expect(restablecerPassword('token', 'nueva123', AHORA)).rejects.toThrow('El enlace no es válido')
    expect(prisma.usuario.update).not.toHaveBeenCalled()
  })
})

describe('rutas', () => {
  it('POST /api/auth/recuperar responde lo mismo exista o no el email', async () => {
    const conocido = await request(app).post('/api/auth/recuperar').send({ email: ' Maria@Familia.test ' })
    prisma.usuario.findUnique.mockResolvedValue(null)
    const desconocido = await request(app).post('/api/auth/recuperar').send({ email: 'nadie@x.test' })
    expect(conocido.status).toBe(200)
    expect(desconocido.status).toBe(200)
    expect(conocido.body).toEqual(desconocido.body)
    // El email se busca normalizado.
    expect(prisma.usuario.findUnique.mock.calls[0][0].where).toEqual({ email: 'maria@familia.test' })
  })

  it('sin email → 400; sin SMTP → 503', async () => {
    expect((await request(app).post('/api/auth/recuperar').send({})).status).toBe(400)
    dobles.emailHabilitado = false
    const res = await request(app).post('/api/auth/recuperar').send({ email: 'maria@familia.test' })
    expect(res.status).toBe(503)
    expect(prisma.usuario.findUnique).not.toHaveBeenCalled()
  })

  it('POST /api/auth/restablecer: 200 con un enlace válido, 400 si no', async () => {
    expect((await request(app).post('/api/auth/restablecer').send({ token: 't', password: 'nueva123' })).status).toBe(200)
    prisma.tokenRecuperacion.updateMany.mockResolvedValue({ count: 0 })
    const res = await request(app).post('/api/auth/restablecer').send({ token: 't', password: 'nueva123' })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Pedí uno nuevo')
  })

  it('el enlace usa PUBLIC_URL aunque el pedido llegue con otro Host', async () => {
    await request(app).post('/api/auth/recuperar').set('Host', 'sitio-malicioso.test').send({ email: 'maria@familia.test' })
    await vi.waitFor(() => expect(dobles.enviarEmail).toHaveBeenCalled())
    const { texto } = dobles.enviarEmail.mock.calls[0][0]
    expect(texto).toContain('https://app.test/restablecer?token=')
    expect(texto).not.toContain('sitio-malicioso')
  })
})
