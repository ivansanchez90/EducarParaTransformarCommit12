/**
 * FacturasAlumno — facturas de un alumno con su estado, el detalle de lo que se
 * cobra y la descarga del PDF. Muestra primero lo que tiene saldo.
 */
import { useState } from 'react'
import { descargar } from '../../lib/api'
import { Badge } from '../../ui/components'
import { btnPrimarySm, btnSecondarySm, msgError } from '../../ui/styles'
import { ESTADO_FACTURA_COLOR, fechaCorta, nombrePeriodo, numeroFactura, pesos } from './formato'
import { OrdenPagoDialog } from './OrdenPagoDialog'
import type { ComprobanteFactura, FacturaPortal } from './types'

const COLOR_COMPROBANTE: Record<ComprobanteFactura['estado'], string> = {
  'En revisión': '#E67E22',
  Aprobado: '#27AE60',
  Rechazado: '#E74C3C',
}

function Dato({ titulo, valor, destacado }: { titulo: string; valor: string; destacado?: boolean }) {
  return (
    <div>
      <div className='text-[11px] font-bold text-textMuted uppercase tracking-[0.04em]'>{titulo}</div>
      <div className={destacado ? 'text-[15px] font-black text-purple-700' : 'text-[14px] font-bold text-text'}>{valor}</div>
    </div>
  )
}

function TarjetaFactura({ factura }: { factura: FacturaPortal }) {
  const [mensaje, setMensaje] = useState('')
  const [pagando, setPagando] = useState(false)

  const bajarPdf = async () => {
    setMensaje('')
    const error = await descargar(`/facturas/${factura.id_factura}/pdf`)
    if (error) setMensaje(error.message)
  }

  return (
    <div className='border border-border rounded-[12px] p-4 flex flex-col gap-3'>
      <div className='flex justify-between items-start gap-2 flex-wrap'>
        <div>
          <div className='text-[15px] font-black'>{nombrePeriodo(factura.anio, factura.mes)}</div>
          <div className='text-[12px] text-textMuted'>Factura N.º {numeroFactura(factura.numero)}</div>
        </div>
        <Badge color={ESTADO_FACTURA_COLOR[factura.estado]}>{factura.estado}</Badge>
      </div>

      <div className='grid grid-cols-3 gap-3'>
        <Dato titulo='Vence' valor={fechaCorta(factura.fecha_vencimiento)} />
        <Dato titulo='Total' valor={pesos(factura.total)} />
        <Dato titulo='Saldo' valor={pesos(factura.saldo)} destacado={factura.saldo > 0} />
      </div>

      <details>
        <summary className='cursor-pointer text-[13px] font-bold text-purple-700 min-h-11 flex items-center'>
          Ver detalle
        </summary>
        <ul className='list-none m-0 p-0 flex flex-col gap-2 mt-1'>
          {factura.items.map((item) => (
            <li key={item.id_item} className='flex justify-between gap-3 text-[13px]'>
              <span className='text-text'>{item.descripcion}</span>
              <span className='font-bold whitespace-nowrap'>{pesos(item.importe)}</span>
            </li>
          ))}
        </ul>
        {factura.comprobantes.length > 0 && (
          <div className='mt-3 flex flex-col gap-1.5'>
            <div className='text-[11px] font-bold text-textMuted uppercase tracking-[0.04em]'>Comprobantes de transferencia</div>
            {factura.comprobantes.map((c) => (
              <div key={c.id_comprobante} className='text-[13px] flex items-center gap-2 flex-wrap'>
                <Badge color={COLOR_COMPROBANTE[c.estado]}>{c.estado}</Badge>
                <span>
                  {pesos(c.importe)} · {fechaCorta(c.fecha_transferencia)}
                </span>
                {c.motivo_rechazo && <span className='text-red'>{c.motivo_rechazo}</span>}
              </div>
            ))}
          </div>
        )}
      </details>

      <div className='flex items-center gap-3 flex-wrap'>
        {factura.saldo > 0 && (
          <button
            className={btnPrimarySm}
            onClick={() => {
              setPagando(true)
            }}
          >
            Pagar por transferencia
          </button>
        )}
        <button
          className={btnSecondarySm}
          onClick={() => {
            void bajarPdf()
          }}
        >
          Descargar factura (PDF)
        </button>
        {mensaje && <span className={msgError}>{mensaje}</span>}
      </div>
      {pagando && (
        <OrdenPagoDialog
          factura={factura}
          onClose={() => {
            setPagando(false)
          }}
        />
      )}
    </div>
  )
}

export function FacturasAlumno({ facturas }: { facturas: FacturaPortal[] }) {
  const [verPagadas, setVerPagadas] = useState(false)
  const conSaldo = facturas.filter((f) => f.estado !== 'Pagada')
  const pagadas = facturas.filter((f) => f.estado === 'Pagada')
  const hayVencidas = conSaldo.some((f) => f.estado === 'Vencida')
  const deuda = conSaldo.reduce((suma, f) => suma + f.saldo, 0)

  return (
    <div className='flex flex-col gap-4'>
      {conSaldo.length === 0 ? (
        <div className='flex flex-col items-center justify-center py-8 text-textMuted text-[13px] gap-2.5'>
          <span className='text-[44px]'>✅</span>
          <span className='text-green font-extrabold text-[15px]'>
            {facturas.length === 0 ? 'Todavía no hay facturas emitidas.' : '¡Estás al día con todas tus facturas!'}
          </span>
        </div>
      ) : (
        <div
          className={`rounded-[12px] px-4 py-3 text-[13px] font-bold border ${
            hayVencidas ? 'bg-red/[0.06] border-red/[0.19] text-red' : 'bg-[#E67E2214] border-[#E67E2240] text-[#B9651A]'
          }`}
        >
          {hayVencidas ? '⚠️ ' : ''}Tenés {conSaldo.length} factura{conSaldo.length > 1 ? 's' : ''} con saldo por {pesos(deuda)}
          {hayVencidas ? '. Regularizá tu situación para evitar recargos.' : '.'}
        </div>
      )}

      {conSaldo.map((f) => (
        <TarjetaFactura key={f.id_factura} factura={f} />
      ))}

      {pagadas.length > 0 && (
        <>
          <button
            className='self-start bg-transparent border-0 p-0 min-h-11 text-[13px] font-bold text-purple-700 cursor-pointer font-[inherit]'
            onClick={() => setVerPagadas((v) => !v)}
          >
            {verPagadas ? 'Ocultar facturas pagadas' : `Ver facturas pagadas (${pagadas.length})`}
          </button>
          {verPagadas && pagadas.map((f) => <TarjetaFactura key={f.id_factura} factura={f} />)}
        </>
      )}
    </div>
  )
}
