/** AtencionesSalud — atenciones de enfermería de un alumno: lista, alta y corrección. Las atenciones no se borran. */
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Badge } from '../../ui/components'
import { btnPrimary, btnSecondary, btnSecondarySm, fieldLabel, inputField, msgError } from '../../ui/styles'
import { fechaHora } from './formato'
import type { Atencion, DatosAtencion } from './types'

const VACIA: DatosAtencion = { motivo: '', descripcion: '', tratamiento: '', fecha_hora: '' }

const desdeAtencion = (a: Atencion): DatosAtencion => ({
  motivo: a.motivo,
  descripcion: a.descripcion ?? '',
  tratamiento: a.tratamiento ?? '',
  fecha_hora: '',
})

interface FormularioProps {
  inicial: DatosAtencion
  /** Al corregir, la fecha vacía deja la que ya tiene la atención. */
  corrigiendo: boolean
  guardando: boolean
  error: string
  onGuardar: (datos: DatosAtencion) => Promise<boolean>
  onCancelar: () => void
}

function FormularioAtencion({ inicial, corrigiendo, guardando, error, onGuardar, onCancelar }: FormularioProps) {
  const [datos, setDatos] = useState(inicial)
  const cambiar = (campo: keyof DatosAtencion, valor: string) => {
    setDatos((actuales) => ({ ...actuales, [campo]: valor }))
  }

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (await onGuardar(datos)) onCancelar()
  }

  return (
    <form
      onSubmit={(e) => {
        void enviar(e)
      }}
      className='flex flex-col gap-3 border border-border rounded-[12px] p-4 mb-4'
    >
      <div>
        <span className={fieldLabel}>Motivo *</span>
        <input
          className={inputField}
          required
          maxLength={200}
          value={datos.motivo}
          onChange={(e) => {
            cambiar('motivo', e.target.value)
          }}
        />
      </div>
      <div>
        <span className={fieldLabel}>Qué pasó</span>
        <textarea
          className={`${inputField} min-h-[64px]`}
          maxLength={1000}
          value={datos.descripcion}
          onChange={(e) => {
            cambiar('descripcion', e.target.value)
          }}
        />
      </div>
      <div>
        <span className={fieldLabel}>Tratamiento</span>
        <textarea
          className={`${inputField} min-h-[64px]`}
          maxLength={1000}
          value={datos.tratamiento}
          onChange={(e) => {
            cambiar('tratamiento', e.target.value)
          }}
        />
      </div>
      <div>
        <span className={fieldLabel}>Fecha y hora {corrigiendo ? '(vacío: se deja la que tiene)' : '(vacío: ahora)'}</span>
        <input
          type='datetime-local'
          className={inputField}
          value={datos.fecha_hora}
          onChange={(e) => {
            cambiar('fecha_hora', e.target.value)
          }}
        />
      </div>
      {error && <div className={msgError}>{error}</div>}
      <div className='flex gap-3 flex-wrap'>
        <button type='submit' className={btnPrimary} disabled={guardando}>
          {guardando ? 'Guardando...' : corrigiendo ? 'Guardar corrección' : 'Registrar atención'}
        </button>
        <button type='button' className={btnSecondary} onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

/** Una atención en una tarjeta; la familia la ve sin el botón de corregir. */
export function TarjetaAtencion({ atencion, onCorregir }: { atencion: Atencion; onCorregir?: () => void }) {
  return (
    <div className='border border-border rounded-[12px] p-4 flex flex-col gap-1.5'>
      <div className='flex justify-between items-start gap-2 flex-wrap'>
        <div className='text-[15px] font-black'>{atencion.motivo}</div>
        <Badge color={atencion.familia_avisada ? '#27AE60' : '#6B6B8A'}>{atencion.familia_avisada ? 'Familia avisada' : 'Sin aviso a la familia'}</Badge>
      </div>
      <div className='text-[12px] text-textMuted'>
        {fechaHora(atencion.fecha_hora)}
        {atencion.registrada_por ? ` · ${atencion.registrada_por}` : ''}
      </div>
      {atencion.descripcion && <div className='text-[13px] text-text'>{atencion.descripcion}</div>}
      {atencion.tratamiento && (
        <div className='text-[13px] text-text'>
          <strong>Tratamiento:</strong> {atencion.tratamiento}
        </div>
      )}
      {onCorregir && (
        <div className='mt-1'>
          <button className={btnSecondarySm} onClick={onCorregir}>
            Corregir
          </button>
        </div>
      )}
    </div>
  )
}

interface Props {
  atenciones: Atencion[]
  guardando: boolean
  error: string
  onRegistrar: (datos: DatosAtencion) => Promise<boolean>
  onCorregir: (idAtencion: number, datos: DatosAtencion) => Promise<boolean>
}

export function AtencionesSalud({ atenciones, guardando, error, onRegistrar, onCorregir }: Props) {
  // `null`: sin formulario; `'nueva'`: alta; un número: corrigiendo esa atención.
  const [abierto, setAbierto] = useState<'nueva' | number | null>(null)
  const cerrar = () => {
    setAbierto(null)
  }

  return (
    <div>
      {abierto === null && (
        <div className='mb-4'>
          <button
            className={btnPrimary}
            onClick={() => {
              setAbierto('nueva')
            }}
          >
            + Registrar atención
          </button>
        </div>
      )}
      {abierto === 'nueva' && <FormularioAtencion inicial={VACIA} corrigiendo={false} guardando={guardando} error={error} onGuardar={onRegistrar} onCancelar={cerrar} />}

      {atenciones.length === 0 ? (
        <p className='text-[13px] text-textMuted m-0'>Todavía no hay atenciones registradas.</p>
      ) : (
        <div className='flex flex-col gap-3'>
          {atenciones.map((a) =>
            abierto === a.id_atencion ? (
              <FormularioAtencion
                key={a.id_atencion}
                inicial={desdeAtencion(a)}
                corrigiendo
                guardando={guardando}
                error={error}
                onGuardar={(datos) => onCorregir(a.id_atencion, datos)}
                onCancelar={cerrar}
              />
            ) : (
              <TarjetaAtencion
                key={a.id_atencion}
                atencion={a}
                onCorregir={() => {
                  setAbierto(a.id_atencion)
                }}
              />
            ),
          )}
        </div>
      )}
    </div>
  )
}
