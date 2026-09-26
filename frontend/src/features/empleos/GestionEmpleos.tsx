// GestionEmpleos — panel de administración de ofertas de empleo.
// Extraído de AdminPanel.tsx sin cambios de lógica.
import { useState, useCallback, useEffect } from 'react'
import type { FormEvent } from 'react'
import { api } from '../../lib/api'
import type { Empleo } from '../../types'
import { TIPOS_CONTRATO } from '../../constants'
import {
  btnPrimary,
  btnDanger,
  inputField,
  selectField,
  fieldLabel,
  card,
} from '../../ui/styles'

export function GestionEmpleos() {
  const [empleos, setEmpleos] = useState<Empleo[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const FORM_VACIO = {
    titulo: '',
    descripcion: '',
    area: '',
    requisitos: '',
    tipo_contrato: 'Full-time',
    fecha_cierre: '',
  }
  const [form, setForm] = useState(FORM_VACIO)

  const load = useCallback(async () => {
    const { data } = await api.get<Empleo[]>('/empleos')
    if (data) setEmpleos(data)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    const { error } = await api.post('/empleos', {
      ...form,
      fecha_cierre: form.fecha_cierre || null,
    })
    if (error) {
      setMsg('❌ Error: ' + error.message)
    } else {
      setMsg('✅ Empleo publicado correctamente.')
      setForm(FORM_VACIO)
      setShowForm(false)
      load()
    }
    setLoading(false)
  }

  const toggleActivo = async (id: number, activo: boolean) => {
    await api.patch(`/empleos/${id}`, { activo: !activo })
    load()
  }

  const eliminar = async (id: number) => {
    if (!confirm('¿Eliminar esta oferta?')) return
    await api.delete(`/empleos/${id}`)
    load()
  }

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex justify-between items-center gap-2 flex-wrap'>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>💼 Empleos</h2>
        <button
          className={btnPrimary}
          onClick={() => {
            setShowForm(!showForm)
            setMsg('')
          }}
        >
          {showForm ? 'Cancelar' : '+ Publicar empleo'}
        </button>
      </div>

      {showForm && (
        <div className={card}>
          <div className='text-[15px] font-extrabold text-text mb-5'>
            Nueva oferta laboral
          </div>
          <form onSubmit={handleCreate} className='flex flex-col gap-4'>
            <div>
              <span className={fieldLabel}>
                Título del puesto *
              </span>
              <input
                className={inputField}
                required
                placeholder='Ej: Docente de Matemáticas'
                value={form.titulo}
                onChange={(e) =>
                  setForm((p) => ({ ...p, titulo: e.target.value }))
                }
              />
            </div>
            <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
              <div>
                <span className={fieldLabel}>
                  Área / Departamento
                </span>
                <input
                  className={inputField}
                  placeholder='Ej: Educación primaria'
                  value={form.area}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, area: e.target.value }))
                  }
                />
              </div>

              <div>
                <span className={fieldLabel}>
                  Tipo de contrato
                </span>
                <select
                  className={selectField}
                  value={form.tipo_contrato}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, tipo_contrato: e.target.value }))
                  }
                >
                  {TIPOS_CONTRATO.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <span className={fieldLabel}>
                Descripción
              </span>
              <textarea
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border min-h-[80px] resize-y'
                placeholder='Descripción del puesto, tareas, etc.'
                value={form.descripcion}
                onChange={(e) =>
                  setForm((p) => ({ ...p, descripcion: e.target.value }))
                }
              />
            </div>
            <div>
              <span className={fieldLabel}>
                Requisitos
              </span>
              <textarea
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border min-h-[80px] resize-y'
                placeholder='Formación requerida, experiencia, certificaciones...'
                value={form.requisitos}
                onChange={(e) =>
                  setForm((p) => ({ ...p, requisitos: e.target.value }))
                }
              />
            </div>
            <div style={{ maxWidth: 240 }}>
              <span className={fieldLabel}>
                Fecha de cierre (opcional)
              </span>
              <input
                type='date'
                className={inputField}
                value={form.fecha_cierre}
                onChange={(e) =>
                  setForm((p) => ({ ...p, fecha_cierre: e.target.value }))
                }
              />
            </div>
            <button
              type='submit'
              disabled={loading}
              className={`${btnPrimary}${loading ? ' opacity-60 self-start' : ' self-start'}`}
            >
              {loading ? 'Publicando...' : 'Publicar oferta'}
            </button>
            {msg && (
              <div
                className='text-[13px] font-bold px-4 py-3 rounded-lg border'
                style={{
                  color: msg.startsWith('✅') ? '#27AE60' : '#E74C3C',
                  background: msg.startsWith('✅') ? '#27AE6012' : '#E74C3C12',
                  borderColor: msg.startsWith('✅') ? '#27AE6040' : '#E74C3C40',
                }}
              >
                {msg}
              </div>
            )}
          </form>
        </div>
      )}

      {msg && !showForm && (
        <div className='text-[13px] font-bold text-green px-4 py-3 rounded-lg bg-[#27AE6012] border border-[#27AE6040]'>
          {msg}
        </div>
      )}

      <div className={card}>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Ofertas publicadas
          <span className='ml-2 text-[12px] font-bold text-textMuted'>
            ({empleos.length})
          </span>
        </div>
        {empleos.length === 0 ? (
          <div className='text-center text-textMuted py-8 text-[14px]'>
            No hay ofertas publicadas aún.
          </div>
        ) : (
          <div className='flex flex-col gap-3'>
            {empleos.map((emp) => (
              <div
                key={emp.id_empleo}
                className='flex items-start justify-between gap-4 p-4 rounded-xl border border-border transition-all duration-200'
                style={{ opacity: emp.activo ? 1 : 0.5 }}
              >
                <div className='flex-1 min-w-0'>
                  <div className='flex items-center gap-2 flex-wrap mb-1'>
                    <span className='text-[15px] font-extrabold text-text'>
                      {emp.titulo}
                    </span>

                    {emp.tipo_contrato && (
                      <span className='inline-block bg-purpleLight text-purple-700 px-[8px] py-[2px] rounded-full text-[10px] font-extrabold'>
                        {emp.tipo_contrato}
                      </span>
                    )}
                    {!emp.activo && (
                      <span className='inline-block bg-[#6B6B8A1A] text-textMuted px-[8px] py-[2px] rounded-full text-[10px] font-extrabold'>
                        Inactivo
                      </span>
                    )}
                  </div>
                  {emp.area && (
                    <div className='text-[12px] text-textMuted mb-1'>
                      📍 {emp.area}
                    </div>
                  )}
                  {emp.descripcion && (
                    <div className='text-[12px] text-text leading-relaxed'>
                      {emp.descripcion.slice(0, 120)}
                      {emp.descripcion.length > 120 ? '...' : ''}
                    </div>
                  )}
                  <div className='text-[11px] text-textMuted mt-2'>
                    Publicado: {emp.fecha_publicacion}
                    {emp.fecha_cierre && ` · Cierre: ${emp.fecha_cierre}`}
                  </div>
                </div>
                <div className='flex gap-2 shrink-0'>
                  <button
                    className={
                      emp.activo
                        ? 'bg-[#E67E221A] text-orange border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                        : 'bg-[#27AE601A] text-green border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                    }
                    onClick={() => toggleActivo(emp.id_empleo, emp.activo)}
                  >
                    {emp.activo ? 'Pausar' : 'Activar'}
                  </button>
                  <button
                    className={btnDanger}
                    onClick={() => eliminar(emp.id_empleo)}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
