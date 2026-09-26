/**
 * Registro del service worker y aviso de versión nueva (PWA).
 *
 * Después de un deploy, el service worker nuevo queda en espera hasta que el
 * usuario toca "Actualizar": así no se recarga la app en medio de un
 * formulario. La app instalada puede quedar abierta días, por eso además se
 * busca una versión nueva cada hora.
 */
import { useRegisterSW } from 'virtual:pwa-register/react'
import { btnPrimarySm } from '../ui/styles'

const UNA_HORA = 60 * 60 * 1000

export function ActualizarApp() {
  const {
    needRefresh: [hayVersionNueva, setHayVersionNueva],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registro) {
      if (!registro) return
      setInterval(() => {
        void registro.update()
      }, UNA_HORA)
    },
  })

  if (!hayVersionNueva) return null

  return (
    <div
      role='status'
      className="fixed inset-x-4 bottom-[calc(16px+env(safe-area-inset-bottom))] z-[1000] mx-auto max-w-[420px] bg-white border border-border rounded-btn shadow-[0_8px_32px_rgba(91,53,197,0.18)] p-4 flex items-center gap-3 font-[Nunito,_'Segoe_UI',_sans-serif]"
    >
      <span className='text-[13px] font-bold text-text flex-1'>Hay una versión nueva de la app.</span>
      <button
        className='bg-transparent border-0 text-xs font-bold text-textMuted cursor-pointer font-[inherit]'
        onClick={() => {
          setHayVersionNueva(false)
        }}
      >
        Después
      </button>
      <button
        className={btnPrimarySm}
        onClick={() => {
          void updateServiceWorker(true)
        }}
      >
        Actualizar
      </button>
    </div>
  )
}
