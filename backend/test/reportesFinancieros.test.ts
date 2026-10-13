import { describe, expect, it } from 'vitest'
import { ingresosPorPeriodo, resumenPorAlumno } from '../src/services/reportesFinancieros.js'
import type { FacturaDelAnio, PagoIngreso } from '../src/services/reportesFinancieros.js'

const ZONA = 'America/Argentina/Buenos_Aires'

const pago = (fecha: string, monto: number, metodo: string | null = 'Transferencia'): PagoIngreso => ({
  fecha_pago: new Date(fecha),
  monto_pagado: monto,
  metodo_pago: metodo,
})

describe('ingresosPorPeriodo', () => {
  it('sin pagos devuelve todo en cero', () => {
    expect(ingresosPorPeriodo([], 'mes', ZONA)).toEqual({ periodos: [], porMetodo: [], cantidad: 0, total: 0 })
  })

  it('suma por mes, en orden cronológico y con el nombre del mes', () => {
    const r = ingresosPorPeriodo(
      [pago('2026-10-05T15:00:00Z', 50000), pago('2026-09-10T15:00:00Z', 30000), pago('2026-10-20T15:00:00Z', 12500)],
      'mes',
      ZONA,
    )
    expect(r.periodos).toEqual([
      { clave: '2026-09', etiqueta: 'Septiembre 2026', cantidad: 1, monto: 30000 },
      { clave: '2026-10', etiqueta: 'Octubre 2026', cantidad: 2, monto: 62500 },
    ])
    expect(r.total).toBe(92500)
    expect(r.cantidad).toBe(3)
  })

  it('un pago de las 23:00 del 30/9 en Argentina cuenta en septiembre, aunque en UTC ya sea octubre', () => {
    const r = ingresosPorPeriodo([pago('2026-10-01T02:00:00Z', 1000)], 'mes', ZONA)
    expect(r.periodos.map((p) => p.clave)).toEqual(['2026-09'])
  })

  it('un pago de las 00:30 del 1/10 en Argentina cuenta en octubre', () => {
    const r = ingresosPorPeriodo([pago('2026-10-01T03:30:00Z', 1000)], 'mes', ZONA)
    expect(r.periodos.map((p) => p.clave)).toEqual(['2026-10'])
  })

  it('agrupa por día con la fecha en formato argentino', () => {
    const r = ingresosPorPeriodo([pago('2026-10-05T15:00:00Z', 100), pago('2026-10-05T18:00:00Z', 200), pago('2026-10-06T15:00:00Z', 50)], 'dia', ZONA)
    expect(r.periodos).toEqual([
      { clave: '2026-10-05', etiqueta: '05/10/2026', cantidad: 2, monto: 300 },
      { clave: '2026-10-06', etiqueta: '06/10/2026', cantidad: 1, monto: 50 },
    ])
  })

  it('suma en centavos: 0,10 + 0,20 da exactamente 0,30', () => {
    const r = ingresosPorPeriodo([pago('2026-10-05T15:00:00Z', 0.1), pago('2026-10-05T16:00:00Z', 0.2)], 'mes', ZONA)
    expect(r.total).toBe(0.3)
    expect(r.periodos[0].monto).toBe(0.3)
  })

  it('separa por método de pago, de mayor a menor, y nombra los que no tienen', () => {
    const r = ingresosPorPeriodo(
      [pago('2026-10-05T15:00:00Z', 100, 'Transferencia'), pago('2026-10-06T15:00:00Z', 900, 'Efectivo'), pago('2026-10-07T15:00:00Z', 50, null)],
      'mes',
      ZONA,
    )
    expect(r.porMetodo).toEqual([
      { metodo: 'Efectivo', cantidad: 1, monto: 900 },
      { metodo: 'Transferencia', cantidad: 1, monto: 100 },
      { metodo: 'Sin dato', cantidad: 1, monto: 50 },
    ])
  })

  it('ignora los pagos sin fecha', () => {
    const r = ingresosPorPeriodo([{ fecha_pago: null, monto_pagado: 999, metodo_pago: null }, pago('2026-10-05T15:00:00Z', 100)], 'mes', ZONA)
    expect(r.cantidad).toBe(1)
    expect(r.total).toBe(100)
  })
})

const HOY = new Date('2026-10-20')

const factura = (id_alumno: number, mes: number, total: number, saldo: number, vence: string, nombre = 'Lucía', apellido = 'Acosta'): FacturaDelAnio => ({
  id_alumno,
  mes,
  numero: id_alumno * 100 + mes,
  total,
  saldo,
  fecha_vencimiento: new Date(vence),
  nombre,
  apellido,
  curso: '3° A',
  nivel: 'Primario',
})

describe('resumenPorAlumno', () => {
  it('un alumno con todas sus facturas pagadas es completo', () => {
    const [a] = resumenPorAlumno([factura(1, 9, 50000, 0, '2026-09-10'), factura(1, 10, 62500, 0, '2026-10-10')], HOY)
    expect(a).toMatchObject({ completo: true, facturas: 2, facturado: 112500, pagado: 112500, adeudado: 0, vencidas: 0 })
  })

  it('con una sola factura con saldo ya es incompleto, y suma lo adeudado', () => {
    const [a] = resumenPorAlumno([factura(1, 9, 50000, 0, '2026-09-10'), factura(1, 10, 62500, 22500, '2026-12-10')], HOY)
    expect(a).toMatchObject({ completo: false, facturado: 112500, pagado: 90000, adeudado: 22500, vencidas: 0 })
  })

  it('cuenta como vencidas solo las facturas con saldo cuyo vencimiento ya pasó', () => {
    const [a] = resumenPorAlumno(
      [factura(1, 8, 50000, 50000, '2026-08-10'), factura(1, 9, 50000, 10000, '2026-09-10'), factura(1, 10, 50000, 50000, '2026-12-10'), factura(1, 7, 50000, 0, '2026-07-10')],
      HOY,
    )
    expect(a.vencidas).toBe(2)
  })

  it('separa a cada alumno y los ordena por apellido y nombre, respetando los acentos', () => {
    const r = resumenPorAlumno(
      [factura(3, 10, 100, 0, '2026-10-10', 'Zoe', 'Álvarez'), factura(2, 10, 100, 0, '2026-10-10', 'Ana', 'Zapata'), factura(1, 10, 100, 100, '2026-12-10', 'Beto', 'Acosta')],
      HOY,
    )
    expect(r.map((a) => a.alumno)).toEqual(['Acosta, Beto', 'Álvarez, Zoe', 'Zapata, Ana'])
    expect(r.map((a) => a.completo)).toEqual([false, true, true])
  })

  it('suma en centavos', () => {
    const [a] = resumenPorAlumno([factura(1, 9, 0.1, 0, '2026-09-10'), factura(1, 10, 0.2, 0, '2026-10-10')], HOY)
    expect(a.facturado).toBe(0.3)
  })

  it('sin facturas no hay alumnos', () => {
    expect(resumenPorAlumno([], HOY)).toEqual([])
  })
})
