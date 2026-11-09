/**
 * Pagar e inscribir lo hace el padre/tutor, no el propio alumno; y en Usuarios se edita
 * el teléfono y se ven los hijos de cada tutor.
 */
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { telefonoOpcional } from '../src/services/usuarios.js'
import { ID_USUARIO, iniciarSesionComo, prismaFalso, usuarioConRol } from './ayudas.js'

vi.mock('../src/lib/prisma.js', async () => ({ prisma: (await import('./ayudas.js')).prismaFalso }))

const { app } = await import('../src/app.js')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('el alumno no paga ni se inscribe (lo hace su familia)', () => {
  const pedidos: [string, (t: string) => request.Test][] = [
    ['emitir una orden de pago', (t) => request(app).post('/api/facturas/1/ordenes-pago').set('Authorization', t).send({ items: [1] })],
    ['subir un comprobante', (t) => request(app).post('/api/facturas/1/comprobantes').set('Authorization', t)],
    ['inscribirse a una actividad', (t) => request(app).post('/api/actividades/3/inscripciones').set('Authorization', t).send({ id_alumno: 1 })],
    ['darse de baja de una actividad', (t) => request(app).delete('/api/actividades/3/inscripciones/1').set('Authorization', t)],
    ['elegir el transporte', (t) => request(app).put('/api/servicios/1/transporte').set('Authorization', t).send({ id_recorrido: 2 })],
    ['dar de baja el transporte', (t) => request(app).delete('/api/servicios/1/transporte').set('Authorization', t)],
    ['inscribirse al comedor', (t) => request(app).put('/api/servicios/1/comedor').set('Authorization', t).send({})],
    ['dar de baja el comedor', (t) => request(app).delete('/api/servicios/1/comedor').set('Authorization', t)],
  ]

  it.each(pedidos)('403 al %s', async (_, pedir) => {
    const token = iniciarSesionComo('Alumno')
    prismaFalso.factura.findUnique.mockResolvedValue({ id_alumno: 1, saldo: { toNumber: () => 1000 } })
    const res = await pedir(token)
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('SOLO_TUTOR')
  })

  it('el padre/tutor sigue pudiendo emitir la orden de su hijo (pasa el control de rol)', async () => {
    const token = iniciarSesionComo('Padre')
    prismaFalso.factura.findUnique.mockResolvedValue({ id_alumno: 1 })
    prismaFalso.alumno.findFirst.mockResolvedValue(null) // no es su hijo: lo frena el control de pertenencia, no el de rol
    const res = await request(app).post('/api/facturas/1/ordenes-pago').set('Authorization', token).send({ items: [1] })
    expect(res.status).toBe(403)
    expect(res.body.code).not.toBe('SOLO_TUTOR')
  })
})

describe('teléfono de los usuarios', () => {
  it('acepta formatos comunes y normaliza los espacios', () => {
    expect(telefonoOpcional('  +54 9 379  455-4837 ')).toBe('+54 9 379 455-4837')
    expect(telefonoOpcional('(0379) 4554837')).toBe('(0379) 4554837')
    expect(telefonoOpcional('')).toBeNull()
    expect(telefonoOpcional(undefined)).toBeNull()
  })

  it('rechaza letras o muy pocos dígitos', () => {
    expect(() => telefonoOpcional('llamar a la tarde')).toThrow('no es válido')
    expect(() => telefonoOpcional('123')).toThrow('no es válido')
  })

  const objetivo = '33333333-3333-4333-8333-333333333333'
  function sesionAdmin() {
    const token = iniciarSesionComo('Admin')
    prismaFalso.usuario.findUnique.mockImplementation(async (args: { where: { id_usuario?: string } }) =>
      args.where.id_usuario === objetivo ? { rol: 'Padre' } : usuarioConRol('Admin'),
    )
    prismaFalso.usuario.update.mockImplementation(async (args: { data: unknown }) => args.data)
    return token
  }

  it('PATCH guarda el teléfono y el nombre sin espacios de más', async () => {
    const res = await request(app)
      .patch(`/api/usuarios/${objetivo}`)
      .set('Authorization', sesionAdmin())
      .send({ nombre: ' Laura ', apellido: 'Gómez', telefono: '379 455-4837' })
    expect(res.status).toBe(200)
    expect(prismaFalso.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ nombre: 'Laura', apellido: 'Gómez', telefono: '379 455-4837' }) }),
    )
  })

  it('PATCH con teléfono vacío lo borra y sin el campo no lo toca', async () => {
    const token = sesionAdmin()
    await request(app).patch(`/api/usuarios/${objetivo}`).set('Authorization', token).send({ telefono: '' })
    expect(prismaFalso.usuario.update.mock.calls[0][0].data.telefono).toBeNull()
    await request(app).patch(`/api/usuarios/${objetivo}`).set('Authorization', token).send({ activo: false })
    expect(prismaFalso.usuario.update.mock.calls[1][0].data.telefono).toBeUndefined()
  })

  it('PATCH rechaza un nombre vacío o un teléfono inválido', async () => {
    const token = sesionAdmin()
    expect((await request(app).patch(`/api/usuarios/${objetivo}`).set('Authorization', token).send({ nombre: '  ' })).status).toBe(400)
    expect((await request(app).patch(`/api/usuarios/${objetivo}`).set('Authorization', token).send({ telefono: 'abc' })).status).toBe(400)
    expect(prismaFalso.usuario.update).not.toHaveBeenCalled()
  })

  it('GET /usuarios trae los hijos de cada usuario', async () => {
    const token = iniciarSesionComo('Admin')
    prismaFalso.usuario.findMany.mockResolvedValue([{ id_usuario: ID_USUARIO, hijos: [] }])
    const res = await request(app).get('/api/usuarios').set('Authorization', token)
    expect(res.status).toBe(200)
    expect(prismaFalso.usuario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ include: expect.objectContaining({ hijos: expect.anything() }) }),
    )
  })
})
