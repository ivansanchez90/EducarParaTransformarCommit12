/**
 * BandejaComprobantes — revisión de las transferencias que suben las familias (T14).
 *
 * Cada comprobante llega "En revisión". "Revisar" abre el archivo (foto o PDF)
 * junto a los datos de la factura: el admin lo aprueba con el importe que se
 * acreditó en el banco (se crea el pago y baja el saldo de la factura) o lo
 * rechaza con un motivo. En los dos casos la familia recibe el aviso in-app,
 * push y por email.
 */
import { useEffect, useState } from 'react'
import { API_URL, api, getToken, qs } from '../../lib/api'
import { MESES } from '../../constants'
import type { ComprobanteBandeja, EstadoComprobante } from '../../types'
import { Badge, Card, FormMessage, ResponsiveTable, SectionHeader, type Columna } from '../../ui/components'
import { btnDanger, btnPrimary, btnSecondary, btnSecondarySm, fieldLabel, inputField, touchTarget } from '../../ui/styles'
import { useEnLinea } from '../../ui/useEnLinea'

const ESTADOS: EstadoComprobante[] = ['En revisión', 'Aprobado', 'Rechazado']

const COLOR_ESTADO: Record<EstadoComprobante, string> = {
  'En revisión': '#E67E22',
  Aprobado: '#27AE60',
  Rechazado: '#E74C3C',
}

const MOTIVOS_FRECUENTES = [
  'El importe no coincide con la transferencia recibida',
  'La transferencia no se acreditó en la cuenta',
  'No se puede leer el comprobante',
]

/** $12.000 · $12.000,50 */
const pesos = (n: number) =>
  `$${n.toLocaleString('es-AR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`

/** 'YYYY-MM-DD…' → 'DD/MM/YYYY' (las fechas sin hora vienen en UTC). */
const fechaCorta = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

const periodo = (c: ComprobanteBandeja) => `${MESES[c.facturas.mes - 1]} ${c.facturas.anio}`
const alumno = (c: ComprobanteBandeja) => `${c.facturas.alumnos.apellido}, ${c.facturas.alumnos.nombre}`

export function BandejaComprobantes() {
  const [estado, setEstado] = useState<EstadoComprobante>('En revisión')
  const [comprobantes, setComprobantes] = useState<ComprobanteBandeja[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [revisando, setRevisando] = useState<ComprobanteBandeja | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let vigente = true
    api.get<ComprobanteBandeja[]>(`/comprobantes${qs({ estado })}`).then(({ data, error }) => {
      if (!vigente) return
      setComprobantes(data ?? [])
      setError(error?.message ?? '')
      setCargando(false)
    })
    return () => {
      vigente = false
    }
  }, [estado, version])

  const alTerminar = (mensaje: string) => {
    setRevisando(null)
    setAviso(mensaje)
    setCargando(true)
    setVersion((v) => v + 1)
  }

  const columnas: Columna<ComprobanteBandeja>[] = [
    { key: 'alumno', header: 'Alumno', movil: 'titulo', className: 'font-bold', render: alumno },
    {
      key: 'factura',
      header: 'Factura',
      render: (c) => `N° ${String(c.facturas.numero).padStart(8, '0')} · ${periodo(c)}`,
    },
    { key: 'importe', header: 'Declarado', className: 'font-bold', render: (c) => pesos(c.importe) },
    { key: 'fecha', header: 'Transferencia', render: (c) => fechaCorta(c.fecha_transferencia) },
    { key: 'saldo', header: 'Saldo factura', render: (c) => pesos(c.facturas.saldo) },
    {
      key: 'carga',
      header: 'Subido',
      className: 'text-textMuted text-xs',
      render: (c) => `${fechaCorta(c.fecha_carga)}${c.carga ? ` · ${c.carga.nombre} ${c.carga.apellido}` : ''}`,
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (c) => (
        <div className='flex flex-col items-start gap-1'>
          <Badge color={COLOR_ESTADO[c.estado]}>{c.estado}</Badge>
          {c.estado === 'Aprobado' && c.pagos && (
            <span className='text-xs text-textMuted'>Acreditado {pesos(c.pagos.monto_pagado)}</span>
          )}
          {c.estado === 'Rechazado' && c.motivo_rechazo && (
            <span className='text-xs text-textMuted max-w-[260px]'>{c.motivo_rechazo}</span>
          )}
        </div>
      ),
    },
    {
      key: 'acciones',
      header: '',
      movil: 'pie',
      render: (c) => (
        <button
          className={`${c.estado === 'En revisión' ? btnPrimary : btnSecondarySm} ${touchTarget}`}
          onClick={() => {
            setAviso('')
            setRevisando(c)
          }}
        >
          {c.estado === 'En revisión' ? 'Revisar' : 'Ver'}
        </button>
      ),
    },
  ]

  return (
    <div>
      <SectionHeader title='📥 Comprobantes de pago' />

      <Card>
        <div className='flex flex-wrap gap-2 mb-5'>
          {ESTADOS.map((e) => (
            <button
              key={e}
              type='button'
              aria-pressed={estado === e}
              className={`${estado === e ? btnPrimary : btnSecondary} ${touchTarget}`}
              onClick={() => {
                setAviso('')
                if (e !== estado) setCargando(true)
                setEstado(e)
              }}
            >
              {e}
            </button>
          ))}
        </div>

        {aviso && (
          <div className='mb-4' role='status'>
            <FormMessage ok>{aviso}</FormMessage>
          </div>
        )}
        {error && (
          <div className='mb-4' role='alert'>
            <FormMessage ok={false}>{error}</FormMessage>
          </div>
        )}

        <ResponsiveTable
          columnas={columnas}
          filas={comprobantes}
          filaKey={(c) => c.id_comprobante}
          vacio={
            cargando
              ? 'Cargando...'
              : estado === 'En revisión'
                ? 'No hay comprobantes para revisar.'
                : `No hay comprobantes en estado "${estado}".`
          }
        />
      </Card>

      {revisando && <Revision comprobante={revisando} onCerrar={() => setRevisando(null)} onTerminar={alTerminar} />}
    </div>
  )
}

