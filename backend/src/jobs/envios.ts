/**
 * Registro de los envíos masivos en `envios_email` (fin de mes, aviso de deuda).
 *
 * Una fila por tipo, período y familia (restricción única). Antes de mandar,
 * la fila se "toma" con un update condicional (`Pendiente`/`Error` →
 * `Enviando`): si la tarea corre dos veces, o en dos instancias a la vez, solo
 * una manda. Si el backend se cae a mitad de un envío, la fila queda en
 * `Enviando` y hay que pasarla a `Error` a mano para que se reintente.
 */
import { Prisma } from '../generated/prisma/client.js'
import { prisma } from '../lib/prisma.js'

export type ClaveEnvio = Prisma.EnvioEmailTipoAnioMesId_usuarioCompoundUniqueInput

/** La fila de esta familia y período; la crea si no existe. */
export async function registroDeEnvio(clave: ClaveEnvio, email: string) {
  try {
    return await prisma.envioEmail.upsert({ where: { tipo_anio_mes_id_usuario: clave }, create: { ...clave, email }, update: {} })
  } catch (err) {
    // Otra ejecución la creó en el mismo instante (el upsert de Prisma no es atómico).
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return prisma.envioEmail.findUniqueOrThrow({ where: { tipo_anio_mes_id_usuario: clave } })
    }
    throw err
  }
}

/** Toma el envío para mandarlo. `false` si ya se mandó o lo tomó otra ejecución. */
export async function tomarEnvio(idEnvio: number, email: string): Promise<boolean> {
  const { count } = await prisma.envioEmail.updateMany({
    where: { id_envio: idEnvio, estado: { in: ['Pendiente', 'Error'] } },
    data: { estado: 'Enviando', intentos: { increment: 1 }, email },
  })
  return count === 1
}

/** Cierra el envío: `Enviado`, o `Error` con el motivo si `error` no es null. */
export async function cerrarEnvio(idEnvio: number, error: string | null, nota: string | null = null) {
  await prisma.envioEmail.update({
    where: { id_envio: idEnvio },
    data: error
      ? { estado: 'Error', error: error.slice(0, 500) }
      : { estado: 'Enviado', enviado_at: new Date(), error: nota },
  })
}
