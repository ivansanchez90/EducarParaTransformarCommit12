/** BadgeAptitud — el estado del certificado de aptitud física de un alumno, en una etiqueta de color. */
import { Badge } from '../../ui/components'
import { fechaCorta } from './formato'
import type { Aptitud } from './types'

/** Texto y color de cada situación; "por vencer" avisa antes de que deje de servir. */
function descripcion(a: Pick<Aptitud, 'estado' | 'vigente_hasta'> & Partial<Pick<Aptitud, 'por_vencer'>>): { texto: string; color: string } {
  const hasta = a.vigente_hasta ? fechaCorta(a.vigente_hasta) : ''
  if (a.estado === 'Vigente') return a.por_vencer ? { texto: `Por vencer el ${hasta}`, color: '#E67E22' } : { texto: `Vigente hasta el ${hasta}`, color: '#27AE60' }
  if (a.estado === 'Vencido') return { texto: `Vencido el ${hasta}`, color: '#E74C3C' }
  return { texto: 'Sin certificado', color: '#6B6B8A' }
}

export function BadgeAptitud({ aptitud }: { aptitud: Pick<Aptitud, 'estado' | 'vigente_hasta'> & Partial<Pick<Aptitud, 'por_vencer'>> }) {
  const { texto, color } = descripcion(aptitud)
  return <Badge color={color}>{texto}</Badge>
}
