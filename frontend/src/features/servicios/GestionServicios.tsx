/**
 * GestionServicios — servicios complementarios (transporte y comedor).
 *
 * Permite administrar los recorridos del transporte escolar e inscribir
 * alumnos al transporte y al comedor. Los padres hacen lo propio con sus
 * hijos desde el portal de familias.
 */
import { Fragment, useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api, qs } from '../../lib/api'
import type { AlumnoServicios, RecorridoTransporte } from '../../types'
import {
  badge,
  btnDanger,
  btnPrimary,
  btnSecondarySm,
  card,
  fieldLabel,
  inputField,
  selectField,
  tdCell,
  thCell,
} from '../../ui/styles'

const RECORRIDO_VACIO = {
  nombre: '',
  zona: '',
  paradas: '',
  hora_ida: '07:00',
  hora_vuelta: '17:30',
  capacidad: '30',
}

export function GestionServicios() {
  const [recorridos, setRecorridos] = useState<RecorridoTransporte[]>([])
  const [alumnos, setAlumnos] = useState<AlumnoServicios[]>([])
  const [msg, setMsg] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(RECORRIDO_VACIO)

  // Filtros del listado de alumnos
  const [filtroRecorrido, setFiltroRecorrido] = useState('')
  const [filtroComedor, setFiltroComedor] = useState('')
  const [busqueda, setBusqueda] = useState('')

  // Inscripción de un alumno
  const [selAlumno, setSelAlumno] = useState<number | null>(null)
  const [selRecorrido, setSelRecorrido] = useState('')
  const [observaciones, setObservaciones] = useState('')

  const loadRecorridos = useCallback(async () => {
    const { data } = await api.get<RecorridoTransporte[]>('/recorridos')
    if (data) setRecorridos(data)
  }, [])

  const loadAlumnos = useCallback(async () => {
    const { data } = await api.get<AlumnoServicios[]>(
      `/servicios${qs({ id_recorrido: filtroRecorrido, comedor: filtroComedor })}`,
    )
    if (data) setAlumnos(data)
  }, [filtroRecorrido, filtroComedor])

  useEffect(() => {
    loadRecorridos()
  }, [loadRecorridos])

  useEffect(() => {
    loadAlumnos()
  }, [loadAlumnos])

  const recargar = async () => {
    await Promise.all([loadRecorridos(), loadAlumnos()])
  }

  // ── Recorridos ───────────────────────────────────────────────

  const abrirNuevo = () => {
    setEditId(null)
    setForm(RECORRIDO_VACIO)
    setShowForm(true)
    setMsg('')
  }

  const abrirEdicion = (r: RecorridoTransporte) => {
    setEditId(r.id_recorrido)
    setForm({
      nombre: r.nombre,
      zona: r.zona ?? '',
      paradas: r.paradas ?? '',
      hora_ida: (r.hora_ida ?? '').slice(0, 5),
      hora_vuelta: (r.hora_vuelta ?? '').slice(0, 5),
      capacidad: r.capacidad === null ? '' : String(r.capacidad),
    })
    setShowForm(true)
    setMsg('')
  }

  const guardarRecorrido = async (e: FormEvent) => {
    e.preventDefault()
    setMsg('')
    const payload = {
      ...form,
      zona: form.zona || null,
      paradas: form.paradas || null,
      hora_ida: form.hora_ida || null,
      hora_vuelta: form.hora_vuelta || null,
      capacidad: form.capacidad === '' ? null : Number(form.capacidad),
    }
    const { error } = editId
      ? await api.put(`/recorridos/${editId}`, payload)
      : await api.post('/recorridos', payload)
    if (error) setMsg('Error: ' + error.message)
    else {
      setMsg(editId ? '✅ Recorrido actualizado.' : '✅ Recorrido creado.')
      setShowForm(false)
      loadRecorridos()
    }
  }

  const toggleActivo = async (r: RecorridoTransporte) => {
    await api.patch(`/recorridos/${r.id_recorrido}`, { activo: !r.activo })
    loadRecorridos()
  }

  const eliminarRecorrido = async (r: RecorridoTransporte) => {
    if (!confirm(`¿Eliminar el recorrido ${r.nombre}?`)) return
    const { error } = await api.delete(`/recorridos/${r.id_recorrido}`)
    if (error) setMsg('Error: ' + error.message)
    else recargar()
  }

  // ── Servicios de los alumnos ─────────────────────────────────

  const abrirInscripcion = (a: AlumnoServicios) => {
    setSelAlumno(a.id_alumno)
    setSelRecorrido(a.transporte ? String(a.transporte.recorridos_transporte.id_recorrido) : '')
    setObservaciones(a.transporte?.observaciones ?? '')
    setMsg('')
  }

  const guardarTransporte = async (idAlumno: number) => {
    setMsg('')
    if (!selRecorrido) {
      setMsg('Elegí un recorrido.')
      return
    }
    const { error } = await api.put(`/servicios/${idAlumno}/transporte`, {
      id_recorrido: Number(selRecorrido),
      observaciones: observaciones || null,
    })
    if (error) setMsg('Error: ' + error.message)
    else {
      setMsg('✅ Transporte registrado.')
      setSelAlumno(null)
      recargar()
    }
  }

  const quitarTransporte = async (idAlumno: number) => {
    if (!confirm('¿Dar de baja el transporte de este alumno?')) return
    await api.delete(`/servicios/${idAlumno}/transporte`)
    recargar()
  }

  const toggleComedor = async (a: AlumnoServicios) => {
    const { error } = a.comedor
      ? await api.delete(`/servicios/${a.id_alumno}/comedor`)
      : await api.put(`/servicios/${a.id_alumno}/comedor`, {})
    if (error) setMsg('Error: ' + error.message)
    else recargar()
  }

  const alumnosFiltrados = alumnos.filter((a) => {
    if (!busqueda) return true
    const term = busqueda.toLowerCase()
    return (
      `${a.apellido} ${a.nombre}`.toLowerCase().includes(term) || a.dni.includes(term)
    )
  })

  const conTransporte = alumnos.filter((a) => a.transporte).length
  const conComedor = alumnos.filter((a) => a.comedor).length

  return (
    <div>
      <div className='flex justify-between items-center mb-5'>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
          🚌 Servicios: transporte y comedor
        </h2>
        <button className={btnPrimary} onClick={showForm ? () => setShowForm(false) : abrirNuevo}>
          {showForm ? 'Cancelar' : '+ Nuevo recorrido'}
        </button>
      </div>

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

      {/* ── Alta / edición de recorrido ── */}
      {showForm && (
        <div className={`${card} mb-6`}>
          <div className='text-[15px] font-extrabold text-text mb-5'>
            {editId ? 'Editar recorrido' : 'Nuevo recorrido'}
          </div>
          <form onSubmit={guardarRecorrido} className='flex flex-col gap-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <span className={fieldLabel}>Nombre del recorrido *</span>
                <input
                  className={inputField}
                  required
                  value={form.nombre}
                  onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                  placeholder='Ej: Recorrido 5 - Este'
                />
              </div>
              <div>
                <span className={fieldLabel}>Zona</span>
                <input
                  className={inputField}
                  value={form.zona}
                  onChange={(e) => setForm((p) => ({ ...p, zona: e.target.value }))}
                  placeholder='Ej: Barrios del este'
                />
              </div>
            </div>
            <div>
              <span className={fieldLabel}>Paradas (una por línea)</span>
              <textarea
                className={`${inputField} min-h-[80px]`}
                value={form.paradas}
                onChange={(e) => setForm((p) => ({ ...p, paradas: e.target.value }))}
                placeholder={'Plaza principal\nTerminal\nAv. San Martín 500'}
              />
            </div>
            <div className='grid grid-cols-3 gap-4'>
              <div>
                <span className={fieldLabel}>Hora de ida</span>
                <input
                  type='time'
                  className={inputField}
                  value={form.hora_ida}
                  onChange={(e) => setForm((p) => ({ ...p, hora_ida: e.target.value }))}
                />
              </div>
              <div>
                <span className={fieldLabel}>Hora de vuelta</span>
                <input
                  type='time'
                  className={inputField}
                  value={form.hora_vuelta}
                  onChange={(e) => setForm((p) => ({ ...p, hora_vuelta: e.target.value }))}
                />
              </div>
              <div>
                <span className={fieldLabel}>Capacidad (vacío = sin límite)</span>
                <input
                  type='number'
                  min='1'
                  className={inputField}
                  value={form.capacidad}
                  onChange={(e) => setForm((p) => ({ ...p, capacidad: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <button type='submit' className={btnPrimary}>
                {editId ? 'Guardar cambios' : 'Crear recorrido'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Recorridos ── */}
      <div className={`${card} mb-6`}>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Recorridos de transporte
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className={thCell}>Recorrido</th>
              <th className={thCell}>Zona</th>
              <th className={thCell}>Ida / Vuelta</th>
              <th className={thCell}>Ocupación</th>
              <th className={thCell}>Estado</th>
              <th className={thCell}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {recorridos.map((r) => {
              const lleno = r.capacidad !== null && r.inscriptos >= r.capacidad
              return (
                <tr key={r.id_recorrido}>
                  <td className={`${tdCell} font-bold`}>
                    {r.nombre}
                    {r.paradas && (
                      <div className='text-[11px] text-textMuted font-normal whitespace-pre-line mt-1'>
                        {r.paradas}
                      </div>
                    )}
                  </td>
                  <td className={tdCell}>{r.zona ?? '—'}</td>
                  <td className={tdCell}>
                    {(r.hora_ida ?? '—').slice(0, 5)} / {(r.hora_vuelta ?? '—').slice(0, 5)}
                  </td>
                  <td className={tdCell}>
                    <span style={badge(lleno ? '#E74C3C' : '#27AE60')}>
                      {r.inscriptos}
                      {r.capacidad !== null ? ` / ${r.capacidad}` : ''}
                    </span>
                  </td>
                  <td className={tdCell}>
                    <span style={badge(r.activo ? '#27AE60' : '#6B6B8A')}>
                      {r.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className={tdCell}>
                    <div className='flex gap-2'>
                      <button className={btnSecondarySm} onClick={() => abrirEdicion(r)}>
                        Editar
                      </button>
                      <button className={btnSecondarySm} onClick={() => toggleActivo(r)}>
                        {r.activo ? 'Desactivar' : 'Activar'}
                      </button>
                      <button className={btnDanger} onClick={() => eliminarRecorrido(r)}>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {recorridos.length === 0 && (
              <tr>
                <td className={`${tdCell} text-textMuted`} colSpan={6}>
                  No hay recorridos cargados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Alumnos y sus servicios ── */}
      <div className={card}>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Alumnos inscriptos ({conTransporte} en transporte · {conComedor} en comedor)
        </div>

        <div className='flex flex-wrap gap-4 items-end mb-5'>
          <div className='flex-1' style={{ minWidth: 200 }}>
            <span className={fieldLabel}>Buscar alumno</span>
            <input
              className={inputField}
              placeholder='Apellido, nombre o DNI...'
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <div>
            <span className={fieldLabel}>Recorrido</span>
            <select
              className={selectField}
              value={filtroRecorrido}
              onChange={(e) => setFiltroRecorrido(e.target.value)}
            >
              <option value=''>Todos</option>
              {recorridos.map((r) => (
                <option key={r.id_recorrido} value={r.id_recorrido}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className={fieldLabel}>Comedor</span>
            <select
              className={selectField}
              value={filtroComedor}
              onChange={(e) => setFiltroComedor(e.target.value)}
            >
              <option value=''>Todos</option>
              <option value='true'>Solo inscriptos</option>
              <option value='false'>Solo no inscriptos</option>
            </select>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className={thCell}>Alumno</th>
              <th className={thCell}>Curso</th>
              <th className={thCell}>Transporte</th>
              <th className={thCell}>Comedor</th>
              <th className={thCell}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {alumnosFiltrados.map((a) => (
              <Fragment key={a.id_alumno}>
                <tr>
                  <td className={`${tdCell} font-bold`}>
                    {a.apellido}, {a.nombre}
                    <div className='text-[11px] text-textMuted font-normal'>DNI {a.dni}</div>
                  </td>
                  <td className={tdCell}>
                    {a.cursos
                      ? `${a.cursos.nivel} · ${a.cursos.grado_anio}° ${a.cursos.division}`
                      : 'Sin curso'}
                  </td>
                  <td className={tdCell}>
                    {a.transporte ? (
                      <>
                        <span style={badge('#2980B9')}>
                          {a.transporte.recorridos_transporte.nombre}
                        </span>
                        {a.transporte.observaciones && (
                          <div className='text-[11px] text-textMuted mt-1'>
                            {a.transporte.observaciones}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className='text-textMuted text-[13px]'>No utiliza</span>
                    )}
                  </td>
                  <td className={tdCell}>
                    <span style={badge(a.comedor ? '#27AE60' : '#6B6B8A')}>
                      {a.comedor ? 'Inscripto' : 'No utiliza'}
                    </span>
                  </td>
                  <td className={tdCell}>
                    <div className='flex gap-2'>
                      <button className={btnSecondarySm} onClick={() => abrirInscripcion(a)}>
                        {a.transporte ? 'Cambiar recorrido' : 'Asignar transporte'}
                      </button>
                      {a.transporte && (
                        <button className={btnDanger} onClick={() => quitarTransporte(a.id_alumno)}>
                          Quitar transporte
                        </button>
                      )}
                      <button className={btnSecondarySm} onClick={() => toggleComedor(a)}>
                        {a.comedor ? 'Baja comedor' : 'Alta comedor'}
                      </button>
                    </div>
                  </td>
                </tr>
                {selAlumno === a.id_alumno && (
                  <tr>
                    <td colSpan={5} className='bg-purpleLight border-b border-border py-4 px-4'>
                      <div className='flex items-end gap-4 flex-wrap'>
                        <div>
                          <span className={fieldLabel}>Recorrido</span>
                          <select
                            className={selectField}
                            value={selRecorrido}
                            onChange={(e) => setSelRecorrido(e.target.value)}
                          >
                            <option value=''>Seleccionar...</option>
                            {recorridos
                              .filter((r) => r.activo)
                              .map((r) => {
                                const lleno =
                                  r.capacidad !== null &&
                                  r.inscriptos >= r.capacidad &&
                                  a.transporte?.recorridos_transporte.id_recorrido !== r.id_recorrido
                                return (
                                  <option key={r.id_recorrido} value={r.id_recorrido} disabled={lleno}>
                                    {r.nombre}
                                    {lleno ? ' (sin lugares)' : ''}
                                  </option>
                                )
                              })}
                          </select>
                        </div>
                        <div className='flex-1' style={{ minWidth: 200 }}>
                          <span className={fieldLabel}>Observaciones</span>
                          <input
                            className={inputField}
                            placeholder='Ej: baja en la parada de la plaza'
                            value={observaciones}
                            onChange={(e) => setObservaciones(e.target.value)}
                          />
                        </div>
                        <button className={btnPrimary} onClick={() => guardarTransporte(a.id_alumno)}>
                          Guardar
                        </button>
                        <button className={btnSecondarySm} onClick={() => setSelAlumno(null)}>
                          Cancelar
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {alumnosFiltrados.length === 0 && (
              <tr>
                <td className={`${tdCell} text-textMuted`} colSpan={5}>
                  No hay alumnos con los filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
