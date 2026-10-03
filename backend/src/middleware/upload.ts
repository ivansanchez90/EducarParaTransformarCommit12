/**
 * Subida de archivos al disco local (reemplaza a Supabase Storage).
 *
 * Cada "bucket" es una carpeta dentro de `uploads/`. Los públicos se sirven
 * estáticamente en `/uploads` y se guarda en la base la URL completa, igual que
 * antes. Los privados (los comprobantes de transferencia) viven en la misma
 * carpeta, para que los alcance el volumen persistente, pero no se sirven: se
 * guarda solo el nombre del archivo y se descargan con sesión (ver
 * `routes/portalFinanzas.ts`).
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import type { Request, Response } from 'express'
import multer from 'multer'
import { config } from '../lib/config.js'
import { HttpError } from '../lib/http.js'
import { tipoDeArchivo } from '../lib/tipoArchivo.js'

export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads')

export type BucketPublico = 'galeria' | 'noticias' | 'documentos-alumnos'
export type BucketPrivado = 'comprobantes'
export type Bucket = BucketPublico | BucketPrivado

const BUCKETS_PUBLICOS: BucketPublico[] = ['galeria', 'noticias', 'documentos-alumnos']

/**
 * Sirve en `/uploads` solo los buckets públicos. Es una lista de permitidos y no
 * de bloqueados: una carpeta nueva queda privada hasta que se la agregue acá.
 */
export const uploadsPublicos = express.Router()
for (const bucket of BUCKETS_PUBLICOS) {
  uploadsPublicos.use(`/${bucket}`, express.static(path.join(UPLOADS_DIR, bucket)))
}

const MB = 1024 * 1024

export function uploader(bucket: Bucket, opciones: { soloImagenes?: boolean } = {}) {
  const destino = path.join(UPLOADS_DIR, bucket)
  fs.mkdirSync(destino, { recursive: true })

  return multer({
    storage: multer.diskStorage({
      destination: destino,
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase()
        cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`)
      },
    }),
    limits: { fileSize: 10 * MB },
    fileFilter: (_req, file, cb) => {
      if (opciones.soloImagenes && !file.mimetype.startsWith('image/')) {
        cb(new Error('Solo se permiten archivos de imagen'))
        return
      }
      cb(null, true)
    },
  })
}

export function urlPublica(bucket: BucketPublico, filename: string): string {
  return `${config.publicUrl}/uploads/${bucket}/${filename}`
}

/** Borra el archivo si la URL apunta a nuestro almacenamiento local. */
export async function borrarArchivo(url: string | null | undefined) {
  if (!url) return
  const prefijo = `${config.publicUrl}/uploads/`
  if (!url.startsWith(prefijo)) return
  const relativo = url.slice(prefijo.length)
  const absoluto = path.resolve(UPLOADS_DIR, relativo)
  // Evita borrar algo fuera de uploads/ con rutas tipo "../"
  if (!absoluto.startsWith(UPLOADS_DIR + path.sep)) return
  await fs.promises.unlink(absoluto).catch(() => undefined)
}

/**
 * Ruta en disco de un archivo de un bucket privado, o `null` si el nombre guardado
 * apunta fuera de la carpeta del bucket (por ejemplo con "../").
 */
export function rutaArchivoPrivado(bucket: BucketPrivado, nombre: string): string | null {
  const carpeta = path.join(UPLOADS_DIR, bucket)
  const absoluto = path.resolve(carpeta, nombre)
  return absoluto.startsWith(carpeta + path.sep) ? absoluto : null
}

// ── Comprobantes de transferencia (bucket privado) ──────────────

export const LIMITE_COMPROBANTE_MB = 10
const TIPOS_DE_FOTO = 'JPG, PNG, WebP, AVIF o HEIC'

const recibirEnMemoria = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITE_COMPROBANTE_MB * MB, files: 1 },
}).single('archivo')

/**
 * Lee el archivo del formulario (campo `archivo`) a memoria, sin escribir nada en
 * disco: así un archivo inválido no deja basura. Si pesa de más, responde 400 con un
 * mensaje que dice qué hacer.
 */
export function recibirArchivoComprobante(req: Request, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    recibirEnMemoria(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        reject(new HttpError(400, `El archivo pesa más de ${LIMITE_COMPROBANTE_MB} MB: sacale una foto más liviana o comprimilo`))
      } else if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

/**
 * Guarda el comprobante en la carpeta privada y devuelve el nombre del archivo. El tipo
 * se decide por el contenido y la extensión sale de ahí, no del nombre que mandó el cliente.
 */
export async function guardarComprobante(archivo: Express.Multer.File | undefined): Promise<string> {
  if (!archivo) throw new HttpError(400, 'Adjuntá el comprobante de la transferencia (foto o PDF)')
  const tipo = tipoDeArchivo(archivo.buffer)
  if (!tipo) throw new HttpError(400, `El archivo no es válido: tiene que ser una foto (${TIPOS_DE_FOTO}) o un PDF`)

  const carpeta = path.join(UPLOADS_DIR, 'comprobantes')
  await fs.promises.mkdir(carpeta, { recursive: true })
  const nombre = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${tipo.ext}`
  await fs.promises.writeFile(path.join(carpeta, nombre), archivo.buffer, { flag: 'wx' })
  return nombre
}

/** Borra un comprobante de la carpeta privada (si falló el alta en la base). */
export async function borrarComprobante(nombre: string) {
  const ruta = rutaArchivoPrivado('comprobantes', nombre)
  if (ruta) await fs.promises.unlink(ruta).catch(() => undefined)
}
