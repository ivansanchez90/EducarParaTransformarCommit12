/** Las tareas programadas (cuándo corren y qué período usan) y su ejecución a mano. */
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { iniciarSesionComo } from './ayudas.js'

const dobles = vi.hoisted(() => ({ enviarFinDeMes: vi.fn(), enviarAvisoDeuda: vi.fn() }))

vi.mock('../src/lib/prisma.js', async () => ({ prisma: (await import('./ayudas.js')).prismaFalso }))
vi.mock('../src/jobs/emailFinDeMes.js', async (original) => ({
  ...(await original<typeof import('../src/jobs/emailFinDeMes.js')>()),
  enviarFinDeMes: dobles.enviarFinDeMes,
}))
vi.mock('../src/jobs/avisoDeuda.js', async (original) => ({
  ...(await original<typeof import('../src/jobs/avisoDeuda.js')>()),
  enviarAvisoDeuda: dobles.enviarAvisoDeuda,
}))

const { TAREAS, correrTarea } = await import('../src/jobs/index.js')
const { app } = await import('../src/app.js')

const RESULTADO = { facturacion: { generadas: 0, omitidas: 0, errores: [] }, emailApagado: false, enviados: 0, yaEnviados: 0, errores: [] }
const AVISO = { familias: 0, avisadas: 0, yaAvisadas: 0, sinDestinatario: [], errores: [], emailApagado: false }
const tarea = TAREAS.find((t) => t.nombre === 'Email de fin de mes')!
const aviso = TAREAS.find((t) => t.nombre === 'Aviso de deuda')!

beforeEach(() => {
  vi.clearAllMocks()
  dobles.enviarFinDeMes.mockResolvedValue(RESULTADO)
  dobles.enviarAvisoDeuda.mockResolvedValue(AVISO)
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

describe('tarea "Email de fin de mes"', () => {
  it('está programada a las 9 y a las 18', () => {
    expect(tarea.expresion).toBe('0 9,18 * * *')
  })

  it('el último día hábil de octubre de 2026 (viernes 30) manda noviembre', async () => {
    expect(await correrTarea(tarea, new Date('2026-10-30T12:00:00Z'))).toBe('ejecutada')
    expect(dobles.enviarFinDeMes).toHaveBeenCalledWith(2026, 11)
  })

  it('cualquier otro día no hace nada (ni el sábado 31)', async () => {
    for (const dia of ['2026-10-29T12:00:00Z', '2026-10-31T12:00:00Z', '2026-11-02T12:00:00Z']) {
      expect(await correrTarea(tarea, new Date(dia)), dia).toBe('omitida')
    }
    expect(dobles.enviarFinDeMes).not.toHaveBeenCalled()
  })

  it('el último día hábil de diciembre manda enero del año siguiente', async () => {
    expect(await correrTarea(tarea, new Date('2026-12-31T12:00:00Z'))).toBe('ejecutada')
    expect(dobles.enviarFinDeMes).toHaveBeenCalledWith(2027, 1)
  })

  it('usa el día de Argentina: el 30/10 a las 23 h de Argentina (ya 31 en UTC) todavía corre', async () => {
    expect(await correrTarea(tarea, new Date('2026-10-31T02:00:00Z'))).toBe('ejecutada')
  })
})

describe('POST /api/tareas/recordatorio-mensual', () => {
  const ruta = '/api/tareas/recordatorio-mensual'

  it('sin sesión 401; Padre y Docente 403', async () => {
    expect((await request(app).post(ruta)).status).toBe(401)
    for (const rol of ['Padre', 'Docente']) {
      const res = await request(app).post(ruta).set('Authorization', iniciarSesionComo(rol)).send({ anio: 2026, mes: 11 })
      expect(res.status, rol).toBe(403)
    }
    expect(dobles.enviarFinDeMes).not.toHaveBeenCalled()
  })

  it('el Admin lo ejecuta para el período que pide', async () => {
    const res = await request(app).post(ruta).set('Authorization', iniciarSesionComo('Admin')).send({ anio: 2026, mes: 11 })
    expect(res.status).toBe(200)
    expect(res.body).toEqual(RESULTADO)
    expect(dobles.enviarFinDeMes).toHaveBeenCalledWith(2026, 11)
  })

  it('un período inválido → 400', async () => {
    const res = await request(app).post(ruta).set('Authorization', iniciarSesionComo('Admin')).send({ anio: 2026, mes: 13 })
    expect(res.status).toBe(400)
  })
})

describe('tarea "Aviso de deuda"', () => {
  it('cron la dispara solo el día 20, a las 9 y a las 18', () => {
    expect(aviso.expresion).toBe('0 9,18 20 * *')
    expect(aviso.corresponde).toBeUndefined()
  })

  it('usa el mes del día de Argentina', async () => {
    expect(await correrTarea(aviso, new Date('2026-11-20T12:00:00Z'))).toBe('ejecutada')
    expect(dobles.enviarAvisoDeuda).toHaveBeenCalledWith(2026, 11)
  })
})

describe('POST /api/tareas/aviso-deuda', () => {
  const ruta = '/api/tareas/aviso-deuda'

  it('sin sesión 401; Padre y Docente 403', async () => {
    expect((await request(app).post(ruta)).status).toBe(401)
    for (const rol of ['Padre', 'Docente']) {
      const res = await request(app).post(ruta).set('Authorization', iniciarSesionComo(rol)).send({ anio: 2026, mes: 11 })
      expect(res.status, rol).toBe(403)
    }
    expect(dobles.enviarAvisoDeuda).not.toHaveBeenCalled()
  })

  it('el Directivo lo ejecuta para el mes que pide; un mes inválido es 400', async () => {
    const token = iniciarSesionComo('Directivo')
    const res = await request(app).post(ruta).set('Authorization', token).send({ anio: 2026, mes: 11 })
    expect(res.status).toBe(200)
    expect(res.body).toEqual(AVISO)
    expect(dobles.enviarAvisoDeuda).toHaveBeenCalledWith(2026, 11)
    expect((await request(app).post(ruta).set('Authorization', token).send({ anio: 2026, mes: 0 })).status).toBe(400)
  })
})
