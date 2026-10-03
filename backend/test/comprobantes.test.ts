import fs from 'node:fs'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { iniciarSesionComo, prismaFalso } from './ayudas.js'

vi.mock('../src/lib/prisma.js', async () => ({ prisma: (await import('./ayudas.js')).prismaFalso }))

const { app } = await import('../src/app.js')

const CONTENIDO = 'comprobante de prueba'
const NOMBRE = 'prueba-t04.txt'
// Un comprobante de la factura de un alumno cuyo archivo existe en la carpeta privada.
const comprobante = (archivo = NOMBRE) => ({ archivo, facturas: { id_alumno: 7 } })

// Los archivos de prueba se arman con rutas literales relativas a `backend/` (donde corre Vitest),
// la misma carpeta `uploads/` que usa la app.
beforeAll(() => {
  fs.mkdirSync('uploads/comprobantes', { recursive: true })
  fs.mkdirSync('uploads/galeria', { recursive: true })
  fs.writeFileSync('uploads/comprobantes/prueba-t04.txt', CONTENIDO)
  fs.writeFileSync('uploads/galeria/prueba-t04.txt', CONTENIDO)
})

afterAll(() => {
  fs.rmSync('uploads/comprobantes/prueba-t04.txt', { force: true })
  fs.rmSync('uploads/galeria/prueba-t04.txt', { force: true })
})

beforeEach(() => {
  vi.clearAllMocks()
  prismaFalso.comprobanteTransferencia.findUnique.mockResolvedValue(comprobante())
})

describe('la carpeta de comprobantes es privada', () => {
  it('no se abre por /uploads, aunque se conozca el nombre del archivo', async () => {
    const res = await request(app).get(`/uploads/comprobantes/${NOMBRE}`)
    expect(res.status).toBe(404)
  })

  it('las carpetas públicas se siguen sirviendo', async () => {
    const res = await request(app).get(`/uploads/galeria/${NOMBRE}`)
    expect(res.status).toBe(200)
    expect(res.text).toBe(CONTENIDO)
  })
})

describe('GET /api/comprobantes/:id/archivo', () => {
  it('sin sesión devuelve 401', async () => {
    const res = await request(app).get('/api/comprobantes/1/archivo')
    expect(res.status).toBe(401)
  })

  it('el Admin descarga el archivo, sin caché', async () => {
    const token = iniciarSesionComo('Admin')
    const res = await request(app).get('/api/comprobantes/1/archivo').set('Authorization', token)
    expect(res.status).toBe(200)
    expect(res.text).toBe(CONTENIDO)
    expect(res.headers['cache-control']).toBe('private, no-store')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })

  it('la familia dueña del alumno descarga el archivo', async () => {
    const token = iniciarSesionComo('Padre')
    prismaFalso.alumno.findFirst.mockResolvedValue({ id_alumno: 7 })
    const res = await request(app).get('/api/comprobantes/1/archivo').set('Authorization', token)
    expect(res.status).toBe(200)
    expect(res.text).toBe(CONTENIDO)
  })

  it('otra familia recibe 403', async () => {
    const token = iniciarSesionComo('Padre')
    prismaFalso.alumno.findFirst.mockResolvedValue(null)
    const res = await request(app).get('/api/comprobantes/1/archivo').set('Authorization', token)
    expect(res.status).toBe(403)
  })

  it('un Docente recibe 403 sin consultar la pertenencia', async () => {
    const token = iniciarSesionComo('Docente')
    const res = await request(app).get('/api/comprobantes/1/archivo').set('Authorization', token)
    expect(res.status).toBe(403)
    expect(prismaFalso.alumno.findFirst).not.toHaveBeenCalled()
  })

  it('un comprobante que no existe devuelve 404', async () => {
    const token = iniciarSesionComo('Admin')
    prismaFalso.comprobanteTransferencia.findUnique.mockResolvedValue(null)
    const res = await request(app).get('/api/comprobantes/99/archivo').set('Authorization', token)
    expect(res.status).toBe(404)
  })

  it('un id inválido devuelve 400', async () => {
    const token = iniciarSesionComo('Admin')
    const res = await request(app).get('/api/comprobantes/abc/archivo').set('Authorization', token)
    expect(res.status).toBe(400)
  })

  it('no sale de la carpeta privada aunque el nombre guardado tenga "../"', async () => {
    const token = iniciarSesionComo('Admin')
    prismaFalso.comprobanteTransferencia.findUnique.mockResolvedValue(comprobante(`../galeria/${NOMBRE}`))
    const res = await request(app).get('/api/comprobantes/1/archivo').set('Authorization', token)
    expect(res.status).toBe(404)
  })

  it('si el archivo no está en el disco devuelve 404', async () => {
    const token = iniciarSesionComo('Admin')
    prismaFalso.comprobanteTransferencia.findUnique.mockResolvedValue(comprobante('no-existe.pdf'))
    const res = await request(app).get('/api/comprobantes/1/archivo').set('Authorization', token)
    expect(res.status).toBe(404)
  })
})

describe('pagos sin efectivo', () => {
  it.each(['Efectivo', 'Tarjeta de débito', 'Cheque', 'Otro', ''])('registrar un pago con "%s" devuelve 400', async (metodo) => {
    const token = iniciarSesionComo('Admin')
    const res = await request(app).patch('/api/cuotas/1/pago').set('Authorization', token).send({ metodo_pago: metodo })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Solo se aceptan pagos por transferencia')
  })
})
