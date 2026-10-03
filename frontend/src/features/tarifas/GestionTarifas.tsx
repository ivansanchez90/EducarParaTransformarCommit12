/**
 * GestionTarifas — precios de la cuota por nivel, de cada deporte, de cada
 * recorrido de transporte y del comedor, con la fecha desde la que rigen.
 *
 * Un precio que ya rige no se edita: se carga una tarifa nueva con la fecha
 * desde la que vale (las facturas ya emitidas no cambian). Solo las tarifas
 * programadas, que todavía no rigen, se pueden corregir o borrar.
 */
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api, qs } from '../../lib/api'
import { CONCEPTOS_TARIFA } from '../../constants'
import type { ConceptoTarifa, OpcionesTarifa, Tarifa } from '../../types'
import { Badge, Card, FormMessage, ResponsiveTable, SectionHeader, type Columna } from '../../ui/components'
import { btnDanger, btnPrimary, btnSecondary, btnSecondarySm, fieldLabel, inputField, selectField, touchTarget } from '../../ui/styles'

const COLOR_ESTADO: Record<Tarifa['estado'], string> = {
  Vigente: '#27AE60',
  Programada: '#2980B9',
  Anterior: '#6B6B8A',
}

/** $12.000 · $12.000,50 */
const pesos = (n: number) =>
  `$${n.toLocaleString('es-AR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' sin pasar por Date (que lo correría por la zona horaria). */
const fechaCorta = (iso: string) => iso.split('-').reverse().join('/')

/** Primer día del mes que viene: la fecha más habitual para un cambio de precio. */
function primeroDelMesQueViene(): string {
  const hoy = new Date()
  const d = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

const FORM_VACIO = {
  concepto: 'Cuota' as ConceptoTarifa,
  nivel: '',
  id_referencia: '',
  importe: '',
  vigente_desde: primeroDelMesQueViene(),
}

export function GestionTarifas() {
  const [tarifas, setTarifas] = useState<Tarifa[]>([])
  const [opciones, setOpciones] = useState<OpcionesTarifa | null>(null)
  const [filtro, setFiltro] = useState<ConceptoTarifa | ''>('')
  const [verAnteriores, setVerAnteriores] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<Tarifa | null>(null)
  const [form, setForm] = useState(FORM_VACIO)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  // Se incrementa para volver a pedir los datos después de guardar o borrar.
  const [version, setVersion] = useState(0)
  const recargar = () => setVersion((v) => v + 1)

  useEffect(() => {
    // Si cambia el filtro antes de que llegue la respuesta, se descarta la vieja.
    let vigente = true
    Promise.all([
      api.get<Tarifa[]>(`/tarifas${qs({ concepto: filtro })}`),
      api.get<OpcionesTarifa>('/tarifas/opciones'),
    ]).then(([{ data: t }, { data: o }]) => {
      if (!vigente) return
      if (t) setTarifas(t)
      if (o) setOpciones(o)
    })
    return () => {
      vigente = false
    }
  }, [filtro, version])

  const abrirNueva = () => {
    setEditando(null)
    setForm(FORM_VACIO)
    setMsg(null)
    setShowForm((v) => !v)
  }

  const abrirEdicion = (t: Tarifa) => {
    setEditando(t)
    setForm({
      concepto: t.concepto,
      nivel: t.nivel ?? '',
      id_referencia: t.id_referencia ? String(t.id_referencia) : '',
      importe: String(t.importe),
      vigente_desde: t.vigente_desde,
    })
    setMsg(null)
    setShowForm(true)
  }

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    setMsg(null)
    const datos = { importe: Number(form.importe), vigente_desde: form.vigente_desde }
    const { error } = editando
      ? await api.put(`/tarifas/${editando.id_tarifa}`, datos)
      : await api.post('/tarifas', {
          ...datos,
          concepto: form.concepto,
          nivel: form.concepto === 'Cuota' ? form.nivel : null,
          id_referencia: form.concepto === 'Deporte' || form.concepto === 'Transporte' ? Number(form.id_referencia) : null,
        })
    if (error) {
      setMsg({ ok: false, texto: error.message })
      return
    }
    setMsg({ ok: true, texto: editando ? 'Tarifa actualizada.' : 'Tarifa cargada.' })
    setEditando(null)
    setForm((f) => ({ ...FORM_VACIO, concepto: f.concepto }))
    recargar()
  }

  const eliminar = async (t: Tarifa) => {
    if (!confirm(`¿Borrar la tarifa programada de ${t.referencia} desde el ${fechaCorta(t.vigente_desde)}?`)) return
    const { error } = await api.delete(`/tarifas/${t.id_tarifa}`)
    if (error) alert(error.message)
    recargar()
  }

  const referencias =
    form.concepto === 'Deporte' ? opciones?.deportes : form.concepto === 'Transporte' ? opciones?.recorridos : undefined

  const visibles = verAnteriores ? tarifas : tarifas.filter((t) => t.estado !== 'Anterior')

  const columnas: Columna<Tarifa>[] = [
    { key: 'referencia', header: 'Qué se cobra', movil: 'titulo', className: 'font-bold', render: (t) => t.referencia },
    { key: 'concepto', header: 'Concepto', render: (t) => t.concepto },
    { key: 'importe', header: 'Importe', className: 'font-bold', render: (t) => pesos(t.importe) },
    { key: 'desde', header: 'Rige desde', render: (t) => fechaCorta(t.vigente_desde) },
    { key: 'estado', header: 'Estado', render: (t) => <Badge color={COLOR_ESTADO[t.estado]}>{t.estado}</Badge> },
    {
      key: 'acciones',
      header: 'Acción',
      movil: 'pie',
      render: (t) =>
        t.estado === 'Programada' ? (
          <div className='flex gap-1.5 flex-wrap'>
            <button className={`${btnSecondarySm} ${touchTarget}`} onClick={() => abrirEdicion(t)}>
              Editar
            </button>
            <button className={`${btnDanger} ${touchTarget}`} onClick={() => eliminar(t)}>
              Borrar
            </button>
          </div>
        ) : null,
    },
  ]

  return (
    <div>
      <SectionHeader
        title='🏷️ Tarifas'
        action={
          <button className={btnPrimary} onClick={abrirNueva}>
            {showForm && !editando ? 'Cancelar' : '+ Nueva tarifa'}
          </button>
        }
      />

      {opciones && opciones.sin_precio.length > 0 && (
        <div role='status' className='mb-5 rounded-input border border-[#E67E22] bg-[#E67E221A] p-4 text-[13px]'>
          <strong>Sin precio vigente:</strong> {opciones.sin_precio.map((s) => s.nombre).join(', ')}. Hasta que tengan
          una tarifa, la facturación no los va a poder cobrar.
        </div>
      )}

      {showForm && (
        <Card className='mb-5'>
          <div className='text-[15px] font-extrabold text-text mb-5'>
            {editando ? `Corregir tarifa programada · ${editando.referencia}` : 'Nueva tarifa'}
          </div>
          <form onSubmit={guardar} className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-[14px] items-end'>
            <div>
              <label className={fieldLabel} htmlFor='tarifa-concepto'>
                Concepto
              </label>
              <select
                id='tarifa-concepto'
                className={selectField}
                disabled={!!editando}
                value={form.concepto}
                onChange={(e) =>
                  setForm((f) => ({ ...f, concepto: e.target.value as ConceptoTarifa, nivel: '', id_referencia: '' }))
                }
              >
                {CONCEPTOS_TARIFA.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>

            {form.concepto === 'Cuota' && (
              <div>
                <label className={fieldLabel} htmlFor='tarifa-nivel'>
                  Nivel
                </label>
                <select
                  id='tarifa-nivel'
                  className={selectField}
                  required
                  disabled={!!editando}
                  value={form.nivel}
                  onChange={(e) => setForm((f) => ({ ...f, nivel: e.target.value }))}
                >
                  <option value=''>Seleccioná...</option>
                  {opciones?.niveles.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </div>
            )}

            {referencias && (
              <div>
                <label className={fieldLabel} htmlFor='tarifa-referencia'>
                  {form.concepto === 'Deporte' ? 'Deporte' : 'Recorrido'}
                </label>
                <select
                  id='tarifa-referencia'
                  className={selectField}
                  required
                  disabled={!!editando}
                  value={form.id_referencia}
                  onChange={(e) => setForm((f) => ({ ...f, id_referencia: e.target.value }))}
                >
                  <option value=''>{editando ? editando.referencia : 'Seleccioná...'}</option>
                  {referencias.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className={fieldLabel} htmlFor='tarifa-importe'>
                Importe mensual ($)
              </label>
              <input
                id='tarifa-importe'
                className={inputField}
                type='number'
                inputMode='decimal'
                min={0.01}
                step={0.01}
                required
                value={form.importe}
                onChange={(e) => setForm((f) => ({ ...f, importe: e.target.value }))}
              />
            </div>

            <div>
              <label className={fieldLabel} htmlFor='tarifa-desde'>
                Rige desde
              </label>
              <input
                id='tarifa-desde'
                className={inputField}
                type='date'
                required
                value={form.vigente_desde}
                onChange={(e) => setForm((f) => ({ ...f, vigente_desde: e.target.value }))}
              />
            </div>

            <div className='col-span-full flex flex-col md:flex-row md:items-center gap-3'>
              <button type='submit' className={`${btnPrimary} ${touchTarget} w-full md:w-auto`}>
                {editando ? 'Guardar cambios' : 'Cargar tarifa'}
              </button>
              {editando && (
                <button
                  type='button'
                  className={`${btnSecondary} ${touchTarget} w-full md:w-auto`}
                  onClick={() => {
                    setEditando(null)
                    setShowForm(false)
                  }}
                >
                  Cancelar
                </button>
              )}
              {msg && (
                <span role='status'>
                  <FormMessage ok={msg.ok}>{msg.texto}</FormMessage>
                </span>
              )}
            </div>
          </form>
          <p className='text-[12px] text-textMuted mt-4 mb-0'>
            Para cambiar un precio que ya rige, cargá una tarifa nueva con la fecha desde la que vale. Las facturas ya
            emitidas no cambian.
          </p>
        </Card>
      )}

      <Card>
        <div className='flex flex-wrap gap-2 items-center mb-5'>
          {(['', ...CONCEPTOS_TARIFA] as const).map((c) => (
            <button
              key={c || 'todos'}
              type='button'
              aria-pressed={filtro === c}
              className={`${filtro === c ? btnPrimary : btnSecondary} ${touchTarget}`}
              onClick={() => setFiltro(c)}
            >
              {c || 'Todos'}
            </button>
          ))}
          <label className='ml-auto flex items-center gap-2 text-[13px] text-textMuted cursor-pointer'>
            <input type='checkbox' checked={verAnteriores} onChange={(e) => setVerAnteriores(e.target.checked)} />
            Ver precios anteriores
          </label>
        </div>
        <ResponsiveTable
          columnas={columnas}
          filas={visibles}
          filaKey={(t) => t.id_tarifa}
          vacio='No hay tarifas cargadas.'
        />
      </Card>
    </div>
  )
}
