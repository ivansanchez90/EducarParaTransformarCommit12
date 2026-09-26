/**
 * Indica si la pantalla está por debajo del breakpoint `md` de Tailwind
 * (768 px), el corte que usa la app para pasar a la interfaz de celular.
 *
 * Sirve para los casos en que no alcanza con ocultar por CSS (`md:hidden`),
 * por ejemplo cuando renderizar las dos versiones duplicaría inputs o ids.
 */
import { useSyncExternalStore } from 'react'

const CONSULTA_MOVIL = '(max-width: 767.98px)'

function suscribir(avisar: () => void) {
  const consulta = window.matchMedia(CONSULTA_MOVIL)
  consulta.addEventListener('change', avisar)
  return () => consulta.removeEventListener('change', avisar)
}

function esMovilAhora() {
  return window.matchMedia(CONSULTA_MOVIL).matches
}

export function useEsMovil() {
  return useSyncExternalStore(suscribir, esMovilAhora)
}
