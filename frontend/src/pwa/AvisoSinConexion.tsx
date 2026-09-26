/**
 * Aviso "Sin conexión" (PWA, fase 3).
 *
 * `/api/*` nunca se cachea (ver PLAN-PWA.md), así que sin señal la app abre
 * con la última pantalla que el service worker tiene precacheada pero no
 * puede traer ni guardar datos. Este aviso avisa del estado y evita que el
 * usuario piense que la app se colgó; los formularios usan `useEnLinea()`
 * para deshabilitar su botón de guardado mientras tanto.
 *
 * Tarjeta flotante (mismo patrón que `ActualizarApp`) en vez de una barra a
 * todo el ancho, para no taparle los botones a las cabeceras `sticky` de
 * `AdminPanel`/`StudentPortal`. Se ubica más arriba que `ActualizarApp` para
 * que los dos avisos puedan mostrarse a la vez sin superponerse.
 */
import { useEffect, useRef, useState } from 'react'
import { useEnLinea } from '../ui/useEnLinea'

const RECONECTADO_MS = 3000

export function AvisoSinConexion() {
  const enLinea = useEnLinea()
  const [mostrarReconectado, setMostrarReconectado] = useState(false)
  const yaEstuvoOffline = useRef(false)

  useEffect(() => {
    if (!enLinea) {
      yaEstuvoOffline.current = true
      return
    }
    if (!yaEstuvoOffline.current) return
    setMostrarReconectado(true)
    const id = setTimeout(() => {
      setMostrarReconectado(false)
      yaEstuvoOffline.current = false
    }, RECONECTADO_MS)
    return () => {
      clearTimeout(id)
    }
  }, [enLinea])

  if (enLinea && !mostrarReconectado) return null

  return (
    <div
      role='status'
      className={`fixed inset-x-4 bottom-[calc(150px+env(safe-area-inset-bottom))] md:bottom-[calc(86px+env(safe-area-inset-bottom))] z-[1000] mx-auto max-w-[420px] rounded-btn shadow-[0_8px_32px_rgba(91,53,197,0.18)] p-4 flex items-center gap-3 font-[Nunito,_'Segoe_UI',_sans-serif] text-[13px] font-bold text-white ${
        enLinea ? 'bg-green' : 'bg-red'
      }`}
    >
      <span className='flex-1'>
        {enLinea
          ? '✅ Conexión restablecida'
          : '📡 Sin conexión — algunas pantallas no se pueden actualizar'}
      </span>
    </div>
  )
}
