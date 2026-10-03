/** Tarea del aviso de deuda (T18): a quién avisa, una vez por mes, y qué registra. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const dobles = vi.hoisted(() => ({
  emailHabilitado: true,
  publicar: vi.fn(),
  prisma: {
    factura: { findMany: vi.fn() },
    envioEmail: { upsert: vi.fn(), updateMany: vi.fn(), update: vi.fn(), findUniqueOrThrow: vi.fn() },
  },
}))

vi.mock('../src/lib/prisma.js', () => ({ prisma: dobles.prisma }))
vi.mock('../src/services/avisos/index.js', () => ({ publicar: dobles.publicar }))
vi.mock('../src/services/email.js', async (original) => ({
  ...(await original<typeof import('../src/services/email.js')>()),
  get emailHabilitado() {
    return dobles.emailHabilitado
  },
}))

const { enviarAvisoDeuda } = await import('../src/jobs/avisoDeuda.js')

const usuario = (id: string, activo = true) => ({ id_usuario: id, email: `${id}@familia.test`, nombre: `Familia ${id}`, activo })

function factura(alumno: [number, string], mes: number, saldo: number, padre: ReturnType<typeof usuario> | null) {
  const [nombre, apellido] = alumno[1].split(' ')
  return {
    numero: 100 + mes,
    anio: 2026,
    mes,
    fecha_vencimiento: new Date(Date.UTC(2026, mes - 1, 10)),
    saldo,
    items: [{ descripcion: 'Cuota', saldo }],
    alumnos: { id_alumno: alumno[0], nombre, apellido, padre, usuarios: null },
  }
}

const OK = [
  { canal: 'in-app y push', ok: true },
  { canal: 'email', ok: true },
]

beforeEach(() => {
  vi.clearAllMocks()
  dobles.emailHabilitado = true
  dobles.publicar.mockResolvedValue(OK)
  dobles.prisma.envioEmail.upsert.mockImplementation(async ({ create }: { create: { id_usuario: string } }) => ({
    id_envio: create.id_usuario.length,
    intentos: 0,
  }))
  dobles.prisma.envioEmail.updateMany.mockResolvedValue({ count: 1 })
})

describe('enviarAvisoDeuda', () => {
  it('busca las facturas con saldo vencidas antes del día 20 del mes', async () => {
    dobles.prisma.factura.findMany.mockResolvedValue([])
    const r = await enviarAvisoDeuda(2026, 11, { pausaMs: 0 })
    expect(dobles.prisma.factura.findMany.mock.calls[0][0].where).toEqual({
      saldo: { gt: 0 },
      fecha_vencimiento: { lt: new Date('2026-11-20T00:00:00Z') },
    })
    expect(r).toMatchObject({ familias: 0, avisadas: 0 })
    expect(dobles.publicar).not.toHaveBeenCalled()
  })

  it('un aviso por familia, con cada hijo y sus facturas, y el total', async () => {
    const lopez = usuario('lopez')
    dobles.prisma.factura.findMany.mockResolvedValue([
      factura([1, 'Ana López'], 10, 30000, lopez),
      factura([1, 'Ana López'], 11, 115000.5, lopez),
      factura([2, 'Tomás López'], 11, 40000, lopez),
      factura([3, 'Juan Pérez'], 11, 20000, usuario('perez')),
    ])

    const r = await enviarAvisoDeuda(2026, 11, { pausaMs: 0 })

    expect(r).toMatchObject({ familias: 2, avisadas: 2, yaAvisadas: 0, errores: [], emailApagado: false })
    expect(dobles.publicar).toHaveBeenCalledTimes(2)
    const evento = dobles.publicar.mock.calls[0][0]
    expect(evento).toMatchObject({
      tipo: 'DeudaDetectada',
      anio: 2026,
      mes: 11,
      primeraVez: true,
      familia: { id_usuario: 'lopez', email: 'lopez@familia.test', nombre: 'Familia lopez' },
      total: 185000.5,
    })
    expect(evento.alumnos.map((a: { nombre: string; facturas: unknown[] }) => [a.nombre, a.facturas.length])).toEqual([
      ['Ana López', 2],
      ['Tomás López', 1],
    ])
    expect(dobles.prisma.envioEmail.upsert.mock.calls[0][0].where).toEqual({
      tipo_anio_mes_id_usuario: { tipo: 'Aviso de deuda', anio: 2026, mes: 11, id_usuario: 'lopez' },
    })
    expect(dobles.prisma.envioEmail.update.mock.calls[0][0].data).toMatchObject({ estado: 'Enviado', error: null })
  })

  it('una familia ya avisada este mes no recibe otro aviso', async () => {
    dobles.prisma.factura.findMany.mockResolvedValue([factura([1, 'Ana López'], 11, 1000, usuario('lopez'))])
    dobles.prisma.envioEmail.updateMany.mockResolvedValue({ count: 0 })
    const r = await enviarAvisoDeuda(2026, 11, { pausaMs: 0 })
    expect(r).toMatchObject({ avisadas: 0, yaAvisadas: 1 })
    expect(dobles.publicar).not.toHaveBeenCalled()
  })

  it('si falla el email queda en Error; el reintento no repite el aviso in-app', async () => {
    dobles.prisma.factura.findMany.mockResolvedValue([factura([1, 'Ana López'], 11, 1000, usuario('lopez'))])
    dobles.publicar.mockResolvedValueOnce([
      { canal: 'in-app y push', ok: true },
      { canal: 'email', ok: false, error: '550 Mailbox unavailable' },
    ])
    const r = await enviarAvisoDeuda(2026, 11, { pausaMs: 0 })
    expect(r.errores).toEqual([{ email: 'lopez@familia.test', motivo: '550 Mailbox unavailable' }])
    expect(dobles.prisma.envioEmail.update.mock.calls[0][0].data).toMatchObject({ estado: 'Error', error: '550 Mailbox unavailable' })

    // Segunda vuelta: la fila ya tuvo un intento.
    dobles.prisma.envioEmail.upsert.mockResolvedValue({ id_envio: 1, intentos: 1 })
    await enviarAvisoDeuda(2026, 11, { pausaMs: 0 })
    expect(dobles.publicar.mock.calls[1][0].primeraVez).toBe(false)
  })

  it('si solo falla el aviso in-app, el email salió y no se reintenta', async () => {
    dobles.prisma.factura.findMany.mockResolvedValue([factura([1, 'Ana López'], 11, 1000, usuario('lopez'))])
    dobles.publicar.mockResolvedValue([
      { canal: 'in-app y push', ok: false, error: 'base caída' },
      { canal: 'email', ok: true },
    ])
    const r = await enviarAvisoDeuda(2026, 11, { pausaMs: 0 })
    expect(r).toMatchObject({ avisadas: 1, errores: [] })
    expect(dobles.prisma.envioEmail.update.mock.calls[0][0].data.estado).toBe('Enviado')
  })

  it('sin SMTP avisa igual in-app y push, y lo deja anotado', async () => {
    dobles.emailHabilitado = false
    dobles.prisma.factura.findMany.mockResolvedValue([factura([1, 'Ana López'], 11, 1000, usuario('lopez'))])
    const r = await enviarAvisoDeuda(2026, 11, { pausaMs: 0 })
    expect(r).toMatchObject({ emailApagado: true, avisadas: 1 })
    expect(dobles.publicar).toHaveBeenCalledTimes(1)
    expect(dobles.prisma.envioEmail.update.mock.calls[0][0].data).toMatchObject({
      estado: 'Enviado',
      error: 'Email apagado: se avisó solo in-app y push',
    })
  })

  it('un alumno sin usuario activo queda en sinDestinatario (una sola vez)', async () => {
    dobles.prisma.factura.findMany.mockResolvedValue([
      factura([1, 'Ana López'], 10, 1000, null),
      factura([1, 'Ana López'], 11, 1000, null),
      factura([2, 'Tomás Gómez'], 11, 1000, usuario('gomez', false)),
    ])
    const r = await enviarAvisoDeuda(2026, 11, { pausaMs: 0 })
    expect(r.sinDestinatario).toEqual(['Ana López', 'Tomás Gómez'])
    expect(dobles.publicar).not.toHaveBeenCalled()
  })
})
