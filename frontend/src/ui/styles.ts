/**
 * Clases de estilo reutilizables (Tailwind).
 *
 * El panel repetía las mismas cadenas de clases decenas de veces (el botón
 * primario aparecía 45 veces, el input 86, el label 98, la cabecera de tabla
 * 112). Se centralizan aquí para tener una única fuente de verdad y una
 * convención de estilos consistente en todo el proyecto.
 */
import type { CSSProperties } from 'react'

/** Botón de acción principal (degradado púrpura). */
export const btnPrimary =
  'bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer'

/** Botón secundario (fondo púrpura claro). */
export const btnSecondary =
  'bg-purpleLight text-purple-700 border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer'

/** Botón secundario pequeño (para acciones dentro de tablas). */
export const btnSecondarySm =
  'bg-purpleLight text-purple-700 border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'

/** Botón primario pequeño. */
export const btnPrimarySm =
  'bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'

/** Botón de peligro / eliminar. */
export const btnDanger =
  'bg-[#E74C3C1A] text-red border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'

/**
 * Campo de texto / número / fecha. En el celular la letra es de 16 px: con
 * menos, el iPhone hace zoom al tocar el campo.
 */
export const inputField =
  'w-full px-[14px] py-[10px] rounded-input border-2 border-border text-base md:text-[13px] text-text outline-none box-border'

/** Select (igual que el input pero sin la flecha nativa). */
export const selectField = `${inputField} appearance-none`

/** Etiqueta de campo de formulario. */
export const fieldLabel =
  'text-[11px] font-extrabold text-textMuted block mb-[5px]'

/** Celda de cabecera de tabla. */
export const thCell =
  'text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'

/** Celda de cuerpo de tabla. */
export const tdCell =
  'py-[11px] pr-3 text-[13px] border-b border-border align-middle'

/** Tarjeta / contenedor de sección (relleno más chico en el celular). */
export const card =
  'bg-white rounded-card p-4 md:p-6 shadow-card border border-border'

/**
 * Estilo del "chip" de estado coloreado.
 * El color es dinámico, por lo que se mantiene como estilo en línea, pero
 * centralizado en un único helper reutilizable.
 */
export const badge = (color: string): CSSProperties => ({
  display: 'inline-block',
  background: color + '1A',
  color,
  borderRadius: 20,
  padding: '3px 10px',
  fontSize: 11,
  fontWeight: 800,
})

/** Tabla de listado a todo el ancho. */
export const tableBase = 'w-full border-collapse'

/** Grilla de formulario de cuatro columnas (la última fila puede ocupar todo el ancho con `col-span-full`). */
export const formGrid4 = 'grid grid-cols-4 gap-[14px]'

/** Acciones por fila dentro de una tabla. */
export const rowActions = 'flex gap-2 justify-end'

/** Mensaje de resultado de un formulario. */
export const msgOk = 'text-[13px] font-bold text-green'
export const msgError = 'text-[13px] font-bold text-red'

// ── Mobile y bordes del teléfono ────────────────────────────────
// La app instalada usa `viewport-fit=cover`, así que el contenido puede quedar
// debajo del gesto de inicio del iPhone o del notch en horizontal. Estas
// clases suman el margen seguro que informa el navegador (0 en escritorio).

/** Relleno inferior igual al área segura (barra de gestos del iPhone). */
export const safeAreaBottom = 'pb-[env(safe-area-inset-bottom)]'

/** Relleno lateral igual al área segura (notch con el teléfono en horizontal). */
export const safeAreaX = 'pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]'

/**
 * Relleno lateral de 16 px en el celular que se agranda si el área segura es
 * mayor. Va en lugar de `px-4` + `safeAreaX`: `safeAreaX` pisaría el `px-4`
 * (vale 0 sin notch). Desde `md`, un `md:px-*` lo reemplaza.
 */
export const conPaddingX =
  'pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]'

/**
 * Relleno inferior del contenido cuando hay `BottomNav`: en el celular deja
 * lugar para la barra (64 px, `h-16`), un margen y el área segura; desde `md`
 * vuelve al relleno normal del panel.
 */
export const conBottomNav = 'pb-[calc(64px+24px+env(safe-area-inset-bottom))] md:pb-7'

/** Área táctil mínima recomendada (44 px) para botones en el celular. */
export const touchTarget = 'min-h-11 min-w-11'
