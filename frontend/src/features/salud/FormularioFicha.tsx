/** FormularioFicha — alta y edición de la ficha médica de un alumno. */
import { useState } from 'react'
import type { FormEvent } from 'react'
import { btnPrimary, fieldLabel, inputField, msgError, selectField } from '../../ui/styles'
import { GRUPOS_SANGUINEOS } from './types'
import type { DatosFicha, FichaMedica } from './types'

const AYUDA_ALERGIAS_CRITICAS = 'Es lo único que ven los docentes. Solo lo que pone en riesgo la salud (por ejemplo, maní o picaduras).'

/** Un campo de texto de la ficha. */
function CampoTexto({ etiqueta, ayuda, valor, onCambiar }: { etiqueta: string; ayuda?: string; valor: string; onCambiar: (valor: string) => void }) {
  return (
    <div>
      <span className={fieldLabel}>{etiqueta}</span>
      <textarea
        className={`${inputField} min-h-[72px]`}
        maxLength={1000}
        value={valor}
        onChange={(e) => {
          onCambiar(e.target.value)
        }}
      />
      {ayuda && <div className='text-[11px] text-textMuted mt-1'>{ayuda}</div>}
    </div>
  )
}

const desdeFicha = (ficha: FichaMedica | null): DatosFicha => ({
  grupo_sanguineo: ficha?.grupo_sanguineo ?? '',
  alergias: ficha?.alergias ?? '',
  alergias_criticas: ficha?.alergias_criticas ?? '',
  medicacion: ficha?.medicacion ?? '',
  condiciones: ficha?.condiciones ?? '',
  observaciones: ficha?.observaciones ?? '',
})

interface Props {
  ficha: FichaMedica | null
  guardando: boolean
  error: string
  onGuardar: (datos: DatosFicha) => Promise<boolean>
}

export function FormularioFicha({ ficha, guardando, error, onGuardar }: Props) {
  const [datos, setDatos] = useState<DatosFicha>(() => desdeFicha(ficha))
  const [guardada, setGuardada] = useState(false)

  const cambiar = (campo: keyof DatosFicha, valor: string) => {
    setGuardada(false)
    setDatos((actuales) => ({ ...actuales, [campo]: valor }))
  }

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setGuardada(await onGuardar(datos))
  }

  return (
    <form
      onSubmit={(e) => {
        void enviar(e)
      }}
      className='flex flex-col gap-4'
    >
      <div>
        <span className={fieldLabel}>Grupo sanguíneo</span>
        <select
          className={selectField}
          value={datos.grupo_sanguineo}
          onChange={(e) => {
            cambiar('grupo_sanguineo', e.target.value)
          }}
        >
          <option value=''>Sin dato</option>
          {GRUPOS_SANGUINEOS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      <CampoTexto
        etiqueta='Alergias críticas'
        ayuda={AYUDA_ALERGIAS_CRITICAS}
        valor={datos.alergias_criticas}
        onCambiar={(valor) => {
          cambiar('alergias_criticas', valor)
        }}
      />
      <CampoTexto
        etiqueta='Otras alergias'
        valor={datos.alergias}
        onCambiar={(valor) => {
          cambiar('alergias', valor)
        }}
      />
      <CampoTexto
        etiqueta='Medicación'
        valor={datos.medicacion}
        onCambiar={(valor) => {
          cambiar('medicacion', valor)
        }}
      />
      <CampoTexto
        etiqueta='Condiciones o enfermedades'
        valor={datos.condiciones}
        onCambiar={(valor) => {
          cambiar('condiciones', valor)
        }}
      />
      <CampoTexto
        etiqueta='Observaciones'
        valor={datos.observaciones}
        onCambiar={(valor) => {
          cambiar('observaciones', valor)
        }}
      />

      {error && <div className={msgError}>{error}</div>}
      {guardada && !error && <div className='text-[13px] font-bold text-green'>✅ Ficha guardada.</div>}
      <div>
        <button type='submit' className={btnPrimary} disabled={guardando}>
          {guardando ? 'Guardando...' : ficha ? 'Guardar cambios' : 'Crear ficha'}
        </button>
      </div>
    </form>
  )
}
