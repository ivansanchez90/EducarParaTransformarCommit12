/**
 * GestionGaleria — administración de la galería institucional: alta de imágenes
 * (archivo local a Storage o URL remota), visibilidad y borrado.
 */
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { badge, btnPrimary, card, fieldLabel, inputField, selectField, thCell } from '../../ui/styles'

export function GestionGaleria({ userId }: { userId: string }) {
  const [imagenes, setImagenes] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    titulo: '',
    descripcion: '',
    categoria: 'Instalaciones',
    url_imagen: '',
  })

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('galeria')
      .select('*')
      .order('fecha_subida', { ascending: false })
    if (data) setImagenes(data)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg('')

    try {
      let finalUrl = form.url_imagen

      // Si el usuario adjuntó un archivo local, procesamos la subida a Supabase Storage
      if (file) {
        const fileExt = file.name.split('.').pop()
        const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('galeria-imagenes')
          .upload(uniqueFileName, file)

        if (uploadError)
          throw new Error('Error en Storage: ' + uploadError.message)

        // Recuperar URL pública del archivo cargado
        const { data } = supabase.storage
          .from('galeria-imagenes')
          .getPublicUrl(uniqueFileName)

        finalUrl = data.publicUrl
      }

      if (!finalUrl) {
        throw new Error(
          'Debes seleccionar un archivo de imagen o ingresar una URL externa.',
        )
      }

      // Persistir registro meta en la base de datos relacional
      const { error } = await supabase.from('galeria').insert([
        {
          titulo: form.titulo || null,
          descripcion: form.descripcion || null,
          categoria: form.categoria || null,
          url_imagen: finalUrl,
          id_autor: userId,
        },
      ])

      if (error) throw error

      setMsg('✅ Imagen incorporada a la galería correctamente.')
      setForm({
        titulo: '',
        descripcion: '',
        categoria: 'Instalaciones',
        url_imagen: '',
      })
      setFile(null)
      setShowForm(false)
      load()
    } catch (err: any) {
      setMsg('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleActivo = async (id: number, activo: boolean) => {
    await supabase
      .from('galeria')
      .update({ activo: !activo })
      .eq('id_imagen', id)
    load()
  }

  const eliminarImagen = async (id: number, urlImagen: string) => {
    if (
      !window.confirm(
        '¿Confirmás la eliminación permanente de esta fotografía?',
      )
    )
      return

    try {
      // Si la imagen pertenece al storage propio, borramos el binario para evitar archivos huérfanos
      if (urlImagen.includes('galeria-imagenes')) {
        const parts = urlImagen.split('/')
        const fileName = parts[parts.length - 1]
        await supabase.storage.from('galeria-imagenes').remove([fileName])
      }

      const { error } = await supabase
        .from('galeria')
        .delete()
        .eq('id_imagen', id)
      if (error) throw error

      setMsg('✅ Registro fotográfico purgado con éxito.')
      load()
    } catch (err: any) {
      setMsg('Error al eliminar: ' + err.message)
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
          🖼️ Galería Institucional
        </h2>
        <button
          className={btnPrimary}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancelar' : '+ Agregar Imagen'}
        </button>
      </div>

      {showForm && (
        <div className={`${card} mb-6`}>
          <div className='text-[15px] font-extrabold text-text mb-5'>
            Publicar nueva fotografía
          </div>
          <form
            onSubmit={handleCreate}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 14,
              }}
            >
              <div>
                <span className={fieldLabel}>
                  Título de la foto (Opcional)
                </span>
                <input
                  className={inputField}
                  value={form.titulo}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, titulo: e.target.value }))
                  }
                  placeholder='Ej: Laboratorio de Ciencias Avanzadas'
                />
              </div>
              <div>
                <span className={fieldLabel}>
                  Categoría / Sección
                </span>
                <select
                  className={selectField}
                  value={form.categoria}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, categoria: e.target.value }))
                  }
                >
                  <option value='Instalaciones'>Instalaciones</option>
                  <option value='Actividades'>Actividades</option>
                  <option value='Idiomas'>Idiomas</option>
                  <option value='Deportes'>Deportes</option>
                  <option value='Arte'>Arte</option>
                  <option value='Tecnología'>Tecnología</option>
                </select>
              </div>
            </div>

            <div>
              <span className={fieldLabel}>
                Descripción descriptiva (Opcional)
              </span>
              <input
                className={inputField}
                value={form.descripcion}
                onChange={(e) =>
                  setForm((p) => ({ ...p, descripcion: e.target.value }))
                }
                placeholder='Breve reseña sobre lo que muestra la imagen...'
              />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 14,
                alignItems: 'center',
              }}
            >
              <div>
                <span className={fieldLabel}>
                  Opción A: Seleccionar archivo local
                </span>
                <input
                  type='file'
                  accept='image/*'
                  className={inputField}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setFile(e.target.files[0])
                    }
                  }}
                />
              </div>
              <div>
                <span className={fieldLabel}>
                  Opción B: Vincular URL de imagen remota
                </span>
                <input
                  className={inputField}
                  value={form.url_imagen}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, url_imagen: e.target.value }))
                  }
                  placeholder='https://images.unsplash.com/...'
                  disabled={!!file}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              <button
                type='submit'
                disabled={loading}
                className={`${btnPrimary}${loading ? ' opacity-60' : ''}`}
              >
                {loading ? 'Subiendo contenido...' : 'Publicar en Galería'}
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

      {/* Lista del Repositorio Visual */}
      <div className={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className={thCell}>
                Miniatura
              </th>
              <th className={thCell}>
                Título / Categoría
              </th>
              <th className={thCell}>
                Fecha de Subida
              </th>
              <th className={thCell}>
                Estado
              </th>
              <th className={thCell}>
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {imagenes.map((img) => (
              <tr key={img.id_imagen}>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  <img
                    src={img.url_imagen}
                    alt={img.titulo || 'Mina'}
                    style={{
                      width: 65,
                      height: 48,
                      objectFit: 'cover',
                      borderRadius: 8,
                      border: `1px solid ${'#E8E6F5'}`,
                    }}
                  />
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  <span style={{ fontWeight: 700 }}>
                    {img.titulo || 'Fotografía sin título'}
                  </span>
                  <br />
                  <span className='inline-block bg-[#5B35C51A] text-purple-700 rounded-[20px] px-[10px] py-[3px] text-[11px] font-extrabold'>
                    {img.categoria || 'General'}
                  </span>
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle text-textMuted'>
                  {new Date(img.fecha_subida).toLocaleDateString('es-AR')}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  <span style={badge(img.activo ? '#27AE60' : '#E74C3C')}>
                    {img.activo ? 'Visible en Home' : 'Oculta'}
                  </span>
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className={
                        img.activo
                          ? 'bg-[#E74C3C1A] text-red border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                          : 'bg-[#27AE601A] text-green border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                      }
                      onClick={() => toggleActivo(img.id_imagen, img.activo)}
                    >
                      {img.activo ? 'Ocultar' : 'Mostrar'}
                    </button>
                    <button
                      className='bg-[#E74C3C26] text-red border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                      onClick={() =>
                        eliminarImagen(img.id_imagen, img.url_imagen)
                      }
                    >
                      Eliminar permanentemente
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {imagenes.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className='py-[11px] pr-3 text-[13px] border-b border-border align-middle text-center text-textMuted p-8'
                >
                  No se registran imágenes en la galería institucional.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
