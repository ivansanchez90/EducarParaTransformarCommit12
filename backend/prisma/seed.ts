/**
 * Datos iniciales: usuario administrador, período académico activo y los
 * catálogos que antes se cargaban con los scripts SQL de Supabase
 * (actividades extracurriculares e instalaciones). Es idempotente.
 */
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client.js'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, options: '-c timezone=UTC' }),
})

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
]

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@educar.local').toLowerCase()
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'admin1234'
  await prisma.usuario.upsert({
    where: { email },
    update: {},
    create: {
      email,
      password_hash: await bcrypt.hash(password, 10),
      nombre: 'Admin',
      apellido: 'Sistema',
      rol: 'Admin',
    },
  })

  const anio = new Date().getFullYear()
  if (!(await prisma.periodoAcademico.findFirst({ where: { activo: true } }))) {
    await prisma.periodoAcademico.create({
      data: {
        nombre: `Ciclo lectivo ${anio}`,
        fecha_inicio: new Date(Date.UTC(anio, 2, 1)),
        fecha_fin: new Date(Date.UTC(anio, 11, 20)),
        activo: true,
      },
    })
  }

  for (const a of ACTIVIDADES) {
    if (!(await prisma.actividadExtracurricular.findFirst({ where: { nombre: a.nombre } }))) {
      await prisma.actividadExtracurricular.create({ data: a })
    }
  }
  for (const i of INSTALACIONES) {
    if (!(await prisma.instalacion.findFirst({ where: { nombre: i.nombre } }))) {
      await prisma.instalacion.create({ data: i })
    }
  }

  console.log(`Seed completo. Admin: ${email}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
