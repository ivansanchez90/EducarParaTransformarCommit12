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

/**
 * Email con el que entra un alumno que no tiene correo propio. Es solo el
 * usuario para iniciar sesión: no es una casilla real.
 */
export function emailInstitucionalAlumno(dni: string): string {
  return `${dni}@alumno.local`
}

/** Normaliza un email opcional del body: `null` si viene vacío, 400 si es inválido. */
export function emailOpcional(valor: unknown): string | null {
  const email = String(valor ?? '').trim().toLowerCase()
  if (!email) return null
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, `El email ${email} no es válido`)
  }
  return email
}

/** Separa "Juan Manuel Cantero" en nombre y apellido para el alta del tutor. */
export function partirNombre(completo: string): { nombre: string; apellido: string } {
  const partes = completo.trim().split(/\s+/)
  return { nombre: partes[0] ?? '', apellido: partes.slice(1).join(' ') }
}

/** Un dato del tutor que no coincide entre su usuario y una nueva solicitud. */
export interface DiferenciaTutor {
  campo: 'Nombre' | 'Teléfono' | 'Rol'
  registrado: string
  solicitud: string
}

/** Sin espacios de más ni diferencias de mayúsculas: "juan  PÉREZ" = "Juan Pérez". */
const normalizar = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')
const soloDigitos = (s: string) => s.replace(/\D/g, '')

/**
 * Compara el usuario del tutor que ya existía con los datos de una nueva
 * solicitud (por ejemplo, la de un segundo hijo). Al aprobar no se pisa nada:
 * esto solo arma el aviso para que la administración decida.
 *
 * - Nombre: se compara el nombre completo, porque la solicitud lo trae en un
 *   solo campo y `partirNombre` no sabe dónde termina un nombre compuesto.
 * - Teléfono: solo si el usuario tiene uno cargado (el alta desde la solicitud
 *   no lo guarda); se comparan los dígitos.
 * - Rol: si la cuenta no es de padre/tutor, el portal no le muestra los hijos.
 */
export function diferenciasTutor(
  usuario: { nombre: string; apellido: string; telefono: string | null; rol: string },
  solicitud: { nombre_tutor: string; telefono_tutor: string | null },
): DiferenciaTutor[] {
  const diferencias: DiferenciaTutor[] = []

  const registrado = `${usuario.nombre} ${usuario.apellido}`.trim().replace(/\s+/g, ' ')
  if (normalizar(registrado) !== normalizar(solicitud.nombre_tutor)) {
    diferencias.push({ campo: 'Nombre', registrado, solicitud: solicitud.nombre_tutor.trim() })
  }

  const telefono = solicitud.telefono_tutor?.trim()
  if (usuario.telefono && telefono && soloDigitos(usuario.telefono) !== soloDigitos(telefono)) {
    diferencias.push({ campo: 'Teléfono', registrado: usuario.telefono, solicitud: telefono })
  }

  if (!/padre|tutor/i.test(usuario.rol)) {
    diferencias.push({ campo: 'Rol', registrado: usuario.rol, solicitud: 'Padre' })
  }

  return diferencias
}
