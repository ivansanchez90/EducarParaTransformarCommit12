/**
 * GestionReportes — reportes para la Dirección.
 *
 * Cada reporte se ve en pantalla y puede descargarse en PDF o CSV: el backend
 * arma el mismo documento en los tres formatos, así lo que se exporta es
 * exactamente lo que se está viendo.
 */
import { useCallback, useEffect, useState } from 'react'
import { DIAS_SEMANA, MESES } from '../../constants'
import { api, descargar, qs } from '../../lib/api'
import type { AlumnoServicios, OpcionesReportes, ReporteDoc } from '../../types'
import { TablaScroll } from '../../ui/components'
import {
  btnPrimary,
  btnSecondary,
  card,
  fieldLabel,
  inputField,
  selectField,
  tdCell,
  thCell,
} from '../../ui/styles'

type ClaveReporte =
  | 'alumnos-por-curso'
  | 'alumnos-por-materia'
  | 'alumnos-por-deporte'
  | 'alumnos-por-transporte'
  | 'ficha-alumno'
  | 'docentes-por-nivel'
  | 'ficha-docente'
  | 'ingresos'
  | 'pagos-completos'
  | 'pagos-incompletos'
  | 'pagos-deportes'
  | 'pagos-transporte'

const REPORTES: { key: ClaveReporte; icono: string; label: string; descripcion: string }[] = [
  {
    key: 'alumnos-por-curso',
    icono: '🏫',
    label: 'Alumnos por curso',
    descripcion: 'Nivel educativo, curso, legajo, apellido y nombre.',
  },
  {
    key: 'alumnos-por-materia',
    icono: '📚',
    label: 'Alumnos por materia',
    descripcion: 'Nivel, curso, materia, profesor a cargo, alumno y legajo.',
  },
  {
    key: 'alumnos-por-deporte',
    icono: '⚽',
    label: 'Alumnos por deporte',
    descripcion: 'Deporte, profesor, horario, alumno, curso y nivel educativo.',
  },
  {
    key: 'alumnos-por-transporte',
    icono: '🚌',
    label: 'Alumnos por recorrido',
    descripcion: 'Recorrido, zona, horarios, alumno, curso y nivel.',
  },
  {
    key: 'ficha-alumno',
    icono: '🧑‍🎓',
    label: 'Ficha individual del alumno',
    descripcion: 'Curso, materias, profesores, actividades y servicios.',
  },
  {
    key: 'docentes-por-nivel',
    icono: '👨‍🏫',
    label: 'Docentes por nivel',
    descripcion: 'Nivel educativo, profesor, materias a cargo y cursos.',
  },
  {
    key: 'ficha-docente',
    icono: '🗂️',
    label: 'Ficha del docente',
    descripcion: 'Datos, cursos a cargo por nivel y horarios de cada curso.',
  },
  {
    key: 'ingresos',
    icono: '💰',
    label: 'Ingresos por período',
    descripcion: 'Lo cobrado entre dos fechas, por mes o por día y por método de pago.',
  },
  {
    key: 'pagos-completos',
    icono: '✅',
    label: 'Pagos completos',
    descripcion: 'Alumnos con todas las facturas del año pagadas, o el detalle de uno.',
  },
  {
    key: 'pagos-incompletos',
    icono: '⚠️',
    label: 'Pagos incompletos',
    descripcion: 'Alumnos con facturas con saldo en el año: lo adeudado y las vencidas.',
  },
  {
    key: 'pagos-deportes',
    icono: '🏅',
    label: 'Pagos de deportes',
    descripcion: 'Facturado, pagado y saldo por deporte, nivel, horario y profesor.',
  },
  {
    key: 'pagos-transporte',
    icono: '🚐',
    label: 'Pagos de transporte',
    descripcion: 'Facturado, pagado y saldo de cada recorrido en el período.',
  },
]

const esReportePagos = (r: ClaveReporte) => r === 'pagos-completos' || r === 'pagos-incompletos'
const esReporteCobranza = (r: ClaveReporte) => r === 'pagos-deportes' || r === 'pagos-transporte'

