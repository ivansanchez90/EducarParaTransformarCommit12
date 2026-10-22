/** FichaSalud — ficha de un alumno para enfermería y administración: ficha médica, atenciones y cambios. */
import { useState } from 'react'
import { btnSecondarySm, msgError } from '../../ui/styles'
import { AtencionesSalud } from './AtencionesSalud'
import { FormularioFicha } from './FormularioFicha'
import { HistorialCambios } from './HistorialCambios'
import { fechaCorta, nombreCurso } from './formato'
import { useSalud } from './useSalud'

type Pestana = 'ficha' | 'atenciones' | 'cambios'

const PESTANAS: { clave: Pestana; texto: string }[] = [
  { clave: 'ficha', texto: 'Ficha médica' },
  { clave: 'atenciones', texto: 'Atenciones' },
  { clave: 'cambios', texto: 'Historial de cambios' },
]

export function FichaSalud({ idAlumno, onVolver }: { idAlumno: number; onVolver: () => void }) {
  const salud = useSalud(idAlumno)
  const [pestana, setPestana] = useState<Pestana>('ficha')
  const { ficha, atenciones, cargando, error, guardando, version } = salud
  const alumno = ficha?.alumno

  return (
    <div>
      <div className='mb-4'>
        <button className={btnSecondarySm} onClick={onVolver}>
          ← Volver a la lista
        </button>
      </div>

      {alumno ? (
        <div className='mb-5'>
          <div className='text-[18px] font-black text-text'>
            {alumno.apellido}, {alumno.nombre}
          </div>
          <div className='text-[12px] text-textMuted'>
            DNI {alumno.dni} · {nombreCurso(alumno.cursos)} · nació el {fechaCorta(alumno.fecha_nacimiento)}
          </div>
          <div className='text-[12px] text-textMuted mt-1'>
            Obra social: {alumno.obra_social ?? '—'}
            {alumno.nro_obra_social ? ` (${alumno.nro_obra_social})` : ''} · Emergencia: {alumno.nombre_contacto_emergencia ?? '—'} {alumno.telefono_emergencia ?? ''}
          </div>
        </div>
      ) : (
        !cargando && error && <div className={`${msgError} mb-4`}>{error}</div>
      )}

      <div className='flex gap-2 mb-5 flex-wrap'>
        {PESTANAS.map(({ clave, texto }) => (
          <button
            key={clave}
            className={`min-h-11 px-4 rounded-btn border text-[13px] font-bold cursor-pointer font-[inherit] ${
              pestana === clave ? 'bg-purple-700 border-purple-700 text-white' : 'bg-transparent border-border text-textMuted'
            }`}
            onClick={() => {
              setPestana(clave)
            }}
          >
            {texto}
          </button>
        ))}
      </div>

      {cargando && !ficha ? (
        <p className='text-[13px] text-textMuted m-0'>Cargando…</p>
      ) : pestana === 'ficha' && ficha ? (
        // La `key` vuelve a armar el formulario con los datos nuevos después de cada guardado.
        <FormularioFicha key={ficha.ficha?.updated_at ?? 'nueva'} ficha={ficha.ficha} guardando={guardando} error={error} onGuardar={salud.guardarFicha} />
      ) : pestana === 'atenciones' ? (
        <AtencionesSalud atenciones={atenciones} guardando={guardando} error={error} onRegistrar={salud.registrarAtencion} onCorregir={salud.corregirAtencion} />
      ) : pestana === 'cambios' ? (
        <HistorialCambios idAlumno={idAlumno} version={version} />
      ) : null}
    </div>
  )
}
