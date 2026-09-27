/**
 * LegajoAlumno — legajo consolidado de un alumno: datos personales, resumen
 * académico, calificaciones, amonestaciones y documentación.
 */
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../../lib/api'
import type { AlumnoLegajo, Calificacion, DocumentoAlumno, UsuarioAlumno } from '../../types'
import { TIPOS_DOC } from '../../constants'
import {
  badge,
  btnDanger,
  btnPrimarySm,
  btnSecondarySm,
  btnPrimary,
  btnSecondary,
  card,
  fieldLabel,
  inputField,
  selectField,
  tdCell,
  thCell,
} from '../../ui/styles'
import { PasswordInput, TablaScroll } from '../../ui/components'

/**
 * Usuario con el que el alumno entra a la plataforma: muestra el email y deja
 * restablecer la contraseña al DNI, asignar otra, o crear el usuario si el
 * alumno se cargó sin él.
 */
function AccesoAlumno({
  idAlumno,
  dni,
  usuario,
  onCambio,
}: {
  idAlumno: number
  dni: string
  usuario: UsuarioAlumno | null
  onCambio: () => void
}) {
  const [email, setEmail] = useState('')
  const [nueva, setNueva] = useState('')
  const [asignando, setAsignando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')

  const ok = msg.startsWith('✅')

  const crearAcceso = async (e: FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    setMsg('')
    const { data, error } = await api.post<AlumnoLegajo>(`/alumnos/${idAlumno}/acceso`, {
      email: email.trim() || null,
    })
    setGuardando(false)
    if (error) return setMsg('Error: ' + error.message)
    setMsg(`✅ Acceso creado. Entra con ${data.usuarios?.email} y su DNI como contraseña.`)
    setEmail('')
    onCambio()
  }

  const restablecer = async () => {
    if (!window.confirm(`¿Restablecer la contraseña del alumno a su DNI (${dni})?`)) return
    setGuardando(true)
    setMsg('')
    const { error } = await api.patch(`/alumnos/${idAlumno}/password`, {})
    setGuardando(false)
    setMsg(error ? 'Error: ' + error.message : `✅ Contraseña restablecida: ahora es el DNI (${dni}).`)
  }

  const asignar = async (e: FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    setMsg('')
    const { error } = await api.patch(`/alumnos/${idAlumno}/password`, { nueva })
    setGuardando(false)
    if (error) return setMsg('Error: ' + error.message)
    setMsg('✅ Contraseña actualizada. Comunicásela al alumno.')
    setNueva('')
    setAsignando(false)
  }

  return (
    <div className={`${card} mb-5`}>
      <div className='text-[15px] font-extrabold text-text mb-4'>
        Acceso a la plataforma
      </div>

      {usuario ? (
        <>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-[18px] mb-4'>
            <div>
              <div className='text-[11px] font-extrabold text-textMuted mb-[2px]'>
                Email para ingresar
              </div>
              <div className='text-sm font-bold break-all'>{usuario.email}</div>
            </div>
            <div>
              <div className='text-[11px] font-extrabold text-textMuted mb-[2px]'>
                Usuario
              </div>
              <div className='text-sm font-bold'>
                {usuario.activo ? 'Activo' : 'Desactivado'}
              </div>
            </div>
          </div>

          <div className='flex flex-wrap gap-2'>
            <button
              type='button'
              className={btnSecondarySm}
              disabled={guardando}
              onClick={restablecer}
            >
              Restablecer contraseña al DNI
            </button>
            <button
              type='button'
              className={btnSecondarySm}
              disabled={guardando}
              onClick={() => {
                setAsignando((v) => !v)
                setMsg('')
              }}
            >
              {asignando ? 'Cancelar' : 'Asignar otra contraseña'}
            </button>
          </div>

          {asignando && (
            <form onSubmit={asignar} className='flex flex-col sm:flex-row sm:items-end gap-3 mt-4'>
              <div className='flex-1 sm:max-w-[320px]'>
                <label className={fieldLabel} htmlFor='alumno-password-nueva'>
                  Contraseña nueva
                </label>
                <PasswordInput
                  id='alumno-password-nueva'
                  required
                  minLength={6}
                  autoComplete='new-password'
                  value={nueva}
                  onChange={(e) => setNueva(e.target.value)}
                  placeholder='Mínimo 6 caracteres'
                />
              </div>
              <button type='submit' className={btnPrimarySm} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar contraseña'}
              </button>
            </form>
          )}
        </>
      ) : (
        <form onSubmit={crearAcceso} className='flex flex-col gap-3'>
          <p className='text-[13px] text-textMuted m-0'>
            Este alumno todavía no tiene usuario para ingresar a la plataforma.
          </p>
          <div className='flex flex-col sm:flex-row sm:items-end gap-3'>
            <div className='flex-1 sm:max-w-[320px]'>
              <label className={fieldLabel} htmlFor='alumno-acceso-email'>
                Email del alumno (opcional)
              </label>
              <input
                id='alumno-acceso-email'
                type='email'
                className={inputField}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={`${dni}@alumno.local`}
              />
            </div>
            <button type='submit' className={btnPrimarySm} disabled={guardando}>
              {guardando ? 'Creando...' : 'Crear acceso'}
            </button>
          </div>
          <p className='text-[11px] text-textMuted m-0'>
            Sin email propio entra con {dni}@alumno.local. La contraseña inicial es su DNI.
          </p>
        </form>
      )}

      {msg && (
        <div role='status' className={`text-[13px] font-bold mt-3 ${ok ? 'text-green' : 'text-red'}`}>
          {msg}
        </div>
      )}
    </div>
  )
}

export function LegajoAlumno({
  idAlumno,
  onClose,
}: {
  idAlumno: number
  onClose: () => void
}) {
  const [alumno, setAlumno] = useState<AlumnoLegajo | null>(null)
  const [califs, setCalifs] = useState<Calificacion[]>([])
  const [asist, setAsist] = useState<{ estado: string }[]>([])
  const [amonest, setAmonest] = useState<
    {
      id_amonestacion: number
      tipo: string
      descripcion: string
      fecha: string
    }[]
  >([])
  const [documentos, setDocumentos] = useState<DocumentoAlumno[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [docNombre, setDocNombre] = useState('')
  const [docTipo, setDocTipo] = useState(TIPOS_DOC[0])
  const [subiendo, setSubiendo] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const base = `/alumnos/${idAlumno}`
    const [al, ca, as, am, doc] = await Promise.all([
      api.get<AlumnoLegajo>(base),
      api.get<Calificacion[]>(`${base}/calificaciones`),
      api.get<{ estado: string }[]>(`${base}/asistencias`),
      api.get<typeof amonest>(`${base}/amonestaciones`),
      api.get<DocumentoAlumno[]>(`${base}/documentos`),
    ])
    if (al.data) setAlumno(al.data)
    if (ca.data) setCalifs(ca.data)
    if (as.data) setAsist(as.data)
    if (am.data) setAmonest(am.data)
    if (doc.data) setDocumentos(doc.data)
  }, [idAlumno])

  useEffect(() => {
    load()
  }, [load])

  const subirDocumento = async (e: FormEvent) => {
    e.preventDefault()
    setMsg('')
    if (!file) {
      setMsg('Seleccioná un archivo.')
      return
    }
    setSubiendo(true)
    try {
      const body = new FormData()
      body.append('archivo', file)
      body.append('nombre', docNombre || file.name)
      body.append('tipo', docTipo)
      const { error } = await api.post(`/alumnos/${idAlumno}/documentos`, body)
      if (error) throw new Error(error.message)
      setMsg('✅ Documento cargado.')
      setFile(null)
      setDocNombre('')
      load()
    } catch (err) {
      setMsg('Error: ' + (err as Error).message)
    } finally {
      setSubiendo(false)
    }
  }

  const eliminarDocumento = async (d: DocumentoAlumno) => {
    if (!window.confirm('¿Eliminar este documento?')) return
    // El backend borra también el archivo guardado.
    await api.delete(`/alumnos/documentos/${d.id_documento}`)
    load()
  }

  // ── Derivados ──────────────────────────────────────────────
  const promedioGeneral = califs.length
    ? (califs.reduce((a, c) => a + Number(c.nota), 0) / califs.length).toFixed(
        2,
      )
    : '—'

  const asistResumen = asist.reduce(
    (acc, a) => {
      acc[a.estado] = (acc[a.estado] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )
  const totalAsist = asist.length
  const pctPresente =
    totalAsist > 0
      ? Math.round(((asistResumen['Presente'] ?? 0) / totalAsist) * 100)
      : null

  const dato = (etiqueta: string, valor: string) => (
    <div>
      <div className='text-[11px] font-extrabold text-textMuted block mb-[2px]'>
        {etiqueta}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700 }}>{valor}</div>
    </div>
  )

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
          📁 Legajo del alumno
        </h2>
        <button className={btnSecondary} onClick={onClose}>
          ← Volver a la lista
        </button>
      </div>

      {/* Datos personales */}
      <div className={`${card} mb-5`}>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Datos personales
        </div>
        {alumno ? (
          <div
            className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-[18px]'
          >
            {dato('Apellido y nombre', `${alumno.apellido}, ${alumno.nombre}`)}
            {dato('DNI', alumno.dni)}
            {dato(
              'Fecha de nacimiento',
              alumno.fecha_nacimiento
                ? new Date(
                    alumno.fecha_nacimiento + 'T00:00:00',
                  ).toLocaleDateString('es-AR')
                : '—',
            )}
            {dato(
              'Curso',
              alumno.cursos
                ? `${alumno.cursos.nivel} — ${alumno.cursos.grado_anio} "${alumno.cursos.division}"`
                : 'Sin asignar',
            )}
            {dato('Obra social', alumno.obra_social ?? '—')}
            {dato('Estado', alumno.activo ? 'Activo' : 'Inactivo')}
          </div>
        ) : (
          <div style={{ color: '#6B6B8A', fontSize: 13 }}>Cargando...</div>
        )}
      </div>

      {alumno && (
        <AccesoAlumno
          idAlumno={idAlumno}
          dni={alumno.dni}
          usuario={alumno.usuarios ?? null}
          onCambio={load}
        />
      )}

      {/* Resumen académico */}
      <div
        className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-5'
      >
        <div className={card}>
          <div className={fieldLabel}>Promedio general</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: '#5B35C5' }}>
            {promedioGeneral}
          </div>
          <div style={{ fontSize: 12, color: '#6B6B8A' }}>
            {califs.length} calificaciones registradas
          </div>
        </div>
        <div className={card}>
          <div className={fieldLabel}>Asistencia</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: '#27AE60' }}>
            {pctPresente !== null ? `${pctPresente}%` : '—'}
          </div>
          <div style={{ fontSize: 12, color: '#6B6B8A' }}>
            {asistResumen['Presente'] ?? 0} pres. ·{' '}
            {asistResumen['Ausente'] ?? 0} aus. · {asistResumen['Tarde'] ?? 0}{' '}
            tarde
          </div>
        </div>
        <div className={card}>
          <div className={fieldLabel}>Amonestaciones</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: '#E67E22' }}>
            {amonest.length}
          </div>
          <div style={{ fontSize: 12, color: '#6B6B8A' }}>
            registradas en su trayectoria
          </div>
        </div>
      </div>

      {/* Historial de calificaciones */}
      <div className={`${card} mb-5`}>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Historial de calificaciones
        </div>
        <TablaScroll>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className={thCell}>Materia</th>
                <th className={thCell}>Trimestre</th>
                <th className={thCell}>Evaluación</th>
                <th className={thCell}>Nota</th>
                <th className={thCell}>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {califs.map((c) => (
                <tr key={c.id_calificacion}>
                  <td className={`${tdCell} font-bold`}>
                    {c.asignaciones?.materias?.nombre ?? '—'}
                  </td>
                  <td className={tdCell}>{c.trimestre}°</td>
                  <td className={`${tdCell} text-textMuted`}>
                    {c.tipo_evaluacion}
                  </td>
                  <td className={tdCell}>
                    <span
                      style={badge(Number(c.nota) >= 6 ? '#27AE60' : '#E74C3C')}
                    >
                      {c.nota}
                    </span>
                  </td>
                  <td className={`${tdCell} text-textMuted text-xs`}>
                    {new Date(c.fecha_carga).toLocaleDateString('es-AR')}
                  </td>
                </tr>
              ))}
              {califs.length === 0 && (
                <tr>
                  <td className={`${tdCell} text-textMuted`} colSpan={5}>
                    Sin calificaciones registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TablaScroll>
      </div>

      {/* Amonestaciones */}
      <div className={`${card} mb-5`}>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Amonestaciones
        </div>
        {amonest.length === 0 ? (
          <div style={{ color: '#6B6B8A', fontSize: 13 }}>
            Sin amonestaciones registradas.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {amonest.map((a) => (
              <div
                key={a.id_amonestacion}
                style={{
                  border: `1px solid ${'#E8E6F5'}`,
                  borderRadius: 10,
                  padding: 12,
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                }}
              >
                <span className='inline-block bg-[#E67E221A] text-orange rounded-[20px] px-[10px] py-[3px] text-[11px] font-extrabold'>
                  {a.tipo}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13 }}>{a.descripcion}</div>
                  <div style={{ fontSize: 11, color: '#6B6B8A' }}>
                    {new Date(a.fecha).toLocaleDateString('es-AR')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Documentación */}
      <div className={card}>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Documentación del legajo
        </div>
        <form
          onSubmit={subirDocumento}
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            marginBottom: 18,
          }}
        >
          <div style={{ flex: '1 1 200px' }}>
            <span className={fieldLabel}>Nombre del documento</span>
            <input
              className={inputField}
              value={docNombre}
              placeholder='Ej: DNI frente y dorso'
              onChange={(e) => setDocNombre(e.target.value)}
            />
          </div>
          <div>
            <span className={fieldLabel}>Tipo</span>
            <select
              className={`${selectField} w-[220px]`}
              value={docTipo}
              onChange={(e) => setDocTipo(e.target.value)}
            >
              {TIPOS_DOC.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className={fieldLabel}>Archivo</span>
            <input
              type='file'
              className={`${inputField} !p-[7px]`}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <button
            type='submit'
            disabled={subiendo}
            className={`${btnPrimary}${subiendo ? ' opacity-60' : ''}`}
          >
            {subiendo ? 'Subiendo...' : 'Subir documento'}
          </button>
        </form>
        {msg && (
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 14,
              color: msg.startsWith('✅') ? '#27AE60' : '#E74C3C',
            }}
          >
            {msg}
          </div>
        )}
        <TablaScroll>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className={thCell}>Documento</th>
                <th className={thCell}>Tipo</th>
                <th className={thCell}>Fecha</th>
                <th className={thCell}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {documentos.map((d) => (
                <tr key={d.id_documento}>
                  <td className={`${tdCell} font-bold`}>{d.nombre}</td>
                  <td className={tdCell}>
                    <span className='inline-block bg-[#2980B91A] text-blue rounded-[20px] px-[10px] py-[3px] text-[11px] font-extrabold'>
                      {d.tipo ?? 'Documento'}
                    </span>
                  </td>
                  <td className={`${tdCell} text-textMuted text-xs`}>
                    {new Date(d.fecha_carga).toLocaleDateString('es-AR')}
                  </td>
                  <td className={tdCell}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <a
                        href={d.url_archivo}
                        target='_blank'
                        rel='noreferrer'
                        className='bg-purpleLight text-purple-700 border-0 rounded-btn py-[6px] px-[12px] text-xs font-extrabold cursor-pointer no-underline'
                      >
                        Ver
                      </a>
                      <button className={btnDanger} onClick={() => eliminarDocumento(d)}>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {documentos.length === 0 && (
                <tr>
                  <td className={`${tdCell} text-textMuted`} colSpan={4}>
                    Sin documentación cargada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TablaScroll>
      </div>
    </div>
  )
}
