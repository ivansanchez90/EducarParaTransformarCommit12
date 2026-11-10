/**
 * Aviso "Instalá la app" (PWA): aparece solo en el celular y solo si la página
 * se abrió en el navegador, no desde la app instalada.
 *
 * - Android (Chrome, Edge, Samsung Internet): el navegador avisa con
 *   `beforeinstallprompt` que la app se puede instalar (no lo hace si ya está
 *   instalada). Se guarda ese evento y el botón "Instalar" abre el diálogo del sistema.
 * - iPhone y iPad: Safari no tiene ese evento ni deja instalar desde la página, así
 *   que se explican los dos toques. Es además la única forma de recibir avisos push ahí.
 *
 * "Ahora no" lo oculta por una semana en ese navegador. Usa el mismo lugar que
 * `ActualizarApp`; los dos casi nunca coinciden, porque en la primera visita no
 * hay una versión anterior que actualizar.
 */
import { useEffect, useState } from 'react'
import { btnPrimarySm } from '../ui/styles'
import { useEsMovil } from '../ui/useEsMovil'
import { esIOS, instalada } from './push'

/** El evento no está en los tipos de TypeScript: solo lo implementan los navegadores Chromium. */
interface EventoInstalar extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const CLAVE_DESCARTADO = 'instalar-app-descartado'
const UNA_SEMANA = 7 * 24 * 60 * 60 * 1000

function descartadoHacePoco(): boolean {
  try {
    const cuando = Number(localStorage.getItem(CLAVE_DESCARTADO))
    return Number.isFinite(cuando) && Date.now() - cuando < UNA_SEMANA
  } catch {
    return false // sin localStorage (modo privado): se vuelve a mostrar
  }
}

function recordarDescarte() {
  try {
    localStorage.setItem(CLAVE_DESCARTADO, String(Date.now()))
  } catch {
    // Sin localStorage el aviso solo se oculta hasta recargar.
  }
}

/** Desde iOS 16.4 Safari, Chrome y Edge agregan a inicio; los navegadores internos (Instagram, Facebook) no. */
const puedeAgregarAInicio = () => !/FBAN|FBAV|Instagram|Line\//.test(navigator.userAgent)

export function InstalarApp() {
  const esMovil = useEsMovil()
  const [evento, setEvento] = useState<EventoInstalar | null>(null)
  const [oculto, setOculto] = useState(() => instalada() || descartadoHacePoco())

  useEffect(() => {
    const alPoderInstalar = (e: Event) => {
      // Sin esto Chrome muestra su propia barrita, que se cierra sola y no vuelve.
      e.preventDefault()
      setEvento(e as EventoInstalar)
    }
    const alInstalar = () => {
      setEvento(null)
      setOculto(true)
    }
    window.addEventListener('beforeinstallprompt', alPoderInstalar)
    window.addEventListener('appinstalled', alInstalar)
    return () => {
      window.removeEventListener('beforeinstallprompt', alPoderInstalar)
      window.removeEventListener('appinstalled', alInstalar)
    }
  }, [])

  const ios = esIOS()
  if (oculto || !(esMovil || ios)) return null
  if (!evento && !(ios && puedeAgregarAInicio())) return null

  const cerrar = () => {
    recordarDescarte()
    setOculto(true)
  }

  const instalar = async () => {
    if (!evento) return
    await evento.prompt()
    const { outcome } = await evento.userChoice
    // El evento sirve una sola vez; si la rechazó, el navegador lo vuelve a mandar más adelante.
    setEvento(null)
    if (outcome === 'dismissed') recordarDescarte()
  }

  return (
    <div
      role='dialog'
      aria-labelledby='instalar-app-titulo'
      className="fixed inset-x-4 bottom-[calc(80px+env(safe-area-inset-bottom))] z-[1000] mx-auto max-w-[420px] bg-white border border-border rounded-btn shadow-[0_8px_32px_rgba(91,53,197,0.18)] p-4 flex gap-3 font-[Nunito,_'Segoe_UI',_sans-serif]"
    >
      <img src='/pwa-64x64.png' alt='' width={40} height={40} className='rounded-lg shrink-0 self-start' />
      <div className='flex-1 min-w-0'>
        <div id='instalar-app-titulo' className='text-[14px] font-extrabold text-text'>
          Instalá la app en tu celular
        </div>
        {evento ? (
          <p className='text-[12px] text-textMuted mt-1 mb-0'>
            Se abre desde un ícono, como cualquier app, y te llegan los avisos de notas, asistencia y pagos.
          </p>
        ) : (
          <p className='text-[12px] text-textMuted mt-1 mb-0'>
            Tocá <strong>Compartir</strong>{' '}
            <span aria-hidden='true' className='inline-block px-1 rounded border border-border text-[11px]'>
              ⬆
            </span>{' '}
            (si no lo ves, primero el botón <strong>···</strong>) y elegí <strong>Agregar a inicio</strong>. En el
            iPhone, los avisos solo llegan con la app instalada.
          </p>
        )}
        <div className='flex justify-end items-center gap-3 mt-3'>
          <button
            type='button'
            className='bg-transparent border-0 min-h-11 px-2 text-xs font-bold text-textMuted cursor-pointer font-[inherit]'
            onClick={cerrar}
          >
            {evento ? 'Ahora no' : 'Entendido'}
          </button>
          {evento && (
            <button type='button' className={`${btnPrimarySm} min-h-11 px-4`} onClick={() => void instalar()}>
              Instalar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
