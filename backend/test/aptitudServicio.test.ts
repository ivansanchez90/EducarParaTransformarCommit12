import { describe, expect, it } from 'vitest'
import { HttpError } from '../src/lib/http.js'
import { DIAS_POR_VENCER, estadoAptitud, validarCertificado, vencimientoDe } from '../src/services/aptitud.js'

const dia = (texto: string) => new Date(`${texto}T00:00:00Z`)
const texto = (d: Date) => d.toISOString().slice(0, 10)

const mensajeDe = (fn: () => unknown) => {
  try {
    fn()
  } catch (error) {
    return error instanceof HttpError ? `${error.status}: ${error.message}` : String(error)
  }
  return 'no falló'
}

describe('vencimientoDe', () => {
  it.each([
    ['2026-03-15', '2027-03-15'],
    ['2026-12-31', '2027-12-31'],
    ['2026-01-01', '2027-01-01'],
    ['2023-10-22', '2024-10-22'],
  ])('un certificado emitido el %s vence el %s', (emision, vence) => {
    expect(texto(vencimientoDe(dia(emision)))).toBe(vence)
  })

  it('un 29 de febrero vence el 28 de febrero del año siguiente, no el 1 de marzo', () => {
    expect(texto(vencimientoDe(dia('2024-02-29')))).toBe('2025-02-28')
  })

  it('un 29 de febrero de un año bisiesto sigue en febrero cuando el siguiente también lo es', () => {
    // 2028 es bisiesto, pero 2029 no: vence el 28/2/2029.
    expect(texto(vencimientoDe(dia('2028-02-29')))).toBe('2029-02-28')
  })
})

describe('estadoAptitud', () => {
  const HOY = dia('2026-10-22')

  it('sin certificados falta', () => {
    expect(estadoAptitud([], HOY)).toEqual({ estado: 'Faltante', vigente_hasta: null, dias_restantes: null, por_vencer: false })
  })

  it('un certificado que vence en el futuro está vigente, con los días que le quedan', () => {
    expect(estadoAptitud([{ fecha_vencimiento: dia('2027-03-15') }], HOY)).toMatchObject({ estado: 'Vigente', vigente_hasta: '2027-03-15', dias_restantes: 144, por_vencer: false })
  })

  it('vence hoy: todavía sirve, con 0 días', () => {
    expect(estadoAptitud([{ fecha_vencimiento: HOY }], HOY)).toMatchObject({ estado: 'Vigente', dias_restantes: 0, por_vencer: true })
  })

  it('venció ayer: ya no sirve', () => {
    expect(estadoAptitud([{ fecha_vencimiento: dia('2026-10-21') }], HOY)).toEqual({ estado: 'Vencido', vigente_hasta: '2026-10-21', dias_restantes: null, por_vencer: false })
  })

  it(`avisa que está por vencer cuando faltan ${DIAS_POR_VENCER} días o menos, y no antes`, () => {
    expect(estadoAptitud([{ fecha_vencimiento: dia('2026-11-21') }], HOY).por_vencer).toBe(true) // 30 días
    expect(estadoAptitud([{ fecha_vencimiento: dia('2026-11-22') }], HOY).por_vencer).toBe(false) // 31 días
  })

  it('rige el que vence más tarde, sin importar el orden', () => {
    const viejo = { fecha_vencimiento: dia('2026-01-10') }
    const nuevo = { fecha_vencimiento: dia('2027-06-30') }
    expect(estadoAptitud([viejo, nuevo], HOY).vigente_hasta).toBe('2027-06-30')
    expect(estadoAptitud([nuevo, viejo], HOY).vigente_hasta).toBe('2027-06-30')
  })

  it('con uno vencido y otro vigente, está vigente', () => {
    expect(estadoAptitud([{ fecha_vencimiento: dia('2026-01-10') }, { fecha_vencimiento: dia('2027-06-30') }], HOY).estado).toBe('Vigente')
  })

  it('con todos vencidos, está vencido y muestra el último', () => {
    expect(estadoAptitud([{ fecha_vencimiento: dia('2025-06-01') }, { fecha_vencimiento: dia('2026-05-01') }], HOY)).toMatchObject({ estado: 'Vencido', vigente_hasta: '2026-05-01' })
  })
})

describe('validarCertificado', () => {
  const HOY = dia('2026-10-22')

  it('calcula el vencimiento y normaliza las observaciones', () => {
    const datos = validarCertificado({ fecha_emision: '2026-10-01', observaciones: '  Apto para todo deporte ' }, HOY)
    expect(texto(datos.fecha_emision)).toBe('2026-10-01')
    expect(texto(datos.fecha_vencimiento)).toBe('2027-10-01')
    expect(datos.observaciones).toBe('Apto para todo deporte')
  })

  it('las observaciones vacías quedan en null', () => {
    expect(validarCertificado({ fecha_emision: '2026-10-01', observaciones: '   ' }, HOY).observaciones).toBeNull()
  })

  it('el vencimiento no se carga: si viene en el cuerpo, se ignora', () => {
    expect(texto(validarCertificado({ fecha_emision: '2026-10-01', fecha_vencimiento: '2099-01-01' }, HOY).fecha_vencimiento)).toBe('2027-10-01')
  })

  it('la fecha de emisión es obligatoria', () => {
    expect(mensajeDe(() => validarCertificado({}, HOY))).toBe('400: La fecha de emisión del certificado es obligatoria')
    expect(mensajeDe(() => validarCertificado(undefined, HOY))).toContain('400')
  })

  it('una fecha que no existe se rechaza', () => {
    expect(mensajeDe(() => validarCertificado({ fecha_emision: '2026-99-99' }, HOY))).toContain('400')
    expect(mensajeDe(() => validarCertificado({ fecha_emision: 'ayer' }, HOY))).toContain('400')
  })

  it('no puede emitirse en el futuro, pero hoy sí', () => {
    expect(mensajeDe(() => validarCertificado({ fecha_emision: '2026-10-23' }, HOY))).toBe('400: La fecha de emisión no puede ser posterior a hoy')
    expect(mensajeDe(() => validarCertificado({ fecha_emision: '2026-10-22' }, HOY))).toBe('no falló')
  })

  it('un certificado de hace más de un año ya está vencido y se rechaza, diciendo cuándo venció', () => {
    expect(mensajeDe(() => validarCertificado({ fecha_emision: '2025-10-21' }, HOY))).toBe('400: Ese certificado venció el 21/10/2026: no sirve para inscribirse. Cargá uno vigente.')
  })

  it('uno emitido hace exactamente un año vence hoy y todavía sirve', () => {
    expect(mensajeDe(() => validarCertificado({ fecha_emision: '2025-10-22' }, HOY))).toBe('no falló')
  })

  it('las observaciones admiten hasta 500 caracteres', () => {
    expect(mensajeDe(() => validarCertificado({ fecha_emision: '2026-10-01', observaciones: 'x'.repeat(500) }, HOY))).toBe('no falló')
    expect(mensajeDe(() => validarCertificado({ fecha_emision: '2026-10-01', observaciones: 'x'.repeat(501) }, HOY))).toBe('400: Las observaciones no pueden tener más de 500 caracteres')
  })
})
