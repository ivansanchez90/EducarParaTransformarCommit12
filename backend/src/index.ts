import { app } from './app.js'
import { config } from './lib/config.js'

app.listen(config.port, (err) => {
  if (err) {
    console.error(`No se pudo iniciar la API en el puerto ${config.port}:`, err.message)
    process.exit(1)
  }
  console.log(`API escuchando en http://localhost:${config.port}`)
})
