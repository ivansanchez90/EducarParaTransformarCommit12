/**
 * AvisoAptitudDeportes — en Extracurriculares, el estado del certificado de aptitud física
 * del hijo antes de inscribirlo a un deporte (el backend lo exige). Así la familia sabe qué
 * hacer antes de tocar "Inscribirme", en vez de enterarse por el error. Solo para el tutor:
 * el propio alumno no ve los datos de salud.
 */
import { useConsulta } from '../../lib/useConsulta'
import { BadgeAptitud } from './BadgeAptitud'
import type { AptitudDelAlumno } from './types'

export function AvisoAptitudDeportes({ idAlumno }: { idAlumno: number }) {
  const { datos } = useConsulta<AptitudDelAlumno>(`/salud/alumnos/${idAlumno}/aptitud`)
  if (!datos) return null
  const { aptitud } = datos
  const vigente = aptitud.estado === 'Vigente'

  return (
    <div
      className='rounded-[8px] border px-3.5 py-2.5 text-xs mb-3 flex flex-col gap-1.5'
      style={{
        background: vigente ? '#27AE6012' : '#E67E2214',
        borderColor: vigente ? '#27AE6040' : '#E67E2240',
      }}
    >
      <div className='flex items-center gap-2 flex-wrap font-bold text-text'>
        Certificado de aptitud física: <BadgeAptitud aptitud={aptitud} />
      </div>
      {!vigente && (
        <div className='text-text'>
          Para inscribirlo a un deporte hace falta el certificado vigente. Presentalo en enfermería; los idiomas no lo
          piden.
        </div>
      )}
      {vigente && aptitud.por_vencer && <div className='text-text'>Vence pronto: renovalo en enfermería.</div>}
    </div>
  )
}
