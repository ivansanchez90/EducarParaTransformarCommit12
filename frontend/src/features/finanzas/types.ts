/** Tipos de las facturas y los pagos que ve la familia en el portal. */

export type EstadoFactura = 'Pendiente' | 'Pago parcial' | 'Pagada' | 'Vencida'

export interface ItemFactura {
  id_item: number
  concepto: string
  descripcion: string
  importe: number
  saldo: number
}

export interface ComprobanteFactura {
  id_comprobante: number
  estado: 'En revisión' | 'Aprobado' | 'Rechazado'
  importe: number
  fecha_transferencia: string
  motivo_rechazo: string | null
}

export interface FacturaPortal {
  id_factura: number
  anio: number
  mes: number
  numero: number
  fecha_emision: string
  fecha_vencimiento: string
  total: number
  saldo: number
  estado: EstadoFactura
  items: ItemFactura[]
  comprobantes: ComprobanteFactura[]
}

export interface PagoPortal {
  id_pago: number
  fecha_pago: string | null
  monto_pagado: number
  metodo_pago: string | null
  nro_comprobante: string | null
  /** Vacía en los pagos que la administración registró sobre una cuota anterior a las facturas. */
  factura: { id_factura: number; numero: number; anio: number; mes: number } | null
  periodo: { anio: number; mes: number } | null
}
