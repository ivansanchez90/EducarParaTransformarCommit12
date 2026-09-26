/**
 * Componentes de presentación reutilizables.
 *
 * Encapsulan patrones de interfaz que se repetían por todo el panel
 * (cabecera de sección, campo de formulario con etiqueta, chip de estado),
 * garantizando una convención visual única y sin duplicación.
 */
import { useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import {
  badge,
  btnPrimary,
  card,
  fieldLabel,
  inputField,
  msgError,
  msgOk,
  safeAreaBottom,
  safeAreaX,
  tableBase,
  tdCell,
  thCell,
  touchTarget,
} from './styles'
import { useEsMovil } from './useEsMovil'

/** Cabecera de una sección: título a la izquierda y acción opcional a la derecha. */
export function SectionHeader({
  title,
  action,
}: {
  title: ReactNode
  action?: ReactNode
}) {
  return (
    <div className='flex justify-between items-center mb-5'>
      <h2 className='text-[22px] font-black m-0'>{title}</h2>
      {action}
    </div>
  )
}

/** Botón que alterna un formulario (abrir / cancelar). */
export function ToggleFormButton({
  open,
  onClick,
  openLabel,
  closeLabel = 'Cancelar',
}: {
  open: boolean
  onClick: () => void
  openLabel: string
  closeLabel?: string
}) {
  return (
    <button className={btnPrimary} onClick={onClick}>
      {open ? closeLabel : openLabel}
    </button>
  )
}

/** Contenedor de tarjeta blanca estándar. */
export function Card({
  children,
  className = '',
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <div className={`${card} ${className}`.trim()} style={style}>
      {children}
    </div>
  )
}

/** Campo de formulario: etiqueta + input controlado. */
export function Field({
  label,
  type = 'text',
  value,
  onChange,
  required,
  placeholder,
}: {
  label: string
  type?: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  placeholder?: string
}) {
  return (
    <div>
      <span className={fieldLabel}>{label}</span>
      <input
        type={type}
        className={inputField}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

/** Chip de estado coloreado (activo/inactivo, estados de cuota, etc.). */
export function Badge({
  color,
  children,
}: {
  color: string
  children: ReactNode
}) {
  return <span style={badge(color)}>{children}</span>
}

/** Resultado de un formulario: verde si salió bien, rojo con el error del backend si no. */
export function FormMessage({ ok, children }: { ok: boolean; children: ReactNode }) {
  return <div className={ok ? msgOk : msgError}>{children}</div>
}

/** Chip Activo/Inactivo (el femenino para "Activa/Inactiva"). */
export function EstadoBadge({ activo, femenino }: { activo: boolean; femenino?: boolean }) {
  const texto = activo ? 'Activo' : 'Inactivo'
  return <Badge color={activo ? '#27AE60' : '#E74C3C'}>{femenino ? texto.slice(0, -1) + 'a' : texto}</Badge>
}

// ═══════════════════════════════════════════════════════════════
//  MOBILE (PWA): navegación inferior, tablas y menú del avatar
// ═══════════════════════════════════════════════════════════════

/** Cierra un menú o panel abierto al apretar Escape. */
function useCerrarConEscape(abierto: boolean, cerrar: () => void) {
  useEffect(() => {
    if (!abierto) return
    const alApretar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar()
    }
    document.addEventListener('keydown', alApretar)
    return () => {
      document.removeEventListener('keydown', alApretar)
    }
  }, [abierto, cerrar])
}

/** Ítem de menú; mismo formato que `NAV_ADMIN` y `NAV_DOCENTE` en `constants`. */
export interface NavItem {
  key: string
  icon: string
  label: string
}

/** Contador rojo sobre un ícono (notificaciones sin leer, cuotas pendientes). */
function Contador({ valor }: { valor: number }) {
  if (valor <= 0) return null
  return (
    <span className='absolute -top-1 -right-2.5 bg-red text-white rounded-full min-w-[18px] h-[18px] px-1 text-[10px] font-black flex items-center justify-center'>
      {valor > 99 ? '99+' : valor}
    </span>
  )
}

function BotonNav({
  icon,
  label,
  activo,
  contador = 0,
  onClick,
  ...aria
}: {
  icon: string
  label: string
  activo: boolean
  contador?: number
  onClick: () => void
  'aria-current'?: 'page'
  'aria-expanded'?: boolean
  'aria-controls'?: string
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={`w-full h-full flex flex-col items-center justify-center gap-0.5 bg-transparent border-0 cursor-pointer font-[inherit] px-1 ${
        activo ? 'text-purple-700' : 'text-textMuted'
      }`}
      {...aria}
    >
      <span className='relative text-xl leading-none' aria-hidden='true'>
        {icon}
        <Contador valor={contador} />
      </span>
      <span className={`text-[10px] max-w-full truncate ${activo ? 'font-black' : 'font-bold'}`}>
        {label}
      </span>
    </button>
  )
}

/**
 * Barra de navegación inferior para el celular (se oculta desde `md`).
 *
 * Muestra hasta `maxVisibles + 1` botones: si hay más ítems, los primeros
 * `maxVisibles` quedan en la barra y el último botón es "Más", que abre el
 * resto en un panel. Con `maxVisibles + 1` ítems o menos se muestran todos.
 * El contenido de la página debe usar `conBottomNav` para que la barra no lo tape.
 */
export function BottomNav({
  items,
  activo,
  onSelect,
  maxVisibles = 4,
  contadores = {},
}: {
  items: NavItem[]
  activo: string
  onSelect: (key: string) => void
  maxVisibles?: number
  /** Número a mostrar sobre el ícono de cada ítem, por `key`. */
  contadores?: Record<string, number>
}) {
  const [masAbierto, setMasAbierto] = useState(false)
  const idPanel = useId()
  const cerrarMas = () => {
    setMasAbierto(false)
  }
  useCerrarConEscape(masAbierto, cerrarMas)

  const hayMas = items.length > maxVisibles + 1
  const visibles = hayMas ? items.slice(0, maxVisibles) : items
  const resto = hayMas ? items.slice(maxVisibles) : []
  const activoEnMas = resto.some((i) => i.key === activo)
  const contadorMas = resto.reduce((total, i) => total + (contadores[i.key] ?? 0), 0)

  const elegir = (key: string) => {
    setMasAbierto(false)
    onSelect(key)
  }

  return (
    <div className='md:hidden'>
      {masAbierto && (
        <>
          <div className='fixed inset-0 z-[80] bg-text/30' onClick={cerrarMas} aria-hidden='true' />
          <div
            id={idPanel}
            role='dialog'
            aria-label='Más secciones'
            className={`fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-[85] bg-white rounded-t-card border-t border-border shadow-[0_-8px_32px_rgba(91,53,197,0.18)] py-2 ${safeAreaX}`}
          >
            <ul className='list-none m-0 p-0'>
              {resto.map((item) => (
                <li key={item.key}>
                  <button
                    type='button'
                    onClick={() => {
                      elegir(item.key)
                    }}
                    aria-current={item.key === activo ? 'page' : undefined}
                    className={`w-full min-h-12 flex items-center gap-3 px-6 bg-transparent border-0 cursor-pointer font-[inherit] text-sm text-left ${
                      item.key === activo ? 'text-purple-700 font-extrabold bg-purpleLight' : 'text-text font-semibold'
                    }`}
                  >
                    <span className='relative text-lg' aria-hidden='true'>
                      {item.icon}
                      <Contador valor={contadores[item.key] ?? 0} />
                    </span>
                    <span>{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <nav
        aria-label='Navegación principal'
        className={`fixed inset-x-0 bottom-0 z-[90] bg-white border-t border-border shadow-[0_-2px_16px_rgba(91,53,197,0.08)] ${safeAreaBottom} ${safeAreaX}`}
      >
        <ul className='flex h-16 list-none m-0 p-0'>
          {visibles.map((item) => (
            <li key={item.key} className='flex-1 min-w-0'>
              <BotonNav
                icon={item.icon}
                label={item.label}
                activo={item.key === activo && !masAbierto}
                contador={contadores[item.key]}
                onClick={() => elegir(item.key)}
                aria-current={item.key === activo ? 'page' : undefined}
              />
            </li>
          ))}
          {hayMas && (
            <li className='flex-1 min-w-0'>
              <BotonNav
                icon='☰'
                label='Más'
                activo={activoEnMas || masAbierto}
                contador={contadorMas}
                onClick={() => {
                  setMasAbierto((abierto) => !abierto)
                }}
                aria-expanded={masAbierto}
                aria-controls={idPanel}
              />
            </li>
          )}
        </ul>
      </nav>
    </div>
  )
}

/** Contenedor con scroll horizontal para que una tabla ancha no desborde la pantalla. */
export function TablaScroll({ children }: { children: ReactNode }) {
  return <div className='overflow-x-auto overscroll-x-contain'>{children}</div>
}

/** Columna de `ResponsiveTable`. */
export interface Columna<T> {
  key: string
  header: ReactNode
  render: (fila: T) => ReactNode
  /** Clases extra para la celda en escritorio. */
  className?: string
  /**
   * Cómo aparece en la tarjeta del celular: `titulo` arriba y en negrita,
   * `pie` abajo sin etiqueta (botones de acción), `oculta` no se muestra.
   * Sin valor, se muestra como "Etiqueta: valor".
   */
  movil?: 'titulo' | 'pie' | 'oculta'
}

/**
 * Tabla en escritorio y lista de tarjetas en el celular (debajo de `md`).
 *
 * Renderiza solo una de las dos versiones, así que las celdas pueden tener
 * inputs controlados o ids sin que se dupliquen.
 */
export function ResponsiveTable<T>({
  columnas,
  filas,
  filaKey,
  vacio = 'No hay registros.',
}: {
  columnas: Columna<T>[]
  filas: T[]
  filaKey: (fila: T) => string | number
  vacio?: ReactNode
}) {
  const esMovil = useEsMovil()

  if (filas.length === 0) {
    return <p className='text-[13px] text-textMuted m-0'>{vacio}</p>
  }

  if (!esMovil) {
    return (
      <TablaScroll>
        <table className={tableBase}>
          <thead>
            <tr>
              {columnas.map((c) => (
                <th key={c.key} className={thCell}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={filaKey(fila)}>
                {columnas.map((c) => (
                  <td key={c.key} className={`${tdCell} ${c.className ?? ''}`.trim()}>
                    {c.render(fila)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </TablaScroll>
    )
  }

  const titulos = columnas.filter((c) => c.movil === 'titulo')
  const campos = columnas.filter((c) => c.movil === undefined)
  const pies = columnas.filter((c) => c.movil === 'pie')

  return (
    <ul className='list-none m-0 p-0 flex flex-col gap-3'>
      {filas.map((fila) => (
        <li key={filaKey(fila)} className='bg-white border border-border rounded-input p-4'>
          {titulos.map((c) => (
            <div key={c.key} className='text-[15px] font-extrabold text-text mb-2'>
              {c.render(fila)}
            </div>
          ))}
          {campos.length > 0 && (
            <dl className='grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 m-0 items-center'>
              {campos.map((c) => (
                <div key={c.key} className='contents'>
                  <dt className='text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em]'>
                    {c.header}
                  </dt>
                  <dd className='m-0 text-[13px] text-text min-w-0 break-words'>{c.render(fila)}</dd>
                </div>
              ))}
            </dl>
          )}
          {pies.map((c) => (
            <div key={c.key} className='mt-3 pt-3 border-t border-border flex flex-wrap gap-2 justify-end'>
              {c.render(fila)}
            </div>
          ))}
        </li>
      ))}
    </ul>
  )
}

/** Opción del menú del avatar. */
export interface OpcionMenu {
  key: string
  label: string
  icon?: string
  onClick: () => void
}

/**
 * Avatar con menú desplegable: reúne en la cabecera las acciones de cuenta
 * ("Mi contraseña", "Inicio", "Salir") que en el celular no entran como botones.
 */
export function AvatarMenu({
  iniciales,
  nombre,
  detalle,
  opciones,
}: {
  iniciales: string
  nombre: string
  /** Segunda línea bajo el nombre (rol, hijo seleccionado...). */
  detalle?: ReactNode
  opciones: OpcionMenu[]
}) {
  const [abierto, setAbierto] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const idMenu = useId()

  const cerrar = () => {
    setAbierto(false)
    boton.current?.focus()
  }
  useCerrarConEscape(abierto, cerrar)

  useEffect(() => {
    if (!abierto) return
    const alTocar = (e: PointerEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('pointerdown', alTocar)
    return () => {
      document.removeEventListener('pointerdown', alTocar)
    }
  }, [abierto])

  return (
    <div ref={contenedor} className='relative'>
      <button
        ref={boton}
        type='button'
        onClick={() => {
          setAbierto((a) => !a)
        }}
        aria-haspopup='menu'
        aria-expanded={abierto}
        aria-controls={idMenu}
        aria-label={`Menú de ${nombre}`}
        className={`${touchTarget} flex items-center justify-center bg-transparent border-0 p-0 cursor-pointer`}
      >
        <span className='w-[38px] h-[38px] rounded-full bg-gradient-to-br from-purple-700 to-purpleMid text-white flex items-center justify-center font-black text-sm'>
          {iniciales}
        </span>
      </button>

      {abierto && (
        <div
          id={idMenu}
          className='absolute right-0 top-[calc(100%+8px)] z-[110] w-[240px] max-w-[calc(100vw-32px)] bg-white border border-border rounded-input shadow-[0_8px_32px_rgba(91,53,197,0.18)] py-2'
        >
          <div className='px-4 pt-1 pb-3 mb-1 border-b border-border'>
            <div className='text-[13px] font-extrabold text-text truncate'>{nombre}</div>
            {detalle && <div className='text-[11px] text-textMuted'>{detalle}</div>}
          </div>
          <ul role='menu' aria-label='Cuenta' className='list-none m-0 p-0'>
            {opciones.map((o) => (
              <li key={o.key} role='none'>
                <button
                  type='button'
                  role='menuitem'
                  onClick={() => {
                    setAbierto(false)
                    o.onClick()
                  }}
                  className='w-full min-h-11 flex items-center gap-2.5 px-4 bg-transparent border-0 cursor-pointer font-[inherit] text-[13px] font-bold text-text text-left hover:bg-purpleLight hover:text-purple-700'
                >
                  {o.icon && <span aria-hidden='true'>{o.icon}</span>}
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
