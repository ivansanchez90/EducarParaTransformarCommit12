/**
 * GestionFacturacion — emisión de las facturas del mes y su listado.
 *
 * "Generar facturas" emite una factura por alumno activo con su cuota,
 * deportes, transporte, comedor y beca, con los precios vigentes el día 1 del
 * mes. Volver a generar no duplica: solo emite las que falten (por ejemplo,
 * después de cargar una tarifa que no estaba).
 */
import { useEffect, useState } from 'react'
import { api, descargar, qs } from '../../lib/api'
import { MESES } from '../../constants'
import type { EstadoFactura, Factura, ResultadoGeneracion } from '../../types'
import { Badge, Card, FormMessage, ResponsiveTable, SectionHeader, type Columna } from '../../ui/components'
import { btnPrimary, btnSecondary, btnSecondarySm, fieldLabel, inputField, selectField, touchTarget } from '../../ui/styles'

const ESTADOS: EstadoFactura[] = ['Pendiente', 'Pago parcial', 'Vencida', 'Pagada']

const COLOR_ESTADO: Record<EstadoFactura, string> = {
  Pendiente: '#E67E22',
  'Pago parcial': '#2980B9',
  Vencida: '#E74C3C',
  Pagada: '#27AE60',
}

/** $12.000 · $12.000,50 · -$19.000 */
const pesos = (n: number) =>
  `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('es-AR', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`

const numero = (n: number) => String(n).padStart(8, '0')

/** Las facturas de un mes se emiten a fin del mes anterior: por defecto, el mes que viene. */
function mesQueViene() {
  const hoy = new Date()
  const d = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1)
  return { anio: d.getFullYear(), mes: d.getMonth() + 1 }
}

