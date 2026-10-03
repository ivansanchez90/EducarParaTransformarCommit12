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
