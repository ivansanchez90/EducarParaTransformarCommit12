/**
 * Ayudas para las pruebas de la API con Supertest. No hay base de datos: el
 * cliente de Prisma se reemplaza por dobles (`vi.mock` en cada archivo de prueba)
 * y los tokens se firman con el mismo secreto que usa `vitest.config.ts`.
 */
import jwt from 'jsonwebtoken'
import { vi } from 'vitest'

export const prismaFalso = {
  usuario: { findUnique: vi.fn() },
  alumno: { findFirst: vi.fn(), findUnique: vi.fn() },
}

// Mismo valor que `JWT_SECRET` en `vitest.config.ts`.
const JWT_SECRET_PRUEBAS = 'test'

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

/** Hace que el token válido de `tokenDe()` pertenezca a un usuario con ese rol. */
export function iniciarSesionComo(rol: string, activo = true): string {
  prismaFalso.usuario.findUnique.mockResolvedValue(usuarioConRol(rol, activo))
  return `Bearer ${jwt.sign({ sub: ID_USUARIO }, JWT_SECRET_PRUEBAS)}`
}
