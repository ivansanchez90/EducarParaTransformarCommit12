/**
 * FinanzasAlumno — pestaña "Cuotas" del portal: las facturas del alumno y su
 * historial de pagos. Los datos los pide `useFinanzas`; esto solo los muestra.
 */
import { useState } from 'react'
import { msgError } from '../../ui/styles'
import { FacturasAlumno } from './FacturasAlumno'
import { HistorialPagos } from './HistorialPagos'
import type { Finanzas } from './useFinanzas'

type Vista = 'facturas' | 'pagos'

export function FinanzasAlumno({ finanzas }: { finanzas: Finanzas }) {
  const [vista, setVista] = useState<Vista>('facturas')
  const { facturas, pagos, cargando, error } = finanzas

  const boton = (clave: Vista, texto: string) => (
    <button
      className={`min-h-11 px-4 rounded-btn border text-[13px] font-bold cursor-pointer font-[inherit] ${
        vista === clave ? 'bg-purple-700 border-purple-700 text-white' : 'bg-transparent border-border text-textMuted'
      }`}
      onClick={() => {
        setVista(clave)
      }}
    >
      {texto}
    </button>
  )

  return (
    <div className='bg-white rounded-card p-6 shadow-card border border-border'>
      <div className='text-[15px] font-extrabold text-text mb-4 flex items-center gap-2'>💳 Facturas y pagos</div>
      <div className='flex gap-2 mb-5 flex-wrap'>
        {boton('facturas', 'Facturas')}
        {boton('pagos', 'Historial de pagos')}
      </div>

      {error && <div className={`${msgError} mb-4`}>⚠️ {error}</div>}
      {cargando ? (
        <p className='text-[13px] text-textMuted m-0'>Cargando…</p>
      ) : vista === 'facturas' ? (
        <FacturasAlumno facturas={facturas} />
      ) : (
        <HistorialPagos pagos={pagos} />
      )}
    </div>
  )
}
