/**
 * Tipos de dominio del panel de administración.
 *
 * Se centralizan aquí todas las interfaces que antes vivían dispersas dentro de
 * AdminPanel.tsx, para poder compartirlas entre los distintos módulos de
 * `features/` sin duplicarlas.
 */

export interface UsuarioPanel {
  id_usuario: string
  nombre: string
  apellido: string
  email: string
  rol: string
  activo: boolean
}

export interface Alumno {
  id_alumno: number
  nombre: string
  apellido: string
  dni: string
  activo: boolean
  fecha_nacimiento?: string
  id_curso?: number | null
  direccion?: string | null
  telefono_emergencia?: string | null
  nombre_contacto_emergencia?: string | null
  obra_social?: string | null
  nro_obra_social?: string | null
  cursos: { nivel: string; grado_anio: string; division: string } | null
  /** Padre/tutor vinculado (solo en el listado del panel). */
  padre?: { email: string } | null
  /** Usuario con el que el alumno entra a la plataforma; `null` si no tiene. */
  usuarios?: UsuarioAlumno | null
}

/** Acceso del alumno a la plataforma. */
export interface UsuarioAlumno {
  email: string
  activo: boolean
}

export interface Docente {
  id_docente: number
  dni: string
  especialidad: string | null
  activo: boolean
  usuarios: { nombre: string; apellido: string; email: string } | null
}

export interface Curso {
  id_curso: number
  nivel: string
  grado_anio: string
  division: string
  /** null = sin límite de cupo */
  capacidad_maxima: number | null
  activo: boolean
}

export interface Materia {
  id_materia: number
  nombre: string
  descripcion: string | null
  horas_semanales: number
  activo: boolean
}

export interface Asignacion {
  id_asignacion: number
  docentes: { usuarios: { nombre: string; apellido: string } | null } | null
  materias: { nombre: string } | null
  /** `id_curso` solo viene en `/asignaciones/mias`. */
  cursos: { id_curso?: number; nivel: string; grado_anio: string; division: string } | null
}

export interface AlumnoAsistencia {
  id_alumno: number
  nombre: string
  apellido: string
  estado: 'Presente' | 'Ausente' | 'Tarde' | 'Justificado'
}

export interface Calificacion {
  id_calificacion: number
  nota: number
  trimestre: number
  tipo_evaluacion: string
  fecha_carga: string
  alumnos: { nombre: string; apellido: string } | null
  asignaciones: { materias: { nombre: string } | null } | null
}

export interface Cuota {
  id_cuota: number
  mes: number
  anio: number
  monto_base: number
  recargo: number | null
  descuento: number | null
  estado: string
  fecha_vencimiento: string
  fecha_pago: string | null
  metodo_pago: string | null
  alumnos: { nombre: string; apellido: string } | null
}

// ── Servicios complementarios (transporte y comedor) ──────────

export interface RecorridoTransporte {
  id_recorrido: number
  nombre: string
  zona: string | null
  paradas: string | null
  hora_ida: string | null
  hora_vuelta: string | null
  capacidad: number | null
  activo: boolean
  inscriptos: number
  /** Precio mensual vigente; `null` si todavía no hay tarifa cargada. */
  precio: number | null
}

export interface InscripcionTransporte {
  observaciones: string | null
  recorridos_transporte: {
    id_recorrido: number
    nombre: string
    zona: string | null
    hora_ida: string | null
    hora_vuelta: string | null
  }
}

/** Servicios que utiliza un alumno (portal de familias). */
export interface ServiciosAlumno {
  transporte: InscripcionTransporte | null
  comedor: { observaciones: string | null } | null
  /** Precios mensuales vigentes; `null` si no hay tarifa cargada (o no usa el transporte). */
  precio_transporte: number | null
  precio_comedor: number | null
}

/** Alumno con el detalle de los servicios que utiliza. */
export interface AlumnoServicios {
  id_alumno: number
  nombre: string
  apellido: string
  dni: string
  cursos: { nivel: string; grado_anio: string; division: string } | null
  transporte: InscripcionTransporte | null
  comedor: { observaciones: string | null } | null
  /** Precios mensuales vigentes; `null` si no hay tarifa cargada (o no usa el transporte). */
  precio_transporte: number | null
  precio_comedor: number | null
}

// ── Reportes ───────────────────────────────────────────────────

export interface ColumnaReporte {
  key: string
  label: string
}

