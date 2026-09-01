// GestionActividades — gestión de actividades extracurriculares e inscripciones.
// Extraído de AdminPanel.tsx sin cambios de lógica.
import { useState, useEffect, useCallback, Fragment } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { ActividadEx, Alumno, InscripcionActividad } from '../../types'
import {
  btnPrimary,
  btnSecondary,
  btnSecondarySm,
  btnPrimarySm,
  btnDanger,
  inputField,
  selectField,
  fieldLabel,
  thCell,
  tdCell,
  card,
  badge,
} from '../../ui/styles'

export function GestionActividades() {
  const [actividades, setActividades] = useState<ActividadEx[]>([])
  const [conteos, setConteos] = useState<Record<number, number>>({})
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [msg, setMsg] = useState('')
  const FORM_VACIO = {
    nombre: '',
    tipo: 'Idioma',
    descripcion: '',
    cupo_maximo: 20,
  }
  const [form, setForm] = useState(FORM_VACIO)

  // Inscriptos por actividad
  const [verInscriptosId, setVerInscriptosId] = useState<number | null>(null)
  const [inscriptos, setInscriptos] = useState<InscripcionActividad[]>([])
  const [alumnos, setAlumnos] = useState<Alumno[]>([])
  const [selAlumno, setSelAlumno] = useState('')
  const [inscMsg, setInscMsg] = useState('')
  const [inscribiendo, setInscribiendo] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('actividades_extracurriculares')
      .select('*')
      .order('tipo', { ascending: true })
      .order('nombre', { ascending: true })
    if (data) setActividades(data as ActividadEx[])

    const { data: insc } = await supabase
      .from('inscripciones_actividades')
      .select('id_actividad')
    const cnt: Record<number, number> = {}
    ;(insc ?? []).forEach((i: { id_actividad: number }) => {
      cnt[i.id_actividad] = (cnt[i.id_actividad] ?? 0) + 1
    })
    setConteos(cnt)

    // Alumnos activos para el selector de inscripción
    const { data: al } = await supabase
      .from('alumnos')
      .select(
        'id_alumno, nombre, apellido, dni, activo, cursos(nivel, grado_anio, division)',
      )
      .eq('activo', true)
      .order('apellido', { ascending: true })
    if (al) setAlumnos(al as unknown as Alumno[])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const loadInscriptos = useCallback(async (idActividad: number) => {
    const { data } = await supabase
      .from('inscripciones_actividades')
      .select(
        'id_inscripcion_act, id_actividad, id_alumno, fecha_inscripcion, alumnos(nombre, apellido, dni, cursos(nivel, grado_anio, division))',
      )
      .eq('id_actividad', idActividad)
      .order('fecha_inscripcion', { ascending: true })
    if (data) setInscriptos(data as unknown as InscripcionActividad[])
  }, [])

  const toggleVerInscriptos = async (idActividad: number) => {
    setInscMsg('')
    setSelAlumno('')
    if (verInscriptosId === idActividad) {
      setVerInscriptosId(null)
      setInscriptos([])
    } else {
      setVerInscriptosId(idActividad)
      await loadInscriptos(idActividad)
    }
  }

  const inscribirAlumno = async (idActividad: number) => {
    if (!selAlumno) return
    setInscribiendo(true)
    setInscMsg('')
    const { error } = await supabase.from('inscripciones_actividades').insert([
      {
        id_actividad: idActividad,
        id_alumno: Number(selAlumno),
      },
    ])
    if (error) {
      if (error.message.includes('Cupo completo')) {
        setInscMsg('❌ Cupo completo para esta actividad.')
      } else if (
        error.message.includes('duplicate') ||
        error.code === '23505'
      ) {
        setInscMsg('❌ El alumno ya está inscripto en esta actividad.')
      } else {
        setInscMsg('❌ Error: ' + error.message)
      }
    } else {
      setInscMsg('✅ Alumno inscripto correctamente.')
      setSelAlumno('')
      await loadInscriptos(idActividad)
      load()
    }
    setInscribiendo(false)
  }

  const quitarInscripcion = async (
    idInscripcion: number,
    idActividad: number,
  ) => {
    if (!confirm('¿Quitar al alumno de esta actividad?')) return
    await supabase
      .from('inscripciones_actividades')
      .delete()
      .eq('id_inscripcion_act', idInscripcion)
    await loadInscriptos(idActividad)
    load()
  }

  const abrirNueva = () => {
    setEditId(null)
    setForm(FORM_VACIO)
    setShowForm(true)
  }

  const abrirEdicion = (a: ActividadEx) => {
    setEditId(a.id_actividad)
    setForm({
      nombre: a.nombre,
      tipo: a.tipo,
      descripcion: a.descripcion ?? '',
      cupo_maximo: a.cupo_maximo,
    })
    setShowForm(true)
  }

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    setMsg('')
    const payload = { ...form, cupo_maximo: Number(form.cupo_maximo) }
    const { error } = editId
      ? await supabase
          .from('actividades_extracurriculares')
          .update(payload)
          .eq('id_actividad', editId)
      : await supabase.from('actividades_extracurriculares').insert([payload])
    if (error) setMsg('Error: ' + error.message)
    else {
      setShowForm(false)
      load()
    }
  }

  const toggleActivo = async (a: ActividadEx) => {
    await supabase
      .from('actividades_extracurriculares')
      .update({ activo: !a.activo })
      .eq('id_actividad', a.id_actividad)
    load()
  }

  const idiomas = actividades.filter((a) => a.tipo === 'Idioma')
  const deportes = actividades.filter((a) => a.tipo === 'Deporte')

  const renderGrupo = (titulo: string, items: ActividadEx[]) => (
    <div className={`${card} mb-5`}>
      <div className='text-[15px] font-extrabold text-text mb-5'>{titulo}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th className={thCell}>
              Actividad
            </th>
            <th className={thCell}>
              Cupo
            </th>
            <th className={thCell}>
              Inscriptos
            </th>
            <th className={thCell}>
              Estado
            </th>
            <th className={thCell}>
              Acción
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => {
            const ocupados = conteos[a.id_actividad] ?? 0
            const completo = ocupados >= a.cupo_maximo
            const expandida = verInscriptosId === a.id_actividad
            return (
              <Fragment key={a.id_actividad}>
                <tr>
                  <td className={`${tdCell} font-bold`}>
                    {a.nombre}
                    {a.descripcion && (
                      <>
                        <br />
                        <span style={{ fontSize: 11, color: '#6B6B8A' }}>
                          {a.descripcion}
                        </span>
                      </>
                    )}
                  </td>
                  <td className={tdCell}>
                    {a.cupo_maximo}
                  </td>
                  <td className={tdCell}>
                    <span
                      style={badge(
                        completo
                          ? '#E74C3C'
                          : ocupados > 0
                            ? '#27AE60'
                            : '#6B6B8A',
                      )}
                    >
                      {ocupados} / {a.cupo_maximo}
                      {completo ? ' · COMPLETO' : ''}
                    </span>
                  </td>
                  <td className={tdCell}>
                    <span style={badge(a.activo ? '#27AE60' : '#6B6B8A')}>
                      {a.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className={tdCell}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        className={
                          expandida
                            ? btnPrimarySm
                            : btnSecondarySm
                        }
                        onClick={() => toggleVerInscriptos(a.id_actividad)}
                      >
                        {expandida
                          ? '▲ Ocultar'
                          : `👥 Inscriptos (${ocupados})`}
                      </button>
                      <button
                        className={btnSecondarySm}
                        onClick={() => abrirEdicion(a)}
                      >
                        Editar
                      </button>
                      <button
                        className={btnDanger}
                        onClick={() => toggleActivo(a)}
                      >
                        {a.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
                {expandida && (
                  <tr>
                    <td
                      colSpan={5}
                      className='bg-purpleLight/50 border-b border-border p-5'
                    >
                      {/* Formulario de inscripción */}
                      <div className='flex items-end gap-3 flex-wrap mb-4'>
                        <div className='flex-1' style={{ minWidth: 280 }}>
                          <span className={fieldLabel}>
                            Inscribir alumno a {a.nombre}
                          </span>
                          <select
                            className={`${selectField} bg-white`}
                            value={selAlumno}
                            onChange={(e) => setSelAlumno(e.target.value)}
                          >
                            <option value=''>Seleccioná un alumno...</option>
                            {alumnos
                              .filter(
                                (al) =>
                                  !inscriptos.some(
                                    (i) => i.id_alumno === al.id_alumno,
                                  ),
                              )
                              .map((al) => (
                                <option key={al.id_alumno} value={al.id_alumno}>
                                  {al.apellido}, {al.nombre} — DNI {al.dni}
                                  {al.cursos
                                    ? ` (${al.cursos.nivel} ${al.cursos.grado_anio} "${al.cursos.division}")`
                                    : ''}
                                </option>
                              ))}
                          </select>
                        </div>
                        <button
                          disabled={!selAlumno || inscribiendo || completo}
                          className={
                            !selAlumno || inscribiendo || completo
                              ? 'bg-border text-textMuted border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-not-allowed'
                              : btnPrimary
                          }
                          onClick={() => inscribirAlumno(a.id_actividad)}
                        >
                          {inscribiendo
                            ? 'Inscribiendo...'
                            : completo
                              ? 'Cupo completo'
                              : '+ Inscribir'}
                        </button>
                      </div>

                      {inscMsg && (
                        <div
                          className='text-[12px] font-bold mb-4'
                          style={{
                            color: inscMsg.startsWith('✅')
                              ? '#27AE60'
                              : '#E74C3C',
                          }}
                        >
                          {inscMsg}
                        </div>
                      )}

                      {/* Listado de inscriptos */}
                      {inscriptos.length === 0 ? (
                        <div className='text-[13px] text-textMuted py-3'>
                          No hay alumnos inscriptos en esta actividad.
                        </div>
                      ) : (
                        <table
                          style={{ width: '100%', borderCollapse: 'collapse' }}
                        >
                          <thead>
                            <tr>
                              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-2 pr-3 border-b border-border'>
                                Alumno
                              </th>
                              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-2 pr-3 border-b border-border'>
                                DNI
                              </th>
                              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-2 pr-3 border-b border-border'>
                                Curso
                              </th>
                              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-2 pr-3 border-b border-border'>
                                Fecha de inscripción
                              </th>
                              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-2 pr-3 border-b border-border'>
                                Acción
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {inscriptos.map((i) => (
                              <tr key={i.id_inscripcion_act}>
                                <td className='py-2 pr-3 text-[13px] border-b border-border align-middle font-bold'>
                                  {i.alumnos?.apellido}, {i.alumnos?.nombre}
                                </td>
                                <td className='py-2 pr-3 text-[13px] border-b border-border align-middle text-textMuted'>
                                  {i.alumnos?.dni}
                                </td>
                                <td className='py-2 pr-3 text-[13px] border-b border-border align-middle'>
                                  {i.alumnos?.cursos
                                    ? `${i.alumnos.cursos.nivel} ${i.alumnos.cursos.grado_anio} "${i.alumnos.cursos.division}"`
                                    : 'Sin curso'}
                                </td>
                                <td className='py-2 pr-3 text-[13px] border-b border-border align-middle text-textMuted text-xs'>
                                  {new Date(
                                    i.fecha_inscripcion,
                                  ).toLocaleDateString('es-AR')}
                                </td>
                                <td className='py-2 pr-3 text-[13px] border-b border-border align-middle'>
                                  <button
                                    className='bg-[#E74C3C1A] text-red border-0 rounded-lg py-[5px] px-3 text-xs font-extrabold cursor-pointer'
                                    onClick={() =>
                                      quitarInscripcion(
                                        i.id_inscripcion_act,
                                        a.id_actividad,
                                      )
                                    }
                                  >
                                    Quitar
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
          {items.length === 0 && (
            <tr>
              <td
                className={`${tdCell} text-textMuted`}
                colSpan={5}
              >
                Sin actividades cargadas.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
          🎨 Actividades extracurriculares
        </h2>
        <button
          className={btnPrimary}
          onClick={abrirNueva}
        >
          + Nueva actividad
        </button>
      </div>

      {showForm && (
        <div className={`${card} mb-6`}>
          <div className='text-[15px] font-extrabold text-text mb-5'>
            {editId ? 'Editar actividad' : 'Nueva actividad'}
          </div>
          <form
            onSubmit={guardar}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr',
                gap: 14,
              }}
            >
              <div>
                <span className={fieldLabel}>
                  Nombre
                </span>
                <input
                  className={inputField}
                  required
                  value={form.nombre}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, nombre: e.target.value }))
                  }
                />
              </div>
              <div>
                <span className={fieldLabel}>
                  Tipo
                </span>
                <select
                  className={selectField}
                  value={form.tipo}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, tipo: e.target.value }))
                  }
                >
                  <option value='Idioma'>Idioma</option>
                  <option value='Deporte'>Deporte</option>
                </select>
              </div>
              <div>
                <span className={fieldLabel}>
                  Cupo máximo
                </span>
                <input
                  className={inputField}
                  type='number'
                  min={1}
                  required
                  value={form.cupo_maximo}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      cupo_maximo: Number(e.target.value),
                    }))
                  }
                />
              </div>
            </div>
            <div>
              <span className={fieldLabel}>
                Descripción (opcional)
              </span>
              <input
                className={inputField}
                value={form.descripcion}
                onChange={(e) =>
                  setForm((p) => ({ ...p, descripcion: e.target.value }))
                }
              />
            </div>
            {msg && (
              <div style={{ fontSize: 12, color: '#E74C3C', fontWeight: 700 }}>
                {msg}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type='submit'
                className={btnPrimary}
              >
                {editId ? 'Guardar cambios' : 'Crear actividad'}
              </button>
              <button
                type='button'
                className={btnSecondary}
                onClick={() => setShowForm(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {renderGrupo('🗣️ Idiomas', idiomas)}
      {renderGrupo('⚽ Disciplinas deportivas', deportes)}
    </div>
  )
}
