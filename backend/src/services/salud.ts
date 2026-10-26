/**
 * Salud y enfermería: quién puede ver la ficha médica de un alumno, cómo se valida lo que carga enfermería
 * y la auditoría de cada cambio.
 *
 * Es información de salud de menores: se ve por rol, nunca se sirve pública, y cada alta o modificación
 * deja una fila en `auditoria_salud` con el usuario, la fecha y qué cambió.
 */
import type { Prisma } from '../generated/prisma/client.js'
import { HttpError, textOrNull } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { ROLES_SALUD, ROLES_STAFF } from '../middleware/auth.js'
import type { UsuarioAuth } from '../middleware/auth.js'

export const GRUPOS_SANGUINEOS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-']

/** Campos de texto de la ficha, con su nombre en pantalla (para los mensajes y la auditoría). */
export const CAMPOS_FICHA = {
  alergias: 'Alergias',
  alergias_criticas: 'Alergias críticas',
  medicacion: 'Medicación',
  condiciones: 'Condiciones',
  observaciones: 'Observaciones',
} as const

export type CampoFicha = keyof typeof CAMPOS_FICHA

export type DatosFicha = {
  grupo_sanguineo: string | null
  alergias: string | null
  alergias_criticas: string | null
  medicacion: string | null
  condiciones: string | null
  observaciones: string | null
}

const MAX_TEXTO = 1000
const MAX_MOTIVO = 200

/** Texto opcional de hasta `max` caracteres: vacío es `null`; si se pasa, responde 400 diciendo cuál campo. */
function textoAcotado(valor: unknown, nombre: string, max = MAX_TEXTO): string | null {
  const texto = textOrNull(valor)
  if (texto !== null && texto.length > max) throw new HttpError(400, `${nombre} no puede tener más de ${max} caracteres`)
  return texto
}

/** Valida y normaliza lo que manda enfermería para la ficha. */
export function validarFicha(body: Record<string, unknown> | undefined): DatosFicha {
  const grupo = textOrNull(body?.grupo_sanguineo)
  if (grupo !== null && !GRUPOS_SANGUINEOS.includes(grupo)) {
    throw new HttpError(400, `El grupo sanguíneo tiene que ser uno de: ${GRUPOS_SANGUINEOS.join(', ')}`)
  }
  return {
    grupo_sanguineo: grupo,
    alergias: textoAcotado(body?.alergias, 'Las alergias'),
    alergias_criticas: textoAcotado(body?.alergias_criticas, 'Las alergias críticas'),
    medicacion: textoAcotado(body?.medicacion, 'La medicación'),
    condiciones: textoAcotado(body?.condiciones, 'Las condiciones'),
    observaciones: textoAcotado(body?.observaciones, 'Las observaciones'),
  }
}

export type DatosAtencion = {
  motivo: string
  descripcion: string | null
  tratamiento: string | null
  fecha_hora: Date | null
}

/** Valida y normaliza lo que manda enfermería para una atención. La fecha, si viene, no puede ser futura. */
export function validarAtencion(body: Record<string, unknown> | undefined, ahora = new Date()): DatosAtencion {
  const motivo = textoAcotado(body?.motivo, 'El motivo', MAX_MOTIVO)
  if (!motivo) throw new HttpError(400, 'El motivo de la atención es obligatorio')

  let fechaHora: Date | null = null
  if (body?.fecha_hora !== undefined && body.fecha_hora !== null && body.fecha_hora !== '') {
    fechaHora = new Date(String(body.fecha_hora))
    if (Number.isNaN(fechaHora.getTime())) throw new HttpError(400, 'La fecha y hora de la atención no es válida')
    // Se tolera un desfase de 5 minutos entre el reloj del teléfono y el del servidor.
    if (fechaHora.getTime() > ahora.getTime() + 5 * 60 * 1000) throw new HttpError(400, 'La atención no puede tener una fecha futura')
  }
  return {
    motivo,
    descripcion: textoAcotado(body?.descripcion, 'La descripción'),
    tratamiento: textoAcotado(body?.tratamiento, 'El tratamiento'),
    fecha_hora: fechaHora,
  }
}

export type Cambios = Record<string, { antes: unknown; despues: unknown }>

/** Campos que cambiaron entre dos versiones, con su valor de antes y de después. Vacío si no cambió nada. */
export function diferencias(antes: Record<string, unknown>, despues: Record<string, unknown>): Cambios {
  const cambios = Object.keys(despues).flatMap((campo): [string, { antes: unknown; despues: unknown }][] => {
    const valorAntes = Object.getOwnPropertyDescriptor(antes, campo)?.value ?? null
    const valorDespues = Object.getOwnPropertyDescriptor(despues, campo)?.value ?? null
    const igual = valorAntes instanceof Date && valorDespues instanceof Date ? valorAntes.getTime() === valorDespues.getTime() : valorAntes === valorDespues
    return igual ? [] : [[campo, { antes: valorAntes, despues: valorDespues }]]
  })
  return Object.fromEntries(cambios)
}

/** Deja asentado un alta o una modificación, dentro de la misma transacción que la produjo. */
export async function registrarAuditoria(
  tx: Pick<Prisma.TransactionClient, 'auditoriaSalud'>,
  datos: { idAlumno: number; entidad: 'Ficha médica' | 'Atención' | 'Certificado de aptitud'; idRegistro: number; accion: 'Alta' | 'Modificación'; cambios: Cambios; idUsuario: string },
) {
  await tx.auditoriaSalud.create({
    data: {
      id_alumno: datos.idAlumno,
      entidad: datos.entidad,
      id_registro: datos.idRegistro,
      accion: datos.accion,
      cambios: datos.cambios as Prisma.InputJsonValue,
      id_usuario: datos.idUsuario,
    },
  })
}

export const veSaludCompleta = (u: UsuarioAuth) => ROLES_SALUD.includes(u.rol)

/** El resumen (alergias críticas y contacto de emergencia) lo ven enfermería, administración y docentes. */
export const veResumenDeSalud = (u: UsuarioAuth) => veSaludCompleta(u) || ROLES_STAFF.includes(u.rol)

/**
 * Quién puede ver la ficha y las atenciones de un alumno: enfermería y administración, y el tutor del alumno.
 * El docente no (solo el resumen) y tampoco el propio alumno: la ficha es de la familia.
 */
export async function assertVeSaludDe(u: UsuarioAuth, idAlumno: number) {
  if (veSaludCompleta(u)) return
  if (ROLES_STAFF.includes(u.rol)) throw new HttpError(403, 'Los docentes ven solo el resumen de salud del alumno')
  const hijo = await prisma.alumno.findFirst({ where: { id_alumno: idAlumno, id_usuario_padre: u.id_usuario }, select: { id_alumno: true } })
  if (!hijo) throw new HttpError(403, 'No tenés acceso a los datos de salud de este alumno')
}