export function GestionReportes() {
  const [opciones, setOpciones] = useState<OpcionesReportes | null>(null)
  const [alumnos, setAlumnos] = useState<AlumnoServicios[]>([])
  const [reporte, setReporte] = useState<ClaveReporte>('alumnos-por-curso')
  const [doc, setDoc] = useState<ReporteDoc | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  // Filtros
  const [nivel, setNivel] = useState('')
  const [idCurso, setIdCurso] = useState('')
  const [idMateria, setIdMateria] = useState('')
  const [idActividad, setIdActividad] = useState('')
  const [idRecorrido, setIdRecorrido] = useState('')
  const [idAlumno, setIdAlumno] = useState('')
  const [idDocenteFicha, setIdDocenteFicha] = useState('')
  // Reportes financieros
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [agrupar, setAgrupar] = useState<'mes' | 'dia'>('mes')
  const [anio, setAnio] = useState(String(new Date().getFullYear()))
  const [mes, setMes] = useState('')
  const [dia, setDia] = useState('')
  const [hora, setHora] = useState('')
  const [idDocente, setIdDocente] = useState('')

  useEffect(() => {
    api.get<OpcionesReportes>('/reportes/opciones').then(({ data }) => {
      if (data) setOpciones(data)
    })
    api.get<AlumnoServicios[]>('/servicios').then(({ data }) => {
      if (data) setAlumnos(data)
    })
  }, [])

  /** Ruta + filtros del reporte elegido, compartida por la vista y las descargas. */
  const ruta = useCallback(
    (formato?: 'pdf' | 'csv') => {
      if (reporte === 'ficha-alumno') {
        return `/reportes/alumno/${idAlumno}${qs({ formato })}`
      }
      if (reporte === 'ficha-docente') return `/reportes/docente/${idDocenteFicha}${qs({ formato })}`
      if (reporte === 'ingresos') return `/reportes/ingresos${qs({ desde, hasta, agrupar, formato })}`
      if (esReportePagos(reporte)) return `/reportes/${reporte}${qs({ anio, nivel, id_alumno: idAlumno, formato })}`
      if (reporte === 'pagos-deportes') {
        return `/reportes/pagos-deportes${qs({ anio, mes, nivel, id_actividad: idActividad, dia, hora, id_docente: idDocente, formato })}`
      }
      if (reporte === 'pagos-transporte') return `/reportes/pagos-transporte${qs({ anio, mes, nivel, id_recorrido: idRecorrido, formato })}`
      const filtros: Record<string, string | undefined> = { nivel, formato }
      if (reporte === 'alumnos-por-curso') filtros.id_curso = idCurso
      if (reporte === 'alumnos-por-materia') filtros.id_materia = idMateria
      if (reporte === 'alumnos-por-deporte') Object.assign(filtros, { id_actividad: idActividad, dia, hora, id_docente: idDocente })
      if (reporte === 'alumnos-por-transporte') filtros.id_recorrido = idRecorrido
      return `/reportes/${reporte}${qs(filtros)}`
    },
    [reporte, nivel, idCurso, idMateria, idActividad, idRecorrido, idAlumno, idDocenteFicha, desde, hasta, agrupar, anio, mes, dia, hora, idDocente],
  )

  const faltaAlumno = reporte === 'ficha-alumno' && !idAlumno
  const faltaDocente = reporte === 'ficha-docente' && !idDocenteFicha
  const faltaDato = faltaAlumno ? 'Elegí un alumno para generar su ficha.' : faltaDocente ? 'Elegí un docente para generar su ficha.' : ''

  const generar = async () => {
    setMsg('')
    if (faltaDato) {
      setMsg(faltaDato)
      return
    }
    setLoading(true)
    const { data, error } = await api.get<ReporteDoc>(ruta())
    if (error) setMsg('Error: ' + error.message)
    else setDoc(data)
    setLoading(false)
  }

  const exportar = async (formato: 'pdf' | 'csv') => {
    setMsg('')
    if (faltaDato) {
      setMsg(faltaDato)
      return
    }
    setLoading(true)
    const error = await descargar(ruta(formato))
    if (error) setMsg('Error al exportar: ' + error.message)
    setLoading(false)
  }

  const cambiarReporte = (key: ClaveReporte) => {
    setReporte(key)
    setDoc(null)
    setMsg('')
    setIdAlumno('')
    // "Alumnos por deporte" también lista idiomas, que "Pagos de deportes" no ofrece.
    setIdActividad('')
  }

  const cursosDelNivel = (opciones?.cursos ?? []).filter((c) => !nivel || c.nivel === nivel)
  const deportes = (opciones?.actividades ?? []).filter((a) => a.tipo === 'Deporte')
  const horariosDelDia = (opciones?.horariosDeportes ?? []).filter((h) => h.dia_semana === dia)
  const diasConDeporte = DIAS_SEMANA.filter((d) => (opciones?.horariosDeportes ?? []).some((h) => h.dia_semana === d))

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 20px' }}>
        📄 Reportes
      </h2>

      {/* ── Tipo de reporte ── */}
      <div className={`${card} mb-6`}>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          ¿Qué reporte necesitás?
        </div>
        <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
          {REPORTES.map((r) => {
            const activo = reporte === r.key
            return (
              <button
                key={r.key}
                onClick={() => cambiarReporte(r.key)}
                className='text-left border rounded-[12px] p-4 cursor-pointer font-[inherit] transition-colors'
                style={{
                  borderColor: activo ? '#5B35C5' : '#E8E6F5',
                  background: activo ? '#F7F5FF' : '#FFFFFF',
                }}
              >
                <div className='text-[20px] mb-1'>{r.icono}</div>
                <div className='text-[13px] font-extrabold text-text'>{r.label}</div>
                <div className='text-[11px] text-textMuted mt-1 leading-snug'>
                  {r.descripcion}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className={`${card} mb-6`}>
        <div className='text-[15px] font-extrabold text-text mb-5'>Filtros</div>
        <div className='flex flex-wrap gap-4 items-end'>
          {reporte !== 'ficha-alumno' && reporte !== 'ficha-docente' && reporte !== 'ingresos' && (
            <div>
              <span className={fieldLabel}>Nivel educativo</span>
              <select
                className={selectField}
                value={nivel}
                onChange={(e) => {
                  setNivel(e.target.value)
                  setIdCurso('')
                }}
              >
                <option value=''>Todos</option>
                {(opciones?.niveles ?? []).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          )}

          {reporte === 'alumnos-por-curso' && (
            <div>
              <span className={fieldLabel}>Curso</span>
              <select className={selectField} value={idCurso} onChange={(e) => setIdCurso(e.target.value)}>
                <option value=''>Todos</option>
                {cursosDelNivel.map((c) => (
                  <option key={c.id_curso} value={c.id_curso}>
                    {c.nivel} · {c.grado_anio}° {c.division}
                  </option>
                ))}
              </select>
            </div>
          )}

          {reporte === 'alumnos-por-materia' && (
            <div>
              <span className={fieldLabel}>Materia</span>
              <select className={selectField} value={idMateria} onChange={(e) => setIdMateria(e.target.value)}>
                <option value=''>Todas</option>
                {(opciones?.materias ?? []).map((m) => (
                  <option key={m.id_materia} value={m.id_materia}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(reporte === 'alumnos-por-deporte' || reporte === 'pagos-deportes') && (
            <div>
              <span className={fieldLabel}>Actividad</span>
              <select className={selectField} value={idActividad} onChange={(e) => setIdActividad(e.target.value)}>
                <option value=''>Todos los deportes</option>
                {(reporte === 'pagos-deportes' ? deportes : (opciones?.actividades ?? [])).map((a) => (
                  <option key={a.id_actividad} value={a.id_actividad}>
                    {a.nombre} ({a.tipo})
                  </option>
                ))}
              </select>
            </div>
          )}

          {(reporte === 'alumnos-por-transporte' || reporte === 'pagos-transporte') && (
            <div>
              <span className={fieldLabel}>Recorrido</span>
              <select className={selectField} value={idRecorrido} onChange={(e) => setIdRecorrido(e.target.value)}>
                <option value=''>Todos</option>
                {(opciones?.recorridos ?? []).map((r) => (
                  <option key={r.id_recorrido} value={r.id_recorrido}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          {reporte === 'ingresos' && (
            <>
              <div>
                <span className={fieldLabel}>Desde</span>
                <input type='date' className={inputField} value={desde} max={hasta || undefined} onChange={(e) => {
                    setDesde(e.target.value)
                  }} />
              </div>
              <div>
                <span className={fieldLabel}>Hasta</span>
                <input type='date' className={inputField} value={hasta} min={desde || undefined} onChange={(e) => {
                    setHasta(e.target.value)
                  }} />
              </div>
              <div>
                <span className={fieldLabel}>Agrupar por</span>
                <select className={selectField} value={agrupar} onChange={(e) => {
                    setAgrupar(e.target.value === 'dia' ? 'dia' : 'mes')
                  }}>
                  <option value='mes'>Mes</option>
                  <option value='dia'>Día</option>
                </select>
              </div>
              <div className='basis-full text-[11px] text-textMuted'>Sin fechas: desde el 1 de enero de este año hasta hoy.</div>
            </>
          )}

          {esReportePagos(reporte) && (
            <>
              <div>
                <span className={fieldLabel}>Año</span>
                <input
                  type='number'
                  min={2000}
                  max={2100}
                  className={inputField}
                  style={{ width: 110 }}
                  value={anio}
                  onChange={(e) => {
                    setAnio(e.target.value)
                  }}
                />
              </div>
              <div className='flex-1' style={{ minWidth: 260 }}>
                <span className={fieldLabel}>Alumno (opcional: baja al detalle de sus facturas)</span>
                <select className={selectField} value={idAlumno} onChange={(e) => {
                    setIdAlumno(e.target.value)
                  }}>
                  <option value=''>Todos los alumnos</option>
                  {alumnos.map((a) => (
                    <option key={a.id_alumno} value={a.id_alumno}>
                      {a.apellido}, {a.nombre} — DNI {a.dni}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {(reporte === 'pagos-deportes' || reporte === 'alumnos-por-deporte') && (
            <>
              <div>
                <span className={fieldLabel}>Día</span>
                <select className={selectField} value={dia} onChange={(e) => {
                    setDia(e.target.value)
                    setHora('')
                  }}>
                  <option value=''>Todos</option>
                  {diasConDeporte.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className={fieldLabel}>Horario</span>
                <select className={selectField} value={hora} disabled={!dia} onChange={(e) => {
                    setHora(e.target.value)
                  }}>
                  <option value=''>{dia ? 'Todo el día' : 'Elegí un día'}</option>
                  {horariosDelDia.map((h) => (
                    <option key={h.hora_inicio} value={h.hora_inicio}>
                      {h.hora_inicio}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className={fieldLabel}>Profesor a cargo</span>
                <select className={selectField} value={idDocente} onChange={(e) => {
                    setIdDocente(e.target.value)
                  }}>
                  <option value=''>Todos</option>
                  {(opciones?.profesores ?? []).map((p) => (
                    <option key={p.id_docente} value={p.id_docente}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {esReporteCobranza(reporte) && (
            <>
              <div>
                <span className={fieldLabel}>Año</span>
                <input
                  type='number'
                  min={2000}
                  max={2100}
                  className={inputField}
                  style={{ width: 110 }}
                  value={anio}
                  onChange={(e) => {
                    setAnio(e.target.value)
                  }}
                />
              </div>
              <div>
                <span className={fieldLabel}>Mes</span>
                <select className={selectField} value={mes} onChange={(e) => {
                    setMes(e.target.value)
                  }}>
                  <option value=''>Todo el año</option>
                  {MESES.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {reporte === 'ficha-alumno' && (
            <div className='flex-1' style={{ minWidth: 260 }}>
              <span className={fieldLabel}>Alumno *</span>
              <select className={selectField} value={idAlumno} onChange={(e) => setIdAlumno(e.target.value)}>
                <option value=''>Seleccionar alumno...</option>
                {alumnos.map((a) => (
                  <option key={a.id_alumno} value={a.id_alumno}>
                    {a.apellido}, {a.nombre} — DNI {a.dni}
                  </option>
                ))}
              </select>
            </div>
          )}

          {reporte === 'ficha-docente' && (
            <div className='flex-1' style={{ minWidth: 260 }}>
              <span className={fieldLabel}>Docente *</span>
              <select className={selectField} value={idDocenteFicha} onChange={(e) => setIdDocenteFicha(e.target.value)}>
                <option value=''>Seleccionar docente...</option>
                {(opciones?.docentes ?? []).map((d) => (
                  <option key={d.id_docente} value={d.id_docente}>
                    {d.nombre}
                    {d.activo ? '' : ' (de baja)'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button className={btnPrimary} onClick={generar} disabled={loading}>
            {loading ? 'Generando...' : 'Ver reporte'}
          </button>
          <button className={btnSecondary} onClick={() => exportar('pdf')} disabled={loading}>
            📄 Exportar PDF
          </button>
          <button className={btnSecondary} onClick={() => exportar('csv')} disabled={loading}>
            📊 Exportar CSV
          </button>
        </div>
        {msg && (
          <div
            className='text-[13px] font-bold px-4 py-3 rounded-lg border mt-4'
            style={{ color: '#E74C3C', background: '#E74C3C12', borderColor: '#E74C3C40' }}
          >
            {msg}
          </div>
        )}
      </div>

      {/* ── Resultado ── */}
      {doc && (
        <div className={card}>
          <div className='text-[17px] font-black text-text'>{doc.titulo}</div>
          {doc.subtitulo && (
            <div className='text-[13px] text-textMuted mt-1'>{doc.subtitulo}</div>
          )}
          {(doc.filtros ?? []).length > 0 && (
            <div className='text-[11px] text-textMuted mt-2'>
              {(doc.filtros ?? []).join(' · ')}
            </div>
          )}

          {doc.bloques.map((bloque, i) => (
            <div key={i} className='mt-6'>
              {bloque.titulo && (
                <div className='text-[13px] font-extrabold text-purple-700 mb-3'>
                  {bloque.titulo}
                </div>
              )}

              {bloque.tipo === 'datos' && (
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                  {bloque.items.map(([label, valor]) => (
                    <div key={label}>
                      <div className='text-[11px] font-extrabold text-textMuted uppercase'>
                        {label}
                      </div>
                      <div className='text-[14px] font-bold text-text'>{valor}</div>
                    </div>
                  ))}
                </div>
              )}

              {bloque.tipo === 'texto' && (
                <p className='text-[13px] text-textMuted m-0'>{bloque.texto}</p>
              )}

              {bloque.tipo === 'tabla' &&
                (bloque.filas.length === 0 ? (
                  <div className='text-center text-textMuted py-8 text-[14px]'>
                    Sin datos para los filtros seleccionados.
                  </div>
                ) : (
                  <>
                    <TablaScroll>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {bloque.columnas.map((c) => (
                            <th key={c.key} className={thCell}>
                              {c.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {bloque.filas.map((fila, j) => (
                          <tr key={j}>
                            {bloque.columnas.map((c) => (
                              <td key={c.key} className={tdCell}>
                                {fila[c.key] ?? '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </TablaScroll>
                    <div className='text-[12px] font-bold text-textMuted mt-3'>
                      Total: {bloque.filas.length} registro(s)
                    </div>
                  </>
                ))}
            </div>
          ))}
        </div>
      )}

      {!doc && (
        <div className={`${card} text-center text-textMuted text-[14px] py-10`}>
          Elegí un reporte y sus filtros, y tocá <strong>Ver reporte</strong> para mostrarlo
          en pantalla o exportalo directamente en PDF o CSV.
        </div>
      )}
    </div>
  )
}
