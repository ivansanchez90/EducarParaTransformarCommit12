/**
 * GestionAlumnos — listado y alta de alumnos.
 *
 * Solo presentación: toda la lógica de datos vive en `useAlumnos`.
 */
import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Alumno } from '../../types'
import {
  btnDanger,
  btnPrimary,
  btnPrimarySm,
  btnSecondarySm,
  card,
  fieldLabel,
  selectField,
  tdCell,
  thCell,
} from '../../ui/styles'
import { Badge, Card, Field, SectionHeader, ToggleFormButton } from '../../ui/components'
import { useAlumnos } from './useAlumnos'
import { LegajoAlumno } from './LegajoAlumno'

const FORM_INICIAL = {
  nombre: '',
  apellido: '',
  dni: '',
  fecha_nacimiento: '',
  id_curso: '',
  email_padre: '',
  obra_social: '',
}

export function GestionAlumnos() {
  const { alumnos, cursos, crearAlumno, cambiarCurso } = useAlumnos()
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [legajoId, setLegajoId] = useState<number | null>(null)
  const [editCursoId, setEditCursoId] = useState<number | null>(null)
  const [editCursoVal, setEditCursoVal] = useState<string>('')
  const [savingCurso, setSavingCurso] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)

  const setCampo = (campo: keyof typeof FORM_INICIAL) => (value: string) =>
    setForm((p) => ({ ...p, [campo]: value }))

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    const error = await crearAlumno(form)
    if (error) {
      setMsg('Error: ' + error)
    } else {
      setMsg('✅ Alumno registrado.')
      setShowForm(false)
    }
    setLoading(false)
  }

  const abrirEditCurso = (a: Alumno) => {
    setEditCursoId(a.id_alumno)
    setEditCursoVal(
      cursos
        .find(
          (c) =>
            c.nivel === a.cursos?.nivel &&
            c.grado_anio === a.cursos?.grado_anio &&
            c.division === a.cursos?.division,
        )
        ?.id_curso?.toString() ?? '',
    )
  }

  const guardarCurso = async () => {
    if (editCursoId === null) return
    setSavingCurso(true)
    const error = await cambiarCurso(editCursoId, editCursoVal)
    if (error) setMsg('Error: ' + error)
    setSavingCurso(false)
    setEditCursoId(null)
  }

  if (legajoId !== null) {
    return (
      <LegajoAlumno idAlumno={legajoId} onClose={() => setLegajoId(null)} />
    )
  }

  return (
    <div>
      <SectionHeader
        title='🎓 Alumnos'
        action={
          <ToggleFormButton
            open={showForm}
            openLabel='+ Nuevo alumno'
            onClick={() => setShowForm(!showForm)}
          />
        }
      />

      {showForm && (
        <Card className='mb-6'>
          <div className='text-[15px] font-extrabold text-text mb-5'>
            Registrar alumno
          </div>
          <form
            onSubmit={handleCreate}
            className='grid grid-cols-2 gap-[14px]'
          >
            <Field
              label='Nombre'
              required
              value={form.nombre}
              onChange={setCampo('nombre')}
            />
            <Field
              label='Apellido'
              required
              value={form.apellido}
              onChange={setCampo('apellido')}
            />
            <Field
              label='DNI'
              required
              value={form.dni}
              onChange={setCampo('dni')}
            />
            <Field
              label='Fecha de nacimiento'
              type='date'
              required
              value={form.fecha_nacimiento}
              onChange={setCampo('fecha_nacimiento')}
            />
            <div>
              <span className={fieldLabel}>Curso</span>
              <select
                className={selectField}
                value={form.id_curso}
                onChange={(e) => setCampo('id_curso')(e.target.value)}
              >
                <option value=''>Sin asignar</option>
                {cursos.map((c) => (
                  <option key={c.id_curso} value={c.id_curso}>
                    {c.nivel} — {c.grado_anio} "{c.division}"
                  </option>
                ))}
              </select>
            </div>
            <Field
              label='Email del padre/tutor'
              type='email'
              value={form.email_padre}
              onChange={setCampo('email_padre')}
              placeholder='Debe existir en usuarios'
            />
            <Field
              label='Obra social'
              value={form.obra_social}
              onChange={setCampo('obra_social')}
            />
            <div className='flex items-end'>
              <button
                type='submit'
                disabled={loading}
                className={`${btnPrimary} w-full${loading ? ' opacity-60' : ''}`}
              >
                {loading ? 'Guardando...' : 'Registrar alumno'}
              </button>
            </div>
            {msg && (
              <div
                className='col-span-full text-[13px] font-bold'
                style={{ color: msg.startsWith('✅') ? '#27AE60' : '#E74C3C' }}
              >
                {msg}
              </div>
            )}
          </form>
        </Card>
      )}

      <div className={card}>
        <table className='w-full border-collapse'>
          <thead>
            <tr>
              <th className={thCell}>Alumno</th>
              <th className={thCell}>DNI</th>
              <th className={thCell}>Curso</th>
              <th className={thCell}>Estado</th>
              <th className={thCell}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {alumnos.map((a) => (
              <tr key={a.id_alumno}>
                <td className={`${tdCell} font-bold`}>
                  {a.apellido}, {a.nombre}
                </td>
                <td className={`${tdCell} text-textMuted`}>{a.dni}</td>
                <td className={tdCell} style={{ minWidth: 260 }}>
                  {editCursoId === a.id_alumno ? (
                    <div className='flex items-center gap-2'>
                      <select
                        className={`flex-1 px-[10px] py-[6px] rounded-input border-2 border-border text-[13px] text-text outline-none appearance-none`}
                        value={editCursoVal}
                        onChange={(e) => setEditCursoVal(e.target.value)}
                        autoFocus
                      >
                        <option value=''>Sin asignar</option>
                        {cursos.map((c) => (
                          <option key={c.id_curso} value={c.id_curso}>
                            {c.nivel} — {c.grado_anio} "{c.division}"
                          </option>
                        ))}
                      </select>
                      <button
                        className={`${btnPrimarySm} shrink-0`}
                        disabled={savingCurso}
                        onClick={guardarCurso}
                      >
                        {savingCurso ? '...' : '✓'}
                      </button>
                      <button
                        className={`${btnDanger} shrink-0`}
                        onClick={() => setEditCursoId(null)}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className='flex items-center gap-2'>
                      <span
                        className={a.cursos ? 'text-text' : 'text-textMuted'}
                      >
                        {a.cursos
                          ? `${a.cursos.nivel} — ${a.cursos.grado_anio} "${a.cursos.division}"`
                          : 'Sin asignar'}
                      </span>
                      <button
                        className='bg-purpleLight text-purple-700 border-0 rounded py-[3px] px-[8px] text-[10px] font-extrabold cursor-pointer shrink-0 opacity-70 hover:opacity-100 transition-opacity'
                        onClick={() => abrirEditCurso(a)}
                      >
                        Cambiar
                      </button>
                    </div>
                  )}
                </td>
                <td className={tdCell}>
                  <Badge color={a.activo ? '#27AE60' : '#E74C3C'}>
                    {a.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </td>
                <td className={tdCell}>
                  <button
                    className={btnSecondarySm}
                    onClick={() => setLegajoId(a.id_alumno)}
                  >
                    Ver legajo
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
