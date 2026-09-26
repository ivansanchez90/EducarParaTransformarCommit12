/**
 * Gestión de cursos (panel admin): alta, edición, baja y reactivación.
 * El acceso a datos está en useCursos; este componente es solo interfaz.
 */
import type { FormEvent } from 'react'
import { useState } from 'react'
import type { Curso } from '../../types'
import { Badge, Card, EstadoBadge, FormMessage, SectionHeader, ToggleFormButton } from '../../ui/components'
import {
  btnDanger,
  btnPrimary,
  btnSecondarySm,
  fieldLabel,
  formGrid4,
  inputField,
  rowActions,
  selectField,
  tableBase,
  tdCell,
  thCell,
} from '../../ui/styles'
import { CURSO_VACIO, aFormulario, useCursos } from './useCursos'
import type { DatosCurso } from './useCursos'

const COLOR_NIVEL: Record<string, string> = {
  Inicial: '#27AE60',
  Primario: '#2980B9',
  Secundario: '#5B35C5',
}

type Aviso = { ok: boolean; texto: string } | null

export function GestionCursos() {
  const { cursos, crearCurso, editarCurso, cambiarEstado } = useCursos()
  const [showForm, setShowForm] = useState(false)
  // null = alta; un curso = edición de ese curso.
  const [editando, setEditando] = useState<Curso | null>(null)
  const [form, setForm] = useState<DatosCurso>(CURSO_VACIO)
  const [loading, setLoading] = useState(false)
  const [aviso, setAviso] = useState<Aviso>(null)

  const set = (campo: keyof DatosCurso) => (valor: string) => {
    setForm((p) => ({ ...p, [campo]: valor }))
  }

  const cerrarForm = () => {
    setShowForm(false)
    setEditando(null)
    setForm(CURSO_VACIO)
  }

  const abrirAlta = () => {
    if (showForm) {
      cerrarForm()
      return
    }
    setEditando(null)
    setForm(CURSO_VACIO)
    setAviso(null)
    setShowForm(true)
  }

  const abrirEdicion = (c: Curso) => {
    setEditando(c)
    setForm(aFormulario(c))
    setAviso(null)
    setShowForm(true)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setAviso(null)
    const error = editando ? await editarCurso(editando.id_curso, form) : await crearCurso(form)
    setLoading(false)
    if (error) {
      setAviso({ ok: false, texto: error })
      return
    }
    setAviso({ ok: true, texto: editando ? '✅ Curso actualizado.' : '✅ Curso creado.' })
    cerrarForm()
  }

  const handleEstado = async (c: Curso) => {
    setAviso(null)
    const error = await cambiarEstado(c.id_curso, !c.activo)
    if (error) setAviso({ ok: false, texto: error })
    else setAviso({ ok: true, texto: c.activo ? '✅ Curso dado de baja.' : '✅ Curso reactivado.' })
  }

  return (
    <div>
      <SectionHeader
        title='🏫 Cursos'
        action={<ToggleFormButton open={showForm} onClick={abrirAlta} openLabel='+ Nuevo curso' />}
      />

      {showForm && (
        <Card className='mb-6'>
          <div className='text-[15px] font-extrabold text-text mb-5'>
            {editando ? `Editar ${editando.grado_anio} ${editando.division} de ${editando.nivel}` : 'Crear curso'}
          </div>
          <form onSubmit={(e) => void handleSubmit(e)} className={formGrid4}>
            <div>
              <span className={fieldLabel}>Nivel</span>
              <select
                className={selectField}
                value={form.nivel}
                onChange={(e) => {
                  set('nivel')(e.target.value)
                }}
              >
                <option>Inicial</option>
                <option>Primario</option>
                <option>Secundario</option>
              </select>
            </div>
            <div>
              <span className={fieldLabel}>Grado / Año</span>
              <input
                className={inputField}
                required
                value={form.grado_anio}
                placeholder='1er Grado'
                onChange={(e) => {
                  set('grado_anio')(e.target.value)
                }}
              />
            </div>
            <div>
              <span className={fieldLabel}>División</span>
              <input
                className={inputField}
                required
                value={form.division}
                placeholder='A'
                onChange={(e) => {
                  set('division')(e.target.value)
                }}
              />
            </div>
            <div>
              <span className={fieldLabel}>Capacidad máx. (vacío = sin límite)</span>
              <input
                type='number'
                min={1}
                className={inputField}
                value={form.capacidad_maxima}
                onChange={(e) => {
                  set('capacidad_maxima')(e.target.value)
                }}
              />
            </div>
            <div className='col-span-full'>
              <button type='submit' disabled={loading} className={`${btnPrimary}${loading ? ' opacity-60' : ''}`}>
                {loading ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear curso'}
              </button>
            </div>
          </form>
        </Card>
      )}

      {aviso && (
        <div className='mb-4'>
          <FormMessage ok={aviso.ok}>{aviso.texto}</FormMessage>
        </div>
      )}

      <Card>
        <table className={tableBase}>
          <thead>
            <tr>
              <th className={thCell}>Nivel</th>
              <th className={thCell}>Grado / Año</th>
              <th className={thCell}>División</th>
              <th className={thCell}>Capacidad</th>
              <th className={thCell}>Estado</th>
              <th className={thCell} />
            </tr>
          </thead>
          <tbody>
            {cursos.map((c) => (
              <tr key={c.id_curso} className={c.activo ? '' : 'opacity-60'}>
                <td className={tdCell}>
                  <Badge color={COLOR_NIVEL[c.nivel] ?? '#6B6B8A'}>{c.nivel}</Badge>
                </td>
                <td className={`${tdCell} font-bold`}>{c.grado_anio}</td>
                <td className={tdCell}>División {c.division}</td>
                <td className={`${tdCell} text-textMuted`}>
                  {c.capacidad_maxima === null ? 'Sin límite' : `${c.capacidad_maxima} alumnos`}
                </td>
                <td className={tdCell}>
                  <EstadoBadge activo={c.activo} />
                </td>
                <td className={tdCell}>
                  <div className={rowActions}>
                    <button
                      className={btnSecondarySm}
                      onClick={() => {
                        abrirEdicion(c)
                      }}
                    >
                      Editar
                    </button>
                    <button className={c.activo ? btnDanger : btnSecondarySm} onClick={() => void handleEstado(c)}>
                      {c.activo ? 'Dar de baja' : 'Reactivar'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
