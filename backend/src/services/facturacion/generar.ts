/**
 * Generación de las facturas de un mes: una por alumno activo, con un ítem
 * por concepto (ver `estrategias.ts`).
 *
 * Generar el mismo mes otra vez no duplica ni modifica nada: los alumnos que
 * ya tienen factura se omiten. Si a un alumno le falta un dato (curso o
 * tarifa), su factura no se emite y queda en `errores`; al cargar el dato y
 * volver a generar, se emite solo la que faltaba.
 */
import { Prisma } from '../../generated/prisma/client.js'
import { prisma } from '../../lib/prisma.js'
import { claveTarifa, tarifasVigentes } from '../tarifas.js'
import { DIA_VENCIMIENTO } from './estado.js'
import { calcularItems, nombrePeriodo } from './estrategias.js'
import { crearPeriodo } from './periodo.js'
import { FaltaDatoFacturacion, type AlumnoFacturable, type ContextoFacturacion } from './tipos.js'

export interface ResultadoGeneracion {
  generadas: number
  /** Alumnos que ya tenían la factura del mes. */
  omitidas: number
  errores: { id_alumno: number; alumno: string; motivo: string }[]
}

/** Alumnos activos con todo lo que se les factura, en una sola consulta. */
async function alumnosFacturables(): Promise<AlumnoFacturable[]> {
  const alumnos = await prisma.alumno.findMany({
    where: { activo: true },
    select: {
      id_alumno: true,
      nombre: true,
      apellido: true,
      cursos: { select: { nivel: true } },
      becas: { select: { porcentaje: true, activo: true } },
      inscripciones_actividades: {
        where: { actividades_extracurriculares: { tipo: 'Deporte' } },
        select: { fecha_inscripcion: true, actividades_extracurriculares: { select: { id_actividad: true, nombre: true } } },
      },
      transporte: {
        select: { fecha_inscripcion: true, recorridos_transporte: { select: { id_recorrido: true, nombre: true } } },
      },
      comedor: { select: { fecha_inscripcion: true } },
    },
    orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
  })
  return alumnos.map((a) => ({
    id_alumno: a.id_alumno,
    nombre: a.nombre,
    apellido: a.apellido,
    nivel: a.cursos?.nivel ?? null,
    beca: a.becas?.activo ? a.becas.porcentaje.toNumber() : null,
    deportes: a.inscripciones_actividades.map((i) => ({
      ...i.actividades_extracurriculares,
      desde: i.fecha_inscripcion,
    })),
    transporte: a.transporte ? { ...a.transporte.recorridos_transporte, desde: a.transporte.fecha_inscripcion } : null,
    comedor: a.comedor ? { desde: a.comedor.fecha_inscripcion } : null,
  }))
}

export async function generarFacturas(anio: number, mes: number): Promise<ResultadoGeneracion> {
  const periodo = crearPeriodo(anio, mes)
  const [tarifas, existentes, alumnos] = await Promise.all([
    tarifasVigentes(periodo.inicio),
    prisma.factura.findMany({ where: { anio, mes }, select: { id_alumno: true } }),
    alumnosFacturables(),
  ])

  const ctx: ContextoFacturacion = {
    periodo,
    precio(ref, nombre) {
      const tarifa = tarifas.get(claveTarifa(ref))
      if (!tarifa) throw new FaltaDatoFacturacion(`No hay tarifa vigente de ${nombre} para ${nombrePeriodo(periodo)}`)
      return Math.round(tarifa.importe.toNumber() * 100)
    },
  }
  const yaFacturados = new Set(existentes.map((f) => f.id_alumno))
  const vencimiento = new Date(Date.UTC(anio, mes - 1, DIA_VENCIMIENTO))
  const resultado: ResultadoGeneracion = { generadas: 0, omitidas: 0, errores: [] }

  for (const alumno of alumnos) {
    if (yaFacturados.has(alumno.id_alumno)) {
      resultado.omitidas++
      continue
    }
    let items
    try {
      items = calcularItems(alumno, ctx)
    } catch (err) {
      if (!(err instanceof FaltaDatoFacturacion)) throw err
      resultado.errores.push({ id_alumno: alumno.id_alumno, alumno: `${alumno.apellido}, ${alumno.nombre}`, motivo: err.message })
      continue
    }

    // Nunca es negativo: la beca descuenta como mucho el 100 % de la cuota.
    const total = items.reduce((s, i) => s + i.centavos, 0) / 100
    try {
      await prisma.factura.create({
        data: {
          id_alumno: alumno.id_alumno,
          anio,
          mes,
          fecha_vencimiento: vencimiento,
          total,
          saldo: total,
          estado: total > 0 ? 'Pendiente' : 'Pagada',
          items: {
            create: items.map((i) => ({
              concepto: i.concepto,
              id_referencia: i.id_referencia,
              descripcion: i.descripcion,
              importe: i.centavos / 100,
              saldo: i.centavos / 100,
            })),
          },
        },
      })
      resultado.generadas++
    } catch (err) {
      // Otra generación simultánea ya creó la factura de este alumno.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') resultado.omitidas++
      else throw err
    }
  }
  return resultado
}
