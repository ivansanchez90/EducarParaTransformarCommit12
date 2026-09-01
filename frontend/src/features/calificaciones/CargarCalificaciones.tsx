/**
 * CargarCalificaciones — Carga y listado de notas por clase (rol Docente).
 * Extraído verbatim de AdminPanel.tsx (sin cambios de lógica).
 */
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { notificarFamilias } from '../../lib/notificaciones'
import type { Asignacion, Calificacion } from '../../types'
import { card, selectField, inputField, fieldLabel, thCell, tdCell, btnPrimary } from '../../ui/styles'

export function CargarCalificaciones({ userId }: { userId: string }) {
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [selAsignacion, setSelAsig] = useState<number | null>(null)
  const [calificaciones, setCals] = useState<Calificacion[]>([])
  const [alumnos, setAlumnos] = useState<
    { id_alumno: number; nombre: string; apellido: string }[]
  >([])
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({
    id_alumno: '',
    trimestre: '1',
    tipo_evaluacion: 'Parcial',
    nota: '',
    descripcion: '',
  })

  useEffect(() => {
    supabase
      .from('docentes')
      .select('id_docente')
      .eq('id_usuario', userId)
      .single()
      .then(({ data: doc }) => {
        if (!doc) return
        supabase
          .from('asignaciones')
          .select('*, materias(nombre), cursos(nivel, grado_anio, division)')
          .eq('id_docente', doc.id_docente)
          .eq('activo', true)
          .then(({ data }) => {
            if (data) setAsignaciones(data as unknown as Asignacion[])
          })
      })
  }, [userId])

  useEffect(() => {
    if (!selAsignacion) return
    supabase
      .from('asignaciones')
      .select('id_curso')
      .eq('id_asignacion', selAsignacion)
      .single()
      .then(({ data: a }) => {
        if (!a) return
        supabase
          .from('alumnos')
          .select('id_alumno, nombre, apellido')
          .eq('id_curso', a.id_curso)
          .eq('activo', true)
          .order('apellido')
          .then(({ data: al }) => {
            if (al) setAlumnos(al)
          })
      })
    supabase
      .from('calificaciones')
      .select('*, alumnos(nombre, apellido), asignaciones(materias(nombre))')
      .eq('id_asignacion', selAsignacion)
      .order('fecha_carga', { ascending: false })
      .then(({ data }) => {
        if (data) setCals(data as unknown as Calificacion[])
      })
  }, [selAsignacion])

  const handleCargar = async (e: FormEvent) => {
    e.preventDefault()
    setMsg('')
    const { data: periodo } = await supabase
      .from('periodos_academicos')
      .select('id_periodo')
      .eq('activo', true)
      .single()
    const { error } = await supabase.from('calificaciones').insert([
      {
        id_alumno: Number(form.id_alumno),
        id_asignacion: selAsignacion,
        id_periodo: periodo?.id_periodo ?? null,
        trimestre: Number(form.trimestre),
        tipo_evaluacion: form.tipo_evaluacion,
        nota: Number(form.nota),
        descripcion: form.descripcion || null,
      },
    ])
    if (error) setMsg('Error: ' + error.message)
    else {
      // R6 · Notificación automática por publicación de calificación
      const asig = asignaciones.find((a) => a.id_asignacion === selAsignacion)
      const materia = asig?.materias?.nombre ?? 'una materia'
      await notificarFamilias(
        [
          {
            id_alumno: Number(form.id_alumno),
            titulo: 'Nueva calificación publicada',
            mensaje: `Se publicó una nota de ${materia}: ${form.nota} (${form.tipo_evaluacion}, ${form.trimestre}° trimestre).`,
          },
        ],
        'Calificación',
      )
      setMsg('✅ Nota cargada y familia notificada.')
      setForm((p) => ({ ...p, id_alumno: '', nota: '', descripcion: '' }))
      // Recargar calificaciones
      if (selAsignacion) {
        supabase
          .from('calificaciones')
          .select(
            '*, alumnos(nombre, apellido), asignaciones(materias(nombre))',
          )
          .eq('id_asignacion', selAsignacion)
          .order('fecha_carga', { ascending: false })
          .then(({ data }) => {
            if (data) setCals(data as unknown as Calificacion[])
          })
      }
    }
  }

  const notaColor = (n: number) =>
    n >= 8 ? '#27AE60' : n >= 6 ? '#E67E22' : '#E74C3C'

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 20px' }}>
        📝 Calificaciones
      </h2>

      <div className={`${card} mb-5`}>
        <span className={fieldLabel}>
          Clase / Materia
        </span>
        <select
          className={`${selectField} max-w-[360px]`}
          value={selAsignacion ?? ''}
          onChange={(e) => setSelAsig(Number(e.target.value))}
        >
          <option value=''>Seleccioná una clase...</option>
          {asignaciones.map((a) => (
            <option key={a.id_asignacion} value={a.id_asignacion}>
              {a.materias?.nombre} — {a.cursos?.nivel} {a.cursos?.grado_anio} "
              {a.cursos?.division}"
            </option>
          ))}
        </select>
      </div>

      {selAsignacion && (
        <>
          {/* Formulario */}
          <div className={`${card} mb-5`}>
            <div className='text-[15px] font-extrabold text-text mb-5'>
              Cargar nota
            </div>
            <form
              onSubmit={handleCargar}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr',
                gap: 14,
              }}
            >
              <div>
                <span className={fieldLabel}>
                  Alumno
                </span>
                <select
                  className={selectField}
                  required
                  value={form.id_alumno}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, id_alumno: e.target.value }))
                  }
                >
                  <option value=''>Seleccioná...</option>
                  {alumnos.map((a) => (
                    <option key={a.id_alumno} value={a.id_alumno}>
                      {a.apellido}, {a.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className={fieldLabel}>
                  Trimestre
                </span>
                <select
                  className={selectField}
                  value={form.trimestre}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, trimestre: e.target.value }))
                  }
                >
                  <option value='1'>1º Trimestre</option>
                  <option value='2'>2º Trimestre</option>
                  <option value='3'>3º Trimestre</option>
                </select>
              </div>
              <div>
                <span className={fieldLabel}>
                  Tipo
                </span>
                <select
                  className={selectField}
                  value={form.tipo_evaluacion}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, tipo_evaluacion: e.target.value }))
                  }
                >
                  <option>Parcial</option>
                  <option>Final</option>
                  <option>Trabajo Práctico</option>
                  <option>Oral</option>
                  <option>Recuperatorio</option>
                </select>
              </div>
              <div>
                <span className={fieldLabel}>
                  Nota (0–10)
                </span>
                <input
                  type='number'
                  min='0'
                  max='10'
                  step='0.25'
                  required
                  className={inputField}
                  value={form.nota}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, nota: e.target.value }))
                  }
                />
              </div>
              <div
                style={{
                  gridColumn: '1/-1',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-end',
                }}
              >
                <div style={{ flex: 1 }}>
                  <span className={fieldLabel}>
                    Descripción (opcional)
                  </span>
                  <input
                    className={inputField}
                    value={form.descripcion}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, descripcion: e.target.value }))
                    }
                    placeholder='Ej: Primer parcial unidad 1'
                  />
                </div>
                <button
                  type='submit'
                  className={btnPrimary}
                >
                  Cargar nota
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

          {/* Historial */}
          <div className={card}>
            <div className='text-[15px] font-extrabold text-text mb-5'>
              Notas cargadas
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className={thCell}>
                    Alumno
                  </th>
                  <th className={thCell}>
                    Tipo
                  </th>
                  <th className={thCell}>
                    Trimestre
                  </th>
                  <th className={thCell}>
                    Fecha
                  </th>
                  <th className={thCell}>
                    Nota
                  </th>
                </tr>
              </thead>
              <tbody>
                {calificaciones.map((c) => (
                  <tr key={c.id_calificacion}>
                    <td className={`${tdCell} font-bold`}>
                      {c.alumnos?.apellido}, {c.alumnos?.nombre}
                    </td>
                    <td className={tdCell}>
                      <span className='inline-block bg-[#5B35C51A] text-purple-700 rounded-[20px] px-[10px] py-[3px] text-[11px] font-extrabold'>
                        {c.tipo_evaluacion}
                      </span>
                    </td>
                    <td className={`${tdCell} text-textMuted`}>
                      T{c.trimestre}
                    </td>
                    <td className={`${tdCell} text-textMuted`}>
                      {new Date(c.fecha_carga).toLocaleDateString('es-AR')}
                    </td>
                    <td className={tdCell}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: notaColor(c.nota) + '1A',
                          color: notaColor(c.nota),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 900,
                          fontSize: 14,
                        }}
                      >
                        {c.nota}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
