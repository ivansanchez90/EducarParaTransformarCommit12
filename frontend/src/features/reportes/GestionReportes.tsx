/**
 * GestionReportes — reportes para la Dirección.
 *
 * Cada reporte se ve en pantalla y puede descargarse en PDF o CSV: el backend
 * arma el mismo documento en los tres formatos, así lo que se exporta es
 * exactamente lo que se está viendo.
 */
import { useCallback, useEffect, useState } from 'react'
import { api, descargar, qs } from '../../lib/api'
import type { AlumnoServicios, OpcionesReportes, ReporteDoc } from '../../types'
import { TablaScroll } from '../../ui/components'
import {
  btnPrimary,
  btnSecondary,
  card,
  fieldLabel,
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
    descripcion: 'Deporte, alumno, curso y nivel educativo.',
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
]

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
      const filtros: Record<string, string | undefined> = { nivel, formato }
      if (reporte === 'alumnos-por-curso') filtros.id_curso = idCurso
      if (reporte === 'alumnos-por-materia') filtros.id_materia = idMateria
      if (reporte === 'alumnos-por-deporte') filtros.id_actividad = idActividad
      if (reporte === 'alumnos-por-transporte') filtros.id_recorrido = idRecorrido
      return `/reportes/${reporte}${qs(filtros)}`
    },
    [reporte, nivel, idCurso, idMateria, idActividad, idRecorrido, idAlumno],
  )

  const faltaAlumno = reporte === 'ficha-alumno' && !idAlumno

  const generar = async () => {
    setMsg('')
    if (faltaAlumno) {
      setMsg('Elegí un alumno para generar su ficha.')
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
    if (faltaAlumno) {
      setMsg('Elegí un alumno para generar su ficha.')
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
  }

  const cursosDelNivel = (opciones?.cursos ?? []).filter((c) => !nivel || c.nivel === nivel)

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
          {reporte !== 'ficha-alumno' && (
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

          {reporte === 'alumnos-por-deporte' && (
            <div>
              <span className={fieldLabel}>Actividad</span>
              <select className={selectField} value={idActividad} onChange={(e) => setIdActividad(e.target.value)}>
                <option value=''>Todos los deportes</option>
                {(opciones?.actividades ?? []).map((a) => (
                  <option key={a.id_actividad} value={a.id_actividad}>
                    {a.nombre} ({a.tipo})
                  </option>
                ))}
              </select>
            </div>
          )}

          {reporte === 'alumnos-por-transporte' && (
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