export type BloqueReporte =
  | { tipo: 'tabla'; titulo?: string; columnas: ColumnaReporte[]; filas: Record<string, string | number | null>[] }
  | { tipo: 'datos'; titulo?: string; items: [string, string][] }
  | { tipo: 'texto'; titulo?: string; texto: string }

/** Reporte devuelto por el backend, que se muestra igual que su versión PDF. */
export interface ReporteDoc {
  titulo: string
  subtitulo?: string
  filtros?: string[]
  bloques: BloqueReporte[]
}

export interface OpcionesReportes {
  niveles: string[]
  cursos: { id_curso: number; nivel: string; grado_anio: string; division: string }[]
  materias: { id_materia: number; nombre: string }[]
  actividades: { id_actividad: number; nombre: string; tipo: string }[]
  recorridos: { id_recorrido: number; nombre: string; zona: string | null }[]
}

/** Movimiento del historial de pagos de cuotas. */
export interface Pago {
  id_pago: number
  id_cuota: number | null
  fecha_pago: string | null
  monto_pagado: number
  metodo_pago: string | null
  nro_comprobante: string | null
  observaciones: string | null
  cuotas: {
    mes: number
    anio: number
    alumnos: { nombre: string; apellido: string } | null
  } | null
  usuarios: { nombre: string; apellido: string } | null
}

export interface HorarioActividad {
  dia_semana: string
  /** 'HH:MM:SS' */
  hora_inicio: string
  hora_fin: string
}

export interface ActividadEx {
  id_actividad: number
  nombre: string
  tipo: string
  descripcion: string | null
  cupo_maximo: number
  activo: boolean
  /** Profesor responsable */
  id_docente: number | null
  docentes: { id_docente: number; usuarios: { nombre: string; apellido: string } | null } | null
  horarios: HorarioActividad[]
}

export type ConceptoTarifa = 'Cuota' | 'Deporte' | 'Transporte' | 'Comedor'

export interface Tarifa {
  id_tarifa: number
  concepto: ConceptoTarifa
  /** Cuota: nivel educativo */
  nivel: string | null
  /** Deporte: id de la actividad · Transporte: id del recorrido */
  id_referencia: number | null
  importe: number
  /** 'YYYY-MM-DD' */
  vigente_desde: string
  /** Nombre de lo que se cobra ("Cuota Primario", "Fútbol"...) */
  referencia: string
  estado: 'Vigente' | 'Programada' | 'Anterior'
}

export type EstadoFactura = 'Pendiente' | 'Pago parcial' | 'Pagada' | 'Vencida'

export interface ItemFactura {
  id_item: number
  concepto: 'Cuota' | 'Deporte' | 'Transporte' | 'Comedor' | 'Recargo' | 'Beca'
  id_referencia: number | null
  descripcion: string
  importe: number
  saldo: number
}

export interface Factura {
  id_factura: number
  id_alumno: number
  anio: number
  mes: number
  numero: number
  fecha_emision: string
  fecha_vencimiento: string
  total: number
  saldo: number
  /** Calculado por el backend con el saldo y la fecha de hoy */
  estado: EstadoFactura
  items: ItemFactura[]
  alumnos: {
    nombre: string
    apellido: string
    dni: string
    cursos: { nivel: string; grado_anio: string; division: string } | null
  }
}

export interface ResultadoGeneracion {
  generadas: number
  omitidas: number
  errores: { id_alumno: number; alumno: string; motivo: string }[]
}

/** Resultado del email de fin de mes (`POST /api/tareas/recordatorio-mensual`). */
export interface ResultadoFinDeMes {
  anio: number
  mes: number
  facturacion: ResultadoGeneracion
  emailApagado: boolean
  familias: number
  enviados: number
  yaEnviados: number
  sinDestinatario: string[]
  errores: { email: string; motivo: string }[]
}

/** Resultado del aviso de deuda (`POST /api/tareas/aviso-deuda`). */
export interface ResultadoAvisoDeuda {
  anio: number
  mes: number
  emailApagado: boolean
  familias: number
  avisadas: number
  yaAvisadas: number
  sinDestinatario: string[]
  errores: { email: string; motivo: string }[]
}

export type EstadoComprobante = 'En revisión' | 'Aprobado' | 'Rechazado'

