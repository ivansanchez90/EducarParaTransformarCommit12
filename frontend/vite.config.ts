import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Las únicas carpetas de /uploads con contenido público (imágenes del sitio).
const UPLOADS_PUBLICOS = ['/uploads/noticias/', '/uploads/galeria/']

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // PWA: la app se puede instalar en el celular. El service worker solo se
    // genera en el build (`pnpm build && pnpm preview` para probarlo).
    VitePWA({
      // Con una versión nueva, se avisa y el usuario decide cuándo recargar
      // (ver ActualizarApp), así no pierde un formulario a medio cargar.
      registerType: 'prompt',
      includeAssets: ['apple-touch-icon-180x180.png'],
      manifest: {
        id: '/',
        name: 'Educar para Transformar',
        short_name: 'Educar',
        description: 'Campus virtual del centro educativo Educar para Transformar',
        lang: 'es',
        // /login redirige solo a /admin o /portal según el rol si ya hay sesión.
        start_url: '/login',
        scope: '/',
        display: 'standalone',
        theme_color: '#5B35C5',
        background_color: '#F5F4FB',
        // Íconos provisorios generados desde logo.png: se reemplazan en T2
        // conservando los mismos nombres de archivo.
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Portal de familias y alumnos', short_name: 'Portal', url: '/portal' },
          { name: 'Panel de gestión', short_name: 'Panel', url: '/admin' },
        ],
      },
      workbox: {
        // Se precachea la app; los íconos del manifest los agrega el plugin.
        // Las imágenes grandes del sitio público quedan afuera.
        globPatterns: ['**/*.{js,css,html}'],
        // Las rutas de React funcionan sin conexión; la API y los archivos nunca reciben el HTML.
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//],
        cleanupOutdatedCaches: true,
        // /api no aparece acá a propósito: los datos personales nunca se guardan
        // en caché, así un celular compartido no deja datos de otro usuario.
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && UPLOADS_PUBLICOS.some((p) => url.pathname.startsWith(p)),
            handler: 'CacheFirst',
            options: {
              cacheName: 'uploads-publicos',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    // En desarrollo, la API y los archivos subidos se piden al backend local,
    // igual que en producción donde todo se sirve desde el mismo dominio.
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
    },
  },
})
