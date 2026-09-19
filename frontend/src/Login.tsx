import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getSession, login } from './lib/auth'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')

  // Si ya hay sesión activa, redirigir directamente
  useEffect(() => {
    getSession().then((perfil) => {
      if (perfil) redirectByRole(perfil.rol)
      else setChecking(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const redirectByRole = (rol: string) => {
    if (rol === 'Admin' || rol === 'Directivo' || rol === 'Docente') {
      navigate('/admin', { replace: true })
    } else {
      navigate('/portal', { replace: true })
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: err } = await login(email, password)

    if (err) {
      // 403 = usuario desactivado; 0 = backend caído; el resto, credenciales.
      setError(
        err.status === 403 || err.status === 0
          ? err.message
          : 'Credenciales incorrectas. Verificá tu email y contraseña.',
      )
      setLoading(false)
      return
    }

    redirectByRole(data.rol)
    setLoading(false)
  }

  if (checking) {
    return (
      <div className='min-h-screen bg-bg flex items-center justify-center'>
        <p className='text-purple-700 font-extrabold text-[15px]'>Cargando...</p>
      </div>
    )
  }

  return (
    <div
      className='min-h-screen bg-bg flex flex-col items-center justify-center px-4'
      style={{
        background: 'radial-gradient(ellipse at 60% 0%, #EEE9FF 0%, #F5F4FB 60%)',
      }}
    >
      {/* Volver al inicio */}
      <Link
        to='/'
        className='flex items-center gap-2 text-textMuted text-[13px] font-bold no-underline hover:text-purple-700 transition-colors mb-6 self-start max-w-[420px] w-full mx-auto'
      >
        ← Volver al inicio
      </Link>

      <div className='bg-white rounded-[24px] px-10 py-11 w-full max-w-[420px] border border-border shadow-[0_8px_48px_rgba(91,53,197,0.14)]'>
        {/* Logo */}
        <div className='text-center mb-8'>
          <Link to='/'>
            <img
              src='/logo.png'
              alt='Educar Para Transformar'
              className='h-20 mb-3 mx-auto'
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          </Link>
          <div className='text-[17px] font-black text-purple-700'>
            Educar Para Transformar
          </div>
          <div className='text-xs text-textMuted tracking-[0.08em] mt-1'>
            CAMPUS VIRTUAL
          </div>
        </div>

        <form onSubmit={handleLogin} className='flex flex-col gap-4'>
          <div>
            <label className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
              Correo electrónico
            </label>
            <input
              type='email'
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder='tu@email.com'
              className='w-full px-[14px] py-[11px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
            />
          </div>

          <div>
            <label className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
              Contraseña
            </label>
            <input
              type='password'
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder='••••••••'
              className='w-full px-[14px] py-[11px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
            />
          </div>

          {error && (
            <div className='text-[12px] font-bold text-red bg-[#E74C3C12] border border-[#E74C3C40] rounded-lg px-4 py-3'>
              ⚠️ {error}
            </div>
          )}

          <button
            type='submit'
            disabled={loading}
            className={`border-0 rounded-btn py-[13px] text-[14px] font-extrabold cursor-pointer mt-1 transition-opacity ${
              loading
                ? 'bg-border text-textMuted cursor-not-allowed'
                : 'bg-gradient-to-br from-purple-700 to-purpleMid text-white'
            }`}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className='text-center text-[11px] text-textMuted mt-6 leading-relaxed'>
          Accedés con las credenciales provistas por la institución.
          <br />
          Cada usuario es redirigido automáticamente según su rol.
        </p>
      </div>
    </div>
  )
}
