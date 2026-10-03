import fs from 'node:fs'
import path from 'node:path'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { iniciarSesionComo, prismaFalso } from './ayudas.js'

vi.mock('../src/lib/prisma.js', async () => ({ prisma: (await import('./ayudas.js')).prismaFalso }))

const { app } = await import('../src/app.js')
const { UPLOADS_DIR } = await import('../src/middleware/upload.js')

const CONTENIDO = 'comprobante de prueba'
const NOMBRE = 'prueba-t04.txt'
const carpetaPrivada = path.join(UPLOADS_DIR, 'comprobantes')
const carpetaPublica = path.join(UPLOADS_DIR, 'galeria')

// Un comprobante de la factura de un alumno cuyo archivo existe en la carpeta privada.
const comprobante = (archivo = NOMBRE) => ({ archivo, facturas: { id_alumno: 7 } })

beforeAll(() => {
  fs.mkdirSync(carpetaPrivada, { recursive: true })
  fs.mkdirSync(carpetaPublica, { recursive: true })
  fs.writeFileSync(path.join(carpetaPrivada, NOMBRE), CONTENIDO)
  fs.writeFileSync(path.join(carpetaPublica, NOMBRE), CONTENIDO)
})

afterAll(() => {
  fs.rmSync(path.join(carpetaPrivada, NOMBRE), { force: true })
  fs.rmSync(path.join(carpetaPublica, NOMBRE), { force: true })
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
