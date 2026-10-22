/** HistorialCambios — auditoría de la ficha y las atenciones de un alumno: quién cambió qué y cuándo. */
import { Badge } from '../../ui/components'
import { msgError } from '../../ui/styles'
import { useConsulta } from '../../lib/useConsulta'
import { fechaHora, valorAuditado } from './formato'
import { ETIQUETAS_FICHA } from './types'
import type { RegistroAuditoria } from './types'

export function HistorialCambios({ idAlumno, version }: { idAlumno: number; version: number }) {
  const { datos, cargando, error } = useConsulta<RegistroAuditoria[]>(`/salud/alumnos/${idAlumno}/auditoria?v=${version}`)

  if (cargando) return <p className='text-[13px] text-textMuted m-0'>Cargando…</p>
  if (error) return <div className={msgError}>{error}</div>
  if (!datos || datos.length === 0) return <p className='text-[13px] text-textMuted m-0'>Todavía no hay cambios registrados.</p>

  return (
    <div className='flex flex-col gap-3'>
      {datos.map((r) => (
        <div key={r.id_auditoria} className='border border-border rounded-[12px] p-4 flex flex-col gap-1.5'>
          <div className='flex justify-between items-start gap-2 flex-wrap'>
            <div className='text-[14px] font-black'>
              {r.accion} · {r.entidad}
            </div>
            <Badge color={r.accion === 'Alta' ? '#27AE60' : '#E67E22'}>{r.accion}</Badge>
          </div>
          <div className='text-[12px] text-textMuted'>
            {fechaHora(r.fecha_hora)} · {r.usuario ?? 'Usuario eliminado'}
            {r.rol ? ` (${r.rol})` : ''}
          </div>
          <ul className='list-none m-0 p-0 flex flex-col gap-1'>
            {Object.entries(r.cambios ?? {}).map(([campo, { antes, despues }]) => (
              <li key={campo} className='text-[13px]'>
                <strong>{ETIQUETAS_FICHA.get(campo) ?? campo}:</strong> {valorAuditado(antes)} → {valorAuditado(despues)}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
