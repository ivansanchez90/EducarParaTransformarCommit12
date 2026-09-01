/**
 * Gestión de usuarios del panel: alta de directivos, docentes, alumnos y
 * tutores (creando también sus registros asociados vía edge function) y
 * activación/desactivación según la jerarquía del rol del actor.
 */
import { useState, useEffect, useCallback } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { UsuarioPanel, PrefillUsuario, Curso } from '../../types'
import {
  btnPrimary,
  btnDanger,
  inputField,
  selectField,
  fieldLabel,
  thCell,
  tdCell,
  card,
  badge,
} from '../../ui/styles'

export function GestionUsuarios({
  prefill,
  onPrefillConsumed,
  rolActor,
}: {
  prefill?: PrefillUsuario | null
  onPrefillConsumed?: () => void
  rolActor?: string
} = {}) {
  // Jerarquía (solo UX): un Directivo no puede activar/desactivar a un Admin u
  // otro Directivo; un Admin puede con todos.
  const puedeGestionar = (rolObjetivo: string) =>
    rolActor === 'Admin' ||
    (rolActor === 'Directivo' && !['Admin', 'Directivo'].includes(rolObjetivo))
  const [usuarios, setUsuarios] = useState<UsuarioPanel[]>([])
  const [cursos, setCursos] = useState<Curso[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    email: '',
    password: '',
    nombre: '',
    apellido: '',
    rol: 'Docente',
  })
  const ALUMNO_VACIO = {
    nombre: '',
    apellido: '',
    dni: '',
    fecha_nacimiento: '',
    id_curso: '',
    obra_social: '',
  }
  const [alumnoForm, setAlumnoForm] = useState(ALUMNO_VACIO)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const [{ data: us }, { data: cu }] = await Promise.all([
      supabase.from('usuarios').select('*').order('apellido'),
      supabase.from('cursos').select('*').eq('activo', true),
    ])
    if (us) setUsuarios(us as UsuarioPanel[])
    if (cu) setCursos(cu as Curso[])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!prefill) return
    setForm({
      email: prefill.email,
      password: prefill.password,
      nombre: prefill.nombre,
      apellido: prefill.apellido,
      rol: prefill.rol,
    })
    setAlumnoForm(
      prefill.alumno
        ? {
            nombre: prefill.alumno.nombre,
            apellido: prefill.alumno.apellido,
            dni: prefill.alumno.dni,
            fecha_nacimiento: prefill.alumno.fecha_nacimiento,
            id_curso: '',
            obra_social: '',
          }
        : ALUMNO_VACIO,
    )
    setMsg('')
    setShowForm(true)
    onPrefillConsumed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill, onPrefillConsumed])

  // Crea el usuario vía edge function y luego fuerza nombre/apellido/rol en la
  // fila de `usuarios`, porque el backend desplegado no respeta esos valores
  // (los crea sin nombre y con un rol por defecto). Devuelve el id_usuario.
  const crearUsuario = async (datos: {
    email: string
    password: string
    nombre: string
    apellido: string
    rol: string
  }): Promise<{ error: string | null; id: string | null }> => {
    const { error } = await supabase.functions.invoke('crear-usuario', {
      body: datos,
    })
    if (error) return { error: error.message, id: null }

    const { data: u } = await supabase
      .from('usuarios')
      .select('id_usuario')
      .eq('email', datos.email)
      .single()
    if (!u?.id_usuario) {
      return {
        error:
          'No se encontró el usuario recién creado para completar sus datos.',
        id: null,
      }
    }
    const { error: updErr } = await supabase
      .from('usuarios')
      .update({
        nombre: datos.nombre,
        apellido: datos.apellido,
        rol: datos.rol,
      })
      .eq('id_usuario', u.id_usuario)
    if (updErr) {
      return {
        error: 'no se pudo guardar nombre/rol del usuario: ' + updErr.message,
        id: u.id_usuario,
      }
    }
    return { error: null, id: u.id_usuario }
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg('')

    const { error: errUser, id: idUsuario } = await crearUsuario({
      email: form.email,
      password: form.password,
      nombre: form.nombre,
      apellido: form.apellido,
      rol: form.rol,
    })
    if (errUser) {
      setMsg('Error: ' + errUser)
      setLoading(false)
      return
    }

    // Si es Tutor: crear también el usuario del alumno (email generado desde el
    // DNI) y el registro en `alumnos` vinculado al alumno y al tutor.
    if (form.rol === 'Padre') {
      const emailAlumno = `${alumnoForm.dni}@alumno.local`
      const { error: errAlumno, id: idAlumno } = await crearUsuario({
        email: emailAlumno,
        password: alumnoForm.dni,
        nombre: alumnoForm.nombre,
        apellido: alumnoForm.apellido,
        rol: 'Alumno',
      })
      if (errAlumno) {
        setMsg(
          '⚠️ Tutor creado, pero hubo un error al crear el usuario del alumno: ' +
            errAlumno,
        )
        setLoading(false)
        load()
        return
      }

      const { error: alErr } = await supabase.from('alumnos').insert([
        {
          nombre: alumnoForm.nombre,
          apellido: alumnoForm.apellido,
          dni: alumnoForm.dni,
          fecha_nacimiento: alumnoForm.fecha_nacimiento || null,
          id_curso: alumnoForm.id_curso ? Number(alumnoForm.id_curso) : null,
          id_usuario: idAlumno,
          id_usuario_padre: idUsuario,
          obra_social: alumnoForm.obra_social || null,
        },
      ])
      if (alErr) {
        setMsg(
          '⚠️ Usuarios creados, pero hubo un error al registrar el alumno: ' +
            alErr.message,
        )
        setLoading(false)
        load()
        return
      }
    }

    // Si es Docente: crear también su registro en `docentes` para que aparezca
    // en el panel de Docentes (la fila no se crea sola desde el backend).
    if (form.rol === 'Docente') {
      const { error: docErr } = await supabase.from('docentes').insert([
        {
          id_usuario: idUsuario,
          // dni va NULL (no ''): la columna es UNIQUE y '' chocaría entre
          // docentes sin DNI cargado.
          dni: null,
          activo: true,
        },
      ])
      if (docErr) {
        setMsg(
          '⚠️ Usuario creado, pero no se pudo registrar en Docentes: ' +
            docErr.message,
        )
        setLoading(false)
        load()
        return
      }
    }

    setMsg(
      form.rol === 'Padre'
        ? '✅ Tutor y alumno (usuario + registro) creados correctamente.'
        : '✅ Usuario creado correctamente.',
    )
    setForm({
      email: '',
      password: '',
      nombre: '',
      apellido: '',
      rol: 'Docente',
    })
    setAlumnoForm(ALUMNO_VACIO)
    setShowForm(false)
    load()
    setLoading(false)
  }

  const toggleActivo = async (id: string, activo: boolean) => {
    await supabase
      .from('usuarios')
      .update({ activo: !activo })
      .eq('id_usuario', id)
    load()
  }

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
          👥 Usuarios
        </h2>
        <button
          className={btnPrimary}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancelar' : '+ Nuevo usuario'}
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className={`${card} mb-6`}>
          <div className='text-[15px] font-extrabold text-text mb-5'>
            Crear nuevo usuario
          </div>
          <form
            onSubmit={handleCreate}
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}
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
                Apellido
              </span>
              <input
                className={inputField}
                required
                value={form.apellido}
                onChange={(e) =>
                  setForm((p) => ({ ...p, apellido: e.target.value }))
                }
              />
            </div>
            <div>
              <span className={fieldLabel}>
                Email
              </span>
              <input
                type='email'
                className={inputField}
                required
                value={form.email}
                onChange={(e) =>
                  setForm((p) => ({ ...p, email: e.target.value }))
                }
              />
            </div>
            <div>
              <span className={fieldLabel}>
                Contraseña
              </span>
              <input
                type='password'
                className={inputField}
                required
                minLength={6}
                value={form.password}
                onChange={(e) =>
                  setForm((p) => ({ ...p, password: e.target.value }))
                }
              />
            </div>
            <div>
              <span className={fieldLabel}>
                Rol
              </span>
              <select
                className={selectField}
                value={form.rol}
                onChange={(e) =>
                  setForm((p) => ({ ...p, rol: e.target.value }))
                }
              >
                <option value='Docente'>Docente</option>
                <option value='Directivo'>Directivo</option>
                <option value='Admin'>Admin</option>
                <option value='Alumno'>Alumno</option>
                <option value='Padre'>Tutor</option>
              </select>
            </div>

            {form.rol === 'Padre' && (
              <div
                style={{
                  gridColumn: '1/-1',
                  borderTop: `1px solid ${'#E8E6F5'}`,
                  paddingTop: 16,
                  marginTop: 4,
                }}
              >
                <div className='text-[15px] font-extrabold text-text mb-5'>
                  Datos del alumno asociado
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 14,
                  }}
                >
                  <div>
                    <span className={fieldLabel}>
                      Nombre del alumno
                    </span>
                    <input
                      className={inputField}
                      required
                      value={alumnoForm.nombre}
                      onChange={(e) =>
                        setAlumnoForm((p) => ({ ...p, nombre: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <span className={fieldLabel}>
                      Apellido del alumno
                    </span>
                    <input
                      className={inputField}
                      required
                      value={alumnoForm.apellido}
                      onChange={(e) =>
                        setAlumnoForm((p) => ({
                          ...p,
                          apellido: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <span className={fieldLabel}>
                      DNI del alumno
                    </span>
                    <input
                      className={inputField}
                      required
                      value={alumnoForm.dni}
                      onChange={(e) =>
                        setAlumnoForm((p) => ({ ...p, dni: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <span className={fieldLabel}>
                      Fecha de nacimiento
                    </span>
                    <input
                      type='date'
                      className={inputField}
                      value={alumnoForm.fecha_nacimiento}
                      onChange={(e) =>
                        setAlumnoForm((p) => ({
                          ...p,
                          fecha_nacimiento: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <span className={fieldLabel}>
                      Curso
                    </span>
                    <select
                      className={selectField}
                      value={alumnoForm.id_curso}
                      onChange={(e) =>
                        setAlumnoForm((p) => ({
                          ...p,
                          id_curso: e.target.value,
                        }))
                      }
                    >
                      <option value=''>Sin asignar</option>
                      {cursos.map((c) => (
                        <option key={c.id_curso} value={c.id_curso}>
                          {c.nivel} — {c.grado_anio} "{c.division}"
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className={fieldLabel}>
                      Obra social
                    </span>
                    <input
                      className={inputField}
                      value={alumnoForm.obra_social}
                      onChange={(e) =>
                        setAlumnoForm((p) => ({
                          ...p,
                          obra_social: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 12,
                    fontSize: 12,
                    color: '#6B6B8A',
                    background: '#EEE9FF',
                    borderRadius: 8,
                    padding: '8px 12px',
                  }}
                >
                  Acceso del alumno al portal — email:{' '}
                  <strong>
                    {alumnoForm.dni
                      ? `${alumnoForm.dni}@alumno.local`
                      : '(se genera con el DNI)'}
                  </strong>{' '}
                  · contraseña: <strong>el DNI</strong>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                type='submit'
                disabled={loading}
                className={`${btnPrimary} w-full${loading ? ' opacity-60' : ''}`}
              >
                {loading
                  ? 'Creando...'
                  : form.rol === 'Padre'
                    ? 'Crear tutor y alumno'
                    : 'Crear usuario'}
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

      {/* Tabla */}
      <div className={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className={thCell}>
                Nombre
              </th>
              <th className={thCell}>
                Email
              </th>
              <th className={thCell}>
                Rol
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
            {usuarios.map((u) => (
              <tr key={u.id_usuario}>
                <td className={`${tdCell} font-bold`}>
                  {u.apellido}, {u.nombre}
                </td>
                <td className={`${tdCell} text-textMuted`}>
                  {u.email}
                </td>
                <td className={tdCell}>
                  <span
                    style={badge(
                      u.rol === 'Admin' || u.rol === 'Directivo'
                        ? '#5B35C5'
                        : '#2980B9',
                    )}
                  >
                    {u.rol}
                  </span>
                </td>
                <td className={tdCell}>
                  <span style={badge(u.activo ? '#27AE60' : '#E74C3C')}>
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className={tdCell}>
                  {puedeGestionar(u.rol) ? (
                    <button
                      className={
                        u.activo
                          ? btnDanger
                          : 'bg-[#27AE601A] text-green border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                      }
                      onClick={() => toggleActivo(u.id_usuario, u.activo)}
                    >
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  ) : (
                    <span className='text-[11px] text-textMuted'>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
