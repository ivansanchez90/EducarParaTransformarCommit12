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
import { FaltaDatoFacturacion, type AlumnoFacturable, type ContextoFacturacion, type Periodo } from './tipos.js'

export interface ResultadoGeneracion {
  generadas: number
  /** Alumnos que ya tenían la factura del mes. */
  omitidas: number
  errores: { id_alumno: number; alumno: string; motivo: string }[]
}

/**
 * Alumnos activos con todo lo que se les factura en el período. Deportes,
 * transporte y comedor salen de `vigencias_servicio` (T07) y no de las
 * inscripciones, que se borran con la baja: así se cobra el mes en que se
 * dio de baja aunque la inscripción ya no exista.
 */
async function alumnosFacturables(periodo: Periodo): Promise<AlumnoFacturable[]> {
  const [alumnos, actividades, recorridos] = await Promise.all([
    prisma.alumno.findMany({
      where: { activo: true },
      select: {
        id_alumno: true,
        nombre: true,
        apellido: true,
        cursos: { select: { nivel: true } },
        becas: { select: { porcentaje: true, activo: true } },
        vigencias_servicio: {
          where: { desde: { lt: periodo.fin }, OR: [{ hasta: null }, { hasta: { gte: periodo.comienzo } }] },
          select: { concepto: true, id_referencia: true, desde: true, hasta: true },
          orderBy: { desde: 'asc' },
        },
      },
      orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
    }),
    prisma.actividadExtracurricular.findMany({ select: { id_actividad: true, nombre: true } }),
    prisma.recorridoTransporte.findMany({ select: { id_recorrido: true, nombre: true } }),
  ])
  // La vigencia guarda solo el id: un recorrido borrado después de la baja conserva un nombre.
  const actividad = new Map(actividades.map((a) => [a.id_actividad, a.nombre]))
  const recorrido = new Map(recorridos.map((r) => [r.id_recorrido, r.nombre]))

  return alumnos.map((a) => {
    const deportes: AlumnoFacturable['deportes'] = []
    const transportes: AlumnoFacturable['transportes'] = []
    const comedor: AlumnoFacturable['comedor'] = []
    for (const { concepto, id_referencia: ref, desde, hasta } of a.vigencias_servicio) {
      if (concepto === 'Deporte' && ref !== null) {
        deportes.push({ id_actividad: ref, nombre: actividad.get(ref) ?? `Deporte ${ref}`, desde, hasta })
      } else if (concepto === 'Transporte' && ref !== null) {
        transportes.push({ id_recorrido: ref, nombre: recorrido.get(ref) ?? `Recorrido ${ref}`, desde, hasta })
      } else if (concepto === 'Comedor') {
        comedor.push({ desde, hasta })
      }
    }
    return {
      id_alumno: a.id_alumno,
      nombre: a.nombre,
      apellido: a.apellido,
      nivel: a.cursos?.nivel ?? null,
      beca: a.becas?.activo ? a.becas.porcentaje.toNumber() : null,
      deportes,
      transportes,
      comedor,
    }
  })
}

export async function generarFacturas(anio: number, mes: number): Promise<ResultadoGeneracion> {
  const periodo = crearPeriodo(anio, mes)
  const [tarifas, existentes, alumnos] = await Promise.all([
    tarifasVigentes(periodo.inicio),
    prisma.factura.findMany({ where: { anio, mes }, select: { id_alumno: true } }),
    alumnosFacturables(periodo),
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
