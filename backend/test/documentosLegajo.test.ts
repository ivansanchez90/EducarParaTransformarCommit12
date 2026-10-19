import fs from 'node:fs'
import request from 'supertest'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { iniciarSesionComo, prismaFalso } from './ayudas.js'

vi.mock('../src/lib/prisma.js', async () => ({ prisma: (await import('./ayudas.js')).prismaFalso }))

const { app } = await import('../src/app.js')

type Fn = ReturnType<typeof vi.fn>
const documentos = () => (prismaFalso as unknown as { documentoAlumno: { findMany: Fn; findUnique: Fn; create: Fn; delete: Fn } }).documentoAlumno

// Archivos de prueba en la misma carpeta `uploads/` que usa la app (Vitest corre en `backend/`).
const CARPETA = 'uploads/documentos-alumnos'
const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(64, 0x20)])
const VIEJO_HTML = 'prueba-legajo-viejo.html'
const PDF_GUARDADO = 'prueba-legajo.pdf'

const archivosDeLaCarpeta = () => new Set(fs.readdirSync(CARPETA))
let antes: Set<string>

beforeAll(() => {
  fs.mkdirSync(CARPETA, { recursive: true })
  fs.writeFileSync(`${CARPETA}/${PDF_GUARDADO}`, PDF)
  // Un archivo subido antes del control de tipo: no tiene que abrirse en el navegador.
  fs.writeFileSync(`${CARPETA}/${VIEJO_HTML}`, '<script>alert(1)</script>')
})

afterAll(() => {
  fs.rmSync(`${CARPETA}/${PDF_GUARDADO}`, { force: true })
  fs.rmSync(`${CARPETA}/${VIEJO_HTML}`, { force: true })
})

beforeEach(() => {
  vi.clearAllMocks()
  ;(prismaFalso as unknown as { documentoAlumno: unknown }).documentoAlumno = {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue({ url_archivo: PDF_GUARDADO }),
    create: vi.fn(),
    delete: vi.fn(),
  }
  antes = archivosDeLaCarpeta()
})

// Lo que suba una prueba y no sea de los archivos fijos se borra.
afterEach(() => {
  for (const nombre of archivosDeLaCarpeta()) {
    if (!antes.has(nombre)) fs.rmSync(`${CARPETA}/${nombre}`, { force: true })
  }
})

describe('la carpeta de documentos del legajo es privada', () => {
  it('no se abre por /uploads, aunque se conozca el nombre del archivo', async () => {
    const res = await request(app).get(`/uploads/documentos-alumnos/${PDF_GUARDADO}`)
    expect(res.status).toBe(404)
  })
})

describe('GET /api/alumnos/:id/documentos', () => {
  it('no expone el nombre del archivo en disco; los enlaces a otros sitios sí se devuelven', async () => {
    documentos().findMany.mockResolvedValue([
      { id_documento: 1, id_alumno: 7, nombre: 'DNI', tipo: 'DNI', url_archivo: PDF_GUARDADO, fecha_carga: new Date() },
      { id_documento: 2, id_alumno: 7, nombre: 'Viejo', tipo: null, url_archivo: 'https://xyz.supabase.co/storage/v1/doc.pdf', fecha_carga: new Date() },
    ])
    const res = await request(app).get('/api/alumnos/7/documentos').set('Authorization', iniciarSesionComo('Admin'))
    expect(res.status).toBe(200)
    expect(res.body[0]).not.toHaveProperty('url_archivo')
    expect(res.body[0].enlace_externo).toBeNull()
    expect(res.body[1].enlace_externo).toBe('https://xyz.supabase.co/storage/v1/doc.pdf')
  })
})

