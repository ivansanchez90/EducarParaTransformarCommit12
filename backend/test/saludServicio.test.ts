import { describe, expect, it } from 'vitest'
import { HttpError } from '../src/lib/http.js'
import { diferencias, validarAtencion, validarFicha } from '../src/services/salud.js'

const mensajeDe = (fn: () => unknown) => {
  try {
    fn()
  } catch (error) {
    return error instanceof HttpError ? `${error.status}: ${error.message}` : String(error)
  }
  return 'no falló'
}

describe('validarFicha', () => {
  it('normaliza los textos: los vacíos y los espacios quedan en null', () => {
    expect(validarFicha({ grupo_sanguineo: '', alergias: '  ', alergias_criticas: ' Maní ', medicacion: null })).toEqual({
      grupo_sanguineo: null,
      alergias: null,
      alergias_criticas: 'Maní',
      medicacion: null,
      condiciones: null,
      observaciones: null,
    })
  })

  it.each(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'])('acepta el grupo sanguíneo %s', (grupo) => {
    expect(validarFicha({ grupo_sanguineo: grupo }).grupo_sanguineo).toBe(grupo)
  })

  it.each(['C+', 'O+', 'a+', 'AB', '++'])('rechaza el grupo sanguíneo "%s", y dice cuáles valen', (grupo) => {
    const mensaje = mensajeDe(() => validarFicha({ grupo_sanguineo: grupo }))
    expect(mensaje).toContain('400')
    expect(mensaje).toContain('A+, A-, B+, B-, AB+, AB-, 0+, 0-')
  })

  it('rechaza un texto de más de 1000 caracteres y dice cuál campo es', () => {
    expect(mensajeDe(() => validarFicha({ alergias: 'a'.repeat(1001) }))).toBe('400: Las alergias no puede tener más de 1000 caracteres')
    expect(mensajeDe(() => validarFicha({ medicacion: 'a'.repeat(1000) }))).toBe('no falló')
  })

  it('sin cuerpo devuelve todo vacío', () => {
    expect(Object.values(validarFicha(undefined)).every((v) => v === null)).toBe(true)
  })
})

describe('validarAtencion', () => {
  const AHORA = new Date('2026-10-22T15:00:00Z')

  it('el motivo es obligatorio', () => {
    expect(mensajeDe(() => validarAtencion({}, AHORA))).toBe('400: El motivo de la atención es obligatorio')
    expect(mensajeDe(() => validarAtencion({ motivo: '   ' }, AHORA))).toBe('400: El motivo de la atención es obligatorio')
  })

  it('el motivo admite hasta 200 caracteres', () => {
    expect(mensajeDe(() => validarAtencion({ motivo: 'a'.repeat(200) }, AHORA))).toBe('no falló')
    expect(mensajeDe(() => validarAtencion({ motivo: 'a'.repeat(201) }, AHORA))).toBe('400: El motivo no puede tener más de 200 caracteres')
  })

  it('sin fecha devuelve null: la base pone la de ahora', () => {
    expect(validarAtencion({ motivo: 'Dolor de cabeza' }, AHORA)).toEqual({ motivo: 'Dolor de cabeza', descripcion: null, tratamiento: null, fecha_hora: null })
  })

  it('acepta una fecha pasada', () => {
    expect(validarAtencion({ motivo: 'x', fecha_hora: '2026-10-22T10:00:00Z' }, AHORA).fecha_hora?.toISOString()).toBe('2026-10-22T10:00:00.000Z')
  })

  it('tolera 5 minutos de desfase de reloj, pero no una fecha futura', () => {
    expect(mensajeDe(() => validarAtencion({ motivo: 'x', fecha_hora: '2026-10-22T15:04:00Z' }, AHORA))).toBe('no falló')
    expect(mensajeDe(() => validarAtencion({ motivo: 'x', fecha_hora: '2026-10-22T15:06:00Z' }, AHORA))).toBe('400: La atención no puede tener una fecha futura')
    expect(mensajeDe(() => validarAtencion({ motivo: 'x', fecha_hora: '2999-01-01' }, AHORA))).toBe('400: La atención no puede tener una fecha futura')
  })

  it('rechaza una fecha que no existe', () => {
    expect(mensajeDe(() => validarAtencion({ motivo: 'x', fecha_hora: 'ayer' }, AHORA))).toBe('400: La fecha y hora de la atención no es válida')
  })
})

describe('diferencias', () => {
  it('devuelve solo lo que cambió, con el valor de antes y el de después', () => {
    expect(diferencias({ alergias: 'Polen', medicacion: null }, { alergias: 'Polen y maní', medicacion: null })).toEqual({
      alergias: { antes: 'Polen', despues: 'Polen y maní' },
    })
  })

  it('si no cambió nada devuelve un objeto vacío', () => {
    expect(diferencias({ alergias: 'Polen' }, { alergias: 'Polen' })).toEqual({})
  })

  it('un campo que antes no existía cuenta como cambio, salvo que siga vacío', () => {
    expect(diferencias({}, { alergias: 'Polen', medicacion: null })).toEqual({ alergias: { antes: null, despues: 'Polen' } })
  })

  it('pasar de un valor a vacío es un cambio', () => {
    expect(diferencias({ alergias: 'Polen' }, { alergias: null })).toEqual({ alergias: { antes: 'Polen', despues: null } })
  })

  it('compara las fechas por su valor, no por la referencia', () => {
    expect(diferencias({ fecha_hora: new Date('2026-10-22T10:00:00Z') }, { fecha_hora: new Date('2026-10-22T10:00:00Z') })).toEqual({})
    expect(Object.keys(diferencias({ fecha_hora: new Date('2026-10-22T10:00:00Z') }, { fecha_hora: new Date('2026-10-22T11:00:00Z') }))).toEqual(['fecha_hora'])
  })

  it('ignora los campos de la versión vieja que no vienen en la nueva (ids, fechas de alta)', () => {
    expect(diferencias({ id_ficha: 3, updated_at: new Date(), alergias: 'Polen' }, { alergias: 'Polen' })).toEqual({})
  })
})
