/**
 * Componentes de presentación reutilizables.
 *
 * Encapsulan patrones de interfaz que se repetían por todo el panel
 * (cabecera de sección, campo de formulario con etiqueta, chip de estado),
 * garantizando una convención visual única y sin duplicación.
 */
import type { CSSProperties, ReactNode } from 'react'
import { badge, btnPrimary, card, fieldLabel, inputField } from './styles'

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
