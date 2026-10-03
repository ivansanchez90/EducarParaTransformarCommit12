/** Canales y textos del aviso de deuda (evento DeudaDetectada). */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DeudaDetectada } from '../src/services/avisos/eventos.js'

const dobles = vi.hoisted(() => ({ notificarFamilias: vi.fn(), enviarEmail: vi.fn() }))

vi.mock('../src/lib/prisma.js', () => ({ prisma: {} }))
vi.mock('../src/services/notificaciones.js', () => ({ notificarFamilias: dobles.notificarFamilias }))
vi.mock('../src/services/email.js', async (original) => ({
  ...(await original<typeof import('../src/services/email.js')>()),
  emailHabilitado: true,
  enviarEmail: dobles.enviarEmail,
}))

const { observadorInApp } = await import('../src/services/avisos/inApp.js')
const { emailObserver } = await import('../src/services/avisos/email.js')
const { emailDeuda } = await import('../src/services/avisos/emailDeuda.js')
const { textoDeuda } = await import('../src/services/avisos/mensajes.js')

const factura = (mes: number, saldo: number) => ({
  numero: 40 + mes,
  anio: 2026,
  mes,
  fecha_vencimiento: new Date(Date.UTC(2026, mes - 1, 10)),
  saldo,
  items: [
    { descripcion: `Cuota Primario · ${mes}`, saldo: saldo - 15000 },
    { descripcion: 'Fútbol', saldo: 15000 },
  ],
})

const evento: DeudaDetectada = {
  tipo: 'DeudaDetectada',
  anio: 2026,
  mes: 11,
  familia: { id_usuario: 'u1', email: 'lopez@familia.test', nombre: 'María' },
  alumnos: [
    { id_alumno: 1, nombre: 'Ana López', facturas: [factura(10, 30000), factura(11, 115000)] },
    { id_alumno: 2, nombre: 'Tomás López', facturas: [factura(11, 40000.5)] },
  ],
  total: 185000.5,
  primeraVez: true,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('canal in-app y push', () => {
  it('un aviso por hijo con lo que debe', async () => {
    await observadorInApp.notificar(evento)
    expect(dobles.notificarFamilias).toHaveBeenCalledWith(
      [
        {
          id_alumno: 1,
          titulo: 'Saldo pendiente',
          mensaje:
            'Ana tiene $ 145.000 pendientes de las facturas de octubre 2026 y noviembre 2026, ya vencidas. ' +
            'Podés pagar por transferencia y subir el comprobante desde la app. Si ya pagaste, no hace falta que hagas nada.',
        },
        expect.objectContaining({ id_alumno: 2, mensaje: expect.stringContaining('Tomás tiene $ 40.000,50 pendientes de la factura de noviembre 2026, ya vencida.') }),
      ],
      'Pago',
    )
  })

  it('en un reintento del email no se repite', async () => {
    await observadorInApp.notificar({ ...evento, primeraVez: false })
    expect(dobles.notificarFamilias).not.toHaveBeenCalled()
  })
})

describe('EmailObserver con la deuda', () => {
  it('manda el detalle a la familia', async () => {
    await emailObserver.notificar(evento)
    const email = dobles.enviarEmail.mock.calls[0][0]
    expect(email.para).toBe('lopez@familia.test')
    expect(email.asunto).toBe('Saldo pendiente · Educar para Transformar')
  })

  it('si el servidor rechaza el email, el canal falla (y la tarea lo registra)', async () => {
    dobles.enviarEmail.mockRejectedValueOnce(new Error('550'))
    await expect(emailObserver.notificar(evento)).rejects.toThrow('550')
  })
})

describe('textos', () => {
  it('el email detalla cada factura y sus ítems, con el total', () => {
    const { texto } = emailDeuda(evento)
    expect(texto).toContain('Hola María:')
    expect(texto).toContain('facturas vencidas con saldo pendiente por un total de $ 185.000,50.')
    expect(texto).toContain('Ana López · octubre 2026 · Factura N° 00000050 (venció el 10/10/2026)')
    expect(texto).toContain('  Fútbol: $ 15.000')
    expect(texto).toContain('Tomás López · noviembre 2026 · Factura N° 00000051 (venció el 10/11/2026)')
    expect(texto).toContain('Total pendiente: $ 185.000,50')
    expect(texto).toContain('Si ya pagaste y subiste el comprobante, no hace falta que hagas nada')
  })

  it('el email escapa el HTML', () => {
    const malo = { ...evento, familia: { ...evento.familia, nombre: '<b>María</b>' } }
    malo.alumnos = [{ id_alumno: 1, nombre: 'Ana <i>López</i>', facturas: [{ ...factura(11, 1000), items: [{ descripcion: '<script>x</script>', saldo: 1000 }] }] }]
    const { html } = emailDeuda(malo)
    expect(html).not.toMatch(/<script>|<b>María|<i>López/)
    expect(html).toContain('&lt;script&gt;')
  })

  it('in-app con una sola factura habla en singular', () => {
    expect(textoDeuda(evento.alumnos[1]).mensaje).toContain('de la factura de noviembre 2026, ya vencida.')
  })
})
