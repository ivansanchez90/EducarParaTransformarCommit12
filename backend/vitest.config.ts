import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // `lib/config.ts` exige estas variables; las pruebas unitarias no usan la base.
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      JWT_SECRET: 'test',
      SMTP_USER: '',
      SMTP_PASS: '',
    },
  },
})