describe('GET /api/alumnos/documentos/:id/archivo', () => {
  const bajar = (token?: string) => {
    const pedido = request(app).get('/api/alumnos/documentos/1/archivo')
    return token ? pedido.set('Authorization', token) : pedido
  }

  it('sin sesión da 401', async () => {
    expect((await bajar()).status).toBe(401)
  })

  it.each(['Padre', 'Alumno'])('%s no puede bajar documentos del legajo (403)', async (rol) => {
    expect((await bajar(iniciarSesionComo(rol))).status).toBe(403)
  })

  it.each(['Admin', 'Directivo', 'Docente'])('%s lo baja como PDF, sin caché', async (rol) => {
    const res = await bajar(iniciarSesionComo(rol))
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('application/pdf')
    expect(res.headers['cache-control']).toBe('private, no-store')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['content-disposition']).toBeUndefined()
  })

  it('un archivo viejo de otro tipo (un HTML) se baja como archivo, nunca como página', async () => {
    documentos().findUnique.mockResolvedValue({ url_archivo: VIEJO_HTML })
    const res = await bajar(iniciarSesionComo('Admin'))
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('application/octet-stream')
    expect(res.headers['content-disposition']).toContain('attachment')
  })

  it.each([
    ['una ruta que sale de la carpeta', '../../package.json'],
    ['un archivo que ya no está', 'no-existe.pdf'],
    ['un enlace a otro sitio', 'https://xyz.supabase.co/storage/v1/doc.pdf'],
  ])('%s da 404', async (_caso, url_archivo) => {
    documentos().findUnique.mockResolvedValue({ url_archivo })
    expect((await bajar(iniciarSesionComo('Admin'))).status).toBe(404)
  })

  it('un documento que no existe da 404', async () => {
    documentos().findUnique.mockResolvedValue(null)
    expect((await bajar(iniciarSesionComo('Admin'))).status).toBe(404)
  })
})

describe('POST /api/alumnos/:id/documentos', () => {
  const subir = (archivo: Buffer, nombre: string, token = iniciarSesionComo('Admin')) =>
    request(app).post('/api/alumnos/7/documentos').set('Authorization', token).field('tipo', 'DNI').attach('archivo', archivo, nombre)

  it('guarda una foto o un PDF en la carpeta privada, con la extensión que sale del contenido', async () => {
    documentos().create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id_documento: 9, fecha_carga: new Date(), ...data }))
    const res = await subir(PDF, 'dni-escaneado.png')
    expect(res.status).toBe(201)
    expect(res.body).not.toHaveProperty('url_archivo')
    const { data } = documentos().create.mock.calls[0][0]
    expect(data).toMatchObject({ id_alumno: 7, nombre: 'dni-escaneado.png', tipo: 'DNI' })
    expect(data.url_archivo).toMatch(/^\d+-[0-9a-f]{16}\.pdf$/)
    expect(fs.existsSync(`${CARPETA}/${data.url_archivo}`)).toBe(true)
  })

  it('rechaza un archivo que no es foto ni PDF (400) y no escribe nada', async () => {
    const res = await subir(Buffer.from('<html><script>alert(1)</script></html>'), 'dni.pdf')
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('tiene que ser una foto')
    expect(documentos().create).not.toHaveBeenCalled()
    expect(archivosDeLaCarpeta()).toEqual(antes)
  })

  it('si falla el alta en la base, borra el archivo guardado', async () => {
    documentos().create.mockRejectedValue(new Error('la base no responde'))
    const res = await subir(PDF, 'dni.pdf')
    expect(res.status).toBe(500)
    expect(archivosDeLaCarpeta()).toEqual(antes)
  })

  it('una familia no puede subir documentos al legajo (403)', async () => {
    expect((await subir(PDF, 'dni.pdf', iniciarSesionComo('Padre'))).status).toBe(403)
  })
})

describe('DELETE /api/alumnos/documentos/:id', () => {
  it('borra el registro y su archivo de la carpeta privada', async () => {
    const nombre = 'prueba-legajo-borrar.pdf'
    fs.writeFileSync(`${CARPETA}/${nombre}`, PDF)
    documentos().delete.mockResolvedValue({ url_archivo: nombre })
    const res = await request(app).delete('/api/alumnos/documentos/3').set('Authorization', iniciarSesionComo('Admin'))
    expect(res.status).toBe(204)
    expect(fs.existsSync(`${CARPETA}/${nombre}`)).toBe(false)
  })

  it('un documento que es un enlace a otro sitio solo se borra de la base', async () => {
    documentos().delete.mockResolvedValue({ url_archivo: 'https://xyz.supabase.co/storage/v1/doc.pdf' })
    const res = await request(app).delete('/api/alumnos/documentos/3').set('Authorization', iniciarSesionComo('Admin'))
    expect(res.status).toBe(204)
    expect(archivosDeLaCarpeta()).toEqual(antes)
  })
})
