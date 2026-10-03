/**
 * Vigencia de los servicios de un alumno (deporte, transporte y comedor).
 *
 * Cada alta abre una vigencia y cada baja o cambio la cierra, así la facturación
 * sabe qué usó el alumno en cada mes aunque la inscripción ya no exista. Se
 * llaman dentro de la misma transacción que modifica la inscripción: si una
 * falla, no queda la otra a medias.
 *
 * La baja rige desde el mes siguiente: `hasta` es la fecha de la baja y el mes
 * en que ocurre se cobra completo (ver `vigenteEnPeriodo()` en
 * `services/facturacion/estrategias.ts`).
 */
import type { Prisma } from '../generated/prisma/client.js'

export type ConceptoVigencia = 'Deporte' | 'Transporte' | 'Comedor'

type Tx = Pick<Prisma.TransactionClient, 'vigenciaServicio'>

/** Empieza a regir un servicio. Si ya había una vigencia abierta igual, no la duplica. */
export async function abrirVigencia(
  tx: Tx,
  idAlumno: number,
  concepto: ConceptoVigencia,
  idReferencia: number | null = null,
  desde = new Date(),
) {
  const abierta = await tx.vigenciaServicio.findFirst({
    where: { id_alumno: idAlumno, concepto, id_referencia: idReferencia, hasta: null },
    select: { id_vigencia: true },
  })
  if (abierta) return
  await tx.vigenciaServicio.create({
    data: { id_alumno: idAlumno, concepto, id_referencia: idReferencia, desde },
  })
}

/**
 * Termina un servicio. Sin `idReferencia` cierra todas las vigencias abiertas del
 * concepto (transporte y comedor tienen una sola); con `idReferencia`, solo la de
 * esa actividad o ese recorrido.
 */
export async function cerrarVigencia(
  tx: Tx,
  idAlumno: number,
  concepto: ConceptoVigencia,
  idReferencia?: number | null,
  hasta = new Date(),
) {
  await tx.vigenciaServicio.updateMany({
    where: { id_alumno: idAlumno, concepto, id_referencia: idReferencia, hasta: null },
    data: { hasta },
  })
}

/** Cambia el servicio de un concepto de una sola vigencia (por ejemplo, de recorrido). */
export async function cambiarVigencia(
  tx: Tx,
  idAlumno: number,
  concepto: ConceptoVigencia,
  idReferencia: number | null,
  ahora = new Date(),
) {
  await cerrarVigencia(tx, idAlumno, concepto, undefined, ahora)
  await abrirVigencia(tx, idAlumno, concepto, idReferencia, ahora)
}
