/**
 * SubirComprobanteDialog — la familia sube la foto o el PDF de su transferencia, con
 * el importe y la fecha. Queda "En revisión" hasta que la administración lo acredite.
 */
import { btnPrimary, btnSecondary, fieldLabel, inputField, msgError } from '../../ui/styles'
import { useEnLinea } from '../../ui/useEnLinea'
import { nombrePeriodo, numeroFactura } from './formato'
import type { FacturaPortal } from './types'
import { TIPOS_COMPROBANTE, MAX_COMPROBANTE_MB, useSubirComprobante } from './useSubirComprobante'

interface Props {
  factura: FacturaPortal
  idOrden: number | null
  importeSugerido: number
  onClose: () => void
  /** Se llama cuando el comprobante se subió, para que la lista de facturas se actualice. */
  onSubido: () => void
}

export function SubirComprobanteDialog({ factura, idOrden, importeSugerido, onClose, onSubido }: Props) {
  const c = useSubirComprobante({ factura, idOrden, importeSugerido, onSubido })
  const enLinea = useEnLinea()

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(26,26,46,0.45)]' onClick={onClose}>
      <div
        className='bg-white rounded-card p-6 shadow-card border border-border w-full max-w-[460px] max-h-[90vh] overflow-y-auto'
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <div className='text-[17px] font-black text-text mb-1'>📎 Subir comprobante</div>
        <p className='text-[13px] text-textMuted mt-0 mb-4'>
          {nombrePeriodo(factura.anio, factura.mes)} · Factura N.º {numeroFactura(factura.numero)}
        </p>

        {c.subido ? (
          <div className='flex flex-col gap-4'>
            <div className='text-[13px] font-bold text-[#27AE60]'>
              ✅ Recibimos tu comprobante. Queda en revisión: cuando la administración acredite la transferencia, tu factura
              se actualiza.
            </div>
            <button className={btnPrimary} onClick={onClose}>
              Cerrar
            </button>
          </div>
        ) : (
          <form
            className='flex flex-col gap-4'
            onSubmit={(e) => {
              e.preventDefault()
              void c.enviar()
            }}
          >
            <div>
              <span className={fieldLabel}>Foto o PDF del comprobante</span>
              <input
                type='file'
                accept={TIPOS_COMPROBANTE}
                className={inputField}
                onChange={(e) => {
                  c.elegirArchivo(e.target.files?.[0] ?? null)
                }}
              />
              <div className='text-[11px] text-textMuted mt-1'>
                JPG, PNG, WebP, AVIF, HEIC o PDF, de hasta {MAX_COMPROBANTE_MB} MB.
              </div>
            </div>
            <div>
              <span className={fieldLabel}>Importe transferido ($)</span>
              <input
                type='text'
                inputMode='decimal'
                className={inputField}
                value={c.importe}
                onChange={(e) => {
                  c.setImporte(e.target.value)
                }}
              />
            </div>
            <div>
              <span className={fieldLabel}>Fecha de la transferencia</span>
              <input
                type='date'
                className={inputField}
                value={c.fechaTransferencia}
                max={c.hoy}
                onChange={(e) => {
                  c.setFechaTransferencia(e.target.value)
                }}
              />
            </div>

            {c.error && <div className={msgError}>{c.error}</div>}
            {!enLinea && <div className={msgError}>📡 Sin conexión: no se puede subir hasta que vuelva la señal.</div>}

            <div className='flex gap-3 flex-wrap'>
              <button type='submit' className={btnPrimary} disabled={c.enviando || !enLinea || !c.archivo}>
                {c.enviando ? 'Subiendo...' : 'Subir comprobante'}
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
