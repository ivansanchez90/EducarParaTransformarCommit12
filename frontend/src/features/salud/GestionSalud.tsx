/**
 * GestionSalud — sección "Salud y enfermería" del panel. Enfermería y administración buscan un
 * alumno, abren su ficha médica y registran las atenciones; cada cambio queda auditado.
 */
import { useState } from 'react'
import type { FormEvent } from 'react'
import { qs } from '../../lib/api'
import { useConsulta } from '../../lib/useConsulta'
import { Badge } from '../../ui/components'
import { btnPrimary, inputField, msgError } from '../../ui/styles'
import { FichaSalud } from './FichaSalud'
import { fechaHora, nombreCurso } from './formato'
import type { AlumnoSalud } from './types'

export function GestionSalud() {
  const [texto, setTexto] = useState('')
  const [buscar, setBuscar] = useState('')
  const [abierto, setAbierto] = useState<number | null>(null)
  const { datos, cargando, error } = useConsulta<AlumnoSalud[]>(`/salud/alumnos${qs({ buscar })}`)

  if (abierto !== null) {
    return (
      <FichaSalud
        idAlumno={abierto}
        onVolver={() => {
          setAbierto(null)
        }}
      />
    )
  }

  const buscarAlumno = (e: FormEvent) => {
    e.preventDefault()
    setBuscar(texto.trim())
  }

  return (
    <div>
      <h2 className='text-[22px] font-black m-0 mb-5'>🩺 Salud y enfermería</h2>
      <form onSubmit={buscarAlumno} className='flex gap-3 mb-5 flex-wrap'>
        <input
          className={`${inputField} flex-1 min-w-[220px]`}
          placeholder='Buscar por nombre, apellido o DNI'
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value)
          }}
        />
        <button type='submit' className={btnPrimary}>
          Buscar
        </button>
      </form>

      {error && <div className={`${msgError} mb-4`}>{error}</div>}
      {cargando ? (
        <p className='text-[13px] text-textMuted m-0'>Cargando…</p>
      ) : !datos || datos.length === 0 ? (
        <p className='text-[13px] text-textMuted m-0'>No hay alumnos que coincidan con la búsqueda.</p>
      ) : (
        <div className='flex flex-col gap-3'>
          {datos.map((a) => (
            <button
              key={a.id_alumno}
              onClick={() => {
                setAbierto(a.id_alumno)
              }}
              className='text-left border border-border rounded-[12px] p-4 bg-white cursor-pointer font-[inherit] flex flex-col gap-1.5 min-h-11'
            >
              <div className='flex justify-between items-start gap-2 flex-wrap'>
                <div className='text-[15px] font-black text-text'>
                  {a.apellido}, {a.nombre}
                </div>
                <div className='flex gap-2 flex-wrap'>
                  {a.tiene_alergias_criticas && <Badge color='#E74C3C'>Alergias críticas</Badge>}
                  <Badge color={a.tiene_ficha ? '#27AE60' : '#6B6B8A'}>{a.tiene_ficha ? 'Con ficha' : 'Sin ficha'}</Badge>
                </div>
              </div>
              <div className='text-[12px] text-textMuted'>
                DNI {a.dni} · {nombreCurso(a.cursos)}
                {a.ultima_atencion ? ` · última atención: ${fechaHora(a.ultima_atencion)}` : ''}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