export function GestionFacturacion() {
  const [periodo, setPeriodo] = useState(mesQueViene)
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [filtro, setFiltro] = useState<EstadoFactura | ''>('')
  const [generando, setGenerando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoGeneracion | null>(null)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let vigente = true
    api.get<Factura[]>(`/facturas${qs(periodo)}`).then(({ data, error }) => {
      if (!vigente) return
      setFacturas(data ?? [])
      setError(error?.message ?? '')
    })
    return () => {
      vigente = false
    }
  }, [periodo, version])

  const nombreMes = `${MESES[periodo.mes - 1]} ${periodo.anio}`

  const generar = async () => {
    if (!confirm(`¿Emitir las facturas de ${nombreMes}? Las que ya existen no se modifican.`)) return
    setGenerando(true)
    setResultado(null)
    setError('')
    const { data, error } = await api.post<ResultadoGeneracion>('/facturas/generar', periodo)
    setGenerando(false)
    if (error) setError(error.message)
    else setResultado(data)
    setVersion((v) => v + 1)
  }

  const bajarPdf = async (f: Factura) => {
    const err = await descargar(`/facturas/${f.id_factura}/pdf`)
    if (err) alert(err.message)
  }

  const visibles = filtro ? facturas.filter((f) => f.estado === filtro) : facturas
  const totalFacturado = facturas.reduce((s, f) => s + f.total, 0)
  const saldoPendiente = facturas.reduce((s, f) => s + f.saldo, 0)

  const columnas: Columna<Factura>[] = [
    {
      key: 'alumno',
      header: 'Alumno',
      movil: 'titulo',
      className: 'font-bold',
      render: (f) => `${f.alumnos.apellido}, ${f.alumnos.nombre}`,
    },
    { key: 'numero', header: 'N°', className: 'text-textMuted', render: (f) => numero(f.numero) },
    {
      key: 'curso',
      header: 'Curso',
      render: (f) => (f.alumnos.cursos ? `${f.alumnos.cursos.nivel} ${f.alumnos.cursos.grado_anio} "${f.alumnos.cursos.division}"` : '—'),
    },
    {
      key: 'composicion',
      header: 'Composición',
      className: 'text-textMuted text-xs max-w-[320px]',
      render: (f) => f.items.map((i) => `${i.concepto === 'Cuota' ? 'Cuota' : i.descripcion} ${pesos(i.importe)}`).join(' · '),
    },
    { key: 'total', header: 'Total', className: 'font-bold', render: (f) => pesos(f.total) },
    { key: 'saldo', header: 'Saldo', render: (f) => pesos(f.saldo) },
    { key: 'estado', header: 'Estado', render: (f) => <Badge color={COLOR_ESTADO[f.estado]}>{f.estado}</Badge> },
    {
      key: 'pdf',
      header: 'Factura',
      movil: 'pie',
      render: (f) => (
        <button className={`${btnSecondarySm} ${touchTarget}`} onClick={() => bajarPdf(f)}>
          📄 PDF
        </button>
      ),
    },
  ]

  return (
    <div>
      <SectionHeader title='🧾 Facturación' />

      <Card className='mb-5'>
        <div className='text-[15px] font-extrabold text-text mb-5'>Generar las facturas del mes</div>
        <div className='grid grid-cols-2 md:grid-cols-[200px_140px_auto] gap-[14px] items-end'>
          <div>
            <label className={fieldLabel} htmlFor='fact-mes'>
              Mes
            </label>
            <select
              id='fact-mes'
              className={selectField}
              value={periodo.mes}
              onChange={(e) => setPeriodo((p) => ({ ...p, mes: Number(e.target.value) }))}
            >
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={fieldLabel} htmlFor='fact-anio'>
              Año
            </label>
            <input
              id='fact-anio'
              className={inputField}
              type='number'
              min={2000}
              max={2100}
              value={periodo.anio}
              onChange={(e) => setPeriodo((p) => ({ ...p, anio: Number(e.target.value) }))}
            />
          </div>
          <button
            className={`${btnPrimary} ${touchTarget} col-span-2 md:col-span-1 md:justify-self-start`}
            disabled={generando}
            onClick={generar}
          >
            {generando ? 'Generando...' : `Generar facturas de ${nombreMes}`}
          </button>
        </div>
        <p className='text-[12px] text-textMuted mt-4 mb-0'>
          Una factura por alumno activo con su cuota, deportes, transporte, comedor y beca, con los precios vigentes el
          1 de {MESES[periodo.mes - 1].toLowerCase()}. Volver a generar no duplica: solo emite las que falten.
        </p>

        {error && (
          <div className='mt-4' role='alert'>
            <FormMessage ok={false}>{error}</FormMessage>
          </div>
        )}
        {resultado && (
          <div className='mt-4' role='status'>
            <FormMessage ok={resultado.errores.length === 0}>
              Se emitieron {resultado.generadas} factura(s).
              {resultado.omitidas > 0 && ` ${resultado.omitidas} ya estaban emitidas.`}
              {resultado.errores.length > 0 && ` ${resultado.errores.length} no se pudieron emitir:`}
            </FormMessage>
            {resultado.errores.length > 0 && (
              <>
                <ul className='mt-2 mb-2 pl-5 text-[13px] text-text max-h-60 overflow-y-auto'>
                  {resultado.errores.map((e) => (
                    <li key={e.id_alumno}>
                      <strong>{e.alumno}:</strong> {e.motivo}
                    </li>
                  ))}
                </ul>
                <div className='text-[12px] text-textMuted'>
                  Cargá los datos que faltan (por ejemplo, la tarifa en <em>Tarifas</em>) y volvé a generar: se emiten solo
                  las que faltan.
                </div>
              </>
            )}
          </div>
        )}
      </Card>

      <Card>
        <div className='flex flex-wrap items-baseline justify-between gap-2 mb-4'>
          <div className='text-[15px] font-extrabold text-text'>Facturas de {nombreMes}</div>
          <div className='text-[13px] text-textMuted'>
            {facturas.length} factura(s) · Total {pesos(totalFacturado)} · Saldo {pesos(saldoPendiente)}
          </div>
        </div>
        <div className='flex flex-wrap gap-2 mb-5'>
          {(['', ...ESTADOS] as const).map((e) => (
            <button
              key={e || 'todas'}
              type='button'
              aria-pressed={filtro === e}
              className={`${filtro === e ? btnPrimary : btnSecondary} ${touchTarget}`}
              onClick={() => setFiltro(e)}
            >
              {e || 'Todas'}
            </button>
          ))}
        </div>
        <ResponsiveTable
          columnas={columnas}
          filas={visibles}
          filaKey={(f) => f.id_factura}
          vacio={facturas.length ? 'No hay facturas con ese estado.' : `Todavía no se emitieron las facturas de ${nombreMes}.`}
        />
      </Card>
    </div>
  )
}
