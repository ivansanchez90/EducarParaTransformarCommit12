/**
 * Ayudas para las pruebas de la API con Supertest. No hay base de datos: el
 * cliente de Prisma se reemplaza por dobles (`vi.mock` en cada archivo de prueba)
 * y los tokens se firman con el mismo secreto que usa `vitest.config.ts`.
 */
import jwt from 'jsonwebtoken'
import { vi } from 'vitest'

export const prismaFalso = {
  usuario: { findUnique: vi.fn(), update: vi.fn() },
  alumno: { findFirst: vi.fn(), findUnique: vi.fn() },
  comprobanteTransferencia: { findUnique: vi.fn() },
  actividadExtracurricular: { findMany: vi.fn() },
  recorridoTransporte: { findMany: vi.fn() },
  inscripcionTransporte: { findUnique: vi.fn() },
  inscripcionComedor: { findUnique: vi.fn() },
  tarifa: { findMany: vi.fn() },
}

// `vitest.config.ts` define JWT_SECRET para las pruebas: se lee de ahí, no se repite el valor.
const secretoDePruebas = process.env.JWT_SECRET ?? ''
const secretoAjeno = `${secretoDePruebas}-ajeno`

export const ID_USUARIO = '11111111-1111-4111-8111-111111111111'

export function usuarioConRol(rol: string, activo = true) {
  return {
    id_usuario: ID_USUARIO,
    email: 'prueba@educar.test',
    nombre: 'Prueba',
    apellido: 'Test',
    rol,
    activo,
  }
}

/** Firma un token del usuario de prueba con el secreto de la app (o con otro, si es `ajeno`). */
export function firmarToken(opciones: jwt.SignOptions = {}, ajeno = false): string {
  return jwt.sign({ sub: ID_USUARIO }, ajeno ? secretoAjeno : secretoDePruebas, opciones)
}

/** Hace que el token válido de `tokenDe()` pertenezca a un usuario con ese rol. */
export function iniciarSesionComo(rol: string, activo = true): string {
  prismaFalso.usuario.findUnique.mockResolvedValue(usuarioConRol(rol, activo))
  return `Bearer ${firmarToken()}`
}
