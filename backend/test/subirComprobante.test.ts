import fs from 'node:fs'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '../src/generated/prisma/client.js'
import { ID_USUARIO, iniciarSesionComo, prismaFalso } from './ayudas.js'

vi.mock('../src/lib/prisma.js', async () => ({ prisma: (await import('./ayudas.js')).prismaFalso }))

const { app } = await import('../src/app.js')

const relleno = Buffer.alloc(64)
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), relleno])
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), relleno])
const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), relleno])
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), relleno])
const AVIF = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypavif'), Buffer.alloc(4), Buffer.from('mif1'), relleno])
const HEIC = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic'), Buffer.alloc(4), Buffer.from('mif1'), relleno])

const escribir = vi.spyOn(fs.promises, 'writeFile')
const crearCarpeta = vi.spyOn(fs.promises, 'mkdir')
const borrar = vi.spyOn(fs.promises, 'unlink')

const comprobanteCreado = {
  id_comprobante: 9,
  id_factura: 3,
  id_orden: null,
  estado: 'En revisión',
  importe: new Prisma.Decimal(1000),
  fecha_transferencia: new Date('2026-10-02'),
  fecha_carga: new Date('2026-10-03T15:00:00Z'),
}

beforeEach(() => {
  vi.clearAllMocks()
  escribir.mockResolvedValue(undefined)
  crearCarpeta.mockResolvedValue(undefined)
  borrar.mockResolvedValue(undefined)
  prismaFalso.factura.findUnique.mockResolvedValue({ id_alumno: 7, saldo: new Prisma.Decimal(1000) })
  prismaFalso.ordenPago.findFirst.mockResolvedValue({ id_orden: 5 })
  prismaFalso.comprobanteTransferencia.create.mockResolvedValue(comprobanteCreado)
})

interface Envio {
  archivo?: Buffer | null
  nombre?: string
  campos?: Record<string, string>
}

/** Sube un comprobante: por defecto una foto JPG de $1.000 transferida el 2/10/2026. */
function subir(token: string | null, { archivo = JPG, nombre = 'foto.jpg', campos = {} }: Envio = {}, idFactura = 3) {
  const datos = { importe: '1000', fecha_transferencia: '2026-10-02', ...campos }
  let pedido = request(app).post(`/api/facturas/${idFactura}/comprobantes`)
  if (token) pedido = pedido.set('Authorization', token)
  for (const [campo, valor] of Object.entries(datos)) pedido = pedido.field(campo, valor)
  return archivo ? pedido.attach('archivo', archivo, nombre) : pedido
}

const familiaDelAlumno = () => {
  const token = iniciarSesionComo('Padre')
  prismaFalso.alumno.findFirst.mockResolvedValue({ id_alumno: 7 })
  return token
}

describe('quién puede subir un comprobante', () => {
  it('sin sesión devuelve 401', async () => {
    expect((await subir(null)).status).toBe(401)
  })

  it('un Docente y una familia ajena reciben 403, sin tocar el disco', async () => {
    expect((await subir(iniciarSesionComo('Docente'))).status).toBe(403)
    const ajena = iniciarSesionComo('Padre')
    prismaFalso.alumno.findFirst.mockResolvedValue(null)
    expect((await subir(ajena)).status).toBe(403)
    expect(escribir).not.toHaveBeenCalled()
  })

  it('una factura que no existe devuelve 404', async () => {
    const token = iniciarSesionComo('Admin')
    prismaFalso.factura.findUnique.mockResolvedValue(null)
    expect((await subir(token)).status).toBe(404)
  })

  it('una factura ya pagada devuelve 409', async () => {
    const token = familiaDelAlumno()
    prismaFalso.factura.findUnique.mockResolvedValue({ id_alumno: 7, saldo: new Prisma.Decimal(0) })
    const res = await subir(token)
    expect(res.status).toBe(409)
    expect(escribir).not.toHaveBeenCalled()
  })
})

