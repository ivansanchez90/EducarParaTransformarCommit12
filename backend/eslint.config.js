import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import security from 'eslint-plugin-security'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'src/generated', 'prisma/migrations']),
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    plugins: { security },
    languageOptions: { globals: globals.node },
    rules: {
      // Convención del repo: lo que se descarta a propósito empieza con `_` (p. ej. `const { _hash, ...resto } = usuario`).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
      // El BOM del CSV (﻿) va dentro de una plantilla a propósito.
      'no-irregular-whitespace': ['error', { skipTemplates: true }],
      // El código ya tiene `eslint-disable` de esta regla (la marca Codacy): se registra el plugin para que esos comentarios valgan.
      'security/detect-non-literal-fs-filename': 'warn',
    },
  },
])
