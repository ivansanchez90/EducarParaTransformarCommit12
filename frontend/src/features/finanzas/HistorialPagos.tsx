/** HistorialPagos — pagos aprobados de un alumno, del más reciente al más antiguo. */
import { ResponsiveTable } from '../../ui/components'
import type { Columna } from '../../ui/components'
import { fechaCorta, nombrePeriodo, pesos } from './formato'
import type { PagoPortal } from './types'

const COLUMNAS: Columna<PagoPortal>[] = [
  {
    key: 'fecha',
    header: 'Fecha',
    movil: 'titulo',
    render: (p) => (p.fecha_pago ? fechaCorta(p.fecha_pago) : '—'),
  },
  {
    key: 'periodo',
    header: 'Período',
    className: 'text-textMuted',
    render: (p) => (p.periodo ? nombrePeriodo(p.periodo.anio, p.periodo.mes) : '—'),
  },
  {
    key: 'monto',
    header: 'Monto',
    className: 'font-black text-purple-700',
    render: (p) => pesos(p.monto_pagado),
  },
  {
    key: 'metodo',
    header: 'Método',
    className: 'text-textMuted',
    movil: 'pie',
    render: (p) => p.metodo_pago ?? '—',
  },
]

export function HistorialPagos({ pagos }: { pagos: PagoPortal[] }) {
  return (
    <ResponsiveTable
      columnas={COLUMNAS}
      filas={pagos}
      filaKey={(p) => p.id_pago}
      vacio='Todavía no hay pagos registrados.'
    />
  )
}
