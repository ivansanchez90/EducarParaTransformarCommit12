/**
 * 401/403 de los endpoints nuevos de la Parte 3 (T09): tarifas, facturación,
 * PDF de la factura y profesor y horarios de las actividades. Cada ruta se
 * prueba con su método real, no solo con GET.
 */
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { iniciarSesionComo, prismaFalso } from './ayudas.js'

const dobles = vi.hoisted(() => ({
  factura: { findUnique: vi.fn() },
  pdfFactura: vi.fn(),
}))

vi.mock('../src/lib/prisma.js', async () => ({
  prisma: { ...(await import('./ayudas.js')).prismaFalso, factura: dobles.factura },
}))
vi.mock('../src/services/facturacion/pdf.js', () => ({ pdfFactura: dobles.pdfFactura }))

const { app } = await import('../src/app.js')

type Metodo = 'get' | 'post' | 'put' | 'delete'

// Solo Admin y Directivo.
const RUTAS_DE_ADMIN: [Metodo, string][] = [
  ['get', '/api/tarifas'],
  ['get', '/api/tarifas/opciones'],
  ['post', '/api/tarifas'],
  ['put', '/api/tarifas/1'],
  ['delete', '/api/tarifas/1'],
  ['post', '/api/facturas/generar'],
  ['get', '/api/facturas?anio=2026&mes=11'],
  ['post', '/api/actividades'],
  ['put', '/api/actividades/1'],
]

const PDF = '/api/facturas/1/pdf'

const pedir = (metodo: Metodo, ruta: string, token?: string) => {
  const req = request(app)[metodo](ruta)
  return token ? req.set('Authorization', token) : req
}

beforeEach(() => {
  vi.clearAllMocks()
  dobles.factura.findUnique.mockResolvedValue({ id_alumno: 7 })
  dobles.pdfFactura.mockResolvedValue({ archivo: 'factura-1', pdf: Buffer.from('%PDF-prueba') })
})

describe('401: sin sesión', () => {
  it.each([...RUTAS_DE_ADMIN, ['get', PDF] as [Metodo, string]])('%s %s', async (metodo, ruta) => {
    const res = await pedir(metodo, ruta)
    expect(res.status).toBe(401)
  })
})

describe('403: rutas de administración', () => {
  it.each(['Padre', 'Alumno', 'Docente'])('%s recibe 403 en todas', async (rol) => {
    const token = iniciarSesionComo(rol)
    for (const [metodo, ruta] of RUTAS_DE_ADMIN) {
      const res = await pedir(metodo, ruta, token)
      expect(res.status, `${rol} en ${metodo.toUpperCase()} ${ruta}`).toBe(403)
    }
  })

  it('un Admin desactivado recibe 403', async () => {
    const token = iniciarSesionComo('Admin', false)
    const res = await pedir('post', '/api/facturas/generar', token)
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('USUARIO_INACTIVO')
  })

  it.each(['Admin', 'Directivo'])('%s pasa el control de rol', async (rol) => {
    const token = iniciarSesionComo(rol)
    // Sin cuerpo, la generación responde 400 por el período: pasó la sesión y el rol sin tocar la base.
    const res = await pedir('post', '/api/facturas/generar', token)
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Mes inválido')
  })
})

describe('PDF de la factura', () => {
  it('la administración lo descarga', async () => {
    const res = await pedir('get', PDF, iniciarSesionComo('Directivo'))
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('application/pdf')
    expect(res.headers['content-disposition']).toBe('attachment; filename="factura-1.pdf"')
  })

  it('la familia del alumno lo descarga', async () => {
    const token = iniciarSesionComo('Padre')
    prismaFalso.alumno.findFirst.mockResolvedValue({ id_alumno: 7 })
    const res = await pedir('get', PDF, token)
    expect(res.status).toBe(200)
  })

  it('otra familia recibe 403 y no se arma el PDF', async () => {
    const token = iniciarSesionComo('Padre')
    prismaFalso.alumno.findFirst.mockResolvedValue(null)
    const res = await pedir('get', PDF, token)
    expect(res.status).toBe(403)
    expect(dobles.pdfFactura).not.toHaveBeenCalled()
  })

  it('un Docente recibe 403 sin consultar la pertenencia', async () => {
    const res = await pedir('get', PDF, iniciarSesionComo('Docente'))
    expect(res.status).toBe(403)
    expect(prismaFalso.alumno.findFirst).not.toHaveBeenCalled()
    expect(dobles.pdfFactura).not.toHaveBeenCalled()
  })

  it('una factura que no existe devuelve 404', async () => {
    dobles.factura.findUnique.mockResolvedValue(null)
    const res = await pedir('get', '/api/facturas/99/pdf', iniciarSesionComo('Admin'))
    expect(res.status).toBe(404)
  })
})
