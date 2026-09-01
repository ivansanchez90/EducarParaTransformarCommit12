/**
 * GestionAmonestaciones — Registro e historial de amonestaciones (rol Docente).
 * Extraído verbatim de AdminPanel.tsx (sin cambios de lógica).
 */
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { Asignacion } from '../../types'
import { card, inputField, selectField, fieldLabel, thCell, tdCell, btnPrimary, btnSecondary, badge } from '../../ui/styles'

export function GestionAmonestaciones({ userId }: { userId: string }) {
  const [idDocente, setIdDocente] = useState<number | null>(null)
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [alumnos, setAlumnos] = useState<
    { id_alumno: number; nombre: string; apellido: string }[]
  >([])
  const [amonestaciones, setAmonest] = useState<
    {
      id_amonestacion: number
      tipo: string
      descripcion: string
      fecha: string
      alumnos: { nombre: string; apellido: string } | null
    }[]
  >([])
  const [selCurso, setSelCurso] = useState<number | null>(null)
  const [form, setForm] = useState({
    id_alumno: '',
    tipo: 'Leve',
    descripcion: '',
  })
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase
      .from('docentes')
      .select('id_docente')
      .eq('id_usuario', userId)
      .single()
      .then(({ data: doc }) => {
        if (!doc) return
        setIdDocente(doc.id_docente)
        supabase
          .from('asignaciones')
          .select(
            '*, materias(nombre), cursos(id_curso, nivel, grado_anio, division)',
          )
          .eq('id_docente', doc.id_docente)
          .eq('activo', true)
          .then(({ data }) => {
            if (data) setAsignaciones(data as unknown as Asignacion[])
          })
        supabase
          .from('amonestaciones')
          .select('*, alumnos(nombre, apellido)')
          .eq('id_docente', doc.id_docente)
          .order('fecha', { ascending: false })
          .then(({ data }) => {
            if (data) setAmonest(data as any)
          })
      })
  }, [userId])

  const handleSelCurso = (idCurso: number) => {
    setSelCurso(idCurso)
    supabase
      .from('alumnos')
      .select('id_alumno, nombre, apellido')
      .eq('id_curso', idCurso)
      .eq('activo', true)
      .order('apellido')
      .then(({ data }) => {
        if (data) setAlumnos(data)
      })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setMsg('')
    const { error } = await supabase.from('amonestaciones').insert([
      {
        id_alumno: Number(form.id_alumno),
        id_docente: idDocente,
        tipo: form.tipo,
        descripcion: form.descripcion,
      },
    ])
    if (error) setMsg('Error: ' + error.message)
    else {
      setMsg('✅ Amonestación registrada.')
      setForm({ id_alumno: '', tipo: 'Leve', descripcion: '' })
      supabase
        .from('amonestaciones')
        .select('*, alumnos(nombre, apellido)')
        .eq('id_docente', idDocente!)
        .order('fecha', { ascending: false })
        .then(({ data }) => {
          if (data) setAmonest(data as any)
        })
    }
  }

  const TIPO_COLOR: Record<string, string> = {
    Leve: '#E67E22',
    Grave: '#E74C3C',
    'Muy grave': '#C0392B',
  }
  const cursosUnicos = asignaciones.filter(
    (a, i, arr) =>
      arr.findIndex(
        (b) => (b.cursos as any)?.id_curso === (a.cursos as any)?.id_curso,
      ) === i,
  )

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 20px' }}>
        ⚠️ Amonestaciones
      </h2>

      <div className={`${card} mb-5`}>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Registrar amonestación
        </div>
        <div style={{ marginBottom: 14 }}>
          <span className={fieldLabel}>
            Seleccioná el curso
          </span>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {cursosUnicos.map((a) => (
              <button
                key={(a.cursos as any)?.id_curso}
                className={
                  selCurso === (a.cursos as any)?.id_curso
                    ? btnPrimary
                    : btnSecondary
                }
                onClick={() => handleSelCurso((a.cursos as any)?.id_curso)}
              >
                {a.cursos?.nivel} {a.cursos?.grado_anio} "{a.cursos?.division}"
              </button>
            ))}
          </div>
        </div>
        {selCurso && (
          <form
            onSubmit={handleSubmit}
            style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}
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
                Tipo
              </span>
              <select
                className={selectField}
                value={form.tipo}
                onChange={(e) =>
                  setForm((p) => ({ ...p, tipo: e.target.value }))
                }
              >
                <option>Leve</option>
                <option>Grave</option>
                <option>Muy grave</option>
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <span className={fieldLabel}>
                Descripción del hecho
              </span>
              <textarea
                className={`${inputField} min-h-[80px] resize-y`}
                required
                value={form.descripcion}
                onChange={(e) =>
                  setForm((p) => ({ ...p, descripcion: e.target.value }))
                }
              />
            </div>
            <div
              style={{
                gridColumn: '1/-1',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <button
                type='submit'
                className={btnPrimary}
              >
                Registrar amonestación
              </button>
              {msg && (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: msg.startsWith('✅') ? '#27AE60' : '#E74C3C',
                  }}
                >
                  {msg}
                </span>
              )}
            </div>
          </form>
        )}
      </div>

      <div className={card}>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Historial de amonestaciones
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
                Descripción
              </th>
              <th className={thCell}>
                Fecha
              </th>
            </tr>
          </thead>
          <tbody>
            {amonestaciones.map((a) => (
              <tr key={a.id_amonestacion}>
                <td className={`${tdCell} font-bold`}>
                  {a.alumnos?.apellido}, {a.alumnos?.nombre}
                </td>
                <td className={tdCell}>
                  <span style={badge(TIPO_COLOR[a.tipo] ?? '#6B6B8A')}>
                    {a.tipo}
                  </span>
                </td>
                <td
                  className={tdCell}
                  style={{ color: '#6B6B8A', maxWidth: 300 }}
                >
                  {a.descripcion}
                </td>
                <td className={`${tdCell} text-textMuted`}>
                  {new Date(a.fecha).toLocaleDateString('es-AR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
