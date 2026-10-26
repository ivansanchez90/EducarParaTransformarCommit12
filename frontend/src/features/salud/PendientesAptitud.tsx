/**
 * PendientesAptitud — alumnos ya inscriptos a un deporte que no tienen el certificado de aptitud vigente.
 * No se los da de baja: enfermería los regulariza con esta lista.
 */
import { useConsulta } from '../../lib/useConsulta'
import { msgError } from '../../ui/styles'
import { BadgeAptitud } from './BadgeAptitud'
import { nombreCurso } from './formato'
import type { AlumnoPendiente } from './types'

export function PendientesAptitud({ onAbrir }: { onAbrir: (idAlumno: number) => void }) {
  const { datos, cargando, error } = useConsulta<AlumnoPendiente[]>('/salud/aptitud/pendientes')

  if (cargando) return <p className='text-[13px] text-textMuted m-0'>Cargando…</p>
  if (error) return <div className={msgError}>{error}</div>
  if (!datos || datos.length === 0) return <p className='text-[13px] text-green font-bold m-0'>✅ Todos los alumnos inscriptos a un deporte tienen el certificado vigente.</p>

  return (
    <div className='flex flex-col gap-3'>
      <p className='text-[13px] text-textMuted m-0'>Están inscriptos a un deporte sin certificado de aptitud física vigente. Abrí su ficha para cargarlo.</p>
      {datos.map((a) => (
        <button
          key={a.id_alumno}
          onClick={() => {
            onAbrir(a.id_alumno)
          }}
          className='text-left border border-border rounded-[12px] p-4 bg-white cursor-pointer font-[inherit] flex flex-col gap-1.5 min-h-11'
        >
          <div className='flex justify-between items-start gap-2 flex-wrap'>
            <div className='text-[15px] font-black text-text'>
              {a.apellido}, {a.nombre}
            </div>
            <BadgeAptitud aptitud={a} />
          </div>
          <div className='text-[12px] text-textMuted'>
            DNI {a.dni} · {nombreCurso(a.cursos)} · {a.deportes.join(', ')}
          </div>
        </button>
      ))}
    </div>
  )
}
