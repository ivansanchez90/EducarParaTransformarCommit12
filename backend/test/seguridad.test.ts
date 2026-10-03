import jwt from 'jsonwebtoken'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ID_USUARIO, iniciarSesionComo, prismaFalso } from './ayudas.js'

vi.mock('../src/lib/prisma.js', async () => ({ prisma: (await import('./ayudas.js')).prismaFalso }))

const { app } = await import('../src/app.js')

// Rutas de la API que exigen sesión (cualquier rol).
const RUTAS_CON_SESION = [
  '/api/alumnos/1',
  '/api/actividades',
  '/api/recorridos',
  '/api/notificaciones',
  '/api/servicios/mis-inscripciones',
]

// Rutas solo para Admin y Directivo.
const RUTAS_DE_ADMIN = ['/api/tarifas', '/api/usuarios', '/api/cuotas', '/api/reportes/alumnos', '/api/dashboard/stats']

beforeEach(() => {
  vi.clearAllMocks()
})

describe('la API responde', () => {
  it('GET /api/health devuelve ok', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })

  it('una ruta de la API que no existe devuelve 404', async () => {
    const res = await request(app).get('/api/no-existe')
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Ruta no encontrada')
  })
})

describe('401: sin sesión válida', () => {
  it.each([...RUTAS_CON_SESION, ...RUTAS_DE_ADMIN])('%s sin token', async (ruta) => {
    const res = await request(app).get(ruta)
    expect(res.status).toBe(401)
  })

  it('rechaza un token que no es un JWT', async () => {
    const res = await request(app).get('/api/tarifas').set('Authorization', 'Bearer cualquier-cosa')
    expect(res.status).toBe(401)
  })

  it('rechaza un token firmado con otro secreto', async () => {
    const ajeno = jwt.sign({ sub: ID_USUARIO }, 'otro-secreto')
    const res = await request(app).get('/api/tarifas').set('Authorization', `Bearer ${ajeno}`)
    expect(res.status).toBe(401)
  })

  it('rechaza un token vencido', async () => {
    const vencido = jwt.sign({ sub: ID_USUARIO }, 'test', { expiresIn: -10 })
    const res = await request(app).get('/api/tarifas').set('Authorization', `Bearer ${vencido}`)
    expect(res.status).toBe(401)
  })

  it('rechaza un token de un usuario que ya no existe', async () => {
    const token = iniciarSesionComo('Admin')
    prismaFalso.usuario.findUnique.mockResolvedValue(null)
    const res = await request(app).get('/api/tarifas').set('Authorization', token)
    expect(res.status).toBe(401)
  })
})

describe('403: sesión válida sin permiso', () => {
  it('un usuario desactivado no entra, ni siquiera siendo Admin', async () => {
    const token = iniciarSesionComo('Admin', false)
    const res = await request(app).get('/api/tarifas').set('Authorization', token)
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('USUARIO_INACTIVO')
  })

  it.each(['Padre', 'Alumno', 'Docente'])('%s no entra a las rutas de administración', async (rol) => {
    const token = iniciarSesionComo(rol)
    for (const ruta of RUTAS_DE_ADMIN) {
      const res = await request(app).get(ruta).set('Authorization', token)
      expect(res.status, `${rol} en ${ruta}`).toBe(403)
    }
  })

  it('el Admin pasa el control de rol (no recibe 401 ni 403)', async () => {
    const token = iniciarSesionComo('Admin')
    const res = await request(app).get('/api/tarifas').set('Authorization', token)
    expect([401, 403]).not.toContain(res.status)
  })

  it('una familia no puede ver al alumno de otra familia', async () => {
    const token = iniciarSesionComo('Padre')
    prismaFalso.alumno.findFirst.mockResolvedValue(null)
    const res = await request(app).get('/api/alumnos/99').set('Authorization', token)
    expect(res.status).toBe(403)
  })

  it('una familia ve a su propio hijo', async () => {
    const token = iniciarSesionComo('Padre')
    prismaFalso.alumno.findFirst.mockResolvedValue({ id_alumno: 7 })
    prismaFalso.alumno.findUnique.mockResolvedValue({ id_alumno: 7, nombre: 'Hijo' })
    const res = await request(app).get('/api/alumnos/7').set('Authorization', token)
    expect(res.status).toBe(200)
    expect(res.body.id_alumno).toBe(7)
  })

  it('el personal ve a cualquier alumno sin consultar la pertenencia', async () => {
    const token = iniciarSesionComo('Docente')
    prismaFalso.alumno.findUnique.mockResolvedValue({ id_alumno: 99 })
    const res = await request(app).get('/api/alumnos/99').set('Authorization', token)
    expect(res.status).toBe(200)
    expect(prismaFalso.alumno.findFirst).not.toHaveBeenCalled()
  })
})
