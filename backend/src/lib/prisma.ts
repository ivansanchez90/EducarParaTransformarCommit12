import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.js'
import { config } from './config.js'

export const prisma = new PrismaClient({
  // La sesión en UTC: el adaptador envía las fechas sin zona horaria y, si no,
  // Postgres las interpretaría en la zona del servidor (corridas 3 horas).
  adapter: new PrismaPg({ connectionString: config.databaseUrl, options: '-c timezone=UTC' }),
  // El hash de la contraseña nunca sale en las respuestas; solo el login lo pide.
  omit: { usuario: { password_hash: true } },
})
