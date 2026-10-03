import { beforeEach, describe, expect, it, vi } from 'vitest'

const dobles = vi.hoisted(() => ({
  emailHabilitado: true,
  enviarEmail: vi.fn(),
  generarFacturas: vi.fn(),
  pdfFactura: vi.fn(),
  prisma: {
    factura: { findMany: vi.fn() },
    envioEmail: { upsert: vi.fn(), updateMany: vi.fn(), update: vi.fn(), findUniqueOrThrow: vi.fn() },
  },
}))

vi.mock('../src/lib/prisma.js', () => ({ prisma: dobles.prisma }))
vi.mock('../src/services/email.js', async (original) => ({
  ...(await original<typeof import('../src/services/email.js')>()),
  get emailHabilitado() {
    return dobles.emailHabilitado
  },
  enviarEmail: dobles.enviarEmail,
}))
vi.mock('../src/services/facturacion/generar.js', () => ({ generarFacturas: dobles.generarFacturas }))
vi.mock('../src/services/facturacion/pdf.js', () => ({ pdfFactura: dobles.pdfFactura }))

const { enviarFinDeMes, periodoAFacturar } = await import('../src/jobs/emailFinDeMes.js')
const { Prisma } = await import('../src/generated/prisma/client.js')
const { emailFinDeMes } = await import('../src/services/facturacion/emailFactura.js')

const VENCE = new Date('2026-11-10T00:00:00Z')
const usuario = (id: string, activo = true) => ({ id_usuario: id, email: `${id}@familia.test`, nombre: `Familia ${id}`, activo })

/** Factura como la devuelve la consulta del job. */
function factura(id: number, alumno: string, padre: ReturnType<typeof usuario> | null, propio: ReturnType<typeof usuario> | null = null) {
  const [nombre, apellido] = alumno.split(' ')
  return {
    id_factura: id,
    numero: 40 + id,
    anio: 2026,
    mes: 11,
    fecha_vencimiento: VENCE,
    total: 115000,
    saldo: 115000,
    items: [
      { descripcion: 'Cuota Primario · noviembre 2026', importe: 100000 },
      { descripcion: 'Fútbol', importe: 15000 },
    ],
    alumnos: { nombre, apellido, padre, usuarios: propio },
  }
}

const SIN_ERRORES = { generadas: 3, omitidas: 0, errores: [] }

beforeEach(() => {
  vi.clearAllMocks()
  dobles.emailHabilitado = true
  dobles.generarFacturas.mockResolvedValue(SIN_ERRORES)
  dobles.pdfFactura.mockImplementation(async (id: number) => ({ archivo: `factura-${id}`, pdf: Buffer.from(`pdf ${id}`) }))
  dobles.prisma.envioEmail.upsert.mockImplementation(async ({ create }: { create: { id_usuario: string } }) => ({
    id_envio: create.id_usuario.length,
  }))
  dobles.prisma.envioEmail.updateMany.mockResolvedValue({ count: 1 })
  dobles.enviarEmail.mockResolvedValue(true)
})

describe('periodoAFacturar', () => {
  it('el último día hábil de un mes se factura el siguiente, y diciembre pasa a enero', () => {
    expect(periodoAFacturar({ anio: 2026, mes: 10 })).toEqual({ anio: 2026, mes: 11 })
    expect(periodoAFacturar({ anio: 2026, mes: 12 })).toEqual({ anio: 2027, mes: 1 })
  })
})

