/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Solo si el backend está en otro dominio, ej. https://api.midominio.com */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
