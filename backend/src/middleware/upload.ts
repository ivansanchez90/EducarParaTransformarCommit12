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
import multer from 'multer'
import { config } from '../lib/config.js'

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
