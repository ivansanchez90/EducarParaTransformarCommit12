import { describe, expect, it, vi } from 'vitest'
import { correrTarea, type TareaProgramada } from '../src/jobs/index.js'
import { esUltimoDiaHabil } from '../src/jobs/calendario.js'

const tarea = (ejecutar: TareaProgramada['ejecutar']): TareaProgramada => ({
  nombre: 'prueba',
  expresion: '0 9 * * *',
  corresponde: esUltimoDiaHabil,
  ejecutar,
})

describe('correrTarea', () => {
  it('no ejecuta la tarea si hoy no corresponde', async () => {
    const ejecutar = vi.fn(async () => {})
    // 29/10/2026 a las 9 de Argentina: no es el último día hábil.
    expect(await correrTarea(tarea(ejecutar), new Date('2026-10-29T12:00:00Z'))).toBe('omitida')
    expect(ejecutar).not.toHaveBeenCalled()
  })

  it('la ejecuta con el día de Argentina cuando corresponde', async () => {
    const ejecutar = vi.fn(async () => {})
    expect(await correrTarea(tarea(ejecutar), new Date('2026-10-30T12:00:00Z'))).toBe('ejecutada')
    expect(ejecutar).toHaveBeenCalledWith({ anio: 2026, mes: 10, dia: 30 })
  })

  it('un error de la tarea no se propaga', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fallida = tarea(async () => {
      throw new Error('SMTP caído')
    })
    expect(await correrTarea(fallida, new Date('2026-10-30T12:00:00Z'))).toBe('fallida')
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})
