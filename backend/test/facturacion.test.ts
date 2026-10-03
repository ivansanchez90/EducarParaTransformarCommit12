import { describe, expect, it } from 'vitest'
import { estadoFactura } from '../src/services/facturacion/estado.js'
import { ESTRATEGIAS, calcularItems, vigenteEnPeriodo } from '../src/services/facturacion/estrategias.js'
import { crearPeriodo } from '../src/services/facturacion/periodo.js'
import {
  FaltaDatoFacturacion,
  type AlumnoFacturable,
  type ContextoFacturacion,
  type EstrategiaConcepto,
} from '../src/services/facturacion/tipos.js'
import { claveTarifa } from '../src/services/tarifas.js'

const noviembre = crearPeriodo(2026, 11)

/** Tarifas de prueba en pesos. */
const PRECIOS: Record<string, number> = {
  [claveTarifa({ concepto: 'Cuota', nivel: 'Primario' })]: 100_000,
  [claveTarifa({ concepto: 'Deporte', id_referencia: 1 })]: 12_000.5,
  [claveTarifa({ concepto: 'Deporte', id_referencia: 2 })]: 15_000,
  [claveTarifa({ concepto: 'Transporte', id_referencia: 7 })]: 30_000,
  [claveTarifa({ concepto: 'Comedor' })]: 40_000,
}

const ctx: ContextoFacturacion = {
  periodo: noviembre,
  precio(ref, nombre) {
    const precio = PRECIOS[claveTarifa(ref)]
    if (precio === undefined) throw new FaltaDatoFacturacion(`Sin tarifa de ${nombre}`)
    return Math.round(precio * 100)
  },
}

const octubre = new Date('2026-10-15T15:00:00Z')

function alumno(datos: Partial<AlumnoFacturable> = {}): AlumnoFacturable {
  return {
    id_alumno: 1,
    nombre: 'Ana',
    apellido: 'Pérez',
    nivel: 'Primario',
    beca: null,
    deportes: [],
    transporte: null,
    comedor: null,
    ...datos,
  }
}

const total = (a: AlumnoFacturable) => calcularItems(a, ctx).reduce((s, i) => s + i.centavos, 0) / 100

describe('calcularItems', () => {
  it('solo cuota', () => {
    const items = calcularItems(alumno(), ctx)
    expect(items).toEqual([
      { concepto: 'Cuota', id_referencia: null, descripcion: 'Cuota Primario · noviembre 2026', centavos: 10_000_000 },
    ])
  })

  it('un ítem por concepto, con decimales exactos', () => {
    const a = alumno({
      deportes: [
        { id_actividad: 1, nombre: 'Fútbol', desde: octubre },
        { id_actividad: 2, nombre: 'Natación', desde: octubre },
      ],
      transporte: { id_recorrido: 7, nombre: 'Recorrido Norte', desde: octubre },
      comedor: { desde: octubre },
    })
    expect(calcularItems(a, ctx).map((i) => i.concepto)).toEqual(['Cuota', 'Deporte', 'Deporte', 'Transporte', 'Comedor'])
    expect(total(a)).toBe(197_000.5)
  })

  it('la beca descuenta su porcentaje solo sobre la cuota', () => {
    const a = alumno({ beca: 25, comedor: { desde: octubre } })
    const items = calcularItems(a, ctx)
    expect(items.at(-1)).toEqual({
      concepto: 'Beca',
      id_referencia: null,
      descripcion: 'Beca 25% sobre la cuota',
      centavos: -2_500_000,
    })
    expect(total(a)).toBe(115_000) // 100.000 − 25.000 + 40.000
  })

  it('una beca del 100 % deja la factura en 0 si no hay servicios', () => {
    expect(total(alumno({ beca: 100 }))).toBe(0)
  })

  it('no cobra un servicio al que se inscribió después del período', () => {
    const diciembre = new Date('2026-12-01T03:00:00Z') // 00:00 del 1/12 en Argentina
    const a = alumno({ comedor: { desde: diciembre } })
    expect(calcularItems(a, ctx).map((i) => i.concepto)).toEqual(['Cuota'])
  })

  it('sin curso o sin tarifa, no se puede facturar', () => {
    expect(() => calcularItems(alumno({ nivel: null }), ctx)).toThrow(FaltaDatoFacturacion)
    expect(() => calcularItems(alumno({ nivel: 'Secundario' }), ctx)).toThrow('Sin tarifa de Cuota Secundario')
    const sinTarifa = alumno({ deportes: [{ id_actividad: 99, nombre: 'Polo', desde: octubre }] })
    expect(() => calcularItems(sinTarifa, ctx)).toThrow('Sin tarifa de Polo')
  })

  it('sumar un concepto es sumar una estrategia', () => {
    const matricula: EstrategiaConcepto = {
      concepto: 'Cuota',
      calcular: () => [{ concepto: 'Cuota', id_referencia: null, descripcion: 'Matrícula', centavos: 500_000 }],
    }
    expect(calcularItems(alumno(), ctx, [...ESTRATEGIAS, matricula]).at(-1)?.descripcion).toBe('Matrícula')
  })
})

describe('vigenteEnPeriodo', () => {
  it('cuenta lo que se usó algún día del mes', () => {
    expect(vigenteEnPeriodo({ desde: octubre }, noviembre)).toBe(true)
    expect(vigenteEnPeriodo({ desde: new Date('2026-11-30T23:00:00Z') }, noviembre)).toBe(true) // 30/11 20 h en Argentina
    expect(vigenteEnPeriodo({ desde: new Date('2026-12-01T03:00:00Z') }, noviembre)).toBe(false)
    // Con fecha de baja (T07): dado de baja en octubre no se cobra en noviembre.
    expect(vigenteEnPeriodo({ desde: octubre, hasta: new Date('2026-10-31T00:00:00Z') }, noviembre)).toBe(false)
    expect(vigenteEnPeriodo({ desde: octubre, hasta: new Date('2026-11-10T00:00:00Z') }, noviembre)).toBe(true)
  })
})

describe('crearPeriodo', () => {
  it('rechaza meses y años inválidos', () => {
    expect(() => crearPeriodo(2026, 13)).toThrow('Mes inválido')
    expect(() => crearPeriodo(Number.NaN, 1)).toThrow('Año inválido')
  })
})

describe('estadoFactura', () => {
  const vence = new Date('2026-11-10T00:00:00Z')
  const antes = new Date('2026-11-05T00:00:00Z')
  const despues = new Date('2026-11-11T00:00:00Z')
  const f = (total: number, saldo: number) => ({ total, saldo, fecha_vencimiento: vence })

  it.each([
    [f(100, 100), antes, 'Pendiente'],
    [f(100, 40), antes, 'Pago parcial'],
    [f(100, 0), antes, 'Pagada'],
    [f(100, 0), despues, 'Pagada'],
    [f(100, 100), despues, 'Vencida'],
    [f(100, 40), despues, 'Vencida'],
    [f(100, 100), vence, 'Pendiente'], // el día del vencimiento todavía no está vencida
    [f(0, 0), antes, 'Pagada'],
  ])('%o el %s → %s', (factura, hoy, esperado) => {
    expect(estadoFactura(factura, hoy)).toBe(esperado)
  })
})
