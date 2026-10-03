/**
 * FinanzasAlumno — pestaña "Cuotas" del portal: las facturas del alumno (con consulta por
 * rango de fechas), lo que debe por ítem, sus comprobantes de transferencia y su historial
 * de pagos. Los datos los piden `useFinanzas` y `useConsulta`; esto solo los muestra.
 */
import { useState } from 'react'
import { qs } from '../../lib/api'
import { msgError } from '../../ui/styles'
import { ComprobantesAlumno } from './ComprobantesAlumno'
import { DeudaAlumno } from './DeudaAlumno'
import { FacturasAlumno } from './FacturasAlumno'
import { FiltroFechas } from './FiltroFechas'
import { rangoValido } from './formato'
import { HistorialPagos } from './HistorialPagos'
import type { ComprobanteListado, DeudaAlumno as Deuda, FacturaPortal, RangoFechas } from './types'
import { useConsulta } from './useConsulta'
import type { Finanzas } from './useFinanzas'

type Vista = 'facturas' | 'deuda' | 'comprobantes' | 'pagos'

const VISTAS: { clave: Vista; texto: string }[] = [
  { clave: 'facturas', texto: 'Facturas' },
  { clave: 'deuda', texto: 'Deuda' },
  { clave: 'comprobantes', texto: 'Comprobantes' },
  { clave: 'pagos', texto: 'Pagos' },
]

const SIN_RANGO: RangoFechas = { desde: '', hasta: '' }

export function FinanzasAlumno({ finanzas }: { finanzas: Finanzas }) {
  const [vista, setVista] = useState<Vista>('facturas')
  const [rango, setRango] = useState<RangoFechas>(SIN_RANGO)
  const { idAlumno, version, facturas, pagos, cargando, error, recargar } = finanzas

  const hayRango = rango.desde !== '' || rango.hasta !== ''
  const consultable = idAlumno !== null && rangoValido(rango)
  const base = `/alumnos/${idAlumno}`

  // Cada vista pide lo suyo solo cuando se la mira; `v` refresca los datos después de una subida.
  const facturasDelRango = useConsulta<FacturaPortal[]>(
    vista === 'facturas' && hayRango && consultable ? `${base}/facturas${qs({ ...rango, v: version })}` : null,
  )
  const deuda = useConsulta<Deuda>(vista === 'deuda' && idAlumno !== null ? `${base}/deuda${qs({ v: version })}` : null)
  const comprobantes = useConsulta<ComprobanteListado[]>(
    vista === 'comprobantes' && consultable ? `${base}/comprobantes${qs({ ...rango, v: version })}` : null,
  )

  const consultaActual = vista === 'deuda' ? deuda : vista === 'comprobantes' ? comprobantes : facturasDelRango
  const mensaje = error || consultaActual.error
  const esperando = vista === 'pagos' || (vista === 'facturas' && !hayRango) ? cargando : consultaActual.cargando

  return (
    <div className='bg-white rounded-card p-6 shadow-card border border-border'>
      <div className='text-[15px] font-extrabold text-text mb-4 flex items-center gap-2'>💳 Facturas y pagos</div>
      <div className='flex gap-2 mb-5 flex-wrap'>
        {VISTAS.map(({ clave, texto }) => (
          <button
            key={clave}
            className={`min-h-11 px-4 rounded-btn border text-[13px] font-bold cursor-pointer font-[inherit] ${
              vista === clave ? 'bg-purple-700 border-purple-700 text-white' : 'bg-transparent border-border text-textMuted'
            }`}
            onClick={() => {
              setVista(clave)
            }}
          >
            {texto}
          </button>
        ))}
      </div>

      {(vista === 'facturas' || vista === 'comprobantes') && (
        <FiltroFechas
          rango={rango}
          onCambiar={setRango}
          queFecha={vista === 'facturas' ? 'fecha de emisión de la factura' : 'fecha de la transferencia'}
        />
      )}

      {mensaje && <div className={`${msgError} mb-4`}>⚠️ {mensaje}</div>}
      {esperando ? (
        <p className='text-[13px] text-textMuted m-0'>Cargando…</p>
      ) : vista === 'facturas' ? (
        hayRango ? (
          <FacturasAlumno facturas={facturasDelRango.datos ?? []} onActualizar={recargar} filtrado />
        ) : (
          <FacturasAlumno facturas={facturas} onActualizar={recargar} />
        )
      ) : vista === 'deuda' ? (
        deuda.datos && <DeudaAlumno deuda={deuda.datos} />
      ) : vista === 'comprobantes' ? (
        <ComprobantesAlumno comprobantes={comprobantes.datos ?? []} filtrado={hayRango} />
      ) : (
        <HistorialPagos pagos={pagos} />
      )}
    </div>
  )
}
