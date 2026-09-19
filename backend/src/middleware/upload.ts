/**
 * Subida de archivos al disco local (reemplaza a Supabase Storage).
 *
 * Cada "bucket" es una carpeta dentro de `uploads/`, servida estáticamente en
 * `/uploads`. Se guarda en la base la URL pública completa, igual que antes.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import multer from 'multer'
import { config } from '../lib/config.js'

export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads')

export type Bucket = 'galeria' | 'noticias' | 'documentos-alumnos'

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

export function urlPublica(bucket: Bucket, filename: string): string {
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
