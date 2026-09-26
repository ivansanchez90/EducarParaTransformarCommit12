/**
 * CargarCalificaciones — Carga y listado de notas por clase (rol Docente).
 * Extraído verbatim de AdminPanel.tsx (sin cambios de lógica).
 *
 * En el celular (PWA-T6) el formulario va en una columna (dos en tablet) y las
 * notas cargadas se ven como tarjetas (`ResponsiveTable`).
 */
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../../lib/api'
import type { Asignacion, Calificacion } from '../../types'
import { card, selectField, inputField, fieldLabel, btnPrimary, touchTarget } from '../../ui/styles'
import { ResponsiveTable, type Columna } from '../../ui/components'

export function CargarCalificaciones() {
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [selAsignacion, setSelAsig] = useState<number | null>(null)
  const [calificaciones, setCals] = useState<Calificacion[]>([])
  const [alumnos, setAlumnos] = useState<
    { id_alumno: number; nombre: string; apellido: string }[]
  >([])
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({
    id_alumno: '',
    trimestre: '1',
    tipo_evaluacion: 'Parcial',
    nota: '',
    descripcion: '',
  })

  useEffect(() => {
    api.get<Asignacion[]>('/asignaciones/mias').then(({ data }) => {
      if (data) setAsignaciones(data)
    })
  }, [])

  const loadCalificaciones = useCallback(async (idAsignacion: number) => {
    const { data } = await api.get<Calificacion[]>(
      `/calificaciones?id_asignacion=${idAsignacion}`,
    )
    if (data) setCals(data)
  }, [])

  useEffect(() => {
    if (!selAsignacion) return
    api
      .get<typeof alumnos>(`/asignaciones/${selAsignacion}/alumnos`)
      .then(({ data: al }) => {
        if (al) setAlumnos(al)
      })
    loadCalificaciones(selAsignacion)
  }, [selAsignacion, loadCalificaciones])

  const handleCargar = async (e: FormEvent) => {
    e.preventDefault()
    setMsg('')
    // El backend asigna el período activo y notifica a la familia (R6).
    const { error } = await api.post('/calificaciones', {
      id_alumno: Number(form.id_alumno),
      id_asignacion: selAsignacion,
      trimestre: Number(form.trimestre),
      tipo_evaluacion: form.tipo_evaluacion,
      nota: Number(form.nota),
      descripcion: form.descripcion || null,
    })
    if (error) setMsg('Error: ' + error.message)
    else {
      setMsg('✅ Nota cargada y familia notificada.')
      setForm((p) => ({ ...p, id_alumno: '', nota: '', descripcion: '' }))
      if (selAsignacion) loadCalificaciones(selAsignacion)
    }
  }

  const notaColor = (n: number) =>
    n >= 8 ? '#27AE60' : n >= 6 ? '#E67E22' : '#E74C3C'

  const columnas: Columna<Calificacion>[] = [
    {
      key: 'alumno',
      header: 'Alumno',
      movil: 'titulo',
      className: 'font-bold',
      render: (c) => `${c.alumnos?.apellido}, ${c.alumnos?.nombre}`,
    },
    {
      key: 'tipo',
      header: 'Tipo',
      render: (c) => (
        <span className='inline-block bg-[#5B35C51A] text-purple-700 rounded-[20px] px-[10px] py-[3px] text-[11px] font-extrabold'>
          {c.tipo_evaluacion}
        </span>
      ),
    },
    {
      key: 'trimestre',
      header: 'Trimestre',
      className: 'text-textMuted',
      render: (c) => `T${c.trimestre}`,
    },
    {
      key: 'fecha',
      header: 'Fecha',
      className: 'text-textMuted',
      render: (c) => new Date(c.fecha_carga).toLocaleDateString('es-AR'),
    },
    {
      key: 'nota',
      header: 'Nota',
      render: (c) => (
        <div
          className='w-9 h-9 rounded-full flex items-center justify-center font-black text-sm'
          style={{ background: notaColor(c.nota) + '1A', color: notaColor(c.nota) }}
        >
          {c.nota}
        </div>
      ),
    },
  ]

  return (
    <div>
      <h2 className='text-[22px] font-black m-0 mb-5'>📝 Calificaciones</h2>

      <div className={`${card} mb-5`}>
        <label className={fieldLabel} htmlFor='cal-clase'>
          Clase / Materia
        </label>
        <select
          id='cal-clase'
          className={`${selectField} md:max-w-[360px]`}
          value={selAsignacion ?? ''}
          onChange={(e) => setSelAsig(Number(e.target.value))}
        >
          <option value=''>Seleccioná una clase...</option>
          {asignaciones.map((a) => (
            <option key={a.id_asignacion} value={a.id_asignacion}>
              {a.materias?.nombre} — {a.cursos?.nivel} {a.cursos?.grado_anio} "
              {a.cursos?.division}"
            </option>
          ))}
        </select>
      </div>

      {selAsignacion && (
        <>
          {/* Formulario */}
          <div className={`${card} mb-5`}>
            <div className='text-[15px] font-extrabold text-text mb-5'>
              Cargar nota
            </div>
            <form
              onSubmit={handleCargar}
              className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1fr] gap-[14px]'
            >
              <div className='sm:col-span-2 md:col-span-1'>
                <label className={fieldLabel} htmlFor='cal-alumno'>
                  Alumno
                </label>
                <select
                  id='cal-alumno'
                  className={selectField}
                  required
                  value={form.id_alumno}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, id_alumno: e.target.value }))
                  }
                >
                  <option value=''>Seleccioná...</option>
                  {alumnos.map((a) => (
                    <option key={a.id_alumno} value={a.id_alumno}>
                      {a.apellido}, {a.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={fieldLabel} htmlFor='cal-trimestre'>
                  Trimestre
                </label>
                <select
                  id='cal-trimestre'
                  className={selectField}
                  value={form.trimestre}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, trimestre: e.target.value }))
                  }
                >
                  <option value='1'>1º Trimestre</option>
                  <option value='2'>2º Trimestre</option>
                  <option value='3'>3º Trimestre</option>
                </select>
              </div>
              <div>
                <label className={fieldLabel} htmlFor='cal-tipo'>
                  Tipo
                </label>
                <select
                  id='cal-tipo'
                  className={selectField}
                  value={form.tipo_evaluacion}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, tipo_evaluacion: e.target.value }))
                  }
                >
                  <option>Parcial</option>
                  <option>Final</option>
                  <option>Trabajo Práctico</option>
                  <option>Oral</option>
                  <option>Recuperatorio</option>
                </select>
              </div>
              <div>
                <label className={fieldLabel} htmlFor='cal-nota'>
                  Nota (0–10)
                </label>
                <input
                  id='cal-nota'
                  type='number'
                  inputMode='decimal'
                  min='0'
                  max='10'
                  step='0.25'
                  required
                  className={inputField}
                  value={form.nota}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, nota: e.target.value }))
                  }
                />
              </div>
              <div className='col-span-full flex flex-col md:flex-row md:items-end gap-3'>
                <div className='flex-1'>
                  <label className={fieldLabel} htmlFor='cal-descripcion'>
                    Descripción (opcional)
                  </label>
                  <input
                    id='cal-descripcion'
                    className={inputField}
                    value={form.descripcion}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, descripcion: e.target.value }))
                    }
                    placeholder='Ej: Primer parcial unidad 1'
                  />
                </div>
                <button
                  type='submit'
                  className={`${btnPrimary} ${touchTarget} w-full md:w-auto`}
                >
                  Cargar nota
                </button>
              </div>
              {msg && (
                <div
                  role='status'
                  className={`col-span-full text-[13px] font-bold ${msg.startsWith('✅') ? 'text-green' : 'text-red'}`}
                >
                  {msg}
                </div>
              )}
            </form>
          </div>

          {/* Historial */}
          <div className={card}>
            <div className='text-[15px] font-extrabold text-text mb-5'>
              Notas cargadas
            </div>
            <ResponsiveTable
              columnas={columnas}
              filas={calificaciones}
              filaKey={(c) => c.id_calificacion}
              vacio='Todavía no hay notas cargadas en esta clase.'
            />
          </div>
        </>
      )}
    </div>
  )
}
