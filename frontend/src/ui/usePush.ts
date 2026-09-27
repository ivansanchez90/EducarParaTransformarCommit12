/**
 * Estado del botón "Activar avisos" del portal (ver `pwa/push.ts`). Mismo
 * patrón que `useEnLinea`/`useEsMovil`: un hook chico, sin estado global.
 */
import { useEffect, useState } from 'react'
import { activarPush, desactivarPush, estadoPush } from '../pwa/push'
import type { EstadoPush } from '../pwa/push'

export function usePush() {
  const [estado, setEstado] = useState<EstadoPush>('no-soportado')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let vigente = true
    void estadoPush().then((e) => {
      if (vigente) setEstado(e)
    })
    return () => {
      vigente = false
    }
  }, [])

  async function activar() {
    setCargando(true)
    setError('')
    const errorActivar = await activarPush()
    if (errorActivar) {
      setError(errorActivar)
      setEstado(await estadoPush())
    } else {
      setEstado('activo')
    }
    setCargando(false)
  }

  async function desactivar() {
    setCargando(true)
    await desactivarPush()
    setEstado('inactivo')
    setCargando(false)
  }

  return { estado, cargando, error, activar, desactivar }
}
