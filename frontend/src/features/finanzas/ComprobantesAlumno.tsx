/** ComprobantesAlumno — las transferencias que subió la familia, con su estado y la factura que pagan. */
import { Badge } from '../../ui/components'
import { fechaCorta, nombrePeriodo, numeroFactura, pesos } from './formato'
import type { ComprobanteListado } from './types'

const COLOR_ESTADO: Record<ComprobanteListado['estado'], string> = {
  'En revisión': '#E67E22',
  Aprobado: '#27AE60',
  Rechazado: '#E74C3C',
}

export function ComprobantesAlumno({ comprobantes, filtrado }: { comprobantes: ComprobanteListado[]; filtrado: boolean }) {
  if (comprobantes.length === 0) {
    return (
      <p className='text-[13px] text-textMuted m-0'>
        {filtrado ? 'No hay comprobantes con transferencias en ese período.' : 'Todavía no subiste ningún comprobante.'}
      </p>
    )
  }

  return (
    <div className='flex flex-col gap-3'>
      {comprobantes.map((c) => (
        <div key={c.id_comprobante} className='border border-border rounded-[12px] p-4 flex flex-col gap-1.5'>
          <div className='flex justify-between items-start gap-2 flex-wrap'>
            <div className='text-[15px] font-black'>{pesos(c.importe)}</div>
            <Badge color={COLOR_ESTADO[c.estado]}>{c.estado}</Badge>
          </div>
          <div className='text-[13px] text-text'>Transferencia del {fechaCorta(c.fecha_transferencia)}</div>
          <div className='text-[12px] text-textMuted'>
            {nombrePeriodo(c.factura.anio, c.factura.mes)} · Factura N.º {numeroFactura(c.factura.numero)}
            {c.orden ? ` · Orden N.º ${numeroFactura(c.orden.numero)}` : ''}
          </div>
          {c.motivo_rechazo && <div className='text-[13px] text-red'>{c.motivo_rechazo}</div>}
        </div>
      ))}
    </div>
  )
}
