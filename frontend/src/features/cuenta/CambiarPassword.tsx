/**
 * CambiarPassword — diálogo para que el propio usuario cambie su contraseña.
 *
 * Lo usan tanto el panel de administración como el portal de familias. Pide la
 * contraseña actual como control y la repetición de la nueva para evitar
 * errores de tipeo.
 */
import { useState } from 'react'
import type { FormEvent } from 'react'
import { cambiarPassword } from '../../lib/auth'
import { btnPrimary, btnSecondary, fieldLabel, inputField } from '../../ui/styles'
import { useEnLinea } from '../../ui/useEnLinea'

export function CambiarPassword({ onClose }: { onClose: () => void }) {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [listo, setListo] = useState(false)
  const enLinea = useEnLinea()

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    setMsg('')
    if (nueva.length < 6) {
      setMsg('La contraseña nueva debe tener al menos 6 caracteres.')
      return
    }
    if (nueva !== repetir) {
      setMsg('Las dos contraseñas nuevas no coinciden.')
      return
    }
    setLoading(true)
    const error = await cambiarPassword(actual, nueva)
    if (error) setMsg(error.message)
    else {
      setListo(true)
      setMsg('✅ Listo, tu contraseña quedó actualizada.')
    }
    setLoading(false)
  }

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center p-4'
      style={{ background: 'rgba(26,26,46,0.45)' }}
      onClick={onClose}
    >
      <div
        className='bg-white rounded-card p-6 shadow-card border border-border w-full max-w-[420px]'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='text-[17px] font-black text-text mb-1'>🔑 Cambiar mi contraseña</div>
        <p className='text-[13px] text-textMuted mt-0 mb-5'>
          Vas a seguir con la sesión abierta en este dispositivo.
        </p>

        {listo ? (
          <>
            <div className='text-[13px] font-bold text-[#27AE60] mb-5'>{msg}</div>
            <button className={btnPrimary} onClick={onClose}>
              Cerrar
            </button>
          </>
        ) : (
          <form onSubmit={guardar} className='flex flex-col gap-4'>
            <div>
              <span className={fieldLabel}>Contraseña actual</span>
              <input
                type='password'
                className={inputField}
                required
                autoFocus
                value={actual}
                onChange={(e) => setActual(e.target.value)}
              />
            </div>
            <div>
              <span className={fieldLabel}>Contraseña nueva</span>
              <input
                type='password'
                className={inputField}
                required
                minLength={6}
                value={nueva}
                onChange={(e) => setNueva(e.target.value)}
                placeholder='Mínimo 6 caracteres'
              />
            </div>
            <div>
              <span className={fieldLabel}>Repetir contraseña nueva</span>
              <input
                type='password'
                className={inputField}
                required
                value={repetir}
                onChange={(e) => setRepetir(e.target.value)}
              />
            </div>

            {msg && (
              <div className='text-[13px] font-bold text-red'>{msg}</div>
            )}

            {!enLinea && (
              <div className='text-[13px] font-bold text-red'>
                📡 Sin conexión: no se puede guardar hasta que vuelva la señal.
              </div>
            )}

            <div className='flex gap-3'>
              <button type='submit' className={btnPrimary} disabled={loading || !enLinea}>
                {loading ? 'Guardando...' : 'Cambiar contraseña'}
              </button>
              <button type='button' className={btnSecondary} onClick={onClose}>
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
