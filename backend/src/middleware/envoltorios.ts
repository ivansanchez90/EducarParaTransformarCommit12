/**
 * Envoltorios para registrar en un router de Express funciones `async` (como `requireAuth` o
 * los manejadores de cada ruta) sin que Express reciba una promesa donde espera `void`.
 * Si la función falla, el error llega al manejador de errores igual que antes.
 */
import type { NextFunction, Request, Response } from 'express'
import { requireAuth } from './auth.js'

/** `requireAuth` listo para usar en un router. */
export const conSesion = (req: Request, res: Response, next: NextFunction) => {
  requireAuth(req, res, next).catch(next)
}

type Manejador = (req: Request, res: Response, next: NextFunction) => Promise<void>

/** Un manejador `async` listo para usar en un router. */
export const asincrono = (manejador: Manejador) => (req: Request, res: Response, next: NextFunction) => {
  manejador(req, res, next).catch(next)
}
