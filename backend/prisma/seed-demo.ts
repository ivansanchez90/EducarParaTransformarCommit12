/**
 * Seed de demostración: llena la base con un colegio completo y coherente
 * (cursos, docentes, familias, alumnos, notas, asistencia, cuotas, servicios,
 * noticias, empleos, preinscripciones...) para poder probar o mostrar el
 * sistema sin cargar nada a mano.
 *
 *   npm run seed:demo
 *
 * ⚠️  BORRA todo lo que haya en la base antes de cargar los datos. Por eso
 * solo corre contra una base local; para usarlo en otra hay que declarar
 * SEED_DEMO_FORCE=true de forma explícita.
 *
 * Todos los usuarios creados acá entran con la misma contraseña: demo1234
 * (o la que se defina en SEED_DEMO_PASSWORD).
 */
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client.js'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, options: '-c timezone=UTC' }),
})

const PASSWORD_DEMO = process.env.SEED_DEMO_PASSWORD ?? 'demo1234'
const ANIO = new Date().getFullYear()

// ── Utilidades ──────────────────────────────────────────────────

/** Random reproducible: el mismo seed genera siempre los mismos datos. */
let semilla = 20260920
const azar = () => {
  semilla = (semilla * 1103515245 + 12345) % 2147483648
  return semilla / 2147483648
}
const entre = (min: number, max: number) => min + Math.floor(azar() * (max - min + 1))
const elegir = <T>(items: readonly T[]): T => items[entre(0, items.length - 1)]
const quizas = (probabilidad: number) => azar() < probabilidad
/** Devuelve `n` elementos distintos del arreglo. */
const varios = <T>(items: readonly T[], n: number): T[] => {
  const copia = [...items]
  const salida: T[] = []
  while (salida.length < Math.min(n, copia.length)) {
    salida.push(...copia.splice(entre(0, copia.length - 1), 1))
  }
  return salida
}

