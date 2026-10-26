/** ResumenSalud — para docentes (y administración): alergias críticas y contacto de emergencia del alumno. */
import { useConsulta } from '../../lib/useConsulta'
import { BadgeAptitud } from './BadgeAptitud'
import type { ResumenDeSalud } from './types'

export function ResumenSalud({ idAlumno }: { idAlumno: number }) {
  const { datos, cargando } = useConsulta<ResumenDeSalud>(`/salud/alumnos/${idAlumno}/resumen`)
  // Si la consulta falla (por ejemplo, un rol sin permiso) no se muestra nada: no es un error del legajo.
  if (cargando || !datos) return null

  const hayAlergias = Boolean(datos.alergias_criticas)
  return (
    <div className={`rounded-[12px] border p-4 mb-5 ${hayAlergias ? 'border-red/30 bg-red/[0.06]' : 'border-border bg-white'}`}>
      <div className='text-[13px] font-extrabold text-text mb-2'>🩺 Salud (resumen)</div>
      <div className='text-[13px]'>
        <strong>Alergias críticas:</strong>{' '}
        {hayAlergias ? <span className='font-bold text-red'>{datos.alergias_criticas}</span> : datos.ficha_cargada ? 'Ninguna registrada' : 'Sin ficha médica cargada'}
      </div>
      <div className='text-[13px] mt-1 flex items-center gap-2 flex-wrap'>
        <strong>Aptitud física:</strong> <BadgeAptitud aptitud={datos.aptitud_fisica} />
      </div>
      <div className='text-[13px] mt-1'>
        <strong>Contacto de emergencia:</strong> {datos.nombre_contacto_emergencia ?? '—'} {datos.telefono_emergencia ? `· ${datos.telefono_emergencia}` : ''}
      </div>
    </div>
  )
}
