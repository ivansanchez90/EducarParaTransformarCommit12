/**
 * Gestión de materias (panel admin): alta, edición, baja y reactivación.
 * El acceso a datos está en useMaterias; este componente es solo interfaz.
 */
import type { FormEvent } from 'react'
import { useState } from 'react'
import type { Materia } from '../../types'
import { Card, EstadoBadge, Field, FormMessage, SectionHeader, ToggleFormButton } from '../../ui/components'
import { btnDanger, btnPrimary, btnSecondarySm, formGrid4, rowActions, tableBase, tdCell, thCell } from '../../ui/styles'
import { MATERIA_VACIA, aFormulario, useMaterias } from './useMaterias'
import type { DatosMateria } from './useMaterias'

type Aviso = { ok: boolean; texto: string } | null

export function GestionMaterias() {
  const { materias, crearMateria, editarMateria, cambiarEstado } = useMaterias()
  const [showForm, setShowForm] = useState(false)
  // null = alta; una materia = edición de esa materia.
  const [editando, setEditando] = useState<Materia | null>(null)
  const [form, setForm] = useState<DatosMateria>(MATERIA_VACIA)
  const [loading, setLoading] = useState(false)
  const [aviso, setAviso] = useState<Aviso>(null)

  const set = (campo: keyof DatosMateria) => (valor: string) => setForm((p) => ({ ...p, [campo]: valor }))

  const cerrarForm = () => {
    setShowForm(false)
    setEditando(null)
    setForm(MATERIA_VACIA)
  }

  const abrirAlta = () => {
    if (showForm) return cerrarForm()
    setEditando(null)
    setForm(MATERIA_VACIA)
    setAviso(null)
    setShowForm(true)
  }

  const abrirEdicion = (m: Materia) => {
    setEditando(m)
    setForm(aFormulario(m))
    setAviso(null)
    setShowForm(true)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setAviso(null)
    const error = editando ? await editarMateria(editando.id_materia, form) : await crearMateria(form)
    setLoading(false)
    if (error) return setAviso({ ok: false, texto: error })
    setAviso({ ok: true, texto: editando ? '✅ Materia actualizada.' : '✅ Materia creada.' })
    cerrarForm()
  }

  const handleEstado = async (m: Materia) => {
    setAviso(null)
    let error = await cambiarEstado(m.id_materia, !m.activo)
    // Con asignaciones activas el backend pide confirmación explícita.
    if (error?.code === 'MATERIA_CON_ASIGNACIONES') {
      if (!confirm(error.message)) return
      error = await cambiarEstado(m.id_materia, false, true)
    }
    if (error) setAviso({ ok: false, texto: error.message })
    else setAviso({ ok: true, texto: m.activo ? '✅ Materia dada de baja.' : '✅ Materia reactivada.' })
  }

  return (
    <div>
      <SectionHeader
        title='📚 Materias'
        action={<ToggleFormButton open={showForm} onClick={abrirAlta} openLabel='+ Nueva materia' />}
      />

      {showForm && (
        <Card className='mb-6'>
          <div className='text-[15px] font-extrabold text-text mb-5'>
            {editando ? `Editar ${editando.nombre}` : 'Crear materia'}
          </div>
          <form onSubmit={handleSubmit} className={formGrid4}>
            <div className='col-span-2'>
              <Field label='Nombre de la materia' required value={form.nombre} onChange={set('nombre')} />
            </div>
            <Field
              label='Horas semanales'
              type='number'
              required
              value={form.horas_semanales}
              onChange={set('horas_semanales')}
            />
            <div />
            <div className='col-span-full'>
              <Field label='Descripción (opcional)' value={form.descripcion} onChange={set('descripcion')} />
            </div>
            <div className='col-span-full'>
              <button type='submit' disabled={loading} className={`${btnPrimary}${loading ? ' opacity-60' : ''}`}>
                {loading ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear materia'}
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
              <th className={thCell}>Materia</th>
              <th className={thCell}>Horas semanales</th>
              <th className={thCell}>Estado</th>
              <th className={thCell} />
            </tr>
          </thead>
          <tbody>
            {materias.map((m) => (
              <tr key={m.id_materia} className={m.activo ? '' : 'opacity-60'}>
                <td className={tdCell}>
                  <div className='font-bold'>{m.nombre}</div>
                  {m.descripcion && <div className='text-xs text-textMuted'>{m.descripcion}</div>}
                </td>
                <td className={tdCell}>{m.horas_semanales} hs</td>
                <td className={tdCell}>
                  <EstadoBadge activo={m.activo} femenino />
                </td>
                <td className={tdCell}>
                  <div className={rowActions}>
                    <button className={btnSecondarySm} onClick={() => abrirEdicion(m)}>
                      Editar
                    </button>
                    <button className={m.activo ? btnDanger : btnSecondarySm} onClick={() => handleEstado(m)}>
                      {m.activo ? 'Dar de baja' : 'Reactivar'}
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
