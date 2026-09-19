/**
 * Constantes de dominio compartidas por los módulos del panel.
 *
 * Antes estaban repartidas a lo largo de AdminPanel.tsx (algunas junto al
 * componente que las usaba). Se agrupan aquí para reutilizarlas sin duplicar.
 */

export const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

export const METODOS_PAGO = [
  'Efectivo',
  'Transferencia',
  'Tarjeta de débito',
  'Tarjeta de crédito',
  'Cheque',
  'Otro',
]

export const CUOTA_ESTADO_COLOR: Record<string, string> = {
  Pendiente: '#E67E22',
  Vencida: '#E74C3C',
  'En mora': '#C0392B',
}

export const DESTINOS_INSUMO = [
  'Laboratorio de computación',
  'Laboratorio de física',
  'Laboratorio de química',
  'Enfermería',
]

export const TIPOS_DOC = [
  'DNI',
  'Partida de nacimiento',
  'Certificado médico',
  'Boletín / certificado de estudios',
  'Ficha de inscripción',
  'Otro',
]

export const MODALIDADES = ['Presencial', 'Remoto', 'Híbrido']

export const TIPOS_CONTRATO = [
  'Full-time',
  'Part-time',
  'Pasantía',
  'Suplencia',
  'Temporal',
]

export const MODALIDAD_COLOR: Record<string, string> = {
  Presencial: '#2980B9',
  Remoto: '#27AE60',
  Híbrido: '#7B55E8',
}

export const POST_ESTADOS = [
  'Recibida',
  'En revisión',
  'Entrevista',
  'Seleccionada',
  'Rechazada',
]

export const POST_COLOR: Record<string, string> = {
  Recibida: '#2980B9',
  'En revisión': '#E67E22',
  Entrevista: '#7B55E8',
  Seleccionada: '#27AE60',
  Rechazada: '#E74C3C',
}

// ── Navegación por rol ──────────────────────────────────────────
export const NAV_ADMIN = [
  { key: 'dashboard', icon: '📊', label: 'Dashboard' },
  { key: 'usuarios', icon: '👥', label: 'Usuarios' },
  { key: 'alumnos', icon: '🎓', label: 'Alumnos' },
  { key: 'docentes', icon: '👨‍🏫', label: 'Docentes' },
  { key: 'cursos', icon: '🏫', label: 'Cursos' },
  { key: 'materias', icon: '📚', label: 'Materias' },
  { key: 'asignaciones', icon: '🔗', label: 'Asignaciones' },
  { key: 'cuotas', icon: '💳', label: 'Cuotas' },
  { key: 'pagos', icon: '💰', label: 'Registrar pagos' },
  { key: 'becas', icon: '🎟️', label: 'Becas' },
  { key: 'sueldos', icon: '💼', label: 'Sueldos' },
  { key: 'compras', icon: '🧪', label: 'Compras insumos' },
  { key: 'inscripciones', icon: '📋', label: 'Inscripciones' },
  { key: 'actividades', icon: '🎨', label: 'Extracurriculares' },
  { key: 'reservas', icon: '🏟️', label: 'Reservas' },
  { key: 'servicios', icon: '🚌', label: 'Transporte y comedor' },
  { key: 'reportes', icon: '📄', label: 'Reportes' },
  { key: 'mensajes', icon: '✉️', label: 'Mensajes' },
  { key: 'noticias', icon: '📰', label: 'Noticias' },
  { key: 'empleos', icon: '💼', label: 'Empleos' },
  { key: 'postulaciones', icon: '📩', label: 'Postulaciones' },
  { key: 'galeria', icon: '🖼️', label: 'Galería' },
]

export const NAV_DOCENTE = [
  { key: 'dashboard', icon: '📊', label: 'Dashboard' },
  { key: 'asistencia', icon: '📅', label: 'Tomar asistencia' },
  { key: 'calificaciones', icon: '📝', label: 'Calificaciones' },
  { key: 'amonestaciones', icon: '⚠️', label: 'Amonestaciones' },
  { key: 'legajos', icon: '📁', label: 'Legajos' },
  { key: 'reservas', icon: '🏟️', label: 'Reservas' },
]
