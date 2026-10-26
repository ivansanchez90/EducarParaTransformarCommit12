/**
 * Parte de salud y enfermería del seed de demostración: un usuario de enfermería, fichas médicas para la
 * mayoría de los alumnos (con algunas alergias críticas), certificados de aptitud física (vigentes, por vencer y
 * vencidos) y atenciones de los últimos días, cada uno con su auditoría de alta, como la que dejan las pantallas.
 */
import type { PrismaClient } from '../src/generated/prisma/client.js'
import { aTexto, vencimientoDe } from '../src/services/aptitud.js'

interface Contexto {
  prisma: PrismaClient
  alumnos: { id_alumno: number }[]
  hash: string
  azar: () => number
  entre: (min: number, max: number) => number
  diasAtras: (n: number) => Date
}

const GRUPOS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-']
const GRUPOS_FRECUENTES = ['A+', 'A+', '0+', '0+', '0+', 'B+', 'A-', '0-', 'AB+', 'B-']
const ALERGIAS_CRITICAS = ['Maní', 'Frutos secos', 'Picaduras de abeja', 'Penicilina', 'Huevo']
const OTRAS_ALERGIAS = ['Polen', 'Ácaros', 'Pelo de animales', 'Lácteos', 'Gluten (celiaquía)']
const MEDICACION = ['Inhalador de salbutamol en crisis', 'Antihistamínico en caso de reacción', 'Insulina (la administra la familia)']
const CONDICIONES = ['Asma leve', 'Rinitis alérgica', 'Diabetes tipo 1', 'Epilepsia controlada']
const MOTIVOS: [string, string | null][] = [
  ['Dolor de cabeza', 'Reposo y agua'],
  ['Dolor de panza', 'Reposo; se llamó a la familia'],
  ['Golpe en el recreo', 'Hielo local'],
  ['Fiebre', 'Se avisó a la familia para el retiro'],
  ['Mareo', 'Reposo y azúcar'],
  ['Raspón en la rodilla', 'Limpieza y curita'],
  ['Náuseas', 'Reposo'],
  ['Dolor de muelas', null],
]

export async function cargarSalud({ prisma, alumnos, hash, azar, entre, diasAtras }: Contexto): Promise<{ fichas: number; atenciones: number; certificados: number }> {
  const elegir = <T>(items: readonly T[]): T => items[entre(0, items.length - 1)]
  const quizas = (probabilidad: number) => azar() < probabilidad

  const enfermero = await prisma.usuario.create({
    data: { email: 'enfermeria@educar.local', password_hash: hash, nombre: 'Ana', apellido: 'Gómez', rol: 'Enfermero', telefono: '3794-400150' },
  })

  const cambiosDeAlta = (datos: Record<string, string | null>) =>
    Object.fromEntries(Object.entries(datos).filter(([, valor]) => valor !== null).map(([campo, valor]) => [campo, { antes: null, despues: valor }]))

  // ── Fichas médicas: la mayoría de los alumnos, unas pocas con alergias críticas ──
  const conFicha = alumnos.filter(() => quizas(0.7))
  for (const alumno of conFicha) {
    const datos = {
      grupo_sanguineo: quizas(0.9) ? elegir(GRUPOS_FRECUENTES.concat(GRUPOS)) : null,
      alergias: quizas(0.25) ? elegir(OTRAS_ALERGIAS) : null,
      alergias_criticas: quizas(0.08) ? elegir(ALERGIAS_CRITICAS) : null,
      medicacion: quizas(0.1) ? elegir(MEDICACION) : null,
      condiciones: quizas(0.12) ? elegir(CONDICIONES) : null,
      observaciones: null,
    }
    const ficha = await prisma.fichaMedica.create({ data: { id_alumno: alumno.id_alumno, ...datos } })
    await prisma.auditoriaSalud.create({
      data: { id_alumno: alumno.id_alumno, entidad: 'Ficha médica', id_registro: ficha.id_ficha, accion: 'Alta', cambios: cambiosDeAlta(datos), id_usuario: enfermero.id_usuario, fecha_hora: diasAtras(entre(5, 40)) },
    })
  }

  // ── Certificados de aptitud física: casi todos vigentes, algunos por vencer y algunos vencidos o sin cargar ──
  // Así se puede probar el bloqueo de la inscripción a deportes y la lista de pendientes de enfermería.
  const emisionHaceDias = (dias: number) => new Date(`${diasAtras(dias).toISOString().slice(0, 10)}T00:00:00Z`)
  let certificados = 0
  for (const alumno of alumnos) {
    const suerte = azar()
    // vigente 72 %, por vencer 8 %, vencido 10 %, sin certificado 10 %
    const emisiones =
      suerte < 0.72 ? [entre(5, 300)] : suerte < 0.8 ? [entre(340, 360)] : suerte < 0.9 ? [entre(380, 700)] : []
    // Algunos vigentes tienen además el del año anterior: el historial de un alumno que renueva todos los años.
    if (suerte < 0.2) emisiones.push(entre(400, 700))
    for (const dias of emisiones) {
      const emision = emisionHaceDias(dias)
      const vencimiento = vencimientoDe(emision)
      const certificado = await prisma.certificadoAptitud.create({
        data: { id_alumno: alumno.id_alumno, fecha_emision: emision, fecha_vencimiento: vencimiento, observaciones: quizas(0.2) ? 'Apto para la práctica deportiva' : null, id_usuario_registra: enfermero.id_usuario },
      })
      await prisma.auditoriaSalud.create({
        data: {
          id_alumno: alumno.id_alumno,
          entidad: 'Certificado de aptitud',
          id_registro: certificado.id_certificado,
          accion: 'Alta',
          cambios: { fecha_emision: { antes: null, despues: aTexto(emision) }, fecha_vencimiento: { antes: null, despues: aTexto(vencimiento) } },
          id_usuario: enfermero.id_usuario,
          fecha_hora: emision,
        },
      })
      certificados += 1
    }
  }

  // ── Atenciones de los últimos 30 días ──
  let atenciones = 0
  for (const alumno of alumnos.filter(() => quizas(0.3))) {
    for (let i = 0; i < entre(1, 2); i++) {
      const [motivo, tratamiento] = elegir(MOTIVOS)
      const fecha = diasAtras(entre(0, 30))
      const atencion = await prisma.atencionEnfermeria.create({
        data: { id_alumno: alumno.id_alumno, fecha_hora: fecha, motivo, tratamiento, id_usuario_registra: enfermero.id_usuario, familia_avisada: quizas(0.7) },
      })
      await prisma.auditoriaSalud.create({
        data: { id_alumno: alumno.id_alumno, entidad: 'Atención', id_registro: atencion.id_atencion, accion: 'Alta', cambios: cambiosDeAlta({ motivo, tratamiento }), id_usuario: enfermero.id_usuario, fecha_hora: fecha },
      })
      atenciones += 1
    }
  }
  return { fichas: conFicha.length, atenciones, certificados }
}