/** Comprobante de transferencia en la bandeja del admin (`GET /api/comprobantes`). */
export interface ComprobanteBandeja {
  id_comprobante: number
  id_factura: number
  id_orden: number | null
  /** Lo que declaró la familia al subirlo. */
  importe: number
  fecha_transferencia: string
  estado: EstadoComprobante
  motivo_rechazo: string | null
  fecha_carga: string
  fecha_revision: string | null
  facturas: {
    numero: number
    anio: number
    mes: number
    total: number
    saldo: number
    fecha_vencimiento: string
    alumnos: {
      id_alumno: number
      nombre: string
      apellido: string
      dni: string
      cursos: { nivel: string; grado_anio: string; division: string } | null
    }
  }
  ordenes_pago: {
    numero: number
    total: number
    items: { importe: number; items: { concepto: string; descripcion: string } }[]
  } | null
  carga: { nombre: string; apellido: string; email: string } | null
  revision: { nombre: string; apellido: string } | null
  /** El pago que generó al aprobarse. */
  pagos: { id_pago: number; monto_pagado: number; fecha_pago: string } | null
}

export interface OpcionesTarifa {
  niveles: string[]
  deportes: { id: number; nombre: string }[]
  recorridos: { id: number; nombre: string }[]
  /** Lo que hoy no tiene precio vigente */
  sin_precio: { concepto: ConceptoTarifa; nivel?: string; id_referencia?: number; nombre: string }[]
}

export interface DocumentoAlumno {
  id_documento: number
  id_alumno: number
  nombre: string
  tipo: string | null
  url_archivo: string
  fecha_carga: string
}

export interface Beca {
  id_beca: number
  id_alumno: number
  porcentaje: number
  motivo: string | null
  activo: boolean
  fecha_otorgamiento: string
  alumnos: { nombre: string; apellido: string } | null
}

export interface Sueldo {
  id_sueldo: number
  id_usuario: string | null
  mes: number
  anio: number
  monto: number
  estado: string
  fecha_pago: string | null
  usuarios: { nombre: string; apellido: string; rol: string } | null
}

export interface Compra {
  id_compra: number
  descripcion: string
  destino: string
  cantidad: number
  monto: number
  proveedor: string | null
  fecha_compra: string
}

export interface Instalacion {
  id_instalacion: number
  nombre: string
  tipo: string | null
  activo: boolean
}

export interface Reserva {
  id_reserva: number
  id_instalacion: number
  fecha: string
  hora_inicio: string
  hora_fin: string
  motivo: string | null
  instalaciones: { nombre: string } | null
  usuarios: { nombre: string; apellido: string } | null
}

export interface MensajeContacto {
  id_mensaje: number
  nombre: string
  email: string
  mensaje: string
  leido: boolean
  fecha_envio: string
}

export interface Inscripcion {
  id_inscripcion: number
  nombre_aspirante: string
  apellido_aspirante: string | null
  fecha_nacimiento_aspirante: string | null
  dni_aspirante: string
  nombre_tutor: string
  email_tutor: string
  telefono_tutor: string | null
  nivel_solicitado: string
  grado_anio_solicitado: string | null
  documentacion_completa: boolean
  observaciones: string | null
  estado: string
  fecha_solicitud: string
  id_alumno_creado: number | null
}

/** Solicitud con el alumno dado de alta, si ya fue aprobada. */
export interface InscripcionDetalle extends Inscripcion {
  alumnos: {
    id_alumno: number
    nombre: string
    apellido: string
    dni: string
    activo: boolean
    cursos: { nivel: string; grado_anio: string; division: string } | null
  } | null
}

export interface Noticia {
  id_noticia: number
  titulo: string
  resumen: string | null
  fecha_publicacion: string
  activo: boolean
  destacada: boolean
}

export interface Empleo {
  id_empleo: number
  titulo: string
  descripcion: string | null
  area: string | null
  requisitos: string | null
  tipo_contrato: string | null
  activo: boolean
  fecha_publicacion: string
  fecha_cierre: string | null
}

export interface Postulacion {
  id_postulacion: number
  id_empleo: number
  nombre: string
  apellido: string
  email: string
  telefono: string | null
  mensaje: string | null
  estado: string
  fecha_postulacion: string
  empleos: { titulo: string; area: string | null } | null
}

export interface AlumnoLegajo {
  id_alumno: number
  nombre: string
  apellido: string
  dni: string
  fecha_nacimiento: string | null
  obra_social: string | null
  activo: boolean
  cursos: { nivel: string; grado_anio: string; division: string } | null
  usuarios?: UsuarioAlumno | null
}

export interface InscripcionActividad {
  id_inscripcion_act: number
  id_actividad: number
  id_alumno: number
  fecha_inscripcion: string
  alumnos: {
    nombre: string
    apellido: string
    dni: string
    cursos: { nivel: string; grado_anio: string; division: string } | null
  } | null
}
