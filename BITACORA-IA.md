# Bitácora de uso de IA — Grupo 12

Registro de cada uso de IA durante la Parte 3. Es el insumo del apartado 2 del
Informe de uso de IA (entrega del 17/11), así que **se anota en el momento**, en el
mismo PR donde se usó. Lo que sale de acá no se reconstruye de memoria después.

## Cómo se completa

Una fila por consulta que haya influido en el código o en un documento. Si una
consulta se repite varias veces para el mismo problema, es una sola fila que
resume la secuencia.

| Columna | Qué va |
| --- | --- |
| **#** | Número correlativo. |
| **Fecha** | Día de la consulta (`AAAA-MM-DD`). |
| **Tarea / PR** | ID de la tarea del `PLAN-P3.md` (`T03`) y el número del PR cuando exista. |
| **Quién** | Quien hizo la consulta: Iván o Juan Manuel. |
| **Herramienta** | La IA usada (Gemini, Claude Code, etc.). El plan define Gemini en su nivel gratuito como la herramienta del equipo; si se usa otra, se aclara acá. |
| **Problema** | Qué se quería resolver, en una o dos frases. |
| **Prompt** | Lo que se le pidió, resumido o textual. Sin datos personales, contraseñas ni claves. |
| **Respuesta** | Qué devolvió la IA, en resumen. |
| **¿Funcionó?** | Sí, Parcial o No, y por qué. |
| **Qué se cambió** | Qué se corrigió, descartó o reescribió a mano respecto de la respuesta. |
| **Resultado** | Qué quedó en el repo y cómo se verificó (prueba, build, revisión). |

## Registro

| # | Fecha | Tarea / PR | Quién | Herramienta | Problema | Prompt | Respuesta | ¿Funcionó? | Qué se cambió | Resultado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2026-10-03 | T03 | Juan Manuel | Claude Code | El backend no tenía pruebas de la API ni CI: solo había pruebas de fechas y tareas (T02) y ninguna comprobaba el 401/403. | Armar las pruebas con Supertest y un workflow de GitHub Actions con lint, build y test, siguiendo las convenciones del repo y sin errores nuevos de Codacy. | Un workflow con dos jobs (backend y frontend), 24 pruebas de seguridad con Prisma reemplazado por dobles, y las actualizaciones del `PLAN-P3.md`. | Sí, después de corregir un error en los dobles de Prisma. | El primer intento exportaba un `vi.hoisted` desde un archivo de ayudas y falló; se movió el doble a un archivo propio y se firma el token con `jsonwebtoken` directo. El lint del frontend quedó con `continue-on-error` por los 46 errores previos de `main`. | `npm test` pasa 47 pruebas; typecheck y build del backend y `tsc -b` y build del frontend sin errores. La CI en GitHub se confirma en el PR. |
| 2 | 2026-10-03 | T07 | Juan Manuel | Claude Code | La facturación necesita saber qué servicio usó el alumno en cada mes, pero las tablas de inscripción solo guardan el estado actual (una baja borra la fila) y cambiar el modelo podía romper el cupo y el tope de 2 deportes. | Diseñar la vigencia desde/hasta de transporte, comedor y deportes sin romper el tope ni el cupo, con la menor cantidad de cambios sobre lo de Iván. | Comparó dos modelos (columna `fecha_baja` o tabla de historial) y recomendó la tabla de historial; implementó la migración con backfill, un servicio de vigencias, las rutas conectadas dentro de las transacciones y pruebas. | Sí. Se eligió la tabla de historial y la baja desde el mes siguiente, y se probó contra una base real. | Se limitó el backfill y las altas a los deportes, porque la facturación no cobra otras actividades. Se comprobó a mano, contra la API real, que el tope de 2 deportes sigue funcionando; el cupo no se tocó. | Migración sin diferencias con el schema, 29 pruebas, y alta, cambio y baja verificados por HTTP sobre `seed:demo`. |
| 3 | 2026-10-03 | T03 (#27) | Juan Manuel | Claude Code | Codacy marcaba 7 issues en el PR de T03: un action de terceros sin fijar por SHA y el secreto JWT escrito literal en las pruebas. | Corregir los avisos de Codacy sin que el check vuelva a fallar. | Reemplazó el action de pnpm por `corepack`, como el Dockerfile, y sacó los secretos literales de las pruebas: ahora se leen de `JWT_SECRET` y el secreto ajeno se arma a partir de ese valor. | Sí. El check de Codacy quedó en verde. | Nada: la corrección se aplicó tal cual y se volvieron a correr typecheck y pruebas. | PR #27 con los tres checks en verde. |
| 4 | 2026-10-03 | T04 | Juan Manuel | Claude Code | Los pagos aceptaban efectivo y otros métodos, y los comprobantes de transferencia no tenían dónde guardarse sin quedar públicos por URL. | Dejar los pagos solo por transferencia y crear un almacenamiento privado de comprobantes con descarga autenticada. | Dejó `Transferencia` como único método, hizo que `/uploads` sirva solo una lista de carpetas públicas (así `comprobantes` queda privada por construcción) y agregó `GET /api/comprobantes/:id/archivo` con control por rol, más 16 pruebas. | Sí. Se comprobó que la prueba de carpeta privada falla con el código anterior. | Nada en lo funcional. Se aclaró que los archivos de `documentos-alumnos` siguen siendo públicos y quedaron fuera de la tarea. | 69 pruebas en verde, `typecheck` y `build` sin errores. |
