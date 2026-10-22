/** SaludHijo — lo que ve la familia: la ficha médica y las atenciones de su hijo, solo para leer. */
import { useConsulta } from '../../lib/useConsulta'
import { msgError } from '../../ui/styles'
import { TarjetaAtencion } from './AtencionesSalud'
import { fechaHora } from './formato'
import type { Atencion, FichaDelAlumno, FichaMedica } from './types'

/** Lo que se muestra de la ficha, en este orden. */
const filasDeLaFicha = (f: FichaMedica): [string, string | null][] => [
  ['Grupo sanguíneo', f.grupo_sanguineo],
  ['Alergias críticas', f.alergias_criticas],
  ['Otras alergias', f.alergias],
  ['Medicación', f.medicacion],
  ['Condiciones', f.condiciones],
  ['Observaciones', f.observaciones],
]

export function SaludHijo({ idAlumno }: { idAlumno: number }) {
  const ficha = useConsulta<FichaDelAlumno>(`/salud/alumnos/${idAlumno}/ficha`)
  const atenciones = useConsulta<Atencion[]>(`/salud/alumnos/${idAlumno}/atenciones`)
  const error = ficha.error || atenciones.error

  return (
    <div className='bg-white rounded-card p-6 shadow-card border border-border'>
      <div className='text-[15px] font-extrabold text-text mb-4 flex items-center gap-2'>🩺 Salud</div>
      {error && <div className={`${msgError} mb-4`}>⚠️ {error}</div>}
      {ficha.cargando || atenciones.cargando ? (
        <p className='text-[13px] text-textMuted m-0'>Cargando…</p>
      ) : (
        <div className='flex flex-col gap-6'>
          <section>
            <div className='text-xs font-black text-purple-700 uppercase tracking-[0.08em] mb-3'>Ficha médica</div>
            {ficha.datos?.ficha ? (
              <>
                <dl className='m-0 grid grid-cols-1 sm:grid-cols-2 gap-3'>
                  {filasDeLaFicha(ficha.datos.ficha).map(([etiqueta, valor]) => (
                    <div key={etiqueta}>
                      <dt className='text-[11px] font-bold text-textMuted uppercase tracking-[0.04em]'>{etiqueta}</dt>
                      <dd className='m-0 text-[14px] text-text'>{valor ?? '—'}</dd>
                    </div>
                  ))}
                </dl>
                <div className='text-[11px] text-textMuted mt-3'>Actualizada el {fechaHora(ficha.datos.ficha.updated_at)}. Para cambiar algo, hablá con enfermería.</div>
              </>
            ) : (
              <p className='text-[13px] text-textMuted m-0'>Todavía no hay una ficha médica cargada. Enfermería la completa con tus datos.</p>
            )}
          </section>

          <section>
            <div className='text-xs font-black text-purple-700 uppercase tracking-[0.08em] mb-3'>Atenciones de enfermería</div>
            {(atenciones.datos ?? []).length === 0 ? (
              <p className='text-[13px] text-textMuted m-0'>No hay atenciones registradas.</p>
            ) : (
              <div className='flex flex-col gap-3'>
                {(atenciones.datos ?? []).map((a) => (
                  <TarjetaAtencion key={a.id_atencion} atencion={a} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
