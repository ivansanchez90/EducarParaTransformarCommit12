/**
 * Email del último día hábil (T17): la factura del mes que viene de cada
 * familia, con la composición y los PDF adjuntos.
 *
 * Primero emite las facturas que falten (generar no duplica). Después manda un
 * email por familia (el padre/tutor, o el alumno si no tiene) con las facturas
 * de todos sus hijos. Cada envío queda en `envios_email` con restricción única
 * por tipo, período y familia: correrla otra vez solo reintenta los que
 * fallaron, y dos instancias no mandan el mismo email (la fila se "toma" con
 * un update condicional antes de enviar).
 */
import { config } from '../lib/config.js'
import { prisma } from '../lib/prisma.js'
import { emailHabilitado, enviarEmail } from '../services/email.js'
import { emailFinDeMes, type FacturaParaEmail } from '../services/facturacion/emailFactura.js'
import { generarFacturas, type ResultadoGeneracion } from '../services/facturacion/generar.js'
import { pdfFactura } from '../services/facturacion/pdf.js'
import type { Dia } from './calendario.js'
import { cerrarEnvio, registroDeEnvio, tomarEnvio } from './envios.js'

export const TIPO_FIN_DE_MES = 'Recordatorio mensual'

export interface ResultadoFinDeMes {
  anio: number
  mes: number
  facturacion: ResultadoGeneracion
  /** Sin SMTP configurado: se emiten las facturas pero no se manda nada. */
  emailApagado: boolean
  familias: number
  enviados: number
  /** Ya enviados antes, o tomados por otra instancia en este momento. */
  yaEnviados: number
  /** Alumnos con factura pero sin un usuario activo a quien escribirle. */
  sinDestinatario: string[]
  errores: { email: string; motivo: string }[]
}

/** El último día hábil de un mes se manda la factura del mes siguiente. */
export function periodoAFacturar({ anio, mes }: Pick<Dia, 'anio' | 'mes'>): { anio: number; mes: number } {
  return mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 }
}

interface Familia {
  id_usuario: string
  email: string
  nombre: string
  facturas: FacturaParaEmail[]
}

/** Facturas del período agrupadas por la familia que las recibe. */
async function familiasDelPeriodo(anio: number, mes: number) {
  const usuario = { select: { id_usuario: true, email: true, nombre: true, activo: true } }
  const facturas = await prisma.factura.findMany({
    where: { anio, mes, alumnos: { activo: true } },
    select: {
      id_factura: true,
      numero: true,
      anio: true,
      mes: true,
      fecha_vencimiento: true,
      total: true,
      saldo: true,
      items: { select: { descripcion: true, importe: true }, orderBy: { id_item: 'asc' } },
      alumnos: { select: { nombre: true, apellido: true, padre: usuario, usuarios: usuario } },
    },
    orderBy: [{ alumnos: { apellido: 'asc' } }, { alumnos: { nombre: 'asc' } }],
  })

  const familias = new Map<string, Familia>()
  const sinDestinatario: string[] = []
  for (const f of facturas) {
    const alumno = `${f.alumnos.nombre} ${f.alumnos.apellido}`
    const destino = f.alumnos.padre ?? f.alumnos.usuarios
    if (!destino?.activo || !destino.email) {
      sinDestinatario.push(alumno)
      continue
    }
    const familia = familias.get(destino.id_usuario) ?? { ...destino, facturas: [] }
    familia.facturas.push({
      ...f,
      total: Number(f.total),
      saldo: Number(f.saldo),
      alumno,
      items: f.items.map((i) => ({ descripcion: i.descripcion, importe: Number(i.importe) })),
    })
    familias.set(destino.id_usuario, familia)
  }
  return { familias: [...familias.values()], sinDestinatario }
}

export async function enviarFinDeMes(
  anio: number,
  mes: number,
  { pausaMs = config.emailPausaMs }: { pausaMs?: number } = {},
): Promise<ResultadoFinDeMes> {
  const facturacion = await generarFacturas(anio, mes)
  const resultado: ResultadoFinDeMes = {
    anio,
    mes,
    facturacion,
    emailApagado: !emailHabilitado,
    familias: 0,
    enviados: 0,
    yaEnviados: 0,
    sinDestinatario: [],
    errores: [],
  }
  if (!emailHabilitado) return resultado

  const { familias, sinDestinatario } = await familiasDelPeriodo(anio, mes)
  resultado.familias = familias.length
  resultado.sinDestinatario = sinDestinatario

  for (const familia of familias) {
    const clave = { tipo: TIPO_FIN_DE_MES, anio, mes, id_usuario: familia.id_usuario }
    const envio = await registroDeEnvio(clave, familia.email)
    if (!(await tomarEnvio(envio.id_envio, familia.email))) {
      resultado.yaEnviados++
      continue
    }

    try {
      const adjuntos = await Promise.all(
        familia.facturas.map(async (f) => {
          const { archivo, pdf } = await pdfFactura(f.id_factura)
          return { nombre: `${archivo}.pdf`, contenido: pdf, tipo: 'application/pdf' }
        }),
      )
      await enviarEmail({ para: familia.email, ...emailFinDeMes(familia.nombre, familia.facturas), adjuntos })
      await cerrarEnvio(envio.id_envio, null)
      resultado.enviados++
    } catch (err) {
      const motivo = err instanceof Error ? err.message : String(err)
      await cerrarEnvio(envio.id_envio, motivo)
      resultado.errores.push({ email: familia.email, motivo })
    }
    if (pausaMs > 0) await new Promise((r) => setTimeout(r, pausaMs))
  }
  return resultado
}
