/**
 * Gestión de asignaciones (panel admin): vincula docente + materia + curso.
 * Extraído verbatim desde AdminPanel.tsx.
 */
import type { FormEvent } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { Asignacion, Curso, Docente, Materia } from '../../types'
import {
  btnPrimary,
  card,
  fieldLabel,
  selectField,
  tdCell,
  thCell,
} from '../../ui/styles'
import { TablaScroll } from '../../ui/components'

export function GestionAsignaciones() {
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [docentes, setDocentes] = useState<Docente[]>([])
  const [materias, setMaterias] = useState<Materia[]>([])
  const [cursos, setCursos] = useState<Curso[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    id_docente: '',
    id_materia: '',
    id_curso: '',
  })
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const [{ data: as }, { data: do_ }, { data: ma }, { data: cu }] =
      await Promise.all([
        api.get<Asignacion[]>('/asignaciones'),
        api.get<Docente[]>('/docentes?activo=true'),
        api.get<Materia[]>('/materias?activo=true'),
        api.get<Curso[]>('/cursos'),
      ])
    if (as) setAsignaciones(as)
    if (do_) setDocentes(do_)
    if (ma) setMaterias(ma)
    if (cu) setCursos(cu)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setMsg('')
    // El backend asigna el período académico activo.
    const { error } = await api.post('/asignaciones', {
      id_docente: Number(form.id_docente),
      id_materia: Number(form.id_materia),
      id_curso: Number(form.id_curso),
    })
    if (error) setMsg('Error: ' + error.message)
    else {
      setMsg('✅ Asignación creada.')
      setShowForm(false)
      load()
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          rowGap: 12,
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
          🔗 Asignaciones
        </h2>
        <button
          className={btnPrimary}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancelar' : '+ Nueva asignación'}
        </button>
      </div>
      {showForm && (
        <div className={`${card} mb-6`}>
          <div className='text-[15px] font-extrabold text-text mb-5'>
            Asignar docente a materia y curso
          </div>
          <form
            onSubmit={handleCreate}
            className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-[14px]'
          >
            <div>
              <span className={fieldLabel}>
                Docente
              </span>
              <select
                className={selectField}
                required
                value={form.id_docente}
                onChange={(e) =>
                  setForm((p) => ({ ...p, id_docente: e.target.value }))
                }
              >
                <option value=''>Seleccioná...</option>
                {docentes.map((d) => (
                  <option key={d.id_docente} value={d.id_docente}>
                    {d.usuarios?.apellido}, {d.usuarios?.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className={fieldLabel}>
                Materia
              </span>
              <select
                className={selectField}
                required
                value={form.id_materia}
                onChange={(e) =>
                  setForm((p) => ({ ...p, id_materia: e.target.value }))
                }
              >
                <option value=''>Seleccioná...</option>
                {materias.map((m) => (
                  <option key={m.id_materia} value={m.id_materia}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className={fieldLabel}>
                Curso
              </span>
              <select
                className={selectField}
                required
                value={form.id_curso}
                onChange={(e) =>
                  setForm((p) => ({ ...p, id_curso: e.target.value }))
                }
              >
                <option value=''>Seleccioná...</option>
                {cursos.map((c) => (
                  <option key={c.id_curso} value={c.id_curso}>
                    {c.nivel} — {c.grado_anio} "{c.division}"
                  </option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <button
                type='submit'
                className={btnPrimary}
              >
                Crear asignación
              </button>
            </div>
            {msg && (
              <div
                style={{
                  gridColumn: '1/-1',
                  fontSize: 13,
                  fontWeight: 700,
                  color: msg.startsWith('✅') ? '#27AE60' : '#E74C3C',
                }}
              >
                {msg}
              </div>
            )}
          </form>
        </div>
      )}
      <div className={card}>
        <TablaScroll>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className={thCell}>
                  Docente
                </th>
                <th className={thCell}>
                  Materia
                </th>
                <th className={thCell}>
                  Curso
                </th>
              </tr>
            </thead>
            <tbody>
              {asignaciones.map((a) => (
                <tr key={a.id_asignacion}>
                  <td className={`${tdCell} font-bold`}>
                    {a.docentes?.usuarios?.apellido},{' '}
                    {a.docentes?.usuarios?.nombre}
                  </td>
                  <td className={tdCell}>
                    {a.materias?.nombre}
                  </td>
                  <td className={tdCell}>
                    {a.cursos?.nivel} — {a.cursos?.grado_anio} "
                    {a.cursos?.division}"
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
