import fs from 'node:fs'
import path from 'node:path'
import cors from 'cors'
import express from 'express'
import { config } from './lib/config.js'
import { jsonReplacer } from './lib/json.js'
import { errorHandler, notFound } from './middleware/errors.js'
import { UPLOADS_DIR } from './middleware/upload.js'
import { amonestacionesRouter, asistenciasRouter, calificacionesRouter } from './routes/docencia.js'
import { actividadesRouter } from './routes/actividades.js'
import { alumnosRouter } from './routes/alumnos.js'
import { asignacionesRouter, cursosRouter, docentesRouter, horariosRouter, materiasRouter } from './routes/academico.js'
import { authRouter } from './routes/auth.js'
import { becasRouter, comprasRouter, cuotasRouter, sueldosRouter } from './routes/administracion.js'
import { dashboardRouter } from './routes/dashboard.js'
import { notificacionesRouter } from './routes/notificaciones.js'
import { reportesRouter } from './routes/reportes.js'
import { instalacionesRouter, reservasRouter } from './routes/reservas.js'
import { recorridosRouter, serviciosRouter } from './routes/servicios.js'
import {
  empleosRouter,
  galeriaRouter,
  inscripcionesRouter,
  mensajesRouter,
  noticiasRouter,
  postulacionesRouter,
} from './routes/sitio.js'
import { usuariosRouter } from './routes/usuarios.js'

export const app = express()

app.set('json replacer', jsonReplacer)
if (config.corsOrigin.length) app.use(cors({ origin: config.corsOrigin }))
app.use(express.json({ limit: '1mb' }))
app.use('/uploads', express.static(UPLOADS_DIR))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api/auth', authRouter)
app.use('/api/usuarios', usuariosRouter)
app.use('/api/alumnos', alumnosRouter)
app.use('/api/cursos', cursosRouter)
app.use('/api/materias', materiasRouter)
app.use('/api/docentes', docentesRouter)
app.use('/api/asignaciones', asignacionesRouter)
app.use('/api/horarios', horariosRouter)
app.use('/api/calificaciones', calificacionesRouter)
app.use('/api/asistencias', asistenciasRouter)
app.use('/api/amonestaciones', amonestacionesRouter)
app.use('/api/cuotas', cuotasRouter)
app.use('/api/becas', becasRouter)
app.use('/api/sueldos', sueldosRouter)
app.use('/api/compras', comprasRouter)
app.use('/api/actividades', actividadesRouter)
app.use('/api/instalaciones', instalacionesRouter)
app.use('/api/reservas', reservasRouter)
app.use('/api/noticias', noticiasRouter)
app.use('/api/galeria', galeriaRouter)
app.use('/api/empleos', empleosRouter)
app.use('/api/postulaciones', postulacionesRouter)
app.use('/api/inscripciones', inscripcionesRouter)
app.use('/api/mensajes', mensajesRouter)
app.use('/api/notificaciones', notificacionesRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/recorridos', recorridosRouter)
app.use('/api/servicios', serviciosRouter)
app.use('/api/reportes', reportesRouter)

// Frontend (SPA): en producción el backend sirve también el build de React,
// así la app entera vive en un solo contenedor y un solo dominio.
const frontendDir = path.resolve(process.cwd(), config.frontendDir)
if (fs.existsSync(path.join(frontendDir, 'index.html'))) {
  // Archivos con hash en el nombre: cache largo.
  app.use('/assets', express.static(path.join(frontendDir, 'assets'), { immutable: true, maxAge: '1y' }))
  app.use(express.static(frontendDir, { index: false }))
  // Cualquier otra ruta (que no sea de la API ni de archivos) es una ruta de React.
  app.get(/^\/(?!api\/|uploads\/).*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache')
    res.sendFile(path.join(frontendDir, 'index.html'))
  })
}

app.use(notFound)
app.use(errorHandler)
