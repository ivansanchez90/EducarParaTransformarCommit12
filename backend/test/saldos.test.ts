import { describe, expect, it } from 'vitest'
import { calcularImputacion, type ItemSaldo } from '../src/services/saldos.js'

// En centavos: cuota $100.000, deporte $15.000, comedor $40.000 y beca del 25 % (-$25.000).
const CUOTA: ItemSaldo = { id_item: 1, concepto: 'Cuota', saldo: 10_000_000 }
const DEPORTE: ItemSaldo = { id_item: 2, concepto: 'Deporte', saldo: 1_500_000 }
const COMEDOR: ItemSaldo = { id_item: 3, concepto: 'Comedor', saldo: 4_000_000 }
const BECA: ItemSaldo = { id_item: 4, concepto: 'Beca', saldo: -2_500_000 }
const FACTURA = [CUOTA, DEPORTE, COMEDOR, BECA] // total $130.000

const suma = (m: Map<number, number>) => [...m.values()].reduce((s, v) => s + v, 0)
const saldosDespues = (items: ItemSaldo[], m: Map<number, number>) =>
  Object.fromEntries(items.map((i) => [i.concepto, i.saldo - (m.get(i.id_item) ?? 0)]))

describe('calcularImputacion', () => {
  it('el pago total salda todos los ítems, la beca incluida', () => {
    const m = calcularImputacion(FACTURA, 13_000_000)
    expect(suma(m)).toBe(13_000_000)
    expect(saldosDespues(FACTURA, m)).toEqual({ Cuota: 0, Deporte: 0, Comedor: 0, Beca: 0 })
  })

  it('sin orden, paga del ítem más viejo al más nuevo, y la beca se salda con la cuota', () => {
    const m = calcularImputacion(FACTURA, 5_000_000)
    expect(suma(m)).toBe(5_000_000)
    // La cuota neta es $75.000: con $50.000 quedan $25.000 de cuota y la beca saldada.
    expect(saldosDespues(FACTURA, m)).toEqual({ Cuota: 2_500_000, Deporte: 1_500_000, Comedor: 4_000_000, Beca: 0 })
  })

  it('primero los ítems de la orden de pago y el resto a los más viejos', () => {
    const soloDeporte = calcularImputacion(FACTURA, 1_500_000, [DEPORTE.id_item])
    expect([...soloDeporte]).toEqual([[DEPORTE.id_item, 1_500_000]])

    const m = calcularImputacion(FACTURA, 2_000_000, [COMEDOR.id_item])
    expect(saldosDespues(FACTURA, m)).toEqual({ Cuota: 10_000_000, Deporte: 1_500_000, Comedor: 2_000_000, Beca: -2_500_000 })
  })

  it('si la orden incluye la cuota, se paga con su beca', () => {
    const m = calcularImputacion(FACTURA, 7_500_000, [CUOTA.id_item])
    expect(saldosDespues(FACTURA, m)).toEqual({ Cuota: 0, Deporte: 1_500_000, Comedor: 4_000_000, Beca: 0 })
  })

  it('un segundo pago parcial termina de saldar la factura', () => {
    const primero = calcularImputacion(FACTURA, 5_000_000)
    const despues = FACTURA.map((i) => ({ ...i, saldo: i.saldo - (primero.get(i.id_item) ?? 0) }))
    const segundo = calcularImputacion(despues, 8_000_000)
    expect(saldosDespues(despues, segundo)).toEqual({ Cuota: 0, Deporte: 0, Comedor: 0, Beca: 0 })
  })

  it('con beca del 100 %, pagar los servicios también salda la cuota', () => {
    const items = [CUOTA, COMEDOR, { id_item: 9, concepto: 'Beca', saldo: -10_000_000 }]
    const m = calcularImputacion(items, 4_000_000)
    expect(suma(m)).toBe(4_000_000)
    expect(saldosDespues(items, m)).toEqual({ Cuota: 0, Comedor: 0, Beca: 0 })
  })

  it('el recargo se cobra como un ítem más', () => {
    const items = [CUOTA, { id_item: 5, concepto: 'Recargo', saldo: 500_000 }]
    expect(saldosDespues(items, calcularImputacion(items, 10_500_000))).toEqual({ Cuota: 0, Recargo: 0 })
  })

  it('rechaza un importe mayor que el saldo, cero, negativo o con fracción de centavo', () => {
    expect(() => calcularImputacion(FACTURA, 13_000_001)).toThrow('El importe supera el saldo de la factura ($ 130.000,00)')
    expect(() => calcularImputacion(FACTURA, 0)).toThrow('mayor que cero')
    expect(() => calcularImputacion(FACTURA, -100)).toThrow('mayor que cero')
    expect(() => calcularImputacion(FACTURA, 10.5)).toThrow('mayor que cero')
  })

  it('una factura ya pagada no admite más pagos', () => {
    const pagada = FACTURA.map((i) => ({ ...i, saldo: 0 }))
    expect(() => calcularImputacion(pagada, 100)).toThrow('La factura ya está pagada')
  })

  it('la suma de lo imputado es siempre el importe y ningún saldo queda negativo (salvo becas sin saldar)', () => {
    for (const importe of [1, 99, 1_500_000, 7_499_999, 7_500_000, 7_500_001, 12_999_999]) {
      for (const prioridad of [[], [2], [3], [1], [4], [2, 3]]) {
        const m = calcularImputacion(FACTURA, importe, prioridad)
        expect(suma(m), `${importe} ${prioridad}`).toBe(importe)
        for (const i of FACTURA) {
          const queda = i.saldo - (m.get(i.id_item) ?? 0)
          if (i.saldo > 0) expect(queda, `${i.concepto} ${importe}`).toBeGreaterThanOrEqual(0)
          else expect([i.saldo, 0]).toContain(queda)
        }
      }
    }
  })
})
