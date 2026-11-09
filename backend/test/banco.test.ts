/** Datos de la cuenta para transferir (`BANCO_*`): qué se muestra según lo que esté cargado. */
import { describe, expect, it } from 'vitest'
import { config } from '../src/lib/config.js'
import { datosBancarios, destinoTransferencia, lineasBancarias } from '../src/services/banco.js'

const completos = { alias: 'educar.transformar.demo', cbu: '9990001800000123456784', titular: 'Educar', banco: 'Banco Escolar' }
const vacios = { alias: null, cbu: null, titular: null, banco: null }

describe('datos bancarios', () => {
  it('lista solo lo cargado, en el orden banco, titular, CBU y alias', () => {
    expect(lineasBancarias(completos)).toEqual([
      'Banco: Banco Escolar',
      'Titular: Educar',
      'CBU: 9990001800000123456784',
      'Alias: educar.transformar.demo',
    ])
    expect(lineasBancarias({ ...vacios, cbu: '9990001800000123456784' })).toEqual(['CBU: 9990001800000123456784'])
    expect(lineasBancarias(vacios)).toEqual([])
  })

  it('arma el destino de la frase de los emails con alias, CBU o los dos', () => {
    expect(destinoTransferencia(completos)).toBe('al alias educar.transformar.demo (CBU 9990001800000123456784)')
    expect(destinoTransferencia({ ...vacios, alias: 'x.y.z' })).toBe('al alias x.y.z')
    expect(destinoTransferencia({ ...vacios, cbu: '123' })).toBe('al CBU 123')
    expect(destinoTransferencia(vacios)).toBe('')
  })

  it('toma los valores de la configuración y deja en null lo que está vacío', () => {
    const antes = { ...config }
    Object.assign(config, { bancoAlias: 'a.b.c', bancoCbu: '9990001800000123456784', bancoTitular: '', bancoNombre: '' })
    try {
      expect(datosBancarios()).toEqual({ alias: 'a.b.c', cbu: '9990001800000123456784', titular: null, banco: null })
    } finally {
      Object.assign(config, antes)
    }
  })
})
