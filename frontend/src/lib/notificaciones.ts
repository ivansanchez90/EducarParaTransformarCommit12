/**
 * Notificaciones a las familias.
 *
 * Helper compartido para insertar notificaciones in-app dirigidas al tutor
 * (o al propio alumno) ante eventos del colegio (cuotas, calificaciones,
 * asistencia, comunicados, etc.). Antes estaba duplicado en varios componentes.
 */
import { supabase } from './supabaseClient'

export async function notificarFamilias(
  items: { id_alumno: number; titulo: string; mensaje: string }[],
  tipo: string,
) {
  if (items.length === 0) return
  const ids = [...new Set(items.map((i) => i.id_alumno))]
  const { data: alumnos } = await supabase
    .from('alumnos')
    .select('id_alumno, id_usuario, id_usuario_padre')
    .in('id_alumno', ids)

  const destinoPorAlumno: Record<number, string> = {}
  ;(alumnos ?? []).forEach(
    (a: {
      id_alumno: number
      id_usuario: string | null
      id_usuario_padre: string | null
    }) => {
      const destino = a.id_usuario_padre ?? a.id_usuario
      if (destino) destinoPorAlumno[a.id_alumno] = destino
    },
  )

  const rows = items
    .filter((i) => destinoPorAlumno[i.id_alumno])
    .map((i) => ({
      id_usuario_destino: destinoPorAlumno[i.id_alumno],
      titulo: i.titulo,
      mensaje: i.mensaje,
      tipo,
      leida: false,
    }))

  if (rows.length) {
    await supabase.from('notificaciones').insert(rows)
    // R6 · Email automático: DESACTIVADO a propósito.
    // Esta es una app de muestra y la tabla `usuarios` tiene emails inventados;
    // enviar correos reales podría spamear a desconocidos. La notificación in-app
    // ya quedó guardada arriba, que es lo que se muestra en la defensa.
    // (Para reactivarlo: descomentar la invocación a 'enviar-notificacion' y
    // configurar el allowlist en la Edge Function.)
  }
}
