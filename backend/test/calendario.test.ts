import { describe, expect, it } from 'vitest'
import {
  diaEnZona,
  diasDelMes,
  esDiaHabil,
  esFeriado,
  esUltimoDiaHabil,
  hayFeriadosCargados,
  ultimoDiaHabil,
  type Dia,
} from '../src/jobs/calendario.js'

describe('ultimoDiaHabil', () => {
  // Calculado a mano con el calendario de 2026: si el mes termina en fin de
  // semana, el último hábil es el viernes anterior.
  it.each([
    [1, 30], // sáb 31 → vie 30
    [2, 27], // sáb 28 → vie 27
    [3, 31], // mar 31
    [4, 30], // jue 30
    [5, 29], // dom 31 → vie 29
    [6, 30], // mar 30
    [7, 31], // vie 31
    [8, 31], // lun 31
    [9, 30], // mié 30
    [10, 30], // sáb 31 → vie 30
    [11, 30], // lun 30
    [12, 31], // jue 31
  ])('2026, mes %i → día %i', (mes, dia) => {
    expect(ultimoDiaHabil(2026, mes)).toEqual({ anio: 2026, mes, dia })
  })

  it('saltea un feriado que cae el último día de semana del mes', () => {
    // 30/10/2026 es viernes; si fuera feriado, el último hábil sería el jueves 29.
    const conFeriado = (f: Dia) => esDiaHabil(f) && !(f.mes === 10 && f.dia === 30)
    expect(ultimoDiaHabil(2026, 10, conFeriado).dia).toBe(29)
  })

  it('saltea varios días seguidos no hábiles', () => {
    // Feriados el jueves 30 y el miércoles 29 de abril de 2026 → martes 28.
    const conFeriados = (f: Dia) => esDiaHabil(f) && !(f.mes === 4 && (f.dia === 29 || f.dia === 30))
    expect(ultimoDiaHabil(2026, 4, conFeriados).dia).toBe(28)
  })

  it('funciona en años bisiestos', () => {
    expect(diasDelMes(2028, 2)).toBe(29)
    expect(ultimoDiaHabil(2028, 2).dia).toBe(29) // martes 29/02/2028
  })
})

describe('feriados y días hábiles', () => {
  it('reconoce feriados con traslado y días no laborables turísticos', () => {
    expect(esFeriado({ anio: 2026, mes: 11, dia: 23 })).toBe(true) // Soberanía, trasladado
    expect(esFeriado({ anio: 2026, mes: 11, dia: 20 })).toBe(false) // fecha original
    expect(esFeriado({ anio: 2026, mes: 12, dia: 7 })).toBe(true) // puente turístico
    expect(esFeriado({ anio: 2026, mes: 10, dia: 12 })).toBe(true)
  })

  it('un feriado o un fin de semana no son días hábiles', () => {
    expect(esDiaHabil({ anio: 2026, mes: 10, dia: 12 })).toBe(false) // lunes feriado
    expect(esDiaHabil({ anio: 2026, mes: 10, dia: 3 })).toBe(false) // sábado
    expect(esDiaHabil({ anio: 2026, mes: 10, dia: 4 })).toBe(false) // domingo
    expect(esDiaHabil({ anio: 2026, mes: 10, dia: 5 })).toBe(true) // lunes
  })

  it('avisa qué años tienen feriados cargados', () => {
    expect(hayFeriadosCargados(2026)).toBe(true)
    expect(hayFeriadosCargados(2027)).toBe(true)
    expect(hayFeriadosCargados(2030)).toBe(false)
  })
})

describe('diaEnZona', () => {
  it('usa el día de Argentina, no el de UTC', () => {
    // 01/10/2026 02:30 UTC = 30/09/2026 23:30 en Buenos Aires.
    expect(diaEnZona(new Date('2026-10-01T02:30:00Z'))).toEqual({ anio: 2026, mes: 9, dia: 30 })
    expect(diaEnZona(new Date('2026-10-01T03:00:00Z'))).toEqual({ anio: 2026, mes: 10, dia: 1 })
  })

  it('el 30/10/2026 a las 22 h de Argentina sigue siendo el último día hábil', () => {
    const instante = new Date('2026-10-31T01:00:00Z')
    expect(esUltimoDiaHabil(diaEnZona(instante))).toBe(true)
  })
})