describe('enviarFinDeMes', () => {
  it('emite las facturas que falten y manda un email por familia con un PDF por hijo', async () => {
    const lopez = usuario('lopez')
    dobles.prisma.factura.findMany.mockResolvedValue([
      factura(1, 'Ana López', lopez),
      factura(2, 'Tomás López', lopez),
      factura(3, 'Juan Pérez', null, usuario('juan')),
    ])

    const r = await enviarFinDeMes(2026, 11, { pausaMs: 0 })

    expect(dobles.generarFacturas).toHaveBeenCalledWith(2026, 11)
    expect(r).toMatchObject({ familias: 2, enviados: 2, yaEnviados: 0, errores: [], emailApagado: false })
    const [primero, segundo] = dobles.enviarEmail.mock.calls.map((c) => c[0])
    expect(primero.para).toBe('lopez@familia.test')
    expect(primero.asunto).toBe('Factura de noviembre 2026 · Educar para Transformar')
    expect(primero.adjuntos.map((a: { nombre: string }) => a.nombre)).toEqual(['factura-1.pdf', 'factura-2.pdf'])
    expect(primero.adjuntos[0].tipo).toBe('application/pdf')
    expect(segundo.para).toBe('juan@familia.test')
    // El envío queda registrado por tipo, período y familia.
    expect(dobles.prisma.envioEmail.upsert.mock.calls[0][0].where).toEqual({
      tipo_anio_mes_id_usuario: { tipo: 'Recordatorio mensual', anio: 2026, mes: 11, id_usuario: 'lopez' },
    })
    expect(dobles.prisma.envioEmail.update.mock.calls[0][0].data).toMatchObject({ estado: 'Enviado', error: null })
  })

  it('un alumno sin usuario activo queda en sinDestinatario', async () => {
    dobles.prisma.factura.findMany.mockResolvedValue([
      factura(1, 'Ana López', null),
      factura(2, 'Tomás Gómez', usuario('gomez', false)),
    ])
    const r = await enviarFinDeMes(2026, 11, { pausaMs: 0 })
    expect(r.sinDestinatario).toEqual(['Ana López', 'Tomás Gómez'])
    expect(dobles.enviarEmail).not.toHaveBeenCalled()
  })

  it('no reenvía: si el envío ya está hecho (o lo tomó otra instancia), lo saltea', async () => {
    dobles.prisma.factura.findMany.mockResolvedValue([factura(1, 'Ana López', usuario('lopez'))])
    dobles.prisma.envioEmail.updateMany.mockResolvedValue({ count: 0 })
    const r = await enviarFinDeMes(2026, 11, { pausaMs: 0 })
    expect(r).toMatchObject({ enviados: 0, yaEnviados: 1 })
    expect(dobles.enviarEmail).not.toHaveBeenCalled()
    // Solo se toman los pendientes o con error.
    expect(dobles.prisma.envioEmail.updateMany.mock.calls[0][0].where.estado).toEqual({ in: ['Pendiente', 'Error'] })
  })

  it('si otra ejecución crea el registro en el mismo instante, lo lee y sigue', async () => {
    dobles.prisma.factura.findMany.mockResolvedValue([factura(1, 'Ana López', usuario('lopez'))])
    dobles.prisma.envioEmail.upsert.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }),
    )
    dobles.prisma.envioEmail.findUniqueOrThrow.mockResolvedValue({ id_envio: 9 })
    dobles.prisma.envioEmail.updateMany.mockResolvedValue({ count: 0 })
    const r = await enviarFinDeMes(2026, 11, { pausaMs: 0 })
    expect(r).toMatchObject({ yaEnviados: 1, errores: [] })
    expect(dobles.prisma.envioEmail.updateMany.mock.calls[0][0].where.id_envio).toBe(9)
  })

  it('si falla un email lo registra como Error y sigue con las demás familias', async () => {
    dobles.prisma.factura.findMany.mockResolvedValue([
      factura(1, 'Ana López', usuario('lopez')),
      factura(2, 'Juan Pérez', usuario('perez')),
    ])
    dobles.enviarEmail.mockRejectedValueOnce(new Error('550 Mailbox unavailable'))
    const r = await enviarFinDeMes(2026, 11, { pausaMs: 0 })
    expect(r.enviados).toBe(1)
    expect(r.errores).toEqual([{ email: 'lopez@familia.test', motivo: '550 Mailbox unavailable' }])
    const estados = dobles.prisma.envioEmail.update.mock.calls.map((c) => c[0].data.estado)
    expect(estados).toEqual(['Error', 'Enviado'])
  })

  it('sin SMTP emite las facturas pero no manda ni registra nada', async () => {
    dobles.emailHabilitado = false
    const r = await enviarFinDeMes(2026, 11, { pausaMs: 0 })
    expect(r).toMatchObject({ emailApagado: true, facturacion: SIN_ERRORES, enviados: 0 })
    expect(dobles.prisma.factura.findMany).not.toHaveBeenCalled()
    expect(dobles.prisma.envioEmail.upsert).not.toHaveBeenCalled()
  })
})

describe('emailFinDeMes (texto)', () => {
  const f = (id: number, alumno: string, total = 115000) => ({
    id_factura: id,
    numero: 40 + id,
    anio: 2026,
    mes: 11,
    fecha_vencimiento: VENCE,
    total,
    saldo: total,
    alumno,
    items: [{ descripcion: 'Cuota Primario · noviembre 2026', importe: total }],
  })

  it('un hijo: vencimiento, composición, número y cómo pagar', () => {
    const { html, texto } = emailFinDeMes('María', [f(1, 'Ana López')])
    expect(texto).toContain('Hola María:')
    expect(texto).toContain('Te enviamos la factura de noviembre 2026 de Ana. Vence el 10/11/2026. Adjuntamos el PDF.')
    expect(texto).toContain('Ana López · Factura N° 00000041')
    expect(texto).toContain('Cuota Primario · noviembre 2026: $ 115.000')
    expect(texto).toContain('Podés pagar por transferencia')
    expect(texto).not.toContain('Total a pagar')
    expect(html).toContain('Factura de noviembre 2026')
  })

  it('varios hijos: los nombra y suma el total a pagar', () => {
    const { texto } = emailFinDeMes('María', [f(1, 'Ana López'), f(2, 'Tomás López', 40000.5), f(3, 'Lía López')])
    expect(texto).toContain('de Ana, Tomás y Lía.')
    expect(texto).toContain('Adjuntamos el PDF de cada una.')
    expect(texto).toContain('Total a pagar: $ 270.000,50')
  })

  it('sin saldo no pide pagar', () => {
    const { texto } = emailFinDeMes('María', [f(1, 'Ana López', 0)])
    expect(texto).toContain('No tiene saldo a pagar.')
    expect(texto).not.toContain('Podés pagar')
  })

  it('escapa el HTML de los nombres y las descripciones', () => {
    const malo = { ...f(1, 'Ana <b>López</b>'), items: [{ descripcion: '<script>x</script>', importe: 1 }] }
    const { html } = emailFinDeMes('<i>María</i>', [malo])
    expect(html).not.toMatch(/<script>|<b>López|<i>María/)
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;')
  })
})
