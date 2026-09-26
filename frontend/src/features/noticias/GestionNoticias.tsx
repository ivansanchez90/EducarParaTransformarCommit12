/**
 * GestionNoticias — publicación y administración de noticias institucionales,
 * con subida de imagen a Storage y notificación opcional a las familias.
 */
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../../lib/api'
import type { Noticia } from '../../types'
import { TablaScroll } from '../../ui/components'
import {
  badge,
  btnPrimary,
  card,
  fieldLabel,
  inputField,
  thCell,
} from '../../ui/styles'

// Helper local: registra notificaciones in-app para las familias.
export function GestionNoticias() {
  const [noticias, setNoticias] = useState<Noticia[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [notificar, setNotificar] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    titulo: '',
    resumen: '',
    contenido: '',
    url_imagen: '',
    destacada: false,
  })

  const load = useCallback(async () => {
    const { data } = await api.get<Noticia[]>('/noticias')
    if (data) setNoticias(data)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg('')

    // Si se adjuntó un archivo, el backend lo guarda y usa su URL pública.
    // Si no, se usa la URL escrita a mano (ambas opciones siguen disponibles).
    // Con `notificar`, el backend envía el comunicado a las familias (R6).
    const body = new FormData()
    body.append('titulo', form.titulo)
    body.append('resumen', form.resumen)
    body.append('contenido', form.contenido)
    body.append('destacada', String(form.destacada))
    body.append('notificar', String(notificar))
    if (file) body.append('imagen', file)
    else body.append('url_imagen', form.url_imagen)

    const { error } = await api.post('/noticias', body)
    if (error) setMsg('Error: ' + error.message)
    else {
      setMsg(
        notificar
          ? '✅ Noticia publicada y familias notificadas.'
          : '✅ Noticia publicada.',
      )
      setShowForm(false)
      setFile(null)
      setForm({
        titulo: '',
        resumen: '',
        contenido: '',
        url_imagen: '',
        destacada: false,
      })
      load()
    }
    setLoading(false)
  }

  const toggleActivo = async (id: number, activo: boolean) => {
    await api.patch(`/noticias/${id}`, { activo: !activo })
    load()
  }

  const eliminar = async (id: number) => {
    if (
      !confirm(
        '¿Eliminar definitivamente esta noticia? Esta acción no se puede deshacer.',
      )
    )
      return
    const { error } = await api.delete(`/noticias/${id}`)
    if (error) setMsg('Error al eliminar: ' + error.message)
    else {
      setMsg('🗑️ Noticia eliminada.')
      load()
    }
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
          📰 Noticias
        </h2>
        <button
          className={btnPrimary}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancelar' : '+ Nueva noticia'}
        </button>
      </div>

      {showForm && (
        <div className={`${card} mb-6`}>
          <div className='text-[15px] font-extrabold text-text mb-5'>
            Publicar noticia
          </div>
          <form
            onSubmit={handleCreate}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div>
              <span className={fieldLabel}>
                Título
              </span>
              <input
                className={inputField}
                required
                value={form.titulo}
                onChange={(e) =>
                  setForm((p) => ({ ...p, titulo: e.target.value }))
                }
              />
            </div>
            <div>
              <span className={fieldLabel}>
                Resumen (opcional)
              </span>
              <input
                className={inputField}
                value={form.resumen}
                onChange={(e) =>
                  setForm((p) => ({ ...p, resumen: e.target.value }))
                }
              />
            </div>
            <div>
              <span className={fieldLabel}>
                Imagen — subir archivo (opcional)
              </span>
              <input
                type='file'
                accept='image/*'
                className={inputField}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div>
              <span className={fieldLabel}>
                …o pegar una URL de imagen (opcional)
              </span>
              <input
                className={`${inputField} disabled:opacity-50`}
                value={form.url_imagen}
                onChange={(e) =>
                  setForm((p) => ({ ...p, url_imagen: e.target.value }))
                }
                placeholder='https://...'
                disabled={!!file}
              />
            </div>
            <div>
              <span className={fieldLabel}>
                Contenido
              </span>
              <textarea
                className={`${inputField} min-h-[120px] resize-y`}
                required
                value={form.contenido}
                onChange={(e) =>
                  setForm((p) => ({ ...p, contenido: e.target.value }))
                }
              />
            </div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
              }}
            >
              <input
                type='checkbox'
                checked={form.destacada}
                onChange={(e) =>
                  setForm((p) => ({ ...p, destacada: e.target.checked }))
                }
              />
              <span style={{ fontSize: 13, fontWeight: 700 }}>
                Marcar como destacada
              </span>
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
              }}
            >
              <input
                type='checkbox'
                checked={notificar}
                onChange={(e) => setNotificar(e.target.checked)}
              />
              <span style={{ fontSize: 13, fontWeight: 700 }}>
                Notificar a las familias como comunicado institucional
              </span>
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type='submit'
                disabled={loading}
                className={`${btnPrimary}${loading ? ' opacity-60' : ''}`}
              >
                {loading ? 'Publicando...' : 'Publicar'}
              </button>
            </div>
            {msg && (
              <div
                style={{
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

      <div className={card}>
        <TablaScroll>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className={thCell}>
                Título
              </th>
              <th className={thCell}>
                Fecha
              </th>
              <th className={thCell}>
                Destacada
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
            {noticias.map((n) => (
              <tr key={n.id_noticia}>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle font-bold max-w-[300px]'>
                  {n.titulo}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle text-textMuted'>
                  {new Date(n.fecha_publicacion).toLocaleDateString('es-AR')}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  {n.destacada ? '⭐' : '—'}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  <span style={badge(n.activo ? '#27AE60' : '#E74C3C')}>
                    {n.activo ? 'Publicada' : 'Oculta'}
                  </span>
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  <div className='flex gap-2'>
                    <button
                      className={
                        n.activo
                          ? 'bg-[#E74C3C1A] text-red border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                          : 'bg-[#27AE601A] text-green border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                      }
                      onClick={() => toggleActivo(n.id_noticia, n.activo)}
                    >
                      {n.activo ? 'Ocultar' : 'Publicar'}
                    </button>
                    <button
                      className='bg-[#6B6B8A1A] text-textMuted border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                      onClick={() => eliminar(n.id_noticia)}
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </TablaScroll>
      </div>
    </div>
  )
}
