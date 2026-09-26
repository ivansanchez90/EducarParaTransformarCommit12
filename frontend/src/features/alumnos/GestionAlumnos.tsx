/**
 * GestionAlumnos — listado y alta de alumnos.
 *
 * Solo presentación: toda la lógica de datos vive en `useAlumnos`.
 */
import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Alumno } from '../../types'
import {
  btnDanger,
  btnPrimary,
  btnPrimarySm,
  btnSecondarySm,
  card,
  fieldLabel,
  inputField,
  selectField,
  tdCell,
  thCell,
} from '../../ui/styles'
import { Badge, Card, Field, SectionHeader, ToggleFormButton, TablaScroll } from '../../ui/components'
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
  nro_obra_social: '',
  direccion: '',
  telefono_emergencia: '',
  nombre_contacto_emergencia: '',
}

export function GestionAlumnos() {
  const { alumnos, cursos, crearAlumno, editarAlumno, cambiarCurso, cambiarEstado } =
    useAlumnos()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [legajoId, setLegajoId] = useState<number | null>(null)
  const [editCursoId, setEditCursoId] = useState<number | null>(null)
  const [editCursoVal, setEditCursoVal] = useState<string>('')
  const [savingCurso, setSavingCurso] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)
  const [busqueda, setBusqueda] = useState('')

  const alumnosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return alumnos
    return alumnos.filter(
      (a) =>
        `${a.apellido} ${a.nombre}`.toLowerCase().includes(q) ||
        a.dni.toLowerCase().includes(q),
    )
  }, [alumnos, busqueda])

  const setCampo = (campo: keyof typeof FORM_INICIAL) => (value: string) =>
    setForm((p) => ({ ...p, [campo]: value }))

  /** Abre el formulario vacío para dar de alta. */
  const abrirAlta = () => {
    setEditId(null)
    setForm(FORM_INICIAL)
    setMsg('')
    setShowForm(true)
  }

  /** Abre el formulario con los datos del alumno para editarlos. */
  const abrirEdicion = (a: Alumno) => {
    setEditId(a.id_alumno)
    setForm({
      nombre: a.nombre,
      apellido: a.apellido,
      dni: a.dni,
      fecha_nacimiento: a.fecha_nacimiento ?? '',
      id_curso: a.id_curso ? String(a.id_curso) : '',
      email_padre: a.padre?.email ?? '',
      obra_social: a.obra_social ?? '',
      nro_obra_social: a.nro_obra_social ?? '',
      direccion: a.direccion ?? '',
      telefono_emergencia: a.telefono_emergencia ?? '',
      nombre_contacto_emergencia: a.nombre_contacto_emergencia ?? '',
    })
    setMsg('')
    setShowForm(true)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    const error = editId ? await editarAlumno(editId, form) : await crearAlumno(form)
    if (error) {
      setMsg('Error: ' + error)
    } else {
      setMsg(editId ? '✅ Datos actualizados.' : '✅ Alumno registrado.')
      setShowForm(false)
      setEditId(null)
    }
    setLoading(false)
  }

  const alternarEstado = async (a: Alumno) => {
    const accion = a.activo ? 'dar de baja' : 'reactivar'
    if (!confirm(`¿Querés ${accion} a ${a.apellido}, ${a.nombre}?`)) return
    const error = await cambiarEstado(a.id_alumno, !a.activo)
    setMsg(error ? 'Error: ' + error : `✅ Alumno ${a.activo ? 'dado de baja' : 'reactivado'}.`)
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
            onClick={() => (showForm ? setShowForm(false) : abrirAlta())}
          />
        }
      />

      {msg && (
        <div
          className='text-[13px] font-bold px-4 py-3 rounded-lg border mb-5'
          style={{
            color: msg.startsWith('✅') ? '#27AE60' : '#E74C3C',
            background: msg.startsWith('✅') ? '#27AE6012' : '#E74C3C12',
            borderColor: msg.startsWith('✅') ? '#27AE6040' : '#E74C3C40',
          }}
        >
          {msg}
        </div>
      )}

      {showForm && (
        <Card className='mb-6'>
          <div className='text-[15px] font-extrabold text-text mb-5'>
            {editId ? 'Editar alumno' : 'Registrar alumno'}
          </div>
          <form onSubmit={handleSubmit} className='grid grid-cols-1 sm:grid-cols-2 gap-[14px]'>
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
            <Field
              label='N° de obra social'
              value={form.nro_obra_social}
              onChange={setCampo('nro_obra_social')}
            />
            <Field
              label='Domicilio'
              value={form.direccion}
              onChange={setCampo('direccion')}
            />
            <Field
              label='Contacto de emergencia'
              value={form.nombre_contacto_emergencia}
              onChange={setCampo('nombre_contacto_emergencia')}
              placeholder='Nombre de la persona a avisar'
            />
            <Field
              label='Teléfono de emergencia'
              value={form.telefono_emergencia}
              onChange={setCampo('telefono_emergencia')}
            />
            <div className='flex items-end'>
              <button
                type='submit'
                disabled={loading}
                className={`${btnPrimary} w-full${loading ? ' opacity-60' : ''}`}
              >
                {loading ? 'Guardando...' : editId ? 'Guardar cambios' : 'Registrar alumno'}
              </button>
            </div>
          </form>
        </Card>
      )}

      <div className='mb-4' style={{ maxWidth: 320 }}>
        <input
          type='text'
          className={inputField}
          placeholder='Buscar por nombre o DNI...'
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className={card}>
        <TablaScroll>
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
              {alumnosFiltrados.length === 0 && (
                <tr>
                  <td className={`${tdCell} text-textMuted`} colSpan={5}>
                    No se encontraron alumnos.
                  </td>
                </tr>
              )}
              {alumnosFiltrados.map((a) => (
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
                    <div className='flex gap-2'>
                    <button
                      className={btnSecondarySm}
                      onClick={() => setLegajoId(a.id_alumno)}
                    >
                      Ver legajo
                    </button>
                    <button className={btnSecondarySm} onClick={() => abrirEdicion(a)}>
                      Editar
                    </button>
                    <button
                      className={
                        a.activo
                          ? btnDanger
                          : 'bg-[#27AE601A] text-green border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                      }
                      onClick={() => alternarEstado(a)}
                    >
                      {a.activo ? 'Dar de baja' : 'Reactivar'}
                    </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TablaScroll>
      </div>
    </div>
  )
}