const fecha = (anio: number, mes: number, dia: number) => new Date(Date.UTC(anio, mes - 1, dia))
const hora = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`)
const diasAtras = (n: number) => new Date(Date.now() - n * 86400000)
const sinAcentos = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '')

// ── Datos de base para generar personas ─────────────────────────

const NOMBRES_F = ['Sofía', 'Valentina', 'Martina', 'Camila', 'Lucía', 'Mía', 'Emma', 'Renata', 'Olivia', 'Julieta', 'Catalina', 'Paula', 'Delfina', 'Abril', 'Agustina', 'Bianca', 'Zoe', 'Malena']
const NOMBRES_M = ['Mateo', 'Benjamín', 'Thiago', 'Bautista', 'Santino', 'Joaquín', 'Lorenzo', 'Felipe', 'Dante', 'Ciro', 'Ignacio', 'Tomás', 'Bruno', 'Facundo', 'Simón', 'Emiliano', 'Lautaro', 'Gael']
const APELLIDOS = ['González', 'Rodríguez', 'Gómez', 'Fernández', 'López', 'Díaz', 'Martínez', 'Pérez', 'Romero', 'Sosa', 'Álvarez', 'Torres', 'Ruiz', 'Ramírez', 'Flores', 'Benítez', 'Acosta', 'Medina', 'Herrera', 'Aguirre', 'Giménez', 'Ferrari', 'Cabrera', 'Ojeda', 'Molina']
const CALLES = ['Av. San Martín', 'Belgrano', 'Rivadavia', 'Sarmiento', 'Mitre', 'Las Heras', 'Junín', 'Bolívar', 'Córdoba', 'Entre Ríos']
const OBRAS_SOCIALES = ['OSDE', 'Swiss Medical', 'IOSFA', 'PAMI', 'Galeno', 'OSECAC', null, null]

const personaAlAzar = (femenino = quizas(0.5)) => ({
  nombre: elegir(femenino ? NOMBRES_F : NOMBRES_M),
  apellido: elegir(APELLIDOS),
})

// ── Catálogos del colegio ───────────────────────────────────────

const CURSOS = [
  { nivel: 'Inicial', grado_anio: 'Sala de 4', division: 'A' },
  { nivel: 'Inicial', grado_anio: 'Sala de 5', division: 'A' },
  { nivel: 'Primario', grado_anio: '1', division: 'A' },
  { nivel: 'Primario', grado_anio: '1', division: 'B' },
  { nivel: 'Primario', grado_anio: '2', division: 'A' },
  { nivel: 'Primario', grado_anio: '3', division: 'A' },
  { nivel: 'Primario', grado_anio: '4', division: 'A' },
  { nivel: 'Primario', grado_anio: '5', division: 'A' },
  { nivel: 'Primario', grado_anio: '6', division: 'A' },
  { nivel: 'Secundario', grado_anio: '1', division: 'A' },
  { nivel: 'Secundario', grado_anio: '2', division: 'A' },
  { nivel: 'Secundario', grado_anio: '3', division: 'A' },
]

const MATERIAS = [
  { nombre: 'Matemática', horas_semanales: 6, niveles: ['Primario', 'Secundario'] },
  { nombre: 'Lengua y Literatura', horas_semanales: 6, niveles: ['Primario', 'Secundario'] },
  { nombre: 'Ciencias Naturales', horas_semanales: 4, niveles: ['Primario'] },
  { nombre: 'Ciencias Sociales', horas_semanales: 4, niveles: ['Primario'] },
  { nombre: 'Biología', horas_semanales: 4, niveles: ['Secundario'] },
  { nombre: 'Historia', horas_semanales: 3, niveles: ['Secundario'] },
  { nombre: 'Geografía', horas_semanales: 3, niveles: ['Secundario'] },
  { nombre: 'Inglés', horas_semanales: 3, niveles: ['Primario', 'Secundario'] },
  { nombre: 'Educación Física', horas_semanales: 2, niveles: ['Inicial', 'Primario', 'Secundario'] },
  { nombre: 'Música', horas_semanales: 2, niveles: ['Inicial', 'Primario'] },
  { nombre: 'Artes Visuales', horas_semanales: 2, niveles: ['Inicial', 'Primario', 'Secundario'] },
  { nombre: 'Educación Tecnológica', horas_semanales: 2, niveles: ['Primario', 'Secundario'] },
  { nombre: 'Formación Ética y Ciudadana', horas_semanales: 2, niveles: ['Secundario'] },
  { nombre: 'Sala de juegos y expresión', horas_semanales: 8, niveles: ['Inicial'] },
]

const ESPECIALIDADES = ['Matemática', 'Lengua', 'Ciencias Naturales', 'Ciencias Sociales', 'Inglés', 'Educación Física', 'Artes', 'Tecnología', 'Nivel Inicial', 'Psicopedagogía']

const ACTIVIDADES = [
  { nombre: 'Inglés', tipo: 'Idioma', descripcion: 'Taller de idioma inglés', cupo_maximo: 25 },
  { nombre: 'Portugués', tipo: 'Idioma', descripcion: 'Taller de idioma portugués', cupo_maximo: 25 },
  { nombre: 'Francés', tipo: 'Idioma', descripcion: 'Taller de idioma francés', cupo_maximo: 25 },
  { nombre: 'Atletismo', tipo: 'Deporte', descripcion: 'Disciplina de atletismo', cupo_maximo: 20 },
  { nombre: 'Natación', tipo: 'Deporte', descripcion: 'Disciplina de natación', cupo_maximo: 20 },
  { nombre: 'Fútbol', tipo: 'Deporte', descripcion: 'Disciplina de fútbol', cupo_maximo: 22 },
  { nombre: 'Artes marciales', tipo: 'Deporte', descripcion: 'Disciplina de artes marciales', cupo_maximo: 18 },
  { nombre: 'Vóleibol', tipo: 'Deporte', descripcion: 'Disciplina de vóleibol', cupo_maximo: 20 },
  { nombre: 'Danza', tipo: 'Deporte', descripcion: 'Disciplina de danza', cupo_maximo: 20 },
  { nombre: 'Básquet', tipo: 'Deporte', descripcion: 'Disciplina de básquet', cupo_maximo: 20 },
  { nombre: 'Ajedrez', tipo: 'Deporte', descripcion: 'Disciplina de ajedrez', cupo_maximo: 16 },
]

const INSTALACIONES = [
  { nombre: 'Pileta de natación', tipo: 'Deportiva', descripcion: 'Pileta climatizada' },
  { nombre: 'Cancha de fútbol', tipo: 'Deportiva', descripcion: 'Cancha de fútbol al aire libre' },
  { nombre: 'Pista de atletismo', tipo: 'Deportiva', descripcion: 'Pista de atletismo' },
  { nombre: 'Gimnasio cubierto', tipo: 'Deportiva', descripcion: 'Gimnasio multipropósito cubierto' },
  { nombre: 'Salón de actos', tipo: 'Común', descripcion: 'Salón para actos y reuniones' },
  { nombre: 'Laboratorio de computación', tipo: 'Laboratorio', descripcion: '20 equipos' },
]

const RECORRIDOS = [
  { nombre: 'Recorrido 1 - Centro', zona: 'Centro y microcentro', paradas: 'Plaza principal\nTerminal\nAv. San Martín 500', hora_ida: '07:00', hora_vuelta: '17:30' },
  { nombre: 'Recorrido 2 - Norte', zona: 'Barrios del norte', paradas: 'Av. Belgrano 2100\nPlaza Norte\nClub Social', hora_ida: '06:45', hora_vuelta: '17:45' },
  { nombre: 'Recorrido 3 - Sur', zona: 'Barrios del sur', paradas: 'Av. Sur 1200\nEscuela N° 12\nPolideportivo', hora_ida: '06:50', hora_vuelta: '17:40' },
  { nombre: 'Recorrido 4 - Oeste', zona: 'Zona oeste y rutas', paradas: 'Ruta 9 km 12\nBarrio El Molino\nAv. Oeste 800', hora_ida: '06:30', hora_vuelta: '18:00' },
]

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']
const TIPOS_EVALUACION = ['Parcial', 'Trabajo práctico', 'Oral', 'Concepto', 'Recuperatorio']
const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Tarjeta de débito', 'Tarjeta de crédito']

// ── Seguridad: por defecto, solo contra una base local ──────────

function verificarDestino() {
  const url = process.env.DATABASE_URL ?? ''
  const local = /@(localhost|127\.0\.0\.1|host\.docker\.internal)[:/]/.test(url)
  if (!local && process.env.SEED_DEMO_FORCE !== 'true') {
    console.error(
      'Este seed BORRA todos los datos y la base no parece local.\n' +
        'Si igual querés cargarlo ahí, volvé a correrlo con SEED_DEMO_FORCE=true.',
    )
    process.exit(1)
  }
}

/** Vacía todas las tablas (menos el historial de migraciones) y reinicia los ids. */
async function vaciarBase() {
  const tablas = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `
  if (tablas.length === 0) return
  const lista = tablas.map((t) => `"${t.tablename}"`).join(', ')
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${lista} RESTART IDENTITY CASCADE`)
}

// ── Carga ───────────────────────────────────────────────────────

async function main() {
  verificarDestino()
  console.log('Vaciando la base...')
  await vaciarBase()

  // Una sola vuelta de bcrypt reutilizada por todos los usuarios de prueba.
  const hash = await bcrypt.hash(PASSWORD_DEMO, 10)
  const hashAdmin = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD ?? 'admin1234', 10)
  const emailAdmin = (process.env.SEED_ADMIN_EMAIL ?? 'admin@educar.local').toLowerCase()

  // ── Período académico y catálogos ──
  const periodo = await prisma.periodoAcademico.create({
    data: {
      nombre: `Ciclo lectivo ${ANIO}`,
      fecha_inicio: fecha(ANIO, 3, 1),
      fecha_fin: fecha(ANIO, 12, 20),
      activo: true,
    },
  })

  await prisma.actividadExtracurricular.createMany({ data: ACTIVIDADES })
  await prisma.instalacion.createMany({ data: INSTALACIONES })
  await prisma.recorridoTransporte.createMany({
    data: RECORRIDOS.map((r) => ({
      ...r,
      hora_ida: hora(r.hora_ida),
      hora_vuelta: hora(r.hora_vuelta),
      capacidad: 30,
    })),
  })
  const actividades = await prisma.actividadExtracurricular.findMany()
  const instalaciones = await prisma.instalacion.findMany()
  const recorridos = await prisma.recorridoTransporte.findMany()

  await prisma.curso.createMany({
    data: CURSOS.map((c) => ({ ...c, capacidad_maxima: 28, id_periodo: periodo.id_periodo })),
  })
  const cursos = await prisma.curso.findMany({ orderBy: { id_curso: 'asc' } })

  await prisma.materia.createMany({
    data: MATERIAS.map((m) => ({ nombre: m.nombre, horas_semanales: m.horas_semanales })),
  })
  const materias = await prisma.materia.findMany({ orderBy: { id_materia: 'asc' } })
  const materiaPorNombre = new Map(materias.map((m) => [m.nombre, m]))

  // ── Personal ──
  await prisma.usuario.create({
    data: { email: emailAdmin, password_hash: hashAdmin, nombre: 'Admin', apellido: 'Sistema', rol: 'Admin' },
  })
  const directivo = await prisma.usuario.create({
    data: {
      email: 'directora@educar.local',
      password_hash: hash,
      nombre: 'Mercedes',
      apellido: 'Vallejos',
      rol: 'Directivo',
      telefono: '3794-400100',
    },
  })

  const docentes: { id_docente: number; id_usuario: string; nombre: string; apellido: string }[] = []
  for (let i = 0; i < 12; i++) {
    const { nombre, apellido } = personaAlAzar()
    const usuario = await prisma.usuario.create({
      data: {
        email: `${sinAcentos(nombre)}.${sinAcentos(apellido)}${i}@educar.local`,
        password_hash: hash,
        nombre,
        apellido,
        rol: 'Docente',
        telefono: `3794-4${entre(10000, 99999)}`,
      },
    })
    const docente = await prisma.docente.create({
      data: {
        id_usuario: usuario.id_usuario,
        dni: String(entre(20000000, 35000000)),
        titulo: elegir(['Profesorado', 'Licenciatura', 'Profesorado universitario']),
        especialidad: ESPECIALIDADES[i % ESPECIALIDADES.length],
        fecha_ingreso: fecha(ANIO - entre(1, 12), entre(1, 12), entre(1, 28)),
      },
    })
    docentes.push({ id_docente: docente.id_docente, id_usuario: usuario.id_usuario, nombre, apellido })
  }

  // ── Familias, alumnos y sus usuarios ──
  const alumnos: { id_alumno: number; id_curso: number; nivel: string; nombre: string; apellido: string; id_usuario: string; id_padre: string }[] = []
  let dni = 47000000

  for (const curso of cursos) {
    const cantidad = curso.nivel === 'Inicial' ? entre(6, 9) : entre(8, 14)
    for (let i = 0; i < cantidad; i++) {
      const { nombre, apellido } = personaAlAzar()
      dni += entre(1000, 9000)
      const dniAlumno = String(dni)

      const tutor = personaAlAzar()
      const usuarioPadre = await prisma.usuario.create({
        data: {
          email: `flia.${sinAcentos(apellido)}${dniAlumno.slice(-4)}@mail.com`,
          password_hash: hash,
          nombre: tutor.nombre,
          apellido,
          rol: 'Padre',
          telefono: `3794-5${entre(10000, 99999)}`,
        },
      })
      const usuarioAlumno = await prisma.usuario.create({
        data: {
          email: `${dniAlumno}@alumno.local`,
          password_hash: hash,
          nombre,
          apellido,
          rol: 'Alumno',
        },
      })

      const edadBase = curso.nivel === 'Inicial' ? 4 : curso.nivel === 'Primario' ? 6 + Number(curso.grado_anio) : 12 + Number(curso.grado_anio)
      const alumno = await prisma.alumno.create({
        data: {
          nombre,
          apellido,
          dni: dniAlumno,
          fecha_nacimiento: fecha(ANIO - edadBase, entre(1, 12), entre(1, 28)),
          direccion: `${elegir(CALLES)} ${entre(100, 3500)}`,
          telefono_emergencia: `3794-6${entre(10000, 99999)}`,
          nombre_contacto_emergencia: `${tutor.nombre} ${apellido}`,
          obra_social: elegir(OBRAS_SOCIALES),
          nro_obra_social: quizas(0.6) ? String(entre(100000, 999999)) : null,
          id_curso: curso.id_curso,
          id_usuario: usuarioAlumno.id_usuario,
          id_usuario_padre: usuarioPadre.id_usuario,
          activo: quizas(0.96),
        },
      })
      alumnos.push({
        id_alumno: alumno.id_alumno,
        id_curso: curso.id_curso,
        nivel: curso.nivel,
        nombre,
        apellido,
        id_usuario: usuarioAlumno.id_usuario,
        id_padre: usuarioPadre.id_usuario,
      })
    }
  }

  // ── Asignaciones y horarios ──
  const asignaciones: { id_asignacion: number; id_curso: number; id_materia: number; id_docente: number }[] = []
  for (const curso of cursos) {
    const delNivel = MATERIAS.filter((m) => m.niveles.includes(curso.nivel))
    let bloque = 0
    for (const materia of delNivel) {
      const docente = elegir(docentes)
      const asignacion = await prisma.asignacion.create({
        data: {
          id_docente: docente.id_docente,
          id_materia: materiaPorNombre.get(materia.nombre)!.id_materia,
          id_curso: curso.id_curso,
          id_periodo: periodo.id_periodo,
        },
      })
      asignaciones.push({
        id_asignacion: asignacion.id_asignacion,
        id_curso: curso.id_curso,
        id_materia: asignacion.id_materia,
        id_docente: docente.id_docente,
      })

      // Dos bloques semanales por materia, sin superponerse dentro del curso.
      const horarios = [0, 1].map(() => {
        const dia = DIAS[bloque % DIAS.length]
        const inicio = 8 + Math.floor(bloque / DIAS.length)
        bloque++
        return {
          id_asignacion: asignacion.id_asignacion,
          dia_semana: dia,
          hora_inicio: hora(`${String(inicio).padStart(2, '0')}:00`),
          hora_fin: hora(`${String(inicio + 1).padStart(2, '0')}:00`),
          aula: `Aula ${entre(1, 12)}`,
        }
      })
      await prisma.horario.createMany({ data: horarios })
    }
  }

  // ── Asistencia de las últimas jornadas ──
  const jornadas: Date[] = []
  for (let d = 1; jornadas.length < 15; d++) {
    const dia = diasAtras(d)
    if (dia.getUTCDay() !== 0 && dia.getUTCDay() !== 6) {
      jornadas.push(fecha(dia.getUTCFullYear(), dia.getUTCMonth() + 1, dia.getUTCDate()))
    }
  }

  const asistencias: { id_alumno: number; id_asignacion: number; fecha: Date; estado: string; observacion: string | null; registrado_por: string }[] = []
  for (const curso of cursos) {
    // Una asignación por curso hace de "toma de asistencia" del día.
    const asignacion = asignaciones.find((a) => a.id_curso === curso.id_curso)!
    const docente = docentes.find((d) => d.id_docente === asignacion.id_docente)!
    for (const dia of jornadas) {
      for (const alumno of alumnos.filter((a) => a.id_curso === curso.id_curso)) {
        const r = azar()
        const estado = r < 0.87 ? 'Presente' : r < 0.94 ? 'Ausente' : r < 0.98 ? 'Tarde' : 'Justificado'
        asistencias.push({
          id_alumno: alumno.id_alumno,
          id_asignacion: asignacion.id_asignacion,
          fecha: dia,
          estado,
          observacion: estado === 'Justificado' ? 'Presentó certificado médico' : null,
          registrado_por: docente.id_usuario,
        })
      }
    }
  }
  await prisma.asistencia.createMany({ data: asistencias, skipDuplicates: true })

  // ── Calificaciones ──
  const calificaciones: { id_alumno: number; id_asignacion: number; id_periodo: number; trimestre: number; tipo_evaluacion: string; nota: number; descripcion: string | null; fecha_carga: Date }[] = []
  for (const alumno of alumnos) {
    const delCurso = asignaciones.filter((a) => a.id_curso === alumno.id_curso)
    for (const asignacion of varios(delCurso, Math.min(5, delCurso.length))) {
      for (const trimestre of [1, 2]) {
        const cantidad = entre(1, 2)
        for (let i = 0; i < cantidad; i++) {
          calificaciones.push({
            id_alumno: alumno.id_alumno,
            id_asignacion: asignacion.id_asignacion,
            id_periodo: periodo.id_periodo,
            trimestre,
            tipo_evaluacion: elegir(TIPOS_EVALUACION),
            nota: entre(4, 10),
            descripcion: quizas(0.3) ? 'Evaluación integradora de la unidad' : null,
            fecha_carga: fecha(ANIO, trimestre === 1 ? entre(4, 6) : entre(7, 9), entre(1, 28)),
          })
        }
      }
    }
  }
  await prisma.calificacion.createMany({ data: calificaciones })

  // ── Amonestaciones ──
  const amonestaciones = varios(alumnos, 14).map((alumno) => {
    const asignacion = asignaciones.find((a) => a.id_curso === alumno.id_curso)!
    return {
      id_alumno: alumno.id_alumno,
      id_docente: asignacion.id_docente,
      tipo: elegir(['Leve', 'Leve', 'Grave', 'Muy grave']),
      descripcion: elegir([
        'Reiteradas llegadas tarde sin justificar.',
        'Falta de respeto a un compañero durante la clase.',
        'No presentó el trabajo práctico en tres oportunidades.',
        'Uso del celular durante la evaluación.',
        'Se retiró del aula sin autorización.',
      ]),
      fecha: fecha(ANIO, entre(3, 9), entre(1, 28)),
      estado: elegir(['Notificada', 'Pendiente de notificar']),
    }
  })
  await prisma.amonestacion.createMany({ data: amonestaciones })

  // ── Becas ──
  const becados = varios(alumnos, 9)
  await prisma.beca.createMany({
    data: becados.map((a) => ({
      id_alumno: a.id_alumno,
      porcentaje: elegir([20, 25, 30, 50, 100]),
      motivo: elegir(['Beca por hermanos en la institución', 'Beca por rendimiento académico', 'Beca por situación socioeconómica', 'Beca deportiva']),
      activo: quizas(0.85),
      fecha_otorgamiento: fecha(ANIO, 3, entre(1, 28)),
    })),
  })
  const becasActivas = new Map(
    (await prisma.beca.findMany({ where: { activo: true } })).map((b) => [b.id_alumno, b.porcentaje.toNumber()]),
  )

  // ── Cuotas y pagos ──
  const MONTO_BASE = 85000
  const mesActual = new Date().getMonth() + 1
  const cuotas: { id_alumno: number; mes: number; anio: number; monto_base: number; recargo: number; descuento: number; fecha_vencimiento: Date; estado: string; fecha_pago: Date | null; metodo_pago: string | null }[] = []
  for (const alumno of alumnos) {
    for (let mes = 3; mes <= Math.min(mesActual, 12); mes++) {
      const descuento = Math.round((MONTO_BASE * (becasActivas.get(alumno.id_alumno) ?? 0)) / 100)
      const vencimiento = fecha(ANIO, mes, 10)
      const vencida = mes < mesActual
      const pagada = vencida ? quizas(0.85) : quizas(0.45)
      cuotas.push({
        id_alumno: alumno.id_alumno,
        mes,
        anio: ANIO,
        monto_base: MONTO_BASE,
        recargo: vencida && !pagada ? 5000 : 0,
        descuento,
        fecha_vencimiento: vencimiento,
        estado: pagada ? 'Pagada' : vencida ? 'Vencida' : 'Pendiente',
        fecha_pago: pagada ? fecha(ANIO, mes, entre(1, 10)) : null,
        metodo_pago: pagada ? elegir(METODOS_PAGO) : null,
      })
    }
  }
  await prisma.cuota.createMany({ data: cuotas })

  // Cada cuota pagada deja su movimiento en el historial de pagos.
  const pagadas = await prisma.cuota.findMany({ where: { estado: 'Pagada' } })
  await prisma.pago.createMany({
    data: pagadas.map((c) => ({
      id_cuota: c.id_cuota,
      fecha_pago: new Date(`${c.fecha_pago!.toISOString().slice(0, 10)}T12:00:00Z`),
      monto_pagado: c.monto_base.plus(c.recargo ?? 0).minus(c.descuento ?? 0),
      metodo_pago: c.metodo_pago,
      nro_comprobante: `REC-${String(c.id_cuota).padStart(6, '0')}`,
      id_usuario_registra: directivo.id_usuario,
    })),
  })

  // ── Sueldos y compras ──
  const personal = [directivo, ...(await prisma.usuario.findMany({ where: { rol: 'Docente' } }))]
  const sueldos = personal.flatMap((u) =>
    Array.from({ length: 4 }, (_, i) => {
      const mes = Math.max(1, mesActual - i)
      const pagado = i > 0
      return {
        id_usuario: u.id_usuario,
        mes,
        anio: ANIO,
        monto: entre(700, 1400) * 1000,
        estado: pagado ? 'Pagado' : 'Pendiente',
        fecha_pago: pagado ? fecha(ANIO, mes, 28) : null,
      }
    }),
  )
  await prisma.sueldo.createMany({ data: sueldos })

  await prisma.compraInsumo.createMany({
    data: [
      { descripcion: 'Reactivos para prácticas de laboratorio', destino: 'Laboratorio de química', cantidad: 12, monto: 185000, proveedor: 'Química del Litoral', fecha_compra: fecha(ANIO, 4, 12) },
      { descripcion: 'Microscopios ópticos', destino: 'Laboratorio de física', cantidad: 4, monto: 920000, proveedor: 'InstrumentAR', fecha_compra: fecha(ANIO, 5, 3) },
      { descripcion: 'Notebooks para el aula de informática', destino: 'Laboratorio de computación', cantidad: 6, monto: 4200000, proveedor: 'TecnoSur', fecha_compra: fecha(ANIO, 5, 20) },
      { descripcion: 'Botiquín completo y repuestos', destino: 'Enfermería', cantidad: 3, monto: 145000, proveedor: 'Farmacia Central', fecha_compra: fecha(ANIO, 6, 8) },
      { descripcion: 'Camilla y tensiómetro', destino: 'Enfermería', cantidad: 1, monto: 310000, proveedor: 'Med Insumos', fecha_compra: fecha(ANIO, 6, 25) },
      { descripcion: 'Kit de robótica educativa', destino: 'Laboratorio de computación', cantidad: 8, monto: 640000, proveedor: 'TecnoSur', fecha_compra: fecha(ANIO, 7, 14) },
      { descripcion: 'Material descartable de laboratorio', destino: 'Laboratorio de química', cantidad: 40, monto: 98000, proveedor: 'Química del Litoral', fecha_compra: fecha(ANIO, 8, 2) },
      { descripcion: 'Balanzas digitales', destino: 'Laboratorio de física', cantidad: 5, monto: 275000, proveedor: 'InstrumentAR', fecha_compra: fecha(ANIO, 8, 30) },
    ],
  })

  // ── Extracurriculares ──
  const inscripcionesActividades: { id_actividad: number; id_alumno: number }[] = []
  const cupoUsado = new Map(actividades.map((a) => [a.id_actividad, 0]))
  for (const alumno of alumnos) {
    if (!quizas(0.55)) continue
    for (const actividad of varios(actividades, entre(1, 2))) {
      const usado = cupoUsado.get(actividad.id_actividad)!
      if (usado >= actividad.cupo_maximo) continue
      cupoUsado.set(actividad.id_actividad, usado + 1)
      inscripcionesActividades.push({ id_actividad: actividad.id_actividad, id_alumno: alumno.id_alumno })
    }
  }
  await prisma.inscripcionActividad.createMany({ data: inscripcionesActividades, skipDuplicates: true })

  // ── Servicios: transporte y comedor ──
  const enTransporte = varios(alumnos, Math.min(alumnos.length, recorridos.length * 18))
  await prisma.inscripcionTransporte.createMany({
    data: enTransporte.map((a, i) => ({
      id_alumno: a.id_alumno,
      id_recorrido: recorridos[i % recorridos.length].id_recorrido,
      observaciones: quizas(0.25) ? 'Baja acompañado/a por un adulto' : null,
    })),
    skipDuplicates: true,
  })
  await prisma.inscripcionComedor.createMany({
    data: varios(alumnos, Math.round(alumnos.length * 0.4)).map((a) => ({
      id_alumno: a.id_alumno,
      observaciones: quizas(0.3) ? elegir(['Sin lácteos', 'Celíaco/a', 'Vegetariano/a', 'Alergia al maní']) : null,
    })),
    skipDuplicates: true,
  })

  // ── Reservas de instalaciones ──
  const reservas = Array.from({ length: 12 }, (_, i) => {
    const instalacion = instalaciones[i % instalaciones.length]
    const dia = new Date(Date.now() + (i + 1) * 86400000)
    const inicio = 8 + (i % 6)
    return {
      id_instalacion: instalacion.id_instalacion,
      fecha: fecha(dia.getUTCFullYear(), dia.getUTCMonth() + 1, dia.getUTCDate()),
      hora_inicio: hora(`${String(inicio).padStart(2, '0')}:00`),
      hora_fin: hora(`${String(inicio + 1).padStart(2, '0')}:30`),
      motivo: elegir(['Clase de Educación Física', 'Ensayo del acto del 25 de mayo', 'Torneo interno', 'Reunión de padres', 'Taller de robótica']),
      reservado_por: elegir(docentes).id_usuario,
    }
  })
  await prisma.reservaInstalacion.createMany({ data: reservas })

  // ── Sitio público: noticias, galería, empleos, postulaciones ──
  await prisma.noticia.createMany({
    data: [
      { titulo: 'Comienzo del ciclo lectivo', resumen: 'Damos la bienvenida a las familias al nuevo ciclo.', contenido: 'El lunes comenzamos las clases en todos los niveles. Recordamos que el ingreso es a las 7:45 y que el uniforme es obligatorio desde el primer día.', fecha_publicacion: fecha(ANIO, 3, 1), destacada: true, id_autor: directivo.id_usuario },
      { titulo: 'Jornada de puertas abiertas', resumen: 'Invitamos a conocer la institución.', contenido: 'Las familias interesadas podrán recorrer las instalaciones y conversar con el equipo directivo. No requiere inscripción previa.', fecha_publicacion: fecha(ANIO, 4, 15), destacada: true, id_autor: directivo.id_usuario },
      { titulo: 'Torneo intercolegial de atletismo', resumen: 'Nuestros equipos participaron del torneo regional.', contenido: 'Felicitamos a los estudiantes que representaron a la institución y obtuvieron el segundo puesto en la clasificación general.', fecha_publicacion: fecha(ANIO, 5, 22), id_autor: directivo.id_usuario },
      { titulo: 'Campaña solidaria de abrigo', resumen: 'Recibimos donaciones hasta fin de mes.', contenido: 'Se reciben prendas de abrigo en buen estado en la recepción del colegio, de 8 a 17.', fecha_publicacion: fecha(ANIO, 6, 10), id_autor: directivo.id_usuario },
      { titulo: 'Muestra anual de artes', resumen: 'Los trabajos del año se exponen en el salón de actos.', contenido: 'La muestra estará abierta durante toda la semana en el horario de clases.', fecha_publicacion: fecha(ANIO, 8, 5), destacada: true, id_autor: directivo.id_usuario },
      { titulo: 'Nuevo laboratorio de computación', resumen: 'Renovamos los equipos del laboratorio.', contenido: 'Gracias al aporte de la cooperadora incorporamos seis notebooks y kits de robótica educativa.', fecha_publicacion: fecha(ANIO, 8, 28), id_autor: directivo.id_usuario },
      { titulo: 'Reunión de padres del nivel primario', resumen: 'Convocamos a las familias del primer ciclo.', contenido: 'La reunión se realizará en el salón de actos. Se tratarán temas de convivencia y el cierre del segundo trimestre.', fecha_publicacion: fecha(ANIO, 9, 3), id_autor: directivo.id_usuario },
      { titulo: 'Suspensión de actividades por jornada docente', resumen: 'No habrá clases el viernes.', contenido: 'Por jornada institucional de capacitación docente no habrá actividad áulica en ninguno de los niveles.', fecha_publicacion: fecha(ANIO, 9, 12), activo: false, id_autor: directivo.id_usuario },
    ],
  })

  const FOTOS = [
    ['Patio central', 'Instalaciones', 'photo-1580582932707-520aed937b7b'],
    ['Biblioteca', 'Instalaciones', 'photo-1521587760476-6c12a4b040da'],
    ['Clase de ciencias', 'Actividades', 'photo-1503676260728-1c00da094a0b'],
    ['Taller de arte', 'Arte', 'photo-1513475382585-d06e58bcb0e0'],
    ['Equipo de vóleibol', 'Deportes', 'photo-1521412644187-c49fa049e84d'],
    ['Laboratorio de computación', 'Tecnología', 'photo-1518770660439-4636190af475'],
    ['Clase de inglés', 'Idiomas', 'photo-1523240795612-9a054b0db644'],
    ['Acto escolar', 'Actividades', 'photo-1523050854058-8df90110c9f1'],
  ]
  await prisma.galeria.createMany({
    data: FOTOS.map(([titulo, categoria, foto]) => ({
      titulo,
      descripcion: `${titulo} — ${categoria}`,
      categoria,
      url_imagen: `https://images.unsplash.com/${foto}?w=1200&q=80`,
      id_autor: directivo.id_usuario,
    })),
  })

  await prisma.empleo.createMany({
    data: [
      { titulo: 'Docente de Matemática (nivel secundario)', descripcion: 'Dictado de Matemática en 1° y 2° año.', area: 'Académica', requisitos: 'Profesorado en Matemática. Experiencia mínima de 2 años.', tipo_contrato: 'Part-time', fecha_publicacion: fecha(ANIO, 7, 1), fecha_cierre: fecha(ANIO, 12, 1), id_autor: directivo.id_usuario },
      { titulo: 'Preceptor/a nivel primario', descripcion: 'Acompañamiento de los grupos del primer ciclo.', area: 'Académica', requisitos: 'Secundario completo. Se valorará experiencia en instituciones educativas.', tipo_contrato: 'Full-time', fecha_publicacion: fecha(ANIO, 7, 20), id_autor: directivo.id_usuario },
      { titulo: 'Profesor/a de Educación Física', descripcion: 'Clases en nivel inicial y primario.', area: 'Deportes', requisitos: 'Profesorado en Educación Física.', tipo_contrato: 'Suplencia', fecha_publicacion: fecha(ANIO, 8, 10), id_autor: directivo.id_usuario },
      { titulo: 'Asistente administrativo', descripcion: 'Atención a familias y tareas administrativas.', area: 'Administración', requisitos: 'Manejo de herramientas informáticas. Disponibilidad horaria.', tipo_contrato: 'Full-time', fecha_publicacion: fecha(ANIO, 8, 25), id_autor: directivo.id_usuario },
      { titulo: 'Enfermero/a escolar', descripcion: 'Cobertura del servicio de enfermería en turno mañana.', area: 'Salud', requisitos: 'Título habilitante y matrícula vigente.', tipo_contrato: 'Part-time', fecha_publicacion: fecha(ANIO, 9, 5), activo: false, id_autor: directivo.id_usuario },
    ],
  })
  const empleos = await prisma.empleo.findMany()

  await prisma.postulacion.createMany({
    data: Array.from({ length: 14 }, () => {
      const p = personaAlAzar()
      return {
        id_empleo: elegir(empleos).id_empleo,
        nombre: p.nombre,
        apellido: p.apellido,
        email: `${sinAcentos(p.nombre)}.${sinAcentos(p.apellido)}${entre(1, 99)}@mail.com`,
        telefono: `3794-7${entre(10000, 99999)}`,
        mensaje: elegir([
          'Adjunto mi CV. Cuento con experiencia en instituciones de gestión privada.',
          'Me interesa la propuesta y tengo disponibilidad horaria completa.',
          'Trabajé cinco años en el nivel primario y busco un nuevo desafío.',
          'Quedo a disposición para una entrevista.',
        ]),
        estado: elegir(['Recibida', 'Recibida', 'En revisión', 'Entrevista', 'Seleccionada', 'Rechazada']),
      }
    }),
  })

  // ── Preinscripciones pendientes de resolver ──
  await prisma.inscripcion.createMany({
    data: Array.from({ length: 10 }, (_, i) => {
      const aspirante = personaAlAzar()
      const tutor = personaAlAzar()
      const nivel = elegir(['Inicial', 'Primario', 'Secundario'])
      return {
        nombre_aspirante: aspirante.nombre,
        apellido_aspirante: aspirante.apellido,
        fecha_nacimiento_aspirante: i === 9 ? null : fecha(ANIO - entre(4, 15), entre(1, 12), entre(1, 28)),
        dni_aspirante: String(entre(48000000, 55000000)),
        nombre_tutor: `${tutor.nombre} ${aspirante.apellido}`,
        email_tutor: `flia.${sinAcentos(aspirante.apellido)}${i}@mail.com`,
        telefono_tutor: `3794-8${entre(10000, 99999)}`,
        nivel_solicitado: nivel,
        grado_anio_solicitado: nivel === 'Inicial' ? 'Sala de 5' : String(entre(1, 6)),
        documentacion_completa: quizas(0.4),
        observaciones: quizas(0.3) ? 'Falta el certificado de vacunación.' : null,
        estado: elegir(['Pendiente', 'Pendiente', 'Pendiente', 'En revisión', 'En lista de espera', 'Rechazada']),
      }
    }),
  })

  await prisma.mensajeContacto.createMany({
    data: Array.from({ length: 9 }, () => {
      const p = personaAlAzar()
      return {
        nombre: `${p.nombre} ${p.apellido}`,
        email: `${sinAcentos(p.nombre)}${entre(1, 999)}@mail.com`,
        mensaje: elegir([
          '¿Cuáles son los aranceles para el nivel primario?',
          'Quisiera saber si tienen vacantes para 3° grado.',
          '¿El transporte escolar llega a la zona norte?',
          '¿Qué documentación necesito para inscribir a mi hija?',
          '¿Cómo son los horarios del nivel inicial?',
          'Me gustaría coordinar una visita a la institución.',
        ]),
        leido: quizas(0.5),
      }
    }),
  })

  // ── Notificaciones a las familias ──
  const notificaciones = varios(alumnos, Math.round(alumnos.length * 0.6)).flatMap((a) => {
    const destino = a.id_padre
    return varios(
      [
        { titulo: 'Nueva calificación publicada', mensaje: `Se publicó una nota de Matemática para ${a.nombre}.`, tipo: 'Calificación' },
        { titulo: 'Inasistencia registrada', mensaje: `${a.nombre} ${a.apellido} fue registrado/a como ausente.`, tipo: 'Asistencia' },
        { titulo: 'Cuota vencida', mensaje: 'Hay una cuota pendiente de pago. Te pedimos regularizar la situación.', tipo: 'Cuota' },
        { titulo: 'Comunicado institucional', mensaje: 'Reunión de padres del nivel primario.', tipo: 'Novedad' },
      ],
      entre(1, 3),
    ).map((n) => ({
      id_usuario_destino: destino,
      ...n,
      leida: quizas(0.4),
      fecha_envio: diasAtras(entre(1, 30)),
    }))
  })
  await prisma.notificacion.createMany({ data: notificaciones })

  // ── Documentación del legajo ──
  const DOCS = ['DNI', 'Partida de nacimiento', 'Certificado médico', 'Boletín / certificado de estudios']
  await prisma.documentoAlumno.createMany({
    data: varios(alumnos, Math.round(alumnos.length * 0.35)).flatMap((a) =>
      varios(DOCS, entre(1, 2)).map((tipo) => ({
        id_alumno: a.id_alumno,
        nombre: `${tipo} - ${a.apellido}`,
        tipo,
        // Archivo de ejemplo: los documentos reales se suben desde el legajo.
        url_archivo: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      })),
    ),
  })

  // ── Resumen ──
  const conteos = {
    usuarios: await prisma.usuario.count(),
    docentes: await prisma.docente.count(),
    alumnos: await prisma.alumno.count(),
    cursos: await prisma.curso.count(),
    materias: await prisma.materia.count(),
    asignaciones: await prisma.asignacion.count(),
    horarios: await prisma.horario.count(),
    asistencias: await prisma.asistencia.count(),
    calificaciones: await prisma.calificacion.count(),
    cuotas: await prisma.cuota.count(),
    pagos: await prisma.pago.count(),
    becas: await prisma.beca.count(),
    sueldos: await prisma.sueldo.count(),
    actividades: await prisma.inscripcionActividad.count(),
    transporte: await prisma.inscripcionTransporte.count(),
    comedor: await prisma.inscripcionComedor.count(),
    reservas: await prisma.reservaInstalacion.count(),
    noticias: await prisma.noticia.count(),
    empleos: await prisma.empleo.count(),
    postulaciones: await prisma.postulacion.count(),
    preinscripciones: await prisma.inscripcion.count(),
    mensajes: await prisma.mensajeContacto.count(),
    notificaciones: await prisma.notificacion.count(),
  }

  console.log('\nDatos de demostración cargados:')
  for (const [clave, valor] of Object.entries(conteos)) {
    console.log(`  ${clave.padEnd(18)} ${valor}`)
  }

  const ejemploPadre = await prisma.usuario.findFirst({ where: { rol: 'Padre' }, orderBy: { email: 'asc' } })
  const ejemploDocente = await prisma.usuario.findFirst({ where: { rol: 'Docente' }, orderBy: { email: 'asc' } })
  const ejemploAlumno = await prisma.usuario.findFirst({ where: { rol: 'Alumno' }, orderBy: { email: 'asc' } })
  console.log('\nAccesos de prueba (contraseña: ' + PASSWORD_DEMO + '):')
  console.log(`  Directivo  directora@educar.local`)
  console.log(`  Docente    ${ejemploDocente?.email}`)
  console.log(`  Familia    ${ejemploPadre?.email}`)
  console.log(`  Alumno     ${ejemploAlumno?.email}`)
  console.log(`\nAdmin: ${emailAdmin} (con SEED_ADMIN_PASSWORD)\n`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
