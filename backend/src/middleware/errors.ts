import type { NextFunction, Request, Response } from 'express'
import multer from 'multer'
import { Prisma } from '../generated/prisma/client.js'
import { HttpError } from '../lib/http.js'

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Ruta no encontrada' })
}

/**
 * Traduce los errores a `{ error, code }`. Los códigos de Postgres que el
 * frontend ya interpretaba (ej. 23505 = duplicado) se mantienen.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, code: err.code })
    return
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Ya existe un registro con esos datos (duplicate key)', code: '23505' })
      return
    }
    if (err.code === 'P2003') {
      res.status(409).json({ error: 'El registro está referenciado o la referencia no existe', code: '23503' })
      return
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Registro no encontrado', code: 'P2025' })
      return
    }
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({ error: 'Datos inválidos' })
    return
  }
  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: `Error al subir el archivo: ${err.message}` })
    return
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'JSON inválido' })
    return
  }
  console.error(err)
  const message = err instanceof Error ? err.message : 'Error interno del servidor'
  res.status(500).json({ error: message })
}
