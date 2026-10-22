/** Tipos del módulo de salud y enfermería. */

export interface CursoResumen {
  nivel: string
  grado_anio: string
  division: string
}

/** Un alumno en la búsqueda de enfermería. */
export interface AlumnoSalud {
  id_alumno: number
  nombre: string
  apellido: string
  dni: string
  cursos: CursoResumen | null
  tiene_ficha: boolean
  tiene_alergias_criticas: boolean
  ultima_atencion: string | null
}

/** Los datos del alumno que acompañan a la ficha. */
export interface AlumnoConFicha {
  id_alumno: number
  nombre: string
  apellido: string
  dni: string
  fecha_nacimiento: string
  obra_social: string | null
  nro_obra_social: string | null
  telefono_emergencia: string | null
  nombre_contacto_emergencia: string | null
  cursos: CursoResumen | null
}

export interface FichaMedica {
  id_ficha: number
  id_alumno: number
  grupo_sanguineo: string | null
  alergias: string | null
  alergias_criticas: string | null
  medicacion: string | null
  condiciones: string | null
  observaciones: string | null
  updated_at: string
}

/** La ficha tal como se edita: texto en todos los campos, vacío = sin dato. */
export type DatosFicha = Record<'grupo_sanguineo' | 'alergias' | 'alergias_criticas' | 'medicacion' | 'condiciones' | 'observaciones', string>

export interface FichaDelAlumno {
  alumno: AlumnoConFicha
  ficha: FichaMedica | null
}

export interface Atencion {
  id_atencion: number
  id_alumno: number
  fecha_hora: string
  motivo: string
  descripcion: string | null
  tratamiento: string | null
  familia_avisada: boolean
  registrada_por: string | null
}

export interface DatosAtencion {
  motivo: string
  descripcion: string
  tratamiento: string
  /** Valor de un `datetime-local`; vacío = ahora. */
  fecha_hora: string
}

export interface RegistroAuditoria {
  id_auditoria: number
  entidad: 'Ficha médica' | 'Atención'
  accion: 'Alta' | 'Modificación'
  cambios: Record<string, { antes: unknown; despues: unknown }> | null
  fecha_hora: string
  usuario: string | null
  rol: string | null
}

/** Lo que ve un docente: solo lo que tiene que saber para cuidar al alumno. */
export interface ResumenDeSalud {
  id_alumno: number
  alergias_criticas: string | null
  nombre_contacto_emergencia: string | null
  telefono_emergencia: string | null
  ficha_cargada: boolean
}

export const GRUPOS_SANGUINEOS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'] as const

/** Nombre en pantalla de cada campo de la ficha (se usa también para mostrar la auditoría). */
export const ETIQUETAS_FICHA = new Map([
  ['grupo_sanguineo', 'Grupo sanguíneo'],
  ['alergias', 'Alergias'],
  ['alergias_criticas', 'Alergias críticas'],
  ['medicacion', 'Medicación'],
  ['condiciones', 'Condiciones'],
  ['observaciones', 'Observaciones'],
  ['motivo', 'Motivo'],
  ['descripcion', 'Descripción'],
  ['tratamiento', 'Tratamiento'],
  ['fecha_hora', 'Fecha y hora'],
])
