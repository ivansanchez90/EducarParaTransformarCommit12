import { describe, expect, it } from 'vitest'
import { cobranzaPorServicio, horariosTexto } from '../src/services/reportesCobranza.js'
import type { ItemServicio } from '../src/services/reportesCobranza.js'

const HOY = new Date('2026-10-20')

const item = (
  id_servicio: number,
  servicio: string,
  id_alumno: number,
  apellido: string,
  mes: number,
  importe: number,
  saldo: number,
  vence = '2026-12-10',
): ItemServicio => ({
  id_servicio,
  servicio,
  id_alumno,
  nombre: 'Ana',
  apellido,
  curso: '3° A',
  nivel: 'Primario',
  anio: 2026,
  mes,
  importe,
  saldo,
  fecha_vencimiento: new Date(vence),
})

describe('cobranzaPorServicio', () => {
  it('sin ítems devuelve todo en cero', () => {
    expect(cobranzaPorServicio([], HOY)).toEqual({ filas: [], porServicio: [], alumnos: 0, facturado: 0, pagado: 0, saldo: 0 })
  })

  it('cada fila tiene lo facturado, lo pagado (importe − saldo) y el saldo del ítem', () => {
    const { filas } = cobranzaPorServicio([item(1, 'Fútbol', 1, 'Acosta', 10, 15000, 5000)], HOY)
    expect(filas[0]).toMatchObject({ servicio: 'Fútbol', alumno: 'Acosta, Ana', periodo: 'Octubre 2026', facturado: 15000, pagado: 10000, saldo: 5000 })
  })

  it('el estado del ítem usa el vencimiento de su factura', () => {
    const { filas } = cobranzaPorServicio(
      [
        item(1, 'Fútbol', 1, 'Acosta', 8, 15000, 0, '2026-08-10'),
        item(1, 'Fútbol', 2, 'Benítez', 8, 15000, 15000, '2026-08-10'),
        item(1, 'Fútbol', 3, 'Castro', 10, 15000, 5000),
        item(1, 'Fútbol', 4, 'Díaz', 10, 15000, 15000),
      ],
      HOY,
    )
    expect(filas.map((f) => f.estado)).toEqual(['Pagada', 'Vencida', 'Pago parcial', 'Pendiente'])
  })

  it('resume cada servicio con sus alumnos distintos, aunque tengan varios meses', () => {
    const r = cobranzaPorServicio(
      [
        item(1, 'Fútbol', 1, 'Acosta', 9, 15000, 0),
        item(1, 'Fútbol', 1, 'Acosta', 10, 15000, 15000),
        item(1, 'Fútbol', 2, 'Benítez', 10, 15000, 0),
        item(2, 'Natación', 1, 'Acosta', 10, 20000, 20000),
      ],
      HOY,
    )
    expect(r.porServicio).toEqual([
      { id_servicio: 1, servicio: 'Fútbol', alumnos: 2, facturado: 45000, pagado: 30000, saldo: 15000 },
      { id_servicio: 2, servicio: 'Natación', alumnos: 1, facturado: 20000, pagado: 0, saldo: 20000 },
    ])
    expect(r).toMatchObject({ alumnos: 2, facturado: 65000, pagado: 30000, saldo: 35000 })
  })

  it('ordena por servicio, alumno (con acentos) y período', () => {
    const { filas } = cobranzaPorServicio(
      [
        item(2, 'Natación', 1, 'Acosta', 10, 1, 0),
        item(1, 'Fútbol', 3, 'Zapata', 9, 1, 0),
        item(1, 'Fútbol', 2, 'Álvarez', 10, 1, 0),
        item(1, 'Fútbol', 2, 'Álvarez', 9, 1, 0),
      ],
      HOY,
    )
    expect(filas.map((f) => `${f.servicio} ${f.alumno} ${f.periodo}`)).toEqual([
      'Fútbol Álvarez, Ana Septiembre 2026',
      'Fútbol Álvarez, Ana Octubre 2026',
      'Fútbol Zapata, Ana Septiembre 2026',
      'Natación Acosta, Ana Octubre 2026',
    ])
  })

  it('dos servicios con el mismo nombre se resumen por separado', () => {
    const r = cobranzaPorServicio([item(1, 'Vóley', 1, 'Acosta', 10, 100, 0), item(2, 'Vóley', 2, 'Benítez', 10, 100, 0)], HOY)
    expect(r.porServicio.map((s) => s.id_servicio)).toEqual([1, 2])
  })

  it('suma en centavos: 0,10 + 0,20 da exactamente 0,30', () => {
    const r = cobranzaPorServicio([item(1, 'Fútbol', 1, 'Acosta', 9, 0.1, 0.1), item(1, 'Fútbol', 1, 'Acosta', 10, 0.2, 0.2)], HOY)
    expect(r.facturado).toBe(0.3)
    expect(r.saldo).toBe(0.3)
    expect(r.porServicio[0].facturado).toBe(0.3)
  })
})

describe('horariosTexto', () => {
  const franja = (dia_semana: string, inicio: string, fin: string) => ({
    dia_semana,
    hora_inicio: new Date(`1970-01-01T${inicio}:00Z`),
    hora_fin: new Date(`1970-01-01T${fin}:00Z`),
  })

  it('ordena las franjas de lunes a domingo y por hora', () => {
    expect(horariosTexto([franja('Miércoles', '17:00', '18:30'), franja('Lunes', '18:00', '19:00'), franja('Lunes', '09:00', '10:00')])).toBe(
      'Lunes 09:00–10:00 · Lunes 18:00–19:00 · Miércoles 17:00–18:30',
    )
  })

  it('sin franjas dice que no tiene horario', () => {
    expect(horariosTexto([])).toBe('Sin horario')
  })
})
