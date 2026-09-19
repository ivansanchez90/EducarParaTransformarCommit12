/**
 * Autenticación con JWT y control de acceso por rol.
 *
 * Reemplaza a Supabase Auth: el login emite un token firmado que el frontend
 * manda en `Authorization: Bearer <token>`. En cada request se vuelve a leer el
 * usuario para respetar desactivaciones y cambios de rol sin esperar al vencimiento.
 */
import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../lib/config.js'
import { HttpError } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'

export const ROLES_ADMIN = ['Admin', 'Directivo']
export const ROLES_STAFF = ['Admin', 'Directivo', 'Docente']

export interface UsuarioAuth {
  id_usuario: string
  email: string
  nombre: string
  apellido: string
  rol: string
  activo: boolean
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UsuarioAuth
    }
  }
}

export function firmarToken(idUsuario: string): string {
  return jwt.sign({ sub: idUsuario }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  })
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) throw new HttpError(401, 'No autenticado')

  let sub: string
  try {
    sub = String((jwt.verify(token, config.jwtSecret) as jwt.JwtPayload).sub)
  } catch {
    throw new HttpError(401, 'Sesión inválida o vencida')
  }

  const usuario = await prisma.usuario.findUnique({ where: { id_usuario: sub } })
  if (!usuario) throw new HttpError(401, 'Usuario inexistente')
  if (!usuario.activo) {
    throw new HttpError(403, 'Tu usuario está desactivado. Contactá a la institución.', 'USUARIO_INACTIVO')
  }
  req.user = {
    id_usuario: usuario.id_usuario,
    email: usuario.email,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    rol: usuario.rol,
    activo: usuario.activo,
  }
  next()
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new HttpError(401, 'No autenticado')
    if (!roles.includes(req.user.rol)) throw new HttpError(403, 'No tenés permisos para esta acción')
    next()
  }
}

export const esStaff = (u: UsuarioAuth) => ROLES_STAFF.includes(u.rol)
export const esTutor = (u: UsuarioAuth) => /padre|tutor/i.test(u.rol)

/**
 * Verifica que el usuario pueda ver los datos de un alumno: el personal puede
 * ver a todos; el alumno solo a sí mismo y el padre/tutor solo a sus hijos.
 */
export async function assertAccesoAlumno(u: UsuarioAuth, idAlumno: number) {
  if (esStaff(u)) return
  const alumno = await prisma.alumno.findFirst({
    where: {
      id_alumno: idAlumno,
      OR: [{ id_usuario: u.id_usuario }, { id_usuario_padre: u.id_usuario }],
    },
    select: { id_alumno: true },
  })
  if (!alumno) throw new HttpError(403, 'No tenés acceso a los datos de este alumno')
}

/** Devuelve el id_docente del usuario logueado (404 si no está registrado como docente). */
export async function idDocenteDe(u: UsuarioAuth): Promise<number> {
  const docente = await prisma.docente.findUnique({
    where: { id_usuario: u.id_usuario },
    select: { id_docente: true },
  })
  if (!docente) throw new HttpError(404, 'El usuario no está registrado como docente')
  return docente.id_docente
}