/** Archivo del comprobante (foto o PDF) bajado con la sesión, para mostrarlo en pantalla. */
function useArchivo(idComprobante: number) {
  const [archivo, setArchivo] = useState<{ url: string; tipo: string } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let url = ''
    let vigente = true
    const token = getToken()
    fetch(`${API_URL}/api/comprobantes/${idComprobante}/archivo`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Error ${res.status}`)
        const blob = await res.blob()
        if (!vigente) return
        url = URL.createObjectURL(blob)
        setArchivo({ url, tipo: blob.type })
      })
      .catch((err: unknown) => {
        if (vigente) setError(err instanceof Error ? err.message : 'No se pudo abrir el archivo')
      })
    return () => {
      vigente = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [idComprobante])

  return { archivo, error }
}

function Revision({
  comprobante: c,
  onCerrar,
  onTerminar,
}: {
  comprobante: ComprobanteBandeja
  onCerrar: () => void
  onTerminar: (mensaje: string) => void
}) {
  const { archivo, error: errorArchivo } = useArchivo(c.id_comprobante)
  const enLinea = useEnLinea()
  const pendiente = c.estado === 'En revisión'
  const [importe, setImporte] = useState(String(Math.min(c.importe, c.facturas.saldo)))
  const [motivo, setMotivo] = useState('')
  const [rechazando, setRechazando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const alApretar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', alApretar)
    return () => {
      document.removeEventListener('keydown', alApretar)
    }
  }, [onCerrar])

  const monto = Number(importe.replace(',', '.'))
  const difiere = Number.isFinite(monto) && monto > 0 && monto !== c.importe

  const aprobar = async () => {
    setEnviando(true)
    setError('')
    const { data, error } = await api.patch<{ factura: { saldo: number; estado: string } }>(
      `/comprobantes/${c.id_comprobante}/aprobar`,
      { importe },
    )
    setEnviando(false)
    if (error) return setError(error.message)
    onTerminar(
      `Pago de ${pesos(monto)} acreditado a ${alumno(c)}. La factura quedó ${data.factura.estado.toLowerCase()}` +
        (data.factura.saldo > 0 ? ` con saldo ${pesos(data.factura.saldo)}.` : '.'),
    )
  }

  const rechazar = async () => {
    setEnviando(true)
    setError('')
    const { error } = await api.patch(`/comprobantes/${c.id_comprobante}/rechazar`, { motivo })
    setEnviando(false)
    if (error) return setError(error.message)
    onTerminar(`Comprobante de ${alumno(c)} rechazado. La familia ya recibió el aviso.`)
  }

  return (
    <div
      className='fixed inset-0 z-[140] flex items-center justify-center p-4'
      style={{ background: 'rgba(26,26,46,0.45)' }}
      onClick={onCerrar}
    >
      <div
        role='dialog'
        aria-modal='true'
        aria-labelledby='revision-titulo'
        className='bg-white rounded-card shadow-card border border-border w-full max-w-[980px] max-h-[calc(100dvh-32px)] overflow-y-auto grid md:grid-cols-[1fr_360px]'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='bg-bg min-h-[240px] md:min-h-[520px] flex flex-col items-center justify-center gap-3 p-3'>
          {errorArchivo && <FormMessage ok={false}>{errorArchivo}</FormMessage>}
          {!errorArchivo && !archivo && <span className='text-[13px] text-textMuted'>Cargando el comprobante...</span>}
          {archivo?.tipo === 'application/pdf' && (
            <iframe title='Comprobante' src={archivo.url} className='w-full h-[55vh] md:h-full md:min-h-[480px] border-0' />
          )}
          {archivo && archivo.tipo !== 'application/pdf' && (
            <img src={archivo.url} alt='Comprobante de transferencia' className='max-w-full max-h-[55vh] md:max-h-[70vh] object-contain' />
          )}
          {archivo && (
            // El navegador del celular no siempre muestra un PDF dentro de la página.
            <a href={archivo.url} target='_blank' rel='noreferrer' className='text-[13px] font-bold text-purple-700'>
              Abrir en otra pestaña ↗
            </a>
          )}
        </div>

        <div className='p-5 flex flex-col gap-4'>
          <div>
            <div id='revision-titulo' className='text-[17px] font-black text-text'>
              {alumno(c)}
            </div>
            <div className='text-[13px] text-textMuted'>
              Factura N° {String(c.facturas.numero).padStart(8, '0')} · {periodo(c)}
            </div>
          </div>

          <dl className='grid grid-cols-2 gap-x-3 gap-y-2 m-0 text-[13px]'>
            <dt className='text-textMuted'>Declarado</dt>
            <dd className='m-0 font-bold'>{pesos(c.importe)}</dd>
            <dt className='text-textMuted'>Transferencia</dt>
            <dd className='m-0'>{fechaCorta(c.fecha_transferencia)}</dd>
            <dt className='text-textMuted'>Total factura</dt>
            <dd className='m-0'>{pesos(c.facturas.total)}</dd>
            <dt className='text-textMuted'>Saldo factura</dt>
            <dd className='m-0 font-bold'>{pesos(c.facturas.saldo)}</dd>
            {c.carga && (
              <>
                <dt className='text-textMuted'>Subido por</dt>
                <dd className='m-0 break-words'>
                  {c.carga.nombre} {c.carga.apellido}
                </dd>
              </>
            )}
          </dl>

          {c.ordenes_pago && (
            <div className='text-[12px] text-textMuted'>
              <span className='font-bold text-text'>Orden N° {c.ordenes_pago.numero}</span> ({pesos(c.ordenes_pago.total)}):{' '}
              {c.ordenes_pago.items.map((i) => `${i.items.descripcion} ${pesos(i.importe)}`).join(' · ')}
            </div>
          )}

          {!pendiente && (
            <div className='text-[13px]'>
              <Badge color={COLOR_ESTADO[c.estado]}>{c.estado}</Badge>
              {c.revision && (
                <span className='text-textMuted'>
                  {' '}
                  por {c.revision.nombre} {c.revision.apellido}
                  {c.fecha_revision && ` el ${fechaCorta(c.fecha_revision)}`}
                </span>
              )}
              {c.pagos && <div className='mt-2'>Acreditado: {pesos(c.pagos.monto_pagado)}</div>}
              {c.motivo_rechazo && <div className='mt-2'>Motivo: {c.motivo_rechazo}</div>}
            </div>
          )}

          {pendiente && !rechazando && (
            <div>
              <label className={fieldLabel} htmlFor='revision-importe'>
                Importe acreditado en el banco
              </label>
              <input
                id='revision-importe'
                className={inputField}
                inputMode='decimal'
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
              />
              {difiere && (
                <p className='text-[12px] text-[#E67E22] font-bold mt-2 mb-0'>
                  Es distinto de lo que declaró la familia ({pesos(c.importe)}).
                </p>
              )}
              {c.facturas.saldo <= 0 && (
                <p className='text-[12px] text-red font-bold mt-2 mb-0'>
                  La factura ya está pagada: este comprobante se debería rechazar.
                </p>
              )}
            </div>
          )}

          {pendiente && rechazando && (
            <div>
              <label className={fieldLabel} htmlFor='revision-motivo'>
                Motivo del rechazo (lo ve la familia)
              </label>
              <textarea
                id='revision-motivo'
                className={`${inputField} min-h-[88px] resize-y`}
                maxLength={300}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
              <div className='flex flex-wrap gap-2 mt-2'>
                {MOTIVOS_FRECUENTES.map((m) => (
                  <button key={m} type='button' className={`${btnSecondarySm} text-left`} onClick={() => setMotivo(m)}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div role='alert'>
              <FormMessage ok={false}>{error}</FormMessage>
            </div>
          )}

          <div className='flex flex-wrap gap-2 mt-auto'>
            {pendiente && !rechazando && (
              <>
                <button
                  className={`${btnPrimary} ${touchTarget}`}
                  disabled={enviando || !enLinea || !(monto > 0)}
                  onClick={aprobar}
                >
                  {enviando ? 'Aprobando...' : 'Aprobar'}
                </button>
                <button className={`${btnSecondary} ${touchTarget}`} disabled={enviando} onClick={() => setRechazando(true)}>
                  Rechazar...
                </button>
              </>
            )}
            {pendiente && rechazando && (
              <>
                <button
                  className={`${btnDanger} ${touchTarget}`}
                  disabled={enviando || !enLinea || !motivo.trim()}
                  onClick={rechazar}
                >
                  {enviando ? 'Rechazando...' : 'Rechazar comprobante'}
                </button>
                <button className={`${btnSecondary} ${touchTarget}`} disabled={enviando} onClick={() => setRechazando(false)}>
                  Volver
                </button>
              </>
            )}
            <button className={`${btnSecondary} ${touchTarget}`} onClick={onCerrar}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
