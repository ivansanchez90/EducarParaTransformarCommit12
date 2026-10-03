import { afterEach, describe, expect, it, vi } from 'vitest'
import { htmlAviso } from '../src/services/avisos/email.js'
import { publicar, suscribir, type ComprobanteValidado, type Observador } from '../src/services/avisos/eventos.js'
import { textoAviso } from '../src/services/avisos/mensajes.js'

// email.ts importa Prisma: sin base, el doble alcanza (solo se prueba el HTML).
vi.mock('../src/lib/prisma.js', () => ({ prisma: {} }))

const aprobado: ComprobanteValidado = {
  tipo: 'ComprobanteValidado',
  aprobado: true,
  id_alumno: 7,
  alumno: 'Ana Pérez',
  factura: { numero: 41, anio: 2026, mes: 11, saldo: 30000 },
  importe: 50000.5,
}

const desuscribir: (() => void)[] = []
const observador = (nombre: string, notificar: Observador['notificar']) => {
  desuscribir.push(suscribir({ nombre, notificar }))
}

afterEach(() => {
  desuscribir.splice(0).forEach((d) => d())
  vi.restoreAllMocks()
})

describe('publicar (Observer)', () => {
  it('avisa a todos los canales; si uno falla, los demás igual reciben el evento, no lanza y devuelve cómo le fue a cada uno', async () => {
    const recibidos: string[] = []
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    observador('in-app', async (e) => {
      recibidos.push(`in-app:${e.tipo}`)
    })
    observador('email', async () => {
      throw new Error('SMTP caído')
    })
    observador('otro', async (e) => {
      recibidos.push(`otro:${e.tipo}`)
    })

    await expect(publicar(aprobado)).resolves.toEqual([
      { canal: 'in-app', ok: true },
      { canal: 'email', ok: false, error: 'SMTP caído' },
      { canal: 'otro', ok: true },
    ])
    expect(recibidos).toEqual(['in-app:ComprobanteValidado', 'otro:ComprobanteValidado'])
    expect(log).toHaveBeenCalledWith('Aviso ComprobanteValidado por email falló:', expect.any(Error))
  })

  it('un canal desuscripto no recibe más eventos', async () => {
    const notificar = vi.fn(async () => undefined)
    const quitar = suscribir({ nombre: 'temporal', notificar })
    quitar()
    await publicar(aprobado)
    expect(notificar).not.toHaveBeenCalled()
  })
})

describe('textos de los avisos', () => {
  it('aprobado con saldo pendiente', () => {
    expect(textoAviso(aprobado)).toEqual({
      titulo: 'Pago acreditado',
      mensaje: 'Acreditamos tu transferencia de $ 50.000,50 para la factura de noviembre 2026 de Ana Pérez. Queda un saldo de $ 30.000.',
    })
  })

  it('aprobado que salda la factura', () => {
    const pagada = { ...aprobado, factura: { ...aprobado.factura, saldo: 0 } }
    expect(textoAviso(pagada).mensaje).toMatch(/La factura quedó pagada\.$/)
  })

  it('rechazado con el motivo', () => {
    const rechazado = { ...aprobado, aprobado: false, importe: 50000, motivo: 'El importe no coincide' }
    expect(textoAviso(rechazado)).toEqual({
      titulo: 'Comprobante rechazado',
      mensaje:
        'No pudimos validar tu comprobante de $ 50.000 para la factura de noviembre 2026 de Ana Pérez. ' +
        'Motivo: El importe no coincide. Podés subir otro desde la app.',
    })
  })

  it('el email escapa el HTML del motivo', () => {
    const html = htmlAviso('Comprobante rechazado', 'Motivo: <script>alert(1)</script> & "otro"')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;otro&quot;')
  })
})
