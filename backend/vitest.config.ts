import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // En CI además del log se escribe un JUnit (`test-results/junit.xml`) que se conserva como artefacto.
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    outputFile: { junit: 'test-results/junit.xml' },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/generated/**'],
      // `text-summary` para el log del CI, `lcov` para SonarCloud y `html` para bajar el detalle como artefacto.
      reporter: ['text-summary', 'lcov', 'html'],
    },
    // `lib/config.ts` exige estas variables; las pruebas unitarias no usan la base.
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      JWT_SECRET: 'test',
      SMTP_USER: '',
      SMTP_PASS: '',
    },
  },
})
