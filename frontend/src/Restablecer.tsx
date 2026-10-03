/**
 * Restablecer — elegir una contraseña nueva con el enlace del email (T20).
 *
 * El enlace trae `?token=…`: se lee una vez y se saca de la barra de
 * direcciones, para que no quede en el historial. Vale 30 minutos y una sola
 * vez; si venció, el backend lo dice y se ofrece pedir otro desde el login.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from './lib/api'
import { PasswordInput } from './ui/components'
import { useEnLinea } from './ui/useEnLinea'

/** Lee el token del enlace y lo saca de la URL. */
function tokenDelEnlace(): string {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('token') ?? ''
  if (token) window.history.replaceState(null, '', window.location.pathname)
  return token
}

const inputClase =
  'w-full px-[14px] py-[11px] rounded-input border-2 border-border text-base md:text-[13px] text-text outline-none box-border'

export default function Restablecer() {
  const [token] = useState(tokenDelEnlace)
  const enLinea = useEnLinea()
  const [password, setPassword] = useState('')
  const [repetida, setRepetida] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [listo, setListo] = useState(false)

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== repetida) return setError('Las dos contraseñas no coinciden.')
    setEnviando(true)
    setError('')
    const { error: err } = await api.post('/auth/restablecer', { token, password })
    setEnviando(false)
    if (err) setError(err.message)
    else setListo(true)
  }

  return (
    <div
      className='min-h-screen bg-bg flex flex-col items-center justify-center px-4'
      style={{ background: 'radial-gradient(ellipse at 60% 0%, #EEE9FF 0%, #F5F4FB 60%)' }}
    >
      <div className='bg-white rounded-[24px] px-6 md:px-10 py-9 w-full max-w-[420px] border border-border shadow-[0_8px_48px_rgba(91,53,197,0.14)]'>
        <div className='text-center mb-6'>
          <img
            src='/logo.png'
            alt='Educar Para Transformar'
            className='h-16 mb-3 mx-auto'
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
          <div className='text-[17px] font-black text-purple-700'>Elegir una contraseña nueva</div>
        </div>

        {listo ? (
          <div className='flex flex-col gap-4' role='status'>
            <p className='text-[13px] text-text m-0 leading-relaxed'>
              ✅ Listo, tu contraseña quedó cambiada. Ya podés ingresar con la nueva.
            </p>
            <Link
              to='/login'
              className='text-center no-underline rounded-btn py-[13px] text-[14px] font-extrabold bg-gradient-to-br from-purple-700 to-purpleMid text-white'
            >
              Ingresar
            </Link>
          </div>
        ) : !token ? (
          <div className='flex flex-col gap-4'>
            <p className='text-[13px] text-text m-0 leading-relaxed'>
              Este enlace no es válido. Pedí uno nuevo desde <strong>¿Olvidaste tu contraseña?</strong> en la pantalla de
              ingreso.
            </p>
            <Link to='/login' className='text-center text-[13px] font-bold text-purple-700 no-underline min-h-11 leading-[44px]'>
              Ir a ingresar
            </Link>
          </div>
        ) : (
          <form onSubmit={guardar} className='flex flex-col gap-4'>
            <div>
              <label htmlFor='restablecer-password' className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Contraseña nueva (al menos 6 caracteres)
              </label>
              <PasswordInput
                id='restablecer-password'
                required
                minLength={6}
                autoFocus
                autoComplete='new-password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClase}
              />
            </div>
            <div>
              <label htmlFor='restablecer-repetida' className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Repetila
              </label>
              <PasswordInput
                id='restablecer-repetida'
                required
                minLength={6}
                autoComplete='new-password'
                value={repetida}
                onChange={(e) => setRepetida(e.target.value)}
                className={inputClase}
              />
            </div>
            {error && (
              <div role='alert' className='text-[12px] font-bold text-red bg-[#E74C3C12] border border-[#E74C3C40] rounded-lg px-4 py-3'>
                ⚠️ {error}
                {/venci|no es válido/.test(error) && (
                  <>
                    {' '}
                    <Link to='/login' className='text-purple-700'>
                      Ir a ingresar
                    </Link>
                  </>
                )}
              </div>
            )}
            <button
              type='submit'
              disabled={enviando || !enLinea}
              className={`border-0 rounded-btn py-[13px] text-[14px] font-extrabold cursor-pointer transition-opacity ${
                enviando || !enLinea ? 'bg-border text-textMuted cursor-not-allowed' : 'bg-gradient-to-br from-purple-700 to-purpleMid text-white'
              }`}
            >
              {enviando ? 'Guardando...' : 'Guardar la contraseña nueva'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
