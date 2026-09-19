import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { HttpError, bool, fechaObligatoria, lista, numOrNull, textOrNull } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { ROLES_ADMIN, requireAuth, requireRole } from '../middleware/auth.js'
import { Prisma } from '../generated/prisma/client.js'
import { verificarCupoCurso } from './alumnos.js'

export const usuariosRouter = Router()
usuariosRouter.use(requireAuth, requireRole(...ROLES_ADMIN))

usuariosRouter.get('/', async (req, res) => {
  const roles = lista(req.query.rol)
  const usuarios = await prisma.usuario.findMany({
    where: { rol: roles ? { in: roles } : undefined, activo: bool(req.query.activo) },
    orderBy: { apellido: 'asc' },
  })
  res.json(usuarios)
})

interface DatosUsuario {
  email: string
  password: string
  nombre: string
  apellido: string
  rol: string
}

function validarUsuario(body: Record<string, unknown>): DatosUsuario {
  const datos = {
    email: String(body.email ?? '').trim().toLowerCase(),
    password: String(body.password ?? ''),
    nombre: String(body.nombre ?? '').trim(),
    apellido: String(body.apellido ?? '').trim(),
    rol: String(body.rol ?? '').trim(),
  }
  if (!datos.email || !datos.rol) throw new HttpError(400, 'Email y rol son obligatorios')
  if (datos.password.length < 6) throw new HttpError(400, 'La contraseña debe tener al menos 6 caracteres')
  return datos
}

/**
 * Jerarquía: un Directivo no puede crear ni modificar a un Admin u otro
 * Directivo; un Admin puede con todos.
 */
function assertPuedeGestionar(rolActor: string, rolObjetivo: string) {
  if (rolActor === 'Directivo' && ROLES_ADMIN.includes(rolObjetivo)) {
    throw new HttpError(403, 'Un Directivo no puede gestionar usuarios Admin o Directivo')
  }
}

async function crearUsuario(tx: Prisma.TransactionClient, datos: DatosUsuario) {
  const existe = await tx.usuario.findUnique({ where: { email: datos.email }, select: { id_usuario: true } })
  if (existe) throw new HttpError(409, `Ya existe un usuario con el email ${datos.email}`, '23505')
  const usuario = await tx.usuario.create({
    data: {
      email: datos.email,
      password_hash: await bcrypt.hash(datos.password, 10),
      nombre: datos.nombre,
      apellido: datos.apellido,
      rol: datos.rol,
    },
  })
  // Los docentes necesitan su fila en `docentes` para aparecer en el panel.
  if (datos.rol === 'Docente') {
    await tx.docente.create({ data: { id_usuario: usuario.id_usuario, dni: null } })
  }
  return usuario
}

/**
 * Crea un usuario (reemplaza a la Edge Function `crear-usuario`).
 *
 * Si el rol es Padre y viene `alumno`, además crea el usuario del alumno
 * (email `<dni>@alumno.local`, contraseña = DNI) y su registro en `alumnos`
 * vinculado al tutor, todo en una sola transacción.
 */
usuariosRouter.post('/', async (req, res) => {
  const datos = validarUsuario(req.body ?? {})
  assertPuedeGestionar(req.user!.rol, datos.rol)
  const alumno = req.body?.alumno as Record<string, unknown> | undefined

  const resultado = await prisma.$transaction(async (tx) => {
    const usuario = await crearUsuario(tx, datos)
    if (datos.rol !== 'Padre' || !alumno) return { usuario, alumno: null }

    const dni = String(alumno.dni ?? '').trim()
    if (!dni) throw new HttpError(400, 'El DNI del alumno es obligatorio')
    const usuarioAlumno = await crearUsuario(tx, {
      email: `${dni}@alumno.local`,
      password: dni,
      nombre: String(alumno.nombre ?? '').trim(),
      apellido: String(alumno.apellido ?? '').trim(),
      rol: 'Alumno',
    })
    const idCurso = numOrNull(alumno.id_curso)
    await verificarCupoCurso(tx, idCurso)
    const registro = await tx.alumno.create({
      data: {
        nombre: usuarioAlumno.nombre,
        apellido: usuarioAlumno.apellido,
        dni,
        fecha_nacimiento: fechaObligatoria(alumno.fecha_nacimiento, 'fecha de nacimiento del alumno'),
        id_curso: idCurso,
        obra_social: textOrNull(alumno.obra_social),
        id_usuario: usuarioAlumno.id_usuario,
        id_usuario_padre: usuario.id_usuario,
      },
    })
    return { usuario, alumno: registro }
  })

  res.status(201).json(resultado)
})

usuariosRouter.patch('/:id', async (req, res) => {
  const { nombre, apellido, rol, activo } = req.body ?? {}
  if (req.params.id === req.user!.id_usuario && activo === false) {
    throw new HttpError(400, 'No podés desactivar tu propio usuario')
  }
  const objetivo = await prisma.usuario.findUnique({ where: { id_usuario: req.params.id }, select: { rol: true } })
  if (!objetivo) throw new HttpError(404, 'Usuario no encontrado')
  assertPuedeGestionar(req.user!.rol, objetivo.rol)
  if (rol) assertPuedeGestionar(req.user!.rol, rol)
  const usuario = await prisma.usuario.update({
    where: { id_usuario: req.params.id },
    data: {
      nombre: nombre ?? undefined,
      apellido: apellido ?? undefined,
      rol: rol ?? undefined,
      activo: typeof activo === 'boolean' ? activo : undefined,
    },
  })
  res.json(usuario)
})
