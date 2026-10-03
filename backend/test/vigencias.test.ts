import { describe, expect, it, vi } from 'vitest'
import { abrirVigencia, cambiarVigencia, cerrarVigencia } from '../src/services/vigencias.js'

type Tx = Parameters<typeof abrirVigencia>[0]

/** Una transacción falsa que anota qué se le pidió a `vigenciaServicio`. */
function txFalsa(abierta: unknown = null) {
  const vigenciaServicio = {
    findFirst: vi.fn(async () => abierta),
    create: vi.fn(async () => ({})),
    updateMany: vi.fn(async () => ({ count: 1 })),
  }
  return { tx: { vigenciaServicio } as unknown as Tx, vigenciaServicio }
}

const AHORA = new Date('2026-11-10T15:00:00Z')

describe('abrirVigencia', () => {
  it('abre la vigencia desde la fecha dada', async () => {
    const { tx, vigenciaServicio } = txFalsa()
    await abrirVigencia(tx, 7, 'Deporte', 3, AHORA)
    expect(vigenciaServicio.create).toHaveBeenCalledWith({
      data: { id_alumno: 7, concepto: 'Deporte', id_referencia: 3, desde: AHORA },
    })
  })

  it('el comedor no tiene referencia', async () => {
    const { tx, vigenciaServicio } = txFalsa()
    await abrirVigencia(tx, 7, 'Comedor', null, AHORA)
    expect(vigenciaServicio.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id_alumno: 7, concepto: 'Comedor', id_referencia: null, hasta: null } }),
    )
  })

  it('no duplica una vigencia que ya está abierta', async () => {
    const { tx, vigenciaServicio } = txFalsa({ id_vigencia: 1 })
    await abrirVigencia(tx, 7, 'Deporte', 3, AHORA)
    expect(vigenciaServicio.create).not.toHaveBeenCalled()
  })
})

describe('cerrarVigencia', () => {
  it('cierra solo la vigencia abierta de esa actividad, con la fecha de la baja', async () => {
    const { tx, vigenciaServicio } = txFalsa()
    await cerrarVigencia(tx, 7, 'Deporte', 3, AHORA)
    expect(vigenciaServicio.updateMany).toHaveBeenCalledWith({
      where: { id_alumno: 7, concepto: 'Deporte', id_referencia: 3, hasta: null },
      data: { hasta: AHORA },
    })
  })

  it('sin referencia cierra todas las abiertas del concepto', async () => {
    const { tx, vigenciaServicio } = txFalsa()
    await cerrarVigencia(tx, 7, 'Transporte', undefined, AHORA)
    expect(vigenciaServicio.updateMany).toHaveBeenCalledWith({
      where: { id_alumno: 7, concepto: 'Transporte', id_referencia: undefined, hasta: null },
      data: { hasta: AHORA },
    })
  })
})

describe('cambiarVigencia', () => {
  it('cierra la anterior y abre la nueva en el mismo instante', async () => {
    const { tx, vigenciaServicio } = txFalsa()
    await cambiarVigencia(tx, 7, 'Transporte', 5, AHORA)
    expect(vigenciaServicio.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { hasta: AHORA } }),
    )
    expect(vigenciaServicio.create).toHaveBeenCalledWith({
      data: { id_alumno: 7, concepto: 'Transporte', id_referencia: 5, desde: AHORA },
    })
  })
})
