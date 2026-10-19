/**
 * Subida de archivos al disco local (reemplaza a Supabase Storage).
 *
 * Cada "bucket" es una carpeta dentro de `uploads/`. Los públicos se sirven
 * estáticamente en `/uploads` y se guarda en la base la URL completa, igual que
 * antes. Los privados (los comprobantes de transferencia y la documentación del
 * legajo de cada alumno) viven en la misma carpeta, para que los alcance el
 * volumen persistente, pero no se sirven: se guarda solo el nombre del archivo y
 * se descargan con sesión (ver `routes/portalFinanzas.ts` y `routes/alumnos.ts`).
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

export type BucketPublico = 'galeria' | 'noticias'
export type BucketPrivado = 'comprobantes' | 'documentos-alumnos'
export type Bucket = BucketPublico | BucketPrivado

const BUCKETS_PUBLICOS: BucketPublico[] = ['galeria', 'noticias']

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

// ── Archivos privados: comprobantes y documentos del legajo ─────

export const LIMITE_COMPROBANTE_MB = 10
export const TIPOS_DE_FOTO = 'JPG, PNG, WebP, AVIF o HEIC'

const recibirEnMemoria = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITE_COMPROBANTE_MB * MB, files: 1 },
}).single('archivo')

/**
 * Lee el archivo del formulario (campo `archivo`) a memoria, sin escribir nada en
 * disco: así un archivo inválido no deja basura. Si pesa de más, responde 400 con un
 * mensaje que dice qué hacer.
 */
export function recibirArchivoPrivado(req: Request, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    recibirEnMemoria(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        reject(new HttpError(400, `El archivo pesa más de ${LIMITE_COMPROBANTE_MB} MB: sacale una foto más liviana o comprimilo`))
      } else if (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      } else {
        resolve()
      }
    })
  })
}

/** El comprobante de una transferencia (lo sube la familia desde el portal). */
export const recibirArchivoComprobante = recibirArchivoPrivado

/**
 * Guarda el archivo en la carpeta privada del bucket y devuelve su nombre. El tipo se
 * decide por el contenido (fotos o PDF) y la extensión sale de ahí, no del nombre que
 * mandó el cliente: así nunca se guarda un HTML o un script que el navegador pueda ejecutar.
 */
export async function guardarArchivoPrivado(
  bucket: BucketPrivado,
  archivo: Express.Multer.File | undefined,
  siFalta: string,
): Promise<string> {
  if (!archivo) throw new HttpError(400, siFalta)
  const tipo = tipoDeArchivo(archivo.buffer)
  if (!tipo) throw new HttpError(400, `El archivo no es válido: tiene que ser una foto (${TIPOS_DE_FOTO}) o un PDF`)

  const carpeta = path.join(UPLOADS_DIR, bucket)
  await fs.promises.mkdir(carpeta, { recursive: true })
  const nombre = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${tipo.ext}`
  // La carpeta es fija y el nombre se genera acá (fecha, bytes al azar y una extensión que sale del contenido).
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  await fs.promises.writeFile(path.join(carpeta, nombre), archivo.buffer, { flag: 'wx' })
  return nombre
}

/** Guarda el comprobante de una transferencia en su carpeta privada. */
export function guardarComprobante(archivo: Express.Multer.File | undefined): Promise<string> {
  return guardarArchivoPrivado('comprobantes', archivo, 'Adjuntá el comprobante de la transferencia (foto o PDF)')
}

/** Borra un archivo de la carpeta privada del bucket (si falló el alta en la base, o al borrar el registro). */
export async function borrarArchivoPrivado(bucket: BucketPrivado, nombre: string) {
  const ruta = rutaArchivoPrivado(bucket, nombre)
  if (!ruta) return
  try {
    // `rutaArchivoPrivado` ya comprobó que la ruta queda dentro de la carpeta del bucket.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    await fs.promises.unlink(ruta)
  } catch {
    // Si el archivo ya no estaba, no hay nada que borrar.
  }
}

/** Borra un comprobante de la carpeta privada (si falló el alta en la base). */
export function borrarComprobante(nombre: string) {
  return borrarArchivoPrivado('comprobantes', nombre)
}
