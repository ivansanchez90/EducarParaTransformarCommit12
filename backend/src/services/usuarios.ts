/**
 * Alta de usuarios, compartida por la gestión de usuarios y por la
 * aprobación de preinscripciones.
 */
import bcrypt from 'bcryptjs'
import type { Prisma } from '../generated/prisma/client.js'
import { HttpError } from '../lib/http.js'

export interface DatosUsuario {
  email: string
  password: string
  nombre: string
  apellido: string
  rol: string
}

export function validarUsuario(body: Record<string, unknown>): DatosUsuario {
  const datos = {
    email: String(body.email ?? '').trim().toLowerCase(),
    password: String(body.password ?? ''),
    nombre: String(body.nombre ?? '').trim(),
    apellido: String(body.apellido ?? '').trim(),
    rol: String(body.rol ?? '').trim(),
  }
  if (!datos.email || !datos.rol) throw new HttpError(400, 'Email y rol son obligatorios')
  if (datos.password.length < 6) throw new HttpError(400, 'La contraseña debe tener al menos 6 caracteres')
  return datos
}

/** Crea el usuario y, si es Docente, su fila en `docentes`. */
export async function crearUsuario(tx: Prisma.TransactionClient, datos: DatosUsuario) {
  const existe = await tx.usuario.findUnique({ where: { email: datos.email }, select: { id_usuario: true } })
  if (existe) throw new HttpError(409, `Ya existe un usuario con el email ${datos.email}`, '23505')

  const usuario = await tx.usuario.create({
    data: {
      email: datos.email,
      password_hash: await bcrypt.hash(datos.password, 10),
      nombre: datos.nombre,
      apellido: datos.apellido,
      rol: datos.rol,
    },
  })
  // Los docentes necesitan su fila en `docentes` para aparecer en el panel.
  if (datos.rol === 'Docente') {
    await tx.docente.create({ data: { id_usuario: usuario.id_usuario, dni: null } })
  }
  return usuario
}

/** Separa "Juan Manuel Cantero" en nombre y apellido para el alta del tutor. */
export function partirNombre(completo: string): { nombre: string; apellido: string } {
  const partes = completo.trim().split(/\s+/)
  return { nombre: partes[0] ?? '', apellido: partes.slice(1).join(' ') }
}
