import { defineConfig } from 'cypress'

// Las pruebas apuntan a un entorno LOCAL con `npm run seed:demo` cargado (el seed borra la base).
// Nunca contra producción: los tests inscriben y dan de baja alumnos.
export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL ?? 'http://localhost:5173',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    viewportWidth: 1280,
    viewportHeight: 800,
    video: false,
    screenshotOnRunFailure: true,
    retries: { runMode: 1, openMode: 0 },
    expose: {
      apiUrl: process.env.CYPRESS_API_URL ?? 'http://localhost:4000/api',
      // Admin del seed local (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, ya documentado en el README): no es un secreto.
      // En Cypress 16 la configuración pública va en `expose` (reemplaza a `env`); para secretos reales se usa `cy.env()`.
      adminEmail: process.env.CYPRESS_ADMIN_EMAIL ?? 'admin@educar.local',
      adminPassword: process.env.CYPRESS_ADMIN_PASSWORD ?? 'admin1234',
    },
  },
})
