/** FiltroFechas — campos "desde" y "hasta" para consultar por rango de fechas (los dos opcionales). */
import { btnSecondarySm, fieldLabel, inputField, msgError } from '../../ui/styles'
import { rangoValido } from './formato'
import type { RangoFechas } from './types'

interface Props {
  rango: RangoFechas
  onCambiar: (rango: RangoFechas) => void
  /** Qué fecha se filtra, para que la familia sepa qué está eligiendo. */
  queFecha: string
}

export function FiltroFechas({ rango, onCambiar, queFecha }: Props) {
  const hayFiltro = rango.desde !== '' || rango.hasta !== ''

  return (
    <div className='flex flex-col gap-2 mb-4'>
      <div className='text-[12px] text-textMuted'>Filtrar por {queFecha}</div>
      <div className='flex gap-3 flex-wrap items-end'>
        <label className='flex-1 min-w-[140px]'>
          <span className={fieldLabel}>Desde</span>
          <input
            type='date'
            className={inputField}
            value={rango.desde}
            max={rango.hasta || undefined}
            onChange={(e) => {
              onCambiar({ ...rango, desde: e.target.value })
            }}
          />
        </label>
        <label className='flex-1 min-w-[140px]'>
          <span className={fieldLabel}>Hasta</span>
          <input
            type='date'
            className={inputField}
            value={rango.hasta}
            min={rango.desde || undefined}
            onChange={(e) => {
              onCambiar({ ...rango, hasta: e.target.value })
            }}
          />
        </label>
        {hayFiltro && (
          <button
            className={btnSecondarySm}
            onClick={() => {
              onCambiar({ desde: '', hasta: '' })
            }}
          >
            Limpiar
          </button>
        )}
      </div>
      {!rangoValido(rango) && <div className={msgError}>La fecha "desde" no puede ser posterior a "hasta".</div>}
    </div>
  )
}
