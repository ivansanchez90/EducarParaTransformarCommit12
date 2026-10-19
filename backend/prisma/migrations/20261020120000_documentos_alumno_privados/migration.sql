-- Documentos del legajo en la carpeta privada (no cambia el schema, solo los datos).
-- Hasta ahora `url_archivo` guardaba la URL pública del archivo, con o sin dominio
-- (`https://…/uploads/documentos-alumnos/<archivo>` o `/uploads/documentos-alumnos/<archivo>`).
-- Desde ahora guarda solo el nombre del archivo dentro de `uploads/documentos-alumnos`,
-- que deja de servirse en /uploads y se baja con sesión por la API. Los enlaces a otros
-- sitios (por ejemplo, del bucket de Supabase) quedan como estaban.
UPDATE "documentos_alumno"
SET "url_archivo" = regexp_replace("url_archivo", '^.*/uploads/documentos-alumnos/', '')
WHERE "url_archivo" ~ '/uploads/documentos-alumnos/[^/]+$';
