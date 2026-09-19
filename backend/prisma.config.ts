import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // `prisma generate` no necesita la base (corre en el build de Docker, sin
    // DATABASE_URL); `migrate` sí, y falla con un error claro si falta.
    url: process.env.DATABASE_URL ?? '',
  },
})
