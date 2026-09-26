/**
 * GestionAmonestaciones — Registro e historial de amonestaciones (rol Docente).
 * Extraído verbatim de AdminPanel.tsx (sin cambios de lógica).
 *
 * En el celular (PWA-T6) el formulario va en una columna y el historial se ve
 * como tarjetas (`ResponsiveTable`).
 */
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../../lib/api'
import type { Asignacion } from '../../types'
import { card, inputField, selectField, fieldLabel, btnPrimary, btnSecondary, badge, touchTarget } from '../../ui/styles'
import { ResponsiveTable, type Columna } from '../../ui/components'

interface Amonestacion {
  id_amonestacion: number
  tipo: string
  descripcion: string
  fecha: string
  alumnos: { nombre: string; apellido: string } | null
}

export function GestionAmonestaciones() {
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [alumnos, setAlumnos] = useState<
    { id_alumno: number; nombre: string; apellido: string }[]
  >([])
  const [amonestaciones, setAmonest] = useState<Amonestacion[]>([])
  const [selCurso, setSelCurso] = useState<number | null>(null)
  const [form, setForm] = useState({
    id_alumno: '',
    tipo: 'Leve',
    descripcion: '',
  })
  const [msg, setMsg] = useState('')

  const loadAmonestaciones = useCallback(async () => {
    const { data } = await api.get<typeof amonestaciones>('/amonestaciones/mias')
    if (data) setAmonest(data)
  }, [])

  useEffect(() => {
    api.get<Asignacion[]>('/asignaciones/mias').then(({ data }) => {
      if (data) setAsignaciones(data)
    })
    loadAmonestaciones()
  }, [loadAmonestaciones])

  const handleSelCurso = (idCurso: number) => {
    setSelCurso(idCurso)
    api
      .get<typeof alumnos>(`/alumnos?id_curso=${idCurso}&activo=true`)
      .then(({ data }) => {
        if (data) setAlumnos(data)
      })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setMsg('')
    // El backend registra la amonestación a nombre del docente logueado.
    const { error } = await api.post('/amonestaciones', {
      id_alumno: Number(form.id_alumno),
      tipo: form.tipo,
      descripcion: form.descripcion,
    })
    if (error) setMsg('Error: ' + error.message)
    else {
      setMsg('✅ Amonestación registrada.')
      setForm({ id_alumno: '', tipo: 'Leve', descripcion: '' })
      loadAmonestaciones()
    }
  }

  const TIPO_COLOR: Record<string, string> = {
    Leve: '#E67E22',
    Grave: '#E74C3C',
    'Muy grave': '#C0392B',
  }
  // Un docente puede dar varias materias en el mismo curso: un botón por curso.
  const cursosUnicos = asignaciones.flatMap((a, i, arr) => {
    const id = a.cursos?.id_curso
    if (!a.cursos || id === undefined) return []
    if (arr.findIndex((b) => b.cursos?.id_curso === id) !== i) return []
    return [{ id_curso: id, ...a.cursos }]
  })

  const columnas: Columna<Amonestacion>[] = [
    {
      key: 'alumno',
      header: 'Alumno',
      movil: 'titulo',
      className: 'font-bold',
      render: (a) => `${a.alumnos?.apellido}, ${a.alumnos?.nombre}`,
    },
    {
      key: 'tipo',
      header: 'Tipo',
      render: (a) => (
        <span style={badge(TIPO_COLOR[a.tipo] ?? '#6B6B8A')}>{a.tipo}</span>
      ),
    },
    {
      key: 'descripcion',
      header: 'Descripción',
      className: 'text-textMuted max-w-[300px]',
      render: (a) => a.descripcion,
    },
    {
      key: 'fecha',
      header: 'Fecha',
      className: 'text-textMuted',
      render: (a) => new Date(a.fecha).toLocaleDateString('es-AR'),
    },
  ]

  return (
    <div>
      <h2 className='text-[22px] font-black m-0 mb-5'>⚠️ Amonestaciones</h2>

      <div className={`${card} mb-5`}>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Registrar amonestación
        </div>
        <div className='mb-3.5'>
          <span className={fieldLabel}>
            Seleccioná el curso
          </span>
          <div className='flex gap-2.5 flex-wrap'>
            {cursosUnicos.map((c) => (
              <button
                key={c.id_curso}
                type='button'
                aria-pressed={selCurso === c.id_curso}
                className={`${
                  selCurso === c.id_curso ? btnPrimary : btnSecondary
                } ${touchTarget}`}
                onClick={() => handleSelCurso(c.id_curso)}
              >
                {c.nivel} {c.grado_anio} "{c.division}"
              </button>
            ))}
          </div>
        </div>
        {selCurso && (
          <form
            onSubmit={handleSubmit}
            className='grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-[14px]'
          >
            <div>
              <label className={fieldLabel} htmlFor='amon-alumno'>
                Alumno
              </label>
              <select
                id='amon-alumno'
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
              <label className={fieldLabel} htmlFor='amon-tipo'>
                Tipo
              </label>
              <select
                id='amon-tipo'
                className={selectField}
                value={form.tipo}
                onChange={(e) =>
                  setForm((p) => ({ ...p, tipo: e.target.value }))
                }
              >
                <option>Leve</option>
                <option>Grave</option>
                <option>Muy grave</option>
              </select>
            </div>
            <div className='col-span-full'>
              <label className={fieldLabel} htmlFor='amon-descripcion'>
                Descripción del hecho
              </label>
              <textarea
                id='amon-descripcion'
                className={`${inputField} min-h-[80px] resize-y`}
                required
                value={form.descripcion}
                onChange={(e) =>
                  setForm((p) => ({ ...p, descripcion: e.target.value }))
                }
              />
            </div>
            <div className='col-span-full flex flex-col md:flex-row md:items-center gap-3.5'>
              <button
                type='submit'
                className={`${btnPrimary} ${touchTarget} w-full md:w-auto`}
              >
                Registrar amonestación
              </button>
              {msg && (
                <span
                  role='status'
                  className={`text-[13px] font-bold ${msg.startsWith('✅') ? 'text-green' : 'text-red'}`}
                >
                  {msg}
                </span>
              )}
            </div>
          </form>
        )}
      </div>

      <div className={card}>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Historial de amonestaciones
        </div>
        <ResponsiveTable
          columnas={columnas}
          filas={amonestaciones}
          filaKey={(a) => a.id_amonestacion}
          vacio='Todavía no registraste amonestaciones.'
        />
      </div>
    </div>
  )
}
