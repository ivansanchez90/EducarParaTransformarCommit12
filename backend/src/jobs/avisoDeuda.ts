/**
 * Aviso de deuda del día 20 (T18): a cada familia con facturas vencidas y con
 * saldo, un aviso con lo que debe cada hijo, por email, in-app y push (evento
 * `DeudaDetectada` del Observer, ver `services/avisos/`).
 *
 * Cuenta la deuda vencida al día 20 del mes del aviso (las facturas vencen el
 * 10), también la de meses anteriores. Un aviso por familia y mes, registrado
 * en `envios_email` (ver `envios.ts`): correrla otra vez solo reintenta los
 * emails que fallaron, y el reintento no repite el aviso in-app ni el push.
 */
import { config } from '../lib/config.js'
import { prisma } from '../lib/prisma.js'
import { publicar } from '../services/avisos/index.js'
import { CANAL_EMAIL } from '../services/avisos/email.js'
import type { DeudaDetectada } from '../services/avisos/eventos.js'
import { emailHabilitado } from '../services/email.js'
import { cerrarEnvio, registroDeEnvio, tomarEnvio } from './envios.js'

export const TIPO_AVISO_DEUDA = 'Aviso de deuda'
export const DIA_AVISO_DEUDA = 20

export interface ResultadoAvisoDeuda {
  anio: number
  mes: number
  /** Sin SMTP configurado: se avisa solo in-app y push. */
  emailApagado: boolean
  familias: number
  avisadas: number
  /** Ya avisadas antes, o tomadas por otra ejecución en este momento. */
  yaAvisadas: number
  /** Alumnos con deuda pero sin un usuario activo a quien avisarle. */
  sinDestinatario: string[]
  errores: { email: string; motivo: string }[]
}

type Familia = Omit<DeudaDetectada, 'tipo' | 'anio' | 'mes' | 'primeraVez'>

const centavos = (n: unknown) => Math.round(Number(n) * 100)

/** Familias con facturas vencidas antes de `corte` y con saldo. */
async function familiasConDeuda(corte: Date) {
  const usuario = { select: { id_usuario: true, email: true, nombre: true, activo: true } }
  const facturas = await prisma.factura.findMany({
    where: { saldo: { gt: 0 }, fecha_vencimiento: { lt: corte } },
    select: {
      numero: true,
      anio: true,
      mes: true,
      fecha_vencimiento: true,
      saldo: true,
      items: { where: { saldo: { not: 0 } }, select: { descripcion: true, saldo: true }, orderBy: { id_item: 'asc' } },
      alumnos: { select: { id_alumno: true, nombre: true, apellido: true, padre: usuario, usuarios: usuario } },
    },
    orderBy: [{ alumnos: { apellido: 'asc' } }, { alumnos: { nombre: 'asc' } }, { anio: 'asc' }, { mes: 'asc' }],
  })

  const familias = new Map<string, Familia>()
  const sinDestinatario = new Set<string>()
  for (const f of facturas) {
    const { alumnos: a } = f
    const nombre = `${a.nombre} ${a.apellido}`
    const destino = a.padre ?? a.usuarios
    if (!destino?.activo || !destino.email) {
      sinDestinatario.add(nombre)
      continue
    }
    const familia = familias.get(destino.id_usuario) ?? {
      familia: { id_usuario: destino.id_usuario, email: destino.email, nombre: destino.nombre },
      alumnos: [],
      total: 0,
    }
    let alumno = familia.alumnos.find((x) => x.id_alumno === a.id_alumno)
    if (!alumno) {
      alumno = { id_alumno: a.id_alumno, nombre, facturas: [] }
      familia.alumnos.push(alumno)
    }
    alumno.facturas.push({
      numero: f.numero,
      anio: f.anio,
      mes: f.mes,
      fecha_vencimiento: f.fecha_vencimiento,
      saldo: Number(f.saldo),
      items: f.items.map((i) => ({ descripcion: i.descripcion, saldo: Number(i.saldo) })),
    })
    familia.total = (centavos(familia.total) + centavos(f.saldo)) / 100
    familias.set(destino.id_usuario, familia)
  }
  return { familias: [...familias.values()], sinDestinatario: [...sinDestinatario] }
}

export async function enviarAvisoDeuda(
  anio: number,
  mes: number,
  { pausaMs = config.emailPausaMs }: { pausaMs?: number } = {},
): Promise<ResultadoAvisoDeuda> {
  const corte = new Date(Date.UTC(anio, mes - 1, DIA_AVISO_DEUDA))
  const { familias, sinDestinatario } = await familiasConDeuda(corte)
  const resultado: ResultadoAvisoDeuda = {
    anio,
    mes,
    emailApagado: !emailHabilitado,
    familias: familias.length,
    avisadas: 0,
    yaAvisadas: 0,
    sinDestinatario,
    errores: [],
  }

  for (const familia of familias) {
    const { id_usuario, email } = familia.familia
    const envio = await registroDeEnvio({ tipo: TIPO_AVISO_DEUDA, anio, mes, id_usuario }, email)
    // Antes de tomarlo: si ya tuvo un intento, el aviso in-app ya salió.
    const primeraVez = envio.intentos === 0
    if (!(await tomarEnvio(envio.id_envio, email))) {
      resultado.yaAvisadas++
      continue
    }

    const canales = await publicar({ tipo: 'DeudaDetectada', anio, mes, primeraVez, ...familia })
    const fallaEmail = canales.find((c) => c.canal === CANAL_EMAIL && !c.ok)
    if (fallaEmail) {
      await cerrarEnvio(envio.id_envio, fallaEmail.error ?? 'Error al enviar el email')
      resultado.errores.push({ email, motivo: fallaEmail.error ?? 'Error al enviar el email' })
    } else {
      await cerrarEnvio(envio.id_envio, null, emailHabilitado ? null : 'Email apagado: se avisó solo in-app y push')
      resultado.avisadas++
    }
    if (pausaMs > 0 && emailHabilitado) await new Promise((r) => setTimeout(r, pausaMs))
  }
  return resultado
}
