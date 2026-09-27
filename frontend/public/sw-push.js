// Manejo del aviso push dentro del service worker (PWA).
// Se inyecta en el sw.js generado por Workbox vía `workbox.importScripts`
// (ver vite.config.ts), porque el modo `generateSW` no admite código propio.
//
// El backend manda el JSON de `PayloadPush` (backend/src/services/push.ts):
// { titulo, mensaje, tipo, url }.

self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload
  try {
    payload = event.data.json()
  } catch {
    return
  }
  event.waitUntil(
    self.registration.showNotification(payload.titulo, {
      body: payload.mensaje,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      // Sin `tag`: un aviso con el mismo tag reemplaza al anterior sin avisar,
      // y un padre con dos hijos ausentes el mismo día vería solo el último.
      data: { url: payload.url },
    }),
  )
})

// Al tocar el aviso: si ya hay una pestaña de la app abierta, la navega a la
// pantalla del aviso y la enfoca; si no, abre una nueva. Se navega siempre
// (no solo se enfoca) porque la URL trae `?seccion=` para abrir la sección
// correcta (ver StudentPortal.tsx), no solo la ruta.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (lista) => {
      const cliente = lista[0]
      if (cliente) {
        if ('navigate' in cliente) await cliente.navigate(url)
        return cliente.focus()
      }
      return self.clients.openWindow(url)
    }),
  )
})
