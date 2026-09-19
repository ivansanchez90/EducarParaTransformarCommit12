/** Selecciones de relaciones reutilizadas en varias rutas. */
export const cursoResumen = { select: { nivel: true, grado_anio: true, division: true } } as const
export const nombreApellido = { select: { nombre: true, apellido: true } } as const
export const materiaNombre = { select: { nombre: true } } as const
