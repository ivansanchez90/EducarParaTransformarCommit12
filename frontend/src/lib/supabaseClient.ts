/**
 * Cliente Supabase único y compartido por toda la aplicación.
 *
 * Antes se creaba con `createClient(...)` de forma idéntica en cada archivo
 * (AdminPanel, Login, Home, StudentPortal, NoticiaDetalle). Se centraliza aquí
 * para eliminar la duplicación y tener un solo punto de configuración.
 */
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
)
