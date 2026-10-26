/**
 * AptitudFisica — certificado de aptitud física de un alumno: su estado, los certificados cargados y el alta.
 * Vence al año de la emisión y hace falta vigente para inscribirse a un deporte. Los certificados no se borran:
 * se corrigen, y cada cambio queda en el historial.
 */
import { useState } from 'react'
import type { FormEvent } from 'react'
import { btnPrimary, btnSecondary, btnSecondarySm, fieldLabel, inputField, msgError } from '../../ui/styles'
import { BadgeAptitud } from './BadgeAptitud'
import { fechaCorta } from './formato'
import type { CertificadoDeAptitud, DatosCertificado } from './types'
import { useAptitud } from './useAptitud'

const hoy = () => new Date().toLocaleDateString('en-CA')

interface FormularioProps {
  inicial: DatosCertificado
  etiquetaBoton: string
  guardando: boolean
  error: string
  onGuardar: (datos: DatosCertificado) => Promise<boolean>
  onCancelar?: () => void
}

function FormularioCertificado({ inicial, etiquetaBoton, guardando, error, onGuardar, onCancelar }: FormularioProps) {
  const [datos, setDatos] = useState(inicial)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (await onGuardar(datos)) {
      setDatos({ fecha_emision: '', observaciones: '' })
      onCancelar?.()
    }
  }

  return (
    <form
      onSubmit={(e) => {
        void enviar(e)
      }}
      className='flex flex-col gap-3 border border-border rounded-[12px] p-4'
    >
      <div>
        <span className={fieldLabel}>Fecha de emisión del certificado *</span>
        <input
          type='date'
          required
          className={inputField}
          max={hoy()}
          value={datos.fecha_emision}
          onChange={(e) => {
            setDatos((actuales) => ({ ...actuales, fecha_emision: e.target.value }))
          }}
        />
        <div className='text-[11px] text-textMuted mt-1'>Vence al año de esa fecha. El certificado tiene que estar vigente.</div>
      </div>
      <div>
        <span className={fieldLabel}>Observaciones</span>
        <input
          className={inputField}
          maxLength={500}
          value={datos.observaciones}
          onChange={(e) => {
            setDatos((actuales) => ({ ...actuales, observaciones: e.target.value }))
          }}
        />
      </div>
      {error && <div className={msgError}>{error}</div>}
      <div className='flex gap-3 flex-wrap'>
        <button type='submit' className={btnPrimary} disabled={guardando}>
          {guardando ? 'Guardando...' : etiquetaBoton}
        </button>
        {onCancelar && (
          <button type='button' className={btnSecondary} onClick={onCancelar}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}

function TarjetaCertificado({ certificado, onCorregir }: { certificado: CertificadoDeAptitud; onCorregir: () => void }) {
  return (
    <div className='border border-border rounded-[12px] p-4 flex flex-col gap-1'>
      <div className='text-[14px] font-black'>Emitido el {fechaCorta(certificado.fecha_emision)}</div>
      <div className='text-[13px] text-text'>Vence el {fechaCorta(certificado.fecha_vencimiento)}</div>
      {certificado.observaciones && <div className='text-[13px] text-textMuted'>{certificado.observaciones}</div>}
      {certificado.registrado_por && <div className='text-[11px] text-textMuted'>Cargado por {certificado.registrado_por}</div>}
      <div className='mt-1'>
        <button className={btnSecondarySm} onClick={onCorregir}>
          Corregir
        </button>
      </div>
    </div>
  )
}

export function AptitudFisica({ idAlumno }: { idAlumno: number }) {
  const { aptitud, certificados, cargando, error, guardando, cargar, corregir } = useAptitud(idAlumno)
  // `null`: sin formulario; `'nuevo'`: alta; un número: corrigiendo ese certificado.
  const [abierto, setAbierto] = useState<'nuevo' | number | null>(null)
  const cerrar = () => {
    setAbierto(null)
  }

  if (cargando && !aptitud) return <p className='text-[13px] text-textMuted m-0'>Cargando…</p>

  return (
    <div className='flex flex-col gap-4'>
      {aptitud && (
        <div className='flex items-center gap-3 flex-wrap'>
          <span className='text-[13px] font-bold text-text'>Aptitud física:</span>
          <BadgeAptitud aptitud={aptitud} />
          {aptitud.estado !== 'Vigente' && <span className='text-[12px] text-textMuted'>No puede inscribirse a un deporte nuevo hasta cargar un certificado vigente.</span>}
        </div>
      )}

      {abierto === null && (
        <div>
          <button
            className={btnPrimary}
            onClick={() => {
              setAbierto('nuevo')
            }}
          >
            + Cargar certificado
          </button>
        </div>
      )}
      {abierto === 'nuevo' && (
        <FormularioCertificado inicial={{ fecha_emision: '', observaciones: '' }} etiquetaBoton='Guardar certificado' guardando={guardando} error={error} onGuardar={cargar} onCancelar={cerrar} />
      )}

      {certificados.length === 0 ? (
        <p className='text-[13px] text-textMuted m-0'>Todavía no hay certificados cargados.</p>
      ) : (
        certificados.map((c) =>
          abierto === c.id_certificado ? (
            <FormularioCertificado
              key={c.id_certificado}
              inicial={{ fecha_emision: c.fecha_emision, observaciones: c.observaciones ?? '' }}
              etiquetaBoton='Guardar corrección'
              guardando={guardando}
              error={error}
              onGuardar={(datos) => corregir(c.id_certificado, datos)}
              onCancelar={cerrar}
            />
          ) : (
            <TarjetaCertificado
              key={c.id_certificado}
              certificado={c}
              onCorregir={() => {
                setAbierto(c.id_certificado)
              }}
            />
          ),
        )
      )}
      {abierto === null && error && <div className={msgError}>{error}</div>}
    </div>
  )
}