describe('validaciones: nada se guarda si algo está mal', () => {
  it.each([
    ['falta el importe', { campos: { importe: '' } }, 'importe'],
    ['el importe es cero', { campos: { importe: '0' } }, 'importe'],
    ['el importe es negativo', { campos: { importe: '-500' } }, 'importe'],
    ['el importe no es un número', { campos: { importe: 'mucho' } }, 'importe'],
    ['falta la fecha', { campos: { fecha_transferencia: '' } }, 'fecha'],
    ['la fecha es futura', { campos: { fecha_transferencia: '2999-01-01' } }, 'posterior a hoy'],
    ['la fecha no es válida', { campos: { fecha_transferencia: '2026-99-99' } }, 'echa'],
    ['el id de la orden no es válido', { campos: { id_orden: 'x' } }, 'Id inválido'],
  ] as [string, Envio, string][])('devuelve 400 si %s', async (_caso, envio, mensaje) => {
    const res = await subir(familiaDelAlumno(), envio)
    expect(res.status).toBe(400)
    expect(res.body.error).toContain(mensaje)
    expect(escribir).not.toHaveBeenCalled()
    expect(prismaFalso.comprobanteTransferencia.create).not.toHaveBeenCalled()
  })

  it('devuelve 400 si no se adjunta ningún archivo', async () => {
    const res = await subir(familiaDelAlumno(), { archivo: null })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Adjuntá')
  })

  it('devuelve 400 si la orden de pago no es de esa factura', async () => {
    prismaFalso.ordenPago.findFirst.mockResolvedValue(null)
    const res = await subir(familiaDelAlumno(), { campos: { id_orden: '99' } })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('no es de esta factura')
    expect(escribir).not.toHaveBeenCalled()
  })

  it.each([
    ['un ejecutable con nombre de foto', Buffer.concat([Buffer.from('MZ'), relleno]), 'foto.jpg'],
    ['una página HTML', Buffer.from('<html><script>alert(1)</script></html>'), 'comprobante.pdf'],
    ['un SVG', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'logo.png'],
  ])('rechaza %s aunque la extensión diga otra cosa', async (_caso, archivo, nombre) => {
    const res = await subir(familiaDelAlumno(), { archivo, nombre })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('no es válido')
    expect(escribir).not.toHaveBeenCalled()
    expect(prismaFalso.comprobanteTransferencia.create).not.toHaveBeenCalled()
  })

  it('rechaza un archivo de más de 10 MB con un mensaje que dice qué hacer', async () => {
    const pesado = Buffer.concat([JPG, Buffer.alloc(10 * 1024 * 1024)])
    const res = await subir(familiaDelAlumno(), { archivo: pesado })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('más de 10 MB')
    expect(escribir).not.toHaveBeenCalled()
  })
})

describe('la subida correcta', () => {
  it.each([
    ['JPG', JPG, 'jpg'],
    ['PNG', PNG, 'png'],
    ['PDF', PDF, 'pdf'],
    ['WebP', WEBP, 'webp'],
    ['AVIF', AVIF, 'avif'],
    ['HEIC', HEIC, 'heic'],
  ])('acepta un %s', async (_formato, archivo, ext) => {
    const res = await subir(familiaDelAlumno(), { archivo, nombre: 'comprobante' })
    expect(res.status).toBe(201)
    expect(escribir).toHaveBeenCalledTimes(1)
    const ruta = String(escribir.mock.calls[0][0])
    expect(ruta).toContain('comprobantes')
    expect(ruta.endsWith(`.${ext}`)).toBe(true)
  })

  it('la extensión sale del contenido, no del nombre que mandó el cliente', async () => {
    await subir(familiaDelAlumno(), { archivo: PDF, nombre: 'cosa.exe' })
    expect(String(escribir.mock.calls[0][0])).toMatch(/\.pdf$/)
  })

  it('queda "En revisión", con el importe, la fecha y quién lo cargó', async () => {
    const res = await subir(familiaDelAlumno())
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ id_comprobante: 9, estado: 'En revisión', importe: 1000, id_orden: null })

    const { data } = prismaFalso.comprobanteTransferencia.create.mock.calls[0][0]
    expect(data.id_factura).toBe(3)
    expect(data.id_orden).toBeNull()
    expect(data.importe.toNumber()).toBe(1000)
    expect(data.fecha_transferencia.toISOString().slice(0, 10)).toBe('2026-10-02')
    expect(data.id_usuario_carga).toBe(ID_USUARIO)
    expect(data.archivo).toMatch(/^[\w-]+\.jpg$/)
  })

  it('la respuesta no muestra el nombre del archivo en disco', async () => {
    const res = await subir(familiaDelAlumno())
    expect(res.body).not.toHaveProperty('archivo')
  })

  it('acepta el importe con coma y lo redondea a centavos', async () => {
    await subir(familiaDelAlumno(), { campos: { importe: '12500,555' } })
    const { data } = prismaFalso.comprobanteTransferencia.create.mock.calls[0][0]
    expect(data.importe.toNumber()).toBe(12500.56)
  })

  it('asocia la orden de pago si es de la factura', async () => {
    await subir(familiaDelAlumno(), { campos: { id_orden: '5' } })
    expect(prismaFalso.ordenPago.findFirst.mock.calls[0][0].where).toEqual({ id_orden: 5, id_factura: 3 })
    expect(prismaFalso.comprobanteTransferencia.create.mock.calls[0][0].data.id_orden).toBe(5)
  })

  it('una factura puede tener varios comprobantes: cada subida es independiente', async () => {
    const token = familiaDelAlumno()
    await subir(token)
    await subir(token)
    expect(prismaFalso.comprobanteTransferencia.create).toHaveBeenCalledTimes(2)
    expect(escribir).toHaveBeenCalledTimes(2)
  })

  it.each(['Admin', 'Directivo'])('%s también puede subirlo', async (rol) => {
    expect((await subir(iniciarSesionComo(rol))).status).toBe(201)
  })

  it('si falla el alta en la base, borra el archivo que había guardado', async () => {
    prismaFalso.comprobanteTransferencia.create.mockRejectedValue(new Error('base caída'))
    const res = await subir(familiaDelAlumno())
    expect(res.status).toBe(500)
    expect(borrar).toHaveBeenCalledTimes(1)
    expect(String(borrar.mock.calls[0][0])).toBe(String(escribir.mock.calls[0][0]))
  })
})
