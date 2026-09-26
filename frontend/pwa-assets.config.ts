import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config'

// Genera los íconos del manifest (frontend/vite.config.ts) a partir del logo
// vectorizado. Los nombres de archivo que produce ya coinciden con los que
// usa el manifest, así que no hace falta tocar vite.config.ts.
export default defineConfig({
  preset,
  images: ['public/logo-icono.svg'],
})
