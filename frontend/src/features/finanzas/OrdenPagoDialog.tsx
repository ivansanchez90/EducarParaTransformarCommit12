/**
 * OrdenPagoDialog — la familia elige qué ítems de una factura va a pagar y el
 * sistema emite la orden de pago (PDF con los datos de la cuenta para transferir). Después
 * se sube el comprobante de la transferencia (T13).
 */
import { useState } from 'react'
import { btnPrimary, btnSecondary, msgError } from '../../ui/styles'
import { useEnLinea } from '../../ui/useEnLinea'
import { nombrePeriodo, numeroFactura, pesos } from './formato'
import type { DatosBancarios, FacturaPortal, OrdenPago } from './types'
import { useOrdenPago } from './useOrdenPago'

const tieneDatos = (d: DatosBancarios) => Boolean(d.alias || d.cbu || d.titular || d.banco)

/** Banco, titular, CBU y alias, con un botón para copiar el CBU y el alias (se pegan en la app del banco). */
function DatosCuenta({ datos }: { datos: DatosBancarios }) {
  const [copiado, setCopiado] = useState('')
  const copiar = async (etiqueta: string, valor: string) => {
    try {
      await navigator.clipboard.writeText(valor)
      setCopiado(etiqueta)
    } catch {
      setCopiado('')
    }
  }
  const filas: [string, string | null, boolean][] = [
    ['Banco', datos.banco, false],
    ['Titular', datos.titular, false],
    ['CBU', datos.cbu, true],
    ['Alias', datos.alias, true],
  ]
  return (
    <dl className='mt-2 mb-0 rounded-lg border border-border bg-[#F7F5FF] px-3 py-2 flex flex-col gap-1.5'>
      {filas
        .filter(([, valor]) => valor)
        .map(([etiqueta, valor, copiable]) => (
          <div key={etiqueta} className='flex items-center justify-between gap-2'>
            <div className='min-w-0'>
              <dt className='text-[11px] font-extrabold text-textMuted uppercase tracking-wide'>{etiqueta}</dt>
              <dd className='m-0 font-bold break-all'>{valor}</dd>
            </div>
            {copiable && (
              <button
                type='button'
                className='shrink-0 min-h-11 px-3 rounded-lg border border-border bg-white text-[12px] font-bold text-purple-700 cursor-pointer'
                onClick={() => copiar(etiqueta, valor!)}
              >
                {copiado === etiqueta ? '✓ Copiado' : 'Copiar'}
              </button>
            )}
          </div>
        ))}
    </dl>
  )
}

interface Props {
  factura: FacturaPortal
  onClose: () => void
  /** Pasa a subir el comprobante de la transferencia de esta orden. */
  onSubirComprobante: (orden: OrdenPago) => void
}

export function OrdenPagoDialog({ factura, onClose, onSubirComprobante }: Props) {
  const { conSaldo, becas, descuento, elegidos, alternar, total, orden, emitiendo, error, emitir, bajarPdf } = useOrdenPago(factura)
  const enLinea = useEnLinea()

  return (
    <div role='dialog' aria-modal='true' className='fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[rgba(26,26,46,0.45)]' onClick={onClose}>
      <div
        className='bg-white rounded-card p-6 shadow-card border border-border w-full max-w-[460px] max-h-[90dvh] overflow-y-auto'
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <div className='text-[17px] font-black text-text mb-1'>💸 Pagar por transferencia</div>
        <p className='text-[13px] text-textMuted mt-0 mb-4'>
          {nombrePeriodo(factura.anio, factura.mes)} · Factura N.º {numeroFactura(factura.numero)}
        </p>

        {orden ? (
          <div className='flex flex-col gap-4'>
            <div className='text-[13px] font-bold text-[#27AE60]'>
              ✅ Orden de pago N.º {numeroFactura(orden.numero)} emitida por {pesos(orden.total)}.
            </div>
            <ol className='text-[13px] text-text m-0 pl-5 flex flex-col gap-1.5'>
              <li>
                {tieneDatos(orden.datos_bancarios) ? (
                  <>
                    Transferí {pesos(orden.total)} a esta cuenta:
                    <DatosCuenta datos={orden.datos_bancarios} />
                  </>
                ) : (
                  <>Transferí {pesos(orden.total)} a la cuenta de la institución (consultá los datos en la administración).</>
                )}
              </li>
              <li>
                En el motivo de la transferencia escribí <strong>Orden {numeroFactura(orden.numero)}</strong>.
              </li>
              <li>Guardá el comprobante de la transferencia y subilo desde acá, con "Ya transferí", o más tarde desde la factura.</li>
            </ol>
            {error && <div className={msgError}>{error}</div>}
            <div className='flex gap-3 flex-wrap'>
              <button
                className={btnPrimary}
                onClick={() => {
                  void bajarPdf()
                }}
              >
                Descargar orden de pago (PDF)
              </button>
              <button
                className={btnSecondary}
                onClick={() => {
                  onSubirComprobante(orden)
                }}
              >
                Ya transferí: subir comprobante
              </button>
              <button className={btnSecondary} onClick={onClose}>
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <div className='flex flex-col gap-4'>
            <div className='text-[13px] text-textMuted'>Elegí qué querés pagar. Se toma el saldo de cada ítem.</div>
            <div className='flex flex-col gap-2'>
              {conSaldo.map((item) => (
                <label
                  key={item.id_item}
                  className='flex items-center gap-3 min-h-11 border border-border rounded-[10px] px-3 py-2 cursor-pointer'
                >
                  <input
                    type='checkbox'
                    className='w-5 h-5 accent-purple-700'
                    checked={elegidos.has(item.id_item)}
                    onChange={() => {
                      alternar(item.id_item)
                    }}
                  />
                  <span className='flex-1 text-[13px]'>{item.descripcion}</span>
                  <span className='text-[13px] font-bold whitespace-nowrap'>{pesos(item.saldo)}</span>
                </label>
              ))}
            </div>
            {becas.length > 0 && (
              <div className='flex justify-between gap-3 text-[13px] text-textMuted px-3'>
                <span>{becas[0].descripcion}</span>
                <span className='font-bold whitespace-nowrap'>{descuento === 0 ? 'no aplica a lo elegido' : pesos(descuento)}</span>
              </div>
            )}
            <div className='flex justify-between text-[15px] font-black text-text'>
              <span>Total a transferir</span>
              <span className='text-purple-700'>{pesos(total)}</span>
            </div>
            {error && <div className={msgError}>{error}</div>}
            {!enLinea && <div className={msgError}>📡 Sin conexión: no se puede emitir hasta que vuelva la señal.</div>}
            <div className='flex gap-3 flex-wrap'>
              <button
                className={btnPrimary}
                disabled={emitiendo || !enLinea || elegidos.size === 0 || total <= 0}
                onClick={() => {
                  void emitir()
                }}
              >
                {emitiendo ? 'Emitiendo...' : 'Emitir orden de pago'}
              </button>
              <button className={btnSecondary} onClick={onClose}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
