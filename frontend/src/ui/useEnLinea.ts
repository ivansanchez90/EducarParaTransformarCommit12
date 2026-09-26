/**
 * Indica si el navegador tiene conexión (evento `online`/`offline` del
 * navegador). Sirve para mostrar el aviso "Sin conexión" y deshabilitar los
 * botones de guardado mientras no hay señal, ya que `/api/*` nunca se
 * cachea (ver PLAN-PWA.md, "Decisiones técnicas").
 */
import { useSyncExternalStore } from 'react'

function suscribir(avisar: () => void) {
  window.addEventListener('online', avisar)
  window.addEventListener('offline', avisar)
  return () => {
    window.removeEventListener('online', avisar)
    window.removeEventListener('offline', avisar)
  }
}

function enLineaAhora() {
  return navigator.onLine
}

export function useEnLinea() {
  return useSyncExternalStore(suscribir, enLineaAhora)
}
