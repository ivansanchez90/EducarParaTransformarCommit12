import 'dotenv/config'

function requerida(nombre: string): string {
  const valor = process.env[nombre]
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}`)
  return valor
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: requerida('DATABASE_URL'),
  jwtSecret: requerida('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  // Solo hace falta si el frontend se sirve desde otro dominio; por defecto
  // frontend y API comparten dominio y no se habilita CORS.
  corsOrigin: (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  // Prefijo de las URLs de archivos subidos. Vacío = rutas relativas
  // (/uploads/...), que funcionan porque todo comparte el mismo dominio.
  publicUrl: (process.env.PUBLIC_URL ?? '').replace(/\/$/, ''),
  // Build del frontend que sirve el backend (si la carpeta existe).
  frontendDir: process.env.FRONTEND_DIR ?? 'public',
  zonaHoraria: process.env.TZ_APP ?? 'America/Argentina/Buenos_Aires',
}
