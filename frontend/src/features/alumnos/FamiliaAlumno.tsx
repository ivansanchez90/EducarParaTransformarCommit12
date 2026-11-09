/**
 * FamiliaAlumno — tarjeta "Familia" del legajo: el padre/tutor vinculado (para
 * contactarlo) y los hermanos, que son los otros alumnos del mismo tutor. La ven la
 * administración, la dirección y los docentes (`GET /alumnos/:id/familia`).
 */
import { useConsulta } from '../../lib/useConsulta'
import { card } from '../../ui/styles'

interface Familia {
  tutor: {
    id_usuario: string
    nombre: string
    apellido: string
    email: string
    telefono: string | null
    activo: boolean
  } | null
  hermanos: {
    id_alumno: number
    nombre: string
    apellido: string
    activo: boolean
    cursos: { nivel: string; grado_anio: string; division: string } | null
  }[]
}

const etiqueta = 'text-[11px] font-extrabold text-textMuted block mb-[2px]'
const enlace = 'text-[14px] font-bold text-purple-700 break-all no-underline hover:underline'

export function FamiliaAlumno({
  idAlumno,
  onAbrirLegajo,
}: {
  idAlumno: number
  /** Abre el legajo de un hermano; sin esta función los hermanos se listan sin enlace. */
  onAbrirLegajo?: (idAlumno: number) => void
}) {
  const { datos, error, cargando } = useConsulta<Familia>(`/alumnos/${idAlumno}/familia`)

  return (
    <section aria-labelledby='legajo-familia' className={`${card} mb-5`}>
      <h3 id='legajo-familia' className='text-[15px] font-extrabold text-text mt-0 mb-4'>
        👨‍👩‍👧 Familia
      </h3>

      {cargando && <div className='text-[13px] text-textMuted'>Cargando...</div>}
      {error && <div className='text-[13px] text-red'>No se pudo cargar la familia: {error}</div>}

      {datos && !datos.tutor && (
        <div className='text-[13px] text-textMuted'>
          No tiene padre/tutor vinculado. La administración lo vincula desde <strong>Alumnos → Editar</strong>, con
          el email del tutor.
        </div>
      )}

      {datos?.tutor && (
        <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-[18px]'>
          <div>
            <span className={etiqueta}>Padre/tutor</span>
            <div className='text-[14px] font-bold'>
              {`${datos.tutor.apellido}, ${datos.tutor.nombre}`.replace(/^, |, $/, '') || '—'}
              {!datos.tutor.activo && <span className='ml-2 text-[11px] font-extrabold text-red'>(usuario inactivo)</span>}
            </div>
          </div>
          <div>
            <span className={etiqueta}>Email</span>
            <a className={enlace} href={`mailto:${datos.tutor.email}`}>
              {datos.tutor.email}
            </a>
          </div>
          <div>
            <span className={etiqueta}>Teléfono</span>
            {datos.tutor.telefono ? (
              <a className={enlace} href={`tel:${datos.tutor.telefono.replace(/[^\d+]/g, '')}`}>
                {datos.tutor.telefono}
              </a>
            ) : (
              <div className='text-[14px] text-textMuted'>Sin cargar</div>
            )}
          </div>
        </div>
      )}

      {datos?.tutor && (
        <div className='mt-5'>
          <span className={etiqueta}>Hermanos en la institución</span>
          {datos.hermanos.length === 0 ? (
            <div className='text-[13px] text-textMuted'>No tiene otros hijos vinculados al mismo tutor.</div>
          ) : (
            <ul className='m-0 p-0 list-none flex flex-col gap-1'>
              {datos.hermanos.map((h) => {
                const curso = h.cursos ? `${h.cursos.nivel} — ${h.cursos.grado_anio} "${h.cursos.division}"` : 'Sin curso'
                const nombre = `${h.apellido}, ${h.nombre}`
                return (
                  <li key={h.id_alumno} className='text-[14px]'>
                    {onAbrirLegajo ? (
                      <button
                        type='button'
                        className='bg-transparent border-0 p-0 min-h-11 text-[14px] font-bold text-purple-700 cursor-pointer text-left hover:underline'
                        onClick={() => onAbrirLegajo(h.id_alumno)}
                      >
                        {nombre}
                      </button>
                    ) : (
                      <span className='font-bold'>{nombre}</span>
                    )}
                    <span className='text-textMuted'>
                      {' '}
                      · {curso}
                      {!h.activo && ' · inactivo'}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
