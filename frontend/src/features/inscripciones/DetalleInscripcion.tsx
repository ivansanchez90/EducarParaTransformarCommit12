/**
 * DetalleInscripcion — revisión de una solicitud de preinscripción.
 *
 * Muestra todos los datos cargados desde la web, permite corregirlos y dejar
 * observaciones, y desde acá se aprueba la solicitud dando de alta al alumno
 * (con sus usuarios de acceso) o se la rechaza.
 */
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../../lib/api'
import type { Curso, InscripcionDetalle } from '../../types'
import { ESTADOS_INSCRIPCION } from '../../constants'
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  card,
  fieldLabel,
  inputField,
  selectField,
} from '../../ui/styles'

const FORM_VACIO = {
  nombre_aspirante: '',
  apellido_aspirante: '',
  dni_aspirante: '',
  fecha_nacimiento_aspirante: '',
  nombre_tutor: '',
  email_tutor: '',
  telefono_tutor: '',
  nivel_solicitado: '',
  grado_anio_solicitado: '',
  observaciones: '',
}

export function DetalleInscripcion({
  idInscripcion,
  onClose,
  onCambio,
}: {
  idInscripcion: number
  onClose: () => void
  /** Se llama cuando cambió algo, para refrescar el listado de atrás. */
  onCambio: () => void
}) {
  const [inscripcion, setInscripcion] = useState<InscripcionDetalle | null>(null)
  const [cursos, setCursos] = useState<Curso[]>([])
  const [form, setForm] = useState(FORM_VACIO)
  const [documentacion, setDocumentacion] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  // Alta del alumno
  const [idCurso, setIdCurso] = useState('')
  const [crearUsuarios, setCrearUsuarios] = useState(true)
  const [accesos, setAccesos] = useState<{ email: string; password_inicial: string } | null>(null)

  const load = useCallback(async () => {
    const [{ data }, { data: cu }] = await Promise.all([
      api.get<InscripcionDetalle>(`/inscripciones/${idInscripcion}`),
      api.get<Curso[]>('/cursos'),
    ])
    if (cu) setCursos(cu)
    if (!data) return
    setInscripcion(data)
    setDocumentacion(data.documentacion_completa)
    setForm({
      nombre_aspirante: data.nombre_aspirante,
      apellido_aspirante: data.apellido_aspirante ?? '',
      dni_aspirante: data.dni_aspirante,
      fecha_nacimiento_aspirante: data.fecha_nacimiento_aspirante ?? '',
      nombre_tutor: data.nombre_tutor,
      email_tutor: data.email_tutor,
      telefono_tutor: data.telefono_tutor ?? '',
      nivel_solicitado: data.nivel_solicitado,
      grado_anio_solicitado: data.grado_anio_solicitado ?? '',
      observaciones: data.observaciones ?? '',
    })
  }, [idInscripcion])

  useEffect(() => {
    load()
  }, [load])

  const campo = (k: keyof typeof FORM_VACIO) => (e: { target: { value: string } }) =>
    setForm((p) => ({ ...p, [k]: e.target.value }))

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    const { error } = await api.patch(`/inscripciones/${idInscripcion}`, {
      ...form,
      apellido_aspirante: form.apellido_aspirante || null,
      telefono_tutor: form.telefono_tutor || null,
      grado_anio_solicitado: form.grado_anio_solicitado || null,
      observaciones: form.observaciones || null,
      fecha_nacimiento_aspirante: form.fecha_nacimiento_aspirante || null,
      documentacion_completa: documentacion,
    })
    setMsg(error ? 'Error: ' + error.message : '✅ Datos de la solicitud guardados.')
    if (!error) {
      await load()
      onCambio()
    }
    setLoading(false)
  }

  const cambiarEstado = async (estado: string) => {
    setLoading(true)
    setMsg('')
    const { error } = await api.patch(`/inscripciones/${idInscripcion}`, { estado })
    setMsg(error ? 'Error: ' + error.message : `✅ Solicitud marcada como "${estado}".`)
    if (!error) {
      await load()
      onCambio()
    }
    setLoading(false)
  }

  /** Aprueba y da de alta al alumno con los datos de la solicitud. */
  const aprobar = async () => {
    if (!confirm('¿Aprobar la solicitud y dar de alta al alumno?')) return
    setLoading(true)
    setMsg('')
    const { data, error } = await api.post<{
      alumno: { id_alumno: number; nombre: string; apellido: string }
      accesos: { alumno: { email: string; password_inicial: string } } | null
    }>(`/inscripciones/${idInscripcion}/aprobar`, {
      id_curso: idCurso ? Number(idCurso) : null,
      crear_usuarios: crearUsuarios,
    })
    if (error) setMsg('Error: ' + error.message)
    else {
      setMsg(
        `✅ Alumno dado de alta: ${data.alumno.apellido}, ${data.alumno.nombre} (legajo ${data.alumno.id_alumno}).`,
      )
      setAccesos(data.accesos?.alumno ?? null)
      await load()
      onCambio()
    }
    setLoading(false)
  }

  if (!inscripcion) {
    return (
      <div className={`${card} text-center text-textMuted py-10`}>Cargando solicitud...</div>
    )
  }

  const yaDadoDeAlta = !!inscripcion.id_alumno_creado

  return (
    <div>
      <div className='flex flex-wrap gap-3 justify-between items-center mb-5'>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
          📋 Solicitud #{inscripcion.id_inscripcion}
        </h2>
        <button className={btnSecondary} onClick={onClose}>
          ← Volver al listado
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
          {accesos && (
            <div className='font-normal mt-2 text-text'>
              Acceso del alumno al portal: <strong>{accesos.email}</strong> · contraseña
              inicial <strong>{accesos.password_inicial}</strong> (que pueda cambiarla desde
              su portal).
            </div>
          )}
        </div>
      )}

      {/* ── Datos de la solicitud ── */}
      <div className={`${card} mb-6`}>
        <div className='flex flex-wrap gap-3 justify-between items-center mb-5'>
          <div className='text-[15px] font-extrabold text-text'>Datos recibidos</div>
          <div className='text-[12px] text-textMuted'>
            Enviada el {new Date(inscripcion.fecha_solicitud).toLocaleString('es-AR')}
          </div>
        </div>

        <form onSubmit={guardar} className='grid grid-cols-1 sm:grid-cols-2 gap-[14px]'>
          <div className='col-span-full text-xs font-black text-purple-700 uppercase tracking-[0.08em]'>
            Aspirante
          </div>
          <div>
            <span className={fieldLabel}>Nombre *</span>
            <input className={inputField} required value={form.nombre_aspirante} onChange={campo('nombre_aspirante')} />
          </div>
          <div>
            <span className={fieldLabel}>Apellido</span>
            <input className={inputField} value={form.apellido_aspirante} onChange={campo('apellido_aspirante')} />
          </div>
          <div>
            <span className={fieldLabel}>DNI *</span>
            <input className={inputField} required value={form.dni_aspirante} onChange={campo('dni_aspirante')} />
          </div>
          <div>
            <span className={fieldLabel}>Fecha de nacimiento</span>
            <input
              type='date'
              className={inputField}
              value={form.fecha_nacimiento_aspirante}
              onChange={campo('fecha_nacimiento_aspirante')}
            />
          </div>
          <div>
            <span className={fieldLabel}>Nivel solicitado *</span>
            <input className={inputField} required value={form.nivel_solicitado} onChange={campo('nivel_solicitado')} />
          </div>
          <div>
            <span className={fieldLabel}>Grado/año solicitado</span>
            <input
              className={inputField}
              value={form.grado_anio_solicitado}
              onChange={campo('grado_anio_solicitado')}
            />
          </div>

          <div className='col-span-full text-xs font-black text-purple-700 uppercase tracking-[0.08em] mt-2'>
            Padre / madre / tutor
          </div>
          <div>
            <span className={fieldLabel}>Nombre y apellido *</span>
            <input className={inputField} required value={form.nombre_tutor} onChange={campo('nombre_tutor')} />
          </div>
          <div>
            <span className={fieldLabel}>Email *</span>
            <input type='email' className={inputField} required value={form.email_tutor} onChange={campo('email_tutor')} />
          </div>
          <div>
            <span className={fieldLabel}>Teléfono</span>
            <input className={inputField} value={form.telefono_tutor} onChange={campo('telefono_tutor')} />
          </div>

          <div className='col-span-full text-xs font-black text-purple-700 uppercase tracking-[0.08em] mt-2'>
            Seguimiento
          </div>
          <div className='col-span-full'>
            <span className={fieldLabel}>Observaciones internas</span>
            <textarea
              className={`${inputField} min-h-[70px]`}
              placeholder='Ej: falta el certificado de vacunas'
              value={form.observaciones}
              onChange={campo('observaciones')}
            />
          </div>
          <label className='flex items-center gap-2 text-[13px] font-bold text-text cursor-pointer'>
            <input
              type='checkbox'
              checked={documentacion}
              onChange={(e) => setDocumentacion(e.target.checked)}
            />
            Documentación completa
          </label>
          <div className='flex items-end justify-end'>
            <button type='submit' className={btnPrimary} disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Resolución ── */}
      <div className={card}>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Resolución de la solicitud
        </div>

        {yaDadoDeAlta ? (
          <div className='text-[13px]'>
            <div className='font-bold text-[#27AE60] mb-2'>
              ✓ Solicitud aprobada y alumno dado de alta.
            </div>
            {inscripcion.alumnos && (
              <div className='text-textMuted'>
                {inscripcion.alumnos.apellido}, {inscripcion.alumnos.nombre} · legajo{' '}
                {inscripcion.alumnos.id_alumno} · DNI {inscripcion.alumnos.dni} ·{' '}
                {inscripcion.alumnos.cursos
                  ? `${inscripcion.alumnos.cursos.nivel} ${inscripcion.alumnos.cursos.grado_anio}° ${inscripcion.alumnos.cursos.division}`
                  : 'sin curso asignado'}
                . El resto de los datos se completan desde el módulo de Alumnos.
              </div>
            )}
          </div>
        ) : (
          <>
            <div className='flex flex-wrap gap-4 items-end mb-4'>
              <div>
                <span className={fieldLabel}>Estado</span>
                <select
                  className={selectField}
                  value={inscripcion.estado}
                  onChange={(e) => cambiarEstado(e.target.value)}
                >
                  {ESTADOS_INSCRIPCION.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className={fieldLabel}>Curso al que ingresa</span>
                <select className={selectField} value={idCurso} onChange={(e) => setIdCurso(e.target.value)}>
                  <option value=''>Asignar después</option>
                  {cursos.map((c) => (
                    <option key={c.id_curso} value={c.id_curso}>
                      {c.nivel} — {c.grado_anio} "{c.division}"
                    </option>
                  ))}
                </select>
              </div>
              <label className='flex items-center gap-2 text-[13px] font-bold text-text cursor-pointer pb-[10px]'>
                <input
                  type='checkbox'
                  checked={crearUsuarios}
                  onChange={(e) => setCrearUsuarios(e.target.checked)}
                />
                Crear los usuarios de acceso (tutor y alumno)
              </label>
            </div>

            <div className='flex gap-3'>
              <button className={btnPrimary} onClick={aprobar} disabled={loading}>
                ✅ Aprobar y dar de alta al alumno
              </button>
              <button
                className={btnDanger}
                onClick={() => cambiarEstado('Rechazada')}
                disabled={loading}
              >
                Rechazar solicitud
              </button>
            </div>

            <p className='text-[12px] text-textMuted mt-4 mb-0'>
              Al aprobar se crea el alumno con estos datos. Si marcás la casilla, también se
              crean el usuario del tutor (con su email) y el del alumno
              (<code>{form.dni_aspirante || 'dni'}@alumno.local</code>), ambos con el DNI como
              contraseña inicial. Si el tutor ya tiene usuario, se reutiliza.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
