/**
 * DeudaAlumno — lo que debe un alumno, por período y por ítem: cada factura con saldo y,
 * de cada una, los ítems que todavía deben algo. Una beca pendiente baja el total.
 */
import { Badge } from '../../ui/components'
import { ESTADO_FACTURA_COLOR, fechaCorta, nombrePeriodo, numeroFactura, pesos } from './formato'
import type { DeudaAlumno as Deuda } from './types'

export function DeudaAlumno({ deuda }: { deuda: Deuda }) {
  if (deuda.facturas.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center py-8 text-textMuted text-[13px] gap-2.5'>
        <span className='text-[44px]'>✅</span>
        <span className='text-green font-extrabold text-[15px]'>¡No tenés deuda!</span>
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-4'>
      <div className='rounded-[12px] px-4 py-3 border bg-red/[0.06] border-red/[0.19]'>
        <div className='text-[11px] font-bold text-textMuted uppercase tracking-[0.04em]'>Deuda total</div>
        <div className='text-[24px] font-black text-red'>{pesos(deuda.total)}</div>
      </div>

      {deuda.facturas.map((f) => (
        <div key={f.id_factura} className='border border-border rounded-[12px] p-4 flex flex-col gap-3'>
          <div className='flex justify-between items-start gap-2 flex-wrap'>
            <div>
              <div className='text-[15px] font-black'>{nombrePeriodo(f.anio, f.mes)}</div>
              <div className='text-[12px] text-textMuted'>
                Factura N.º {numeroFactura(f.numero)} · vence {fechaCorta(f.fecha_vencimiento)}
              </div>
            </div>
            <Badge color={ESTADO_FACTURA_COLOR[f.estado]}>{f.estado}</Badge>
          </div>

          <ul className='list-none m-0 p-0 flex flex-col gap-2'>
            {f.items.map((item) => (
              <li key={item.id_item} className='flex justify-between gap-3 text-[13px]'>
                <span className='text-text'>{item.descripcion}</span>
                <span className={`font-bold whitespace-nowrap ${item.saldo < 0 ? 'text-green' : ''}`}>{pesos(item.saldo)}</span>
              </li>
            ))}
          </ul>

          <div className='flex justify-between text-[14px] font-black border-t border-border pt-2'>
            <span>Saldo del período</span>
            <span className='text-purple-700'>{pesos(f.saldo)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
