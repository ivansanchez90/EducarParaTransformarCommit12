# Plan Parte 3 — App móvil de cuotas, comedor, deportes y transporte

Iván Sánchez y Juan Manuel Cantero · iniciado el 29/09/2026

> **Este archivo es el tablero de tareas de la Parte 3.** Al terminar una tarea,
> actualizar en el mismo PR su fila en [Reparto del trabajo](#reparto-del-trabajo),
> agregar una entrada en [Entregas](#entregas) y registrar el uso de IA en
> `BITACORA-IA.md`.

El plan formal (historias, casos de uso, Gantt y PERT) es el documento
entregado a la cátedra: `Plan_Trabajo_Parte3_AppMovil_IA_Grupo12.docx`. Las
tareas de este tablero son las mismas historias (P3-HUxx), agrupadas para
trabajar en paralelo.

**Fechas fijas:** la app tiene que estar terminada el **10/11** (el 11/11 es la
actividad de testing) y el Informe de uso de IA se entrega el **17/11**.

## Diagnóstico

La app móvil es la **PWA** que ya existe (no se hace en React Native). Lo que
falta es casi todo el módulo financiero: hoy una cuota es un monto único por
alumno y mes, solo el admin registra pagos y no hay email ni tareas programadas.

| Aspecto | Estado inicial | Qué falta |
| --- | --- | --- |
| App móvil | PWA instalable con portal familiar, selector de hijo y push (PLAN-PWA T1–T12) | Nada de base; se suman pantallas al portal |
| Autenticación | Login JWT, logout, cambio de contraseña, `requireRole` y `assertAccesoAlumno` | Recuperar la contraseña por email (P3-HU03) |
| Cuotas | `Cuota` con `monto_base`, recargo y descuento; `@@unique([id_alumno, mes, anio])`; vence el día 10 | Factura con ítems por concepto, saldo y pagos parciales |
| Precios | Un `monto_base` único al generar las cuotas del mes | Tarifa por nivel, por deporte, por recorrido y de comedor, con vigencia |
| Pagos | `Pago` con `nro_comprobante` de texto, solo lo carga el admin; "Efectivo" es el método por defecto | Solo transferencia; el padre sube los comprobantes (varios por factura) y el admin los valida |
| Inscripciones | Tope de 2 deportes, 1 recorrido con cupo y comedor; `InscripcionTransporte` es una fila única por alumno | Vigencia desde/hasta para facturar lo que se usó cada mes |
| Email | No hay (la Edge Function de Supabase no se migró) | nodemailer con Gmail |
| Tareas programadas | No hay; los vencimientos se procesan con un botón | node-cron: último día hábil y día 20 |
| Archivos | `multer` en `backend/uploads/<bucket>`, **públicos por URL** | Bucket privado para comprobantes, descarga con sesión |
| PDF | `pdfkit` solo en reportes (`lib/documentos.ts`) | PDF de factura y de comprobante de pago |
| Reportes | 5 reportes académicos y de servicios, sin datos de pagos | Los 5 listados financieros de la consigna |
| Calidad | Sin tests ni CI (solo lint) | Vitest + Supertest y GitHub Actions |

## Decisiones técnicas

| Tema | Decisión | Motivo |
| --- | --- | --- |
| App móvil | La misma PWA; las pantallas nuevas van en el portal (`/portal`) y usan `ResponsiveTable` | Una sola API y una sola base: no hay datos duplicados ni sincronización |
| Factura | `Factura` por alumno y período con `ItemFactura` por concepto (Cuota, Deporte, Transporte, Comedor, Beca) | La consigna pide la composición del total y la deuda por ítem |
| Cálculo de ítems | Patrón **Strategy**: una estrategia por concepto (`services/facturacion/`) | Agregar un concepto no cambia el servicio de facturación |
| Precios | `Tarifa` (concepto, referencia, importe, `vigente_desde`) | Un cambio de precio no altera facturas ya emitidas |
| Servicios por mes | Vigencia desde/hasta en transporte, comedor y deportes | El transporte puede cambiar de un mes a otro |
| Pagos | Solo `Transferencia`. El padre elige ítems → el sistema emite un **comprobante de pago** (`OrdenPago`) → el padre sube la **transferencia** (`ComprobanteTransferencia`) → el admin la aprueba y se crea el `Pago` imputado a los ítems | Cumple "el padre selecciona ítems" y "una factura puede tener varios comprobantes" |
| Estado de la factura | Se calcula por saldo: Pendiente, Pago parcial, Pagada, Vencida | Permite los listados de pagos completos e incompletos |
| Avisos | Patrón **Observer** (ya usado): eventos `FacturaEmitida`, `ComprobanteValidado`, `DeudaDetectada`; se suma `EmailObserver` a in-app y push | Un canal que falla no revierte la operación |
| Email | nodemailer con **Gmail** (`smtp.gmail.com`, puerto 465, SSL) y una **contraseña de aplicación** (requiere verificación en dos pasos en la cuenta). Variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Gratis y sin dominio propio. Sin claves, el envío queda apagado y la app funciona igual (como el push) |
| Datos bancarios | El comprobante de pago y los emails indican transferir al alias **`sanchezoliva`**. Va en la variable `BANCO_ALIAS`, no en el código | Si cambia la cuenta, se cambia en Coolify sin tocar código |
| Tareas programadas | node-cron dentro del backend, zona `America/Argentina/Buenos_Aires`, tabla de feriados; cada envío queda en `EnvioEmail` | Un reinicio o una segunda ejecución no reenvía |
| Archivos | Comprobantes en `uploads/comprobantes` **fuera** del estático `/uploads`; se descargan por la API con sesión y pertenencia | Son datos personales y bancarios |
| Herramienta de IA | API de Gemini, nivel gratuito (Google AI Studio) | Decisión del equipo; sin datos personales ni claves en los prompts |

## Reparto del trabajo

Se mantiene la idea del plan PWA: cada uno es dueño de archivos distintos. **Iván**
se queda con el núcleo financiero del backend (modelo, facturación, email, tareas
programadas, validación de pagos) y las pantallas del admin. **Juan Manuel** se
queda con lo que usan las familias (endpoints del portal y pantallas de la app),
las inscripciones con vigencia, los reportes financieros y las pruebas/CI.

Estados: Pendiente · En curso · En revisión · Hecho.

| Tarea | HU | Sprint | Responsable | Depende de | Estimación | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| T01. Modelo de datos financiero: `Tarifa`, `Factura`, `ItemFactura`, `OrdenPago`, `ComprobanteTransferencia`, `Pago` ligado a factura e ítems, `EnvioEmail`, `TokenRecuperacion`; migración de las cuotas existentes | — | 0 | Iván | — | 2 días | Hecho |
| T02. Email (nodemailer + Gmail con contraseña de aplicación) y tareas programadas (node-cron, feriados, `ultimoDiaHabil()` con pruebas) | — | 0 | Iván | — | 1,5 días | Hecho |
| T03. Pruebas y CI: Vitest + Supertest en `backend/`, GitHub Actions con lint, build y test | — | 0 | Juan Manuel | — | 1 día | Hecho |
| T04. Quitar "Efectivo" (backend, `constants`, `RegistrarPagos`) y bucket privado de comprobantes con descarga autenticada | — | 0 | Juan Manuel | — | 1 día | Hecho |
| T05. `BITACORA-IA.md` con la plantilla de la consigna | — | 0 | Juan Manuel | — | 0,5 días | Hecho |
| T06. Tarifas: ABM por concepto con vigencia y pantalla admin; horario y profesor del deporte (deuda de la Parte 2) | HU04–HU07 | 1 | Iván | T01 | 2,5 días | Hecho |
| T07. Inscripciones con vigencia (transporte, comedor, deportes) sin romper el tope de 2 ni el cupo | HU08 | 1 | Juan Manuel | T01 | 2 días | Hecho |
| T08. Facturación mensual con Strategy, becas, PDF de la factura y botón "Generar facturas" | HU09 | 1 | Iván | T06, T07 | 3 días | Hecho |
| T09. Login/logout en la PWA instalada y pruebas 401/403 de los endpoints nuevos | HU01 | 1 | Iván | T03 | 0,5 días | Hecho |
| T10. Cambio de contraseña en la PWA y su prueba automática | HU02 | 1 | Juan Manuel | T03 | 0,5 días | Hecho |
| T11. Portal: cuotas pendientes y pagadas, e historial de pagos | HU10, HU11 | 2 | Juan Manuel | T08 | 2 días | Hecho |
| T12. Portal: elegir ítems y emitir el comprobante de pago (PDF con datos bancarios) | HU12 | 2 | Juan Manuel | T08 | 2,5 días | Pendiente |
| T13. Portal: subir comprobantes de transferencia (foto o PDF, varios por factura) | HU13 | 2 | Juan Manuel | T04, T08 | 1,5 días | Pendiente |
| T14. Admin: bandeja de comprobantes, aprobar/rechazar, imputación, saldo (`services/saldos.ts`) y `EmailObserver` | HU14 | 2 | Iván | T02, T13 (contrato) | 2,5 días | En revisión |
| T15. Portal: facturas y comprobantes por rango de fechas | HU15 | 3 | Juan Manuel | T13 | 1,5 días | Pendiente |
| T16. Portal: deuda por ítem | HU16 | 3 | Juan Manuel | T14 | 1,5 días | Pendiente |
| T17. Email del último día hábil con la composición y la factura adjunta | HU17 | 3 | Iván | T02, T08 | 2,5 días | Pendiente |
| T18. Email del día 20 con la deuda (más in-app y push) | HU18 | 3 | Iván | T14 | 1,5 días | Pendiente |
| T19. Portal: precio de cada servicio en "Transporte y comedor" y "Extracurriculares" | HU24 | 3 | Juan Manuel | T06 | 0,5 días | Hecho |
| T20. Recuperar la contraseña por email | HU03 | 4 | Iván | T02 | 1,5 días | Pendiente |
| T21. Reportes: ingresos por período, pagos completos e incompletos por año y alumno (PDF y CSV) | HU19–HU21 | 4 | Juan Manuel | T14 | 2 días | Pendiente |
| T22. Reportes: pagos por deporte/nivel/horario/profesor y por recorrido | HU22, HU23 | 4 | Iván | T06, T21 | 1,5 días | Pendiente |
| T23. Pruebas integrales con `seed:demo` ampliado (tarifas, facturas, pagos) y en teléfonos reales | — | 4 | Los dos | T01–T22 | 1,5 días | Pendiente |
| T24. Testing del 11/11 y corrección de defectos | — | 5 | Los dos | T23 | 3 días | Pendiente |
| T25. Informe de uso de IA: apartados 1 y 4 (Iván), 3 y 5 (Juan Manuel), 2 bitácora (los dos) | — | 5 | Los dos | T05 | 2 días | Pendiente |

**Sprints:** 0 = 29/09–02/10 · 1 = 05/10–14/10 (12/10 feriado) · 2 = 15/10–23/10 ·
3 = 26/10–03/11 · 4 = 04/11–10/11 · 5 = 11/11–17/11.

**Carga:** Iván 52 puntos y Juan Manuel 48 (según el backlog del plan entregado).

### Contratos para trabajar en paralelo

Juan Manuel puede arrancar las pantallas del portal (T11–T13) antes de que T08 y
T14 estén mergeadas si los dos respetan estos contratos. Si alguno cambia, se
avisa y se actualiza esta sección en el mismo PR.

**Modelos** (T01, Iván; nombres de tabla en snake_case como el resto del schema):

```text
Tarifa             { id_tarifa, concepto: 'Cuota'|'Deporte'|'Transporte'|'Comedor',
                     nivel?, id_referencia?, importe, vigente_desde }
                     // nivel: nivel educativo del curso (Cuota; en la base es texto, no hay tabla de niveles)
                     // id_referencia: id de la actividad (Deporte) o del recorrido (Transporte)
Factura            { id_factura, id_alumno, anio, mes, numero, fecha_emision, fecha_vencimiento,
                     total, saldo, estado: 'Pendiente'|'Pago parcial'|'Pagada'|'Vencida' }
                     // @@unique([id_alumno, anio, mes]); numero lo asigna la base (serial)
ItemFactura        { id_item, id_factura, concepto: 'Cuota'|'Deporte'|'Transporte'|'Comedor'|'Recargo'|'Beca',
                     id_referencia?, descripcion, importe, saldo }
                     // Beca con importe negativo; Recargo solo si hay recargo por mora
OrdenPago          { id_orden, id_factura, numero, fecha, total, id_usuario?, items: OrdenPagoItem[] }
                     // el "comprobante de pago" que emite el sistema
OrdenPagoItem      { id_orden, id_item, importe }   // saldo del ítem al emitir la orden
ComprobanteTransferencia { id_comprobante, id_factura, id_orden?, archivo, importe,
                     fecha_transferencia, estado: 'En revisión'|'Aprobado'|'Rechazado',
                     motivo_rechazo?, id_usuario_carga, fecha_carga,
                     id_usuario_revisa?, fecha_revision? }
Pago               { ..., id_factura, id_comprobante (único), metodo_pago: 'Transferencia' }
ImputacionPago     { id_imputacion, id_pago, id_item, importe }
                     // a qué ítems se aplicó el pago: los de la orden, o los más viejos primero
EnvioEmail         { id_envio, tipo, anio, mes, id_usuario, email, estado, intentos, error?, enviado_at? }
                     // @@unique([tipo, anio, mes, id_usuario]): un email por familia y período
TokenRecuperacion  { id_token, id_usuario, token_hash, expira_at, usado_at? }
```

Invariantes que mantienen T08 y T14: `factura.total = Σ ítems.importe`,
`ítem.saldo = importe − Σ imputaciones del ítem` y `factura.saldo = Σ ítems.saldo`.

**Endpoints de familias** (Juan Manuel, en `backend/src/routes/portalFinanzas.ts`; todos
con `requireAuth` + `assertAccesoAlumno`):

- `GET /api/alumnos/:id/facturas?desde=&hasta=&estado=` → facturas con `items` y `comprobantes`.
- `GET /api/alumnos/:id/pagos` → pagos aprobados con su factura.
- `GET /api/alumnos/:id/deuda` → saldo por ítem y período: devolver `deudaAlumno(id)` de `services/saldos.ts` (T14), que da `{ total, facturas: [{ numero, anio, mes, fecha_vencimiento, total, saldo, estado, items: [{ concepto, descripcion, importe, saldo }] }] }` con solo las facturas e ítems que deben algo (la beca pendiente va en negativo).
- `POST /api/facturas/:id/ordenes-pago` con `{ items: number[] }` → 201 con la orden; `GET /api/ordenes-pago/:id/pdf` (el PDF muestra el alias de `BANCO_ALIAS`).
- `POST /api/facturas/:id/comprobantes` (multipart: `archivo`, `importe`, `fecha_transferencia`, `id_orden?`) → 201 en `En revisión`. En `archivo` se guarda solo el nombre del archivo dentro del bucket privado `comprobantes` (es lo que lee la descarga de T04 y muestra la bandeja de T14), y `id_usuario_carga` es quien lo sube.
- `GET /api/comprobantes/:id/archivo` → descarga con sesión (familia dueña o admin).
- `GET /api/facturas/:id/pdf` → PDF de la factura (lo genera T08; la ruta la expone Iván).

**Endpoints de administración** (Iván; `requireRole(ROLES_ADMIN)`):

- `GET|POST|PUT /api/tarifas` (con `?concepto=`; cada tarifa trae `referencia`, el nombre de lo que se cobra, y `estado`: Vigente, Programada o Anterior), `DELETE /api/tarifas/:id` y `GET /api/tarifas/opciones` (niveles, deportes, recorridos y lo que no tiene precio vigente). Solo se editan o borran las tarifas programadas.
- Para leer precios desde otro módulo (T08, T19): `tarifasVigentes(fecha)` y `claveTarifa()` de `services/tarifas.ts`.
- `GET /api/actividades` suma `docentes` (profesor) y `horarios` (`dia_semana`, `hora_inicio`, `hora_fin`); `POST|PUT /api/actividades` aceptan `id_docente` y `horarios` (sin `horarios`, el PUT no los toca).
- `POST /api/facturas/generar` con `{ anio, mes }` → `{ generadas, omitidas, errores[] }`; `GET /api/facturas?anio=&mes=&estado=` → facturas del mes con `items`, `alumnos` y el `estado` calculado.
- El estado de una factura se calcula al leerla con `estadoFactura()` de `services/facturacion/estado.ts` (saldo y vencimiento); T11, T14 y T18 lo reutilizan.
- `GET /api/comprobantes?estado=En revisión` (o varios: `?estado=Aprobado,Rechazado`) → comprobantes con `facturas` (y su alumno), `ordenes_pago`, `carga`, `revision` y `pagos`; `PATCH /api/comprobantes/:id/aprobar` con `{ importe }` → `{ estado, factura: { saldo, estado } }`; `PATCH /api/comprobantes/:id/rechazar` con `{ motivo }`. Un comprobante ya revisado da 409.
- Todo pago pasa por `aplicarPago(tx, …)` de `services/saldos.ts` (crea el `Pago`, lo imputa y recalcula los saldos). El `fecha_pago` de un pago aprobado es la **fecha de la transferencia** (a las 12 h de Argentina), no la de la aprobación: es la que usan los reportes de ingresos (T21).
- Avisos a las familias: `publicar(evento)` de `services/avisos/index.js` (patrón Observer; hoy, el evento `ComprobanteValidado`). T17 y T18 suman sus eventos en `services/avisos/eventos.ts`.
- `POST /api/tareas/recordatorio-mensual` y `POST /api/tareas/aviso-deuda` con `{ anio, mes }`: ejecutan a mano lo mismo que el cron (para probar).
- `POST /api/auth/recuperar` `{ email }` y `POST /api/auth/restablecer` `{ token, password }` (T20).

**Reportes** (en `backend/src/routes/reportesFinancieros.ts` y una opción nueva por reporte en
`GestionReportes.tsx`; mismo formato `Documento` para PDF/CSV):
`/api/reportes/ingresos`, `/pagos-completos`, `/pagos-incompletos` (Juan Manuel, T21) y
`/pagos-por-deporte`, `/pagos-por-recorrido` (Iván, T22, después de T21).

### Reglas para trabajar en paralelo

- **Archivos con dueño.**
  - **Iván:** `backend/prisma/schema.prisma` y las migraciones, `services/facturacion/`, `services/saldos.ts`, `services/email.ts`, `jobs/`, `routes/tarifas.ts`, `routes/facturas.ts`, `routes/comprobantes.ts`, `routes/auth.ts`, las pantallas nuevas del admin (Tarifas, Comprobantes, Facturación) y `AdminPanel.tsx`.
  - **Juan Manuel:** `routes/portalFinanzas.ts`, `routes/servicios.ts` y `routes/actividades.ts` (vigencias), `routes/reportesFinancieros.ts`, `GestionReportes.tsx`, `StudentPortal.tsx`, `ui/`, los tests y `.github/`.
  - Si uno necesita tocar un archivo del otro, lo avisa y hace un PR chico aparte.
- **Un solo dueño del schema.** Todo cambio a `schema.prisma` lo hace Iván (o lo revisa antes de mergear), para no generar dos migraciones que choquen.
- **Una rama por tarea:** `feat/p3-t01-modelo-financiero`, `feat/p3-t12-orden-pago`, etc. PR a `main` al terminar cada tarea.
- **Revisión cruzada:** cada PR lo revisa y aprueba el otro. Nadie mergea su propio PR sin esa aprobación.
- **Traer `main` seguido:** `git pull origin main` todos los días.
- **Uso de IA:** cada PR que usó Gemini suma sus filas en `BITACORA-IA.md` (problema, prompt, respuesta, si funcionó, qué se cambió y resultado). Es lo que se evalúa el 17/11, así que se anota en el momento.
- **Definición de hecho:** cumple los criterios de aceptación de la HU; reglas probadas en el backend (no solo en la pantalla); pruebas de 401/403 y de pertenencia padre–hijo; importes verificados (total = suma de ítems, saldo = total − pagos aprobados); la pantalla funciona a 375 px; CI en verde; PR aprobado y mergeado; bitácora actualizada.

## Entregas

_Al cerrar cada tarea, agregar una entrada con el mismo formato que en `PLAN-PWA.md`: qué quedó, qué se verificó y qué falta._

### T01 — Modelo de datos financiero (Iván): hecho, mergeado en el PR #24

- **Qué quedó:** en `backend/prisma/schema.prisma`, los modelos `Tarifa`, `Factura`, `ItemFactura`, `OrdenPago`, `OrdenPagoItem`, `ComprobanteTransferencia`, `ImputacionPago`, `EnvioEmail` y `TokenRecuperacion`, y `Pago` con `id_factura` e `id_comprobante`. La migración `20261002120000_modelo_financiero` crea las tablas y pasa cada cuota existente a una factura del mismo alumno y período: ítem *Cuota*, ítem *Recargo* si tenía recargo e ítem *Beca* negativo si tenía descuento. Los pagos quedan ligados a su factura e imputados a los ítems. La tabla `cuotas` no se borra.
- **Cambios al contrato** (ya actualizados arriba): la tarifa de la cuota se identifica por `nivel` (texto), porque no existe una tabla de niveles. Se suma el concepto *Recargo* para no perder los recargos de las cuotas vencidas. La orden y la imputación tienen tablas propias (`OrdenPagoItem`, `ImputacionPago`).
- **Verificado:** sobre una base con `seed:demo`, la migración pasa las 984 cuotas a 984 facturas con 1165 ítems. Se cumplen los tres invariantes en todas las facturas, cada pago suma lo mismo que sus imputaciones y `prisma migrate diff` no encuentra diferencias con el schema. `typecheck` sin errores y `seed:demo` corre igual con el schema nuevo.
- **Falta:** respaldar la base de producción antes de desplegar. Hasta que T08 y T14 reemplacen las pantallas, "Generar cuotas" y "Registrar pago" siguen escribiendo solo en `cuotas` y no actualizan las facturas. Conviene no usarlas en producción en ese tiempo, o regenerar las facturas del mes con T08.

### T07 — Inscripciones con vigencia (Juan Manuel): hecho, mergeado en el PR #29

- **Qué quedó:** la migración `20261003134629_vigencias_servicio` crea la tabla `vigencias_servicio` (modelo `VigenciaServicio`): una fila por alumno, concepto (`Deporte`, `Transporte` o `Comedor`) y referencia (la actividad o el recorrido; vacía en Comedor), con `desde` y `hasta` (vacío mientras sigue vigente). No toca ninguna tabla existente: las inscripciones siguen mandando para el cupo, el tope de 2 deportes y los listados. `services/vigencias.ts` tiene `abrirVigencia`, `cerrarVigencia` y `cambiarVigencia`, que las rutas llaman dentro de la misma transacción que la inscripción (`routes/actividades.ts` y `routes/servicios.ts`): el alta abre una vigencia, la baja la cierra con la fecha de la baja y cambiar de recorrido cierra la anterior y abre la nueva. Solo los deportes llevan vigencia, porque es lo único que se factura. La migración deja vigente, desde su fecha de inscripción, todo lo que ya estaba inscripto.
- **Regla de la baja:** rige desde el mes siguiente. Si se da de baja durante noviembre, noviembre se cobra completo y diciembre no; es lo que ya hace `vigenteEnPeriodo()` de T08 (`hasta >= inicio del mes`). Un cambio de recorrido a mitad de mes deja dos vigencias que tocan ese mes; la facturación tiene que quedarse con la más reciente.
- **Pruebas:** 6 nuevas en `test/vigencias.test.ts` (29 en total), con una transacción falsa: abre desde la fecha dada, no duplica una vigencia abierta, cierra solo la de esa actividad o todas las del concepto, y el cambio cierra y abre en el mismo instante.
- **Verificado:** `typecheck` y `build` del backend sin errores, y `prisma migrate diff` sin diferencias con el schema. Sobre una base descartable con `seed:demo`, el backfill deja 89 deportes, 62 de transporte y 49 de comedor (una por inscripción) y el seed genera las mismas. Con la API real: alta, mismo recorrido con observaciones (sin duplicar), cambio, baja de transporte, alta repetida y baja de comedor, y alta y baja de un deporte y de un idioma (el idioma no genera vigencia). Un alta rechazada por el tope o por duplicada no deja vigencias de más, el tope de 2 deportes sigue funcionando y al final las vigencias abiertas coinciden con las inscripciones.
- **Falta:** que `alumnosFacturables()` de T08 (`services/facturacion/generar.ts`) lea de `vigencias_servicio` en lugar de `fecha_inscripcion`: hasta entonces la facturación sigue como está y no se rompe nada. Rechazar la inscripción a un deporte cuyo horario choca con otro del alumno (HU 2 de `PENDIENTES.md`) queda para un PR aparte. Después de traer esta rama hay que correr `npm run db:sync` en `backend/` para aplicar la migración.

### T05 — Bitácora de IA (Juan Manuel): hecho, mergeado en el PR #28

- **Qué quedó:** `BITACORA-IA.md` en la raíz, con las columnas que pide el plan (problema, prompt, respuesta, si funcionó, qué se cambió y resultado) más número, fecha, tarea o PR, quién y herramienta. Incluye cómo completar cada columna y la primera fila, la de T03. Desde ahora cada PR que use IA suma sus filas ahí, en el mismo PR.
- **Verificado:** se revisó que el archivo no tenga datos personales ni claves. Falta mirarlo en la vista previa del PR, para ver que las tablas se muestren bien.
- **Falta:** confirmar con la consigna de la cátedra si la plantilla oficial pide otras columnas; si las pide, se agregan acá. Iván completa sus filas desde su próximo PR.

### T10 — Cambio de contraseña en la PWA (Juan Manuel): hecho, mergeado en el PR #31

- **Qué quedó:** el cambio ya existía y no hizo falta tocarlo: el diálogo `features/cuenta/CambiarPassword.tsx` (contraseña actual, nueva y repetición; deshabilitado sin conexión) se abre con *Mi contraseña* desde el menú del avatar del panel (Admin, Directivo y Docente) y del portal de familias, y llama a `POST /api/auth/password`, que pide la actual, exige al menos 6 caracteres y una distinta de la actual, y guarda el hash con bcrypt. Lo que faltaba era su prueba automática: `test/password.test.ts` (15 pruebas).
- **Pruebas:** sin sesión es 401 y un usuario desactivado es 403; los cinco casos de 400 (nueva corta o ausente, igual a la actual, actual incorrecta o ausente) no modifican nada; los cinco roles pueden cambiarla; solo se guarda el hash de la nueva, para el usuario de la sesión (aunque el cuerpo traiga el id de otro); y la respuesta no filtra ningún hash. Total: 68 pruebas.
- **Verificado:** `typecheck` sin errores. Quitando la regla "distinta de la actual", o guardando la contraseña sin hash, las pruebas fallan. Con la API real sobre `seed:demo`: la nueva corta, la igual y la actual incorrecta devuelven 400; el cambio correcto devuelve 200; después la contraseña vieja da 401 y la nueva 200, el mismo token sigue valiendo y la base guarda el hash (`$2b$`), no el texto.
- **Falta:** no se probó el diálogo en un teléfono real ni a 375 px, porque no se modificó; queda para la prueba integral (T23). El cambio no cierra las sesiones abiertas en otros dispositivos.

### T19 — Precio de cada servicio en el portal (Juan Manuel): hecho, mergeado en el PR #33

- **Qué quedó:** la familia ve el precio mensual vigente de cada servicio. `services/precios.ts` (`preciosVigentes()`) lee las tarifas que rigen hoy con `tarifasVigentes()` de T06 y devuelve el precio de cada servicio, o `null` si todavía no hay una cargada; una tarifa programada para más adelante no cuenta hasta su fecha. `GET /api/actividades` suma `precio` (solo en los deportes; los idiomas no se cobran aparte, así que traen `null`), `GET /api/recorridos` suma `precio`, y `GET /api/servicios/:idAlumno` suma `precio_transporte` (el del recorrido que usa el alumno, aunque el recorrido ya no esté activo) y `precio_comedor`. En el portal, el componente `PrecioMensual` (`ui/components.tsx`) se muestra en las tarjetas de *Extracurriculares* (deportes) y de *Transporte y comedor* (comedor, recorrido actual y cada recorrido disponible); sin tarifa dice "Precio a confirmar".
- **Pruebas:** 7 nuevas en `test/precios.test.ts` (91 en total): precio de deportes y recorridos con y sin tarifa, un idioma sin precio aunque exista una tarifa con su id, precios del alumno (recorrido y comedor), `null` sin transporte o sin tarifa, que solo se pidan tarifas hasta hoy, y 403 para una familia ajena.
- **Verificado:** `typecheck` y `build` del backend, y `tsc -b` y `build` del frontend, sin errores. El lint del frontend sigue en los 46 errores de `main`, ninguno nuevo. Quitando la condición de "solo deportes" o la fecha de hoy, las pruebas fallan. Con la API real sobre `seed:demo` y cuatro tarifas cargadas por SQL: el deporte con tarifa trae 12500 y los demás `null`, el recorrido con tarifa trae 8000, el que solo tiene una tarifa de 2027 trae `null`, y el comedor trae 15000.
- **Falta:** no se pudo mirar la pantalla en un teléfono ni a 375 px (la extensión del navegador no estaba conectada); queda para la prueba integral (T23). El precio es el mensual de la tarifa; no se suma a ninguna factura, de eso se encarga T08. Las tarifas reales se cargan desde *Tarifas*.

### T02 — Email y tareas programadas (Iván): hecho, mergeado en el PR #25

- **Qué quedó:** `backend/src/services/email.ts` (`enviarEmail` con nodemailer por el SMTP de Gmail, con adjuntos). Sin `SMTP_USER` y `SMTP_PASS` el envío queda apagado, como el push. Al arrancar se prueba el login con Gmail y, si falla, queda en el log sin tumbar la API. `backend/src/jobs/calendario.ts` tiene la tabla de feriados y días no laborables turísticos de 2026 y 2027, `esDiaHabil`, `ultimoDiaHabil` y `diaEnZona`, que da el día de Argentina y no el de UTC. `backend/src/jobs/index.ts` es el programador con node-cron en hora de Argentina: cada tarea tiene una condición `corresponde` (por ejemplo, `esUltimoDiaHabil`), no se superpone consigo misma y sus errores no tumban el backend. Variables nuevas en `.env.example` y en el README.
- **Pruebas:** `npm test` (Vitest, `backend/test/`) corre 23 pruebas: el último día hábil de los 12 meses de 2026 calculado a mano, feriados al final del mes, años bisiestos, feriados trasladados, el cambio de día entre Argentina y UTC, y que una tarea no se ejecuta si no corresponde ni propaga sus errores. Vitest quedó instalado con `vitest.config.ts`; T03 suma Supertest y la CI sobre esta base.
- **Verificado:** `typecheck` sin errores. La API arranca sin claves de email (envío apagado) y con una contraseña inválida (Gmail la rechaza, sale en el log y la API sigue). Un cron real de prueba se ejecuta cada segundo con el día de Argentina.
- **Falta:** crear la contraseña de aplicación en la cuenta que va a enviar, definir `MAIL_FROM` y cargarlos en Coolify. Agregar los días no laborables turísticos de 2027 cuando se publiquen. Las tareas concretas (emails del último día hábil y del día 20) se suman en T17 y T18.

### T04 — Sin efectivo y comprobantes privados (Juan Manuel): hecho, mergeado en el PR #30

- **Qué quedó:** los pagos aceptan solo `Transferencia`: `PATCH /api/cuotas/:id/pago` responde 400 con cualquier otro método (`routes/administracion.ts`), `constants` y `RegistrarPagos` ofrecen solo esa opción y el `seed:demo` ya no genera pagos en efectivo. Los pagos anteriores conservan su método, porque no se reescribe la historia. Los comprobantes de transferencia tienen una carpeta privada, `uploads/comprobantes/` (el bucket `comprobantes` de `middleware/upload.ts`): `/uploads` ahora sirve solo los buckets de una lista (`galeria`, `noticias`, `documentos-alumnos`), así que una carpeta nueva nace privada. En la base se guarda solo el nombre del archivo (`ComprobanteTransferencia.archivo`), y `rutaArchivoPrivado()` rechaza nombres que salgan de la carpeta. La descarga es `GET /api/comprobantes/:id/archivo` (`routes/portalFinanzas.ts`): la ve la administración o la familia del alumno de la factura; el Docente y otra familia reciben 403, y la respuesta lleva `Cache-Control: private, no-store`.
- **Pruebas:** 16 nuevas en `test/comprobantes.test.ts` (63 en total): el archivo no se abre por `/uploads`, las carpetas públicas siguen funcionando, la descarga por rol (401, 403 y 200), comprobante inexistente, id inválido, nombre con `../`, archivo ausente del disco, y que ningún método distinto de transferencia se acepta.
- **Verificado:** `typecheck` y `build` del backend, y `tsc -b` y `build` del frontend, sin errores. El lint del frontend sigue en los 46 errores de `main`, sin ninguno nuevo.
- **Falta:** el endpoint de subida (T13) usará el bucket `comprobantes` y deberá limitar el tipo de archivo a foto o PDF. Los archivos de `documentos-alumnos` siguen siendo públicos por URL; no son comprobantes y quedan fuera de esta tarea. En producción, `uploads/` ya es el volumen persistente (`/app/uploads`), así que no hace falta configurar nada más.

### T11 — Portal: facturas y pagos (Juan Manuel): hecho, mergeado en el PR #35

- **Qué quedó:** la pestaña *Cuotas* del portal muestra las facturas del alumno en lugar de la tabla vieja `cuotas`. Cada factura trae su estado (Pendiente, Pago parcial, Pagada o Vencida, calculado con `estadoFactura()` de T08), el vencimiento, el total, el saldo, el detalle de ítems, el estado de sus comprobantes de transferencia y la descarga del PDF; primero van las que tienen saldo, con un aviso del total adeudado, y las pagadas se ven aparte. Una segunda vista muestra el historial de pagos. Backend, en `routes/portalFinanzas.ts`: `GET /api/alumnos/:id/facturas` (con `?estado=` opcional) y `GET /api/alumnos/:id/pagos`. Los datos de pagos los ve la administración o la familia del alumno; los docentes y otras familias reciben 403, y la descarga del comprobante de T04 usa la misma regla. El historial junta los pagos aprobados desde una factura y los que la administración registró sobre una cuota anterior. Frontend, en la carpeta nueva `features/finanzas/` (`useFinanzas`, `FinanzasAlumno`, `FacturasAlumno`, `HistorialPagos`, `types.ts` y `formato.ts`): los tipos están ahí y no en `types/index.ts` para no chocar con otras ramas. El menú, la tarjeta de inicio y la barra inferior cuentan las facturas con saldo.
- **Pruebas:** 22 nuevas en `test/portalFinanzas.test.ts` (126 en total): 401, 403 a familia ajena y a docentes, acceso de Admin, Directivo y la familia del alumno, id inválido, el estado de las cuatro situaciones, el filtro por estado, que la consulta use el alumno de la URL y el orden, que los comprobantes no traigan el nombre del archivo, y el historial de facturas y de cuotas anteriores.
- **Verificado:** `typecheck` y `build` del backend, y `tsc -b` y `build` del frontend, sin errores; el lint del frontend sigue en los 46 errores de `main`, ninguno nuevo. Quitando el bloqueo a docentes, el filtro por alumno o el cálculo del estado, las pruebas fallan. Con la API real sobre `seed:demo`, con tarifas cargadas y las facturas de septiembre y octubre generadas con el motor de T08 (116 cada mes) y un pago parcial por SQL: la familia ve su factura de octubre en *Pago parcial* (saldo 70.000 de 90.000) y la de septiembre *Vencida*, el filtro por estado funciona, el historial trae el pago nuevo y los de cuotas anteriores, el docente y otra familia reciben 403, sin sesión es 401 y el PDF baja (200).
- **Falta:** no se pudo mirar la pantalla en un teléfono ni a 375 px (la extensión del navegador no estaba conectada); queda para la prueba integral (T23). Elegir ítems y emitir la orden de pago es T12, y subir comprobantes es T13. Los pagos que se registran desde la pantalla vieja *Registrar pagos* siguen escribiendo en `cuotas` hasta T14, por lo que no actualizan el saldo de las facturas.

### T03 — Pruebas y CI (Juan Manuel): hecho, mergeado en el PR #27

- **Qué quedó:** Supertest en `backend/` y `.github/workflows/ci.yml`, que corre en cada PR a `main` y en cada push a `main`. Backend: `prisma generate`, `typecheck`, `build` y `npm test`. Frontend: `tsc -b`, `build` y `lint`. Node 22 y pnpm 10.29.3, como el `Dockerfile`. `test/seguridad.test.ts` prueba la API real (`app`) sin base de datos: `test/ayudas.ts` reemplaza a Prisma por dobles y firma los tokens con el secreto de `vitest.config.ts`. Cubre `GET /api/health`, el 404 de la API, el 401 (sin token, token inválido, firmado con otro secreto, vencido y de un usuario inexistente), el 403 (usuario desactivado; Padre, Alumno y Docente en las rutas de administración) y la pertenencia padre–hijo en `GET /api/alumnos/:id`. Para sumar un caso, agregar la ruta a `RUTAS_CON_SESION` o `RUTAS_DE_ADMIN`.
- **Verificado:** `npm test` corre 47 pruebas (23 de T02 y 24 nuevas); `typecheck` y `build` del backend, y `tsc -b`, `build` y `pnpm install --frozen-lockfile` del frontend, sin errores.
- **Falta:** el `lint` del frontend no frena el PR (`continue-on-error`) porque `main` tiene 46 errores anteriores a la Parte 3; cuando se limpien, se saca esa línea. En GitHub: Settings → Branches → exigir los checks `Backend` y `Frontend` para mergear a `main`. Las pruebas con base real (facturación, pagos) pueden sumar un servicio Postgres al job cuando haga falta.

### T06 — Tarifas, horario y profesor del deporte (Iván): hecho, mergeado en el PR #26

- **Qué quedó:** `backend/src/routes/tarifas.ts` y `services/tarifas.ts`, y la pantalla *Tarifas* del admin (`frontend/src/features/tarifas/GestionTarifas.tsx`). La pantalla tiene alta, filtro por concepto, precios anteriores ocultos por defecto y un aviso de lo que no tiene precio vigente (la facturación no lo podría cobrar). Una tarifa que ya rige no se edita ni se borra: para cambiar el precio se carga una nueva con su fecha. Solo se corrigen las programadas. No se aceptan dos tarifas de lo mismo con la misma fecha, ni un nivel sin cursos, ni un deporte o recorrido que no existe. Deuda de la Parte 2: la migración `20261002130000_horario_profesor_actividad` suma el profesor responsable (`id_docente`) y los días y horarios (`horarios_actividades`, varios por actividad) a las actividades. Se cargan desde *Extracurriculares* y se rechazan franjas superpuestas dentro de la misma actividad.
- **Archivos de Juan Manuel que toqué** (cambios chicos): `routes/actividades.ts` (profesor y horarios en el GET, POST y PUT) y `ui/components.tsx`: en `ResponsiveTable`, si la columna `pie` devuelve `null`, la tarjeta del celular no muestra el pie vacío. El rechazo de una **inscripción** cuyos horarios chocan con otro deporte del alumno (HU 2 de `PENDIENTES.md`) sigue pendiente, ahora que los horarios existen.
- **Verificado:** sobre una base con `seed:demo`, la API responde 401 sin sesión y 403 a una familia; cubre altas, todas las validaciones, el estado de cada tarifa, la edición y el borrado solo de las programadas, y el profesor y los horarios (también los ve el portal). En el navegador, a 1366 px y a 375 px (sin scroll horizontal ni errores de consola): carga de una tarifa, edición de una actividad con profesor y horarios, y el mensaje de horarios superpuestos. `typecheck` y `build` sin errores; el lint del frontend sigue en los 46 errores que ya había en `main`, ninguno nuevo.
- **Falta:** cargar las tarifas reales antes de facturar (T08).

### T14 — Bandeja de comprobantes, imputación y avisos (Iván): en revisión

- **Qué quedó:**
  - **Bandeja** (`routes/comprobantes.ts`, solo Admin y Directivo): comprobantes por estado; los pendientes, del más viejo al más nuevo. Aprobar pide el importe que se acreditó en el banco: crea el `Pago`, lo imputa a los ítems y recalcula saldo y estado de la factura. Rechazar pide un motivo (hasta 300 caracteres). Un comprobante ya revisado da 409, así que dos admins no lo pueden validar a la vez, y la API no expone el nombre del archivo en disco.
  - **Imputación y saldos** (`services/saldos.ts`): `calcularImputacion()` es una función pura. Imputa primero los ítems de la orden de pago y después los demás, en el orden de la factura. La beca se salda junto con la cuota, como en la migración de T01, así que una factura pagada queda con todos sus ítems en 0. No acepta más que el saldo. `aplicarPago()` bloquea la fila de la factura (`FOR UPDATE`) para que dos pagos simultáneos no imputen sobre el mismo saldo. `deudaAlumno()` es para T16.
  - **Avisos** (patrón Observer, `services/avisos/`): `publicar()` reparte el evento entre los canales suscriptos, in-app con push y `EmailObserver`. Un canal que falla queda en el log y no frena a los otros ni a la aprobación. Los dos canales usan el mismo texto, con el saldo que queda o el motivo del rechazo, y el email escapa el HTML.
  - **Pantallas viejas fuera del menú:** se borraron *Cuotas* (`GestionCuotas`) y *Registrar pagos* (`RegistrarPagos`), que seguían escribiendo en la tabla `cuotas`; las reemplazan *Facturación* y *Comprobantes*. También se borraron sus constantes (`METODOS_PAGO`, `CUOTA_ESTADO_COLOR`). El Dashboard cuenta "Facturas sin pagar" (con saldo) en lugar de cuotas. Los endpoints viejos de `/api/cuotas` siguen en el backend porque los usan las pruebas de T03 y T04.
  - **Pantalla** *Comprobantes* del admin (`features/comprobantes/BandejaComprobantes.tsx`): filtros por estado y diálogo de revisión con el comprobante a la vista (foto o PDF, con "Abrir en otra pestaña" para el celular). Avisa si el importe difiere de lo declarado o si la factura ya está pagada, y ofrece motivos de rechazo frecuentes.
- **Pruebas:** 40 nuevas (194 en total, con las de T11):
  - `test/saldos.test.ts` (10): pago total y parcial, orden de pago, beca normal y del 100 %, recargo, segundo pago, importes inválidos, y una prueba con 42 combinaciones donde lo imputado siempre suma el importe y ningún saldo queda negativo;
  - `test/bandeja-comprobantes.test.ts` (24): 401/403, validaciones, 409, la fecha del pago, el evento que se publica, y que la familia sigue pudiendo bajar su archivo;
  - `test/avisos.test.ts` (6): un canal caído no frena a los demás, los textos y el escape del HTML.
- **Verificado sobre una base descartable con `seed:demo` y la API real** (email y push apagados; los comprobantes de prueba se cargaron directo en la base porque T13 todavía no existe):
  - **Pagos parciales y orden:** un pago parcial con orden de pago imputa primero el ítem de la orden; uno parcial sin orden salda la beca junto con la cuota; aprobar el resto deja la factura *Pagada* con todos los ítems en 0.
  - **Validaciones:** más que el saldo da 400 y el comprobante sigue en revisión; aprobar un rechazado da 409; un rechazo sin motivo da 400.
  - **Simultaneidad:** el mismo comprobante aprobado dos veces a la vez da un 200 y un 409. Dos comprobantes distintos por todo el saldo de la misma factura: pasa uno y el otro recibe 400 y queda en revisión.
  - **Avisos y permisos:** la familia recibió los tres avisos con el texto esperado. La familia recibe 403 en la bandeja y sí puede bajar su comprobante.
  - **Invariantes:** se cumplen en todas las facturas (`ítem.saldo = importe − imputaciones`, `factura.saldo = Σ ítems`, `total = Σ importes` y `pago = Σ imputaciones`).
  - **En el navegador** (a 1366 y 375 px): aprobación con importe distinto y rechazo con un motivo frecuente; sin scroll horizontal ni errores de consola.
  - **Lint del frontend:** baja de 46 a 43 errores; los 3 que se van eran de las pantallas borradas.
- **Falta:**
  - Probar el `EmailObserver` con la cuenta de Gmail real, cuando esté la contraseña de aplicación.
  - Con T11 el portal ya no lee la tabla `cuotas`: los endpoints viejos de `/api/cuotas` se pueden borrar en un PR aparte, ajustando las pruebas de T03 y T04 que los usan.
  - Con T13 mergeada, probar la subida real desde el portal.

### T09 — Login y logout en la PWA instalada (Iván): hecho, mergeado en el PR #34

- **Qué quedó:** la app instalada ya no pierde la sesión por abrirse sin señal. Antes, `getSession()` tomaba el error de red como "sin sesión" y mandaba al login aunque el token siguiera guardado. Ahora (`frontend/src/lib/auth.ts`), sin conexión o con el servidor caído (5xx), usa el último perfil conocido (`ept_perfil` en `localStorage`: solo id, nombre, apellido, email, rol y activo, sin teléfono ni foto). El backend vuelve a validar el token cuando vuelve la señal. El logout y un 401 borran token y perfil. En el portal (`StudentPortal.tsx`, archivo de Juan Manuel, cambio chico), abrir sin señal muestra "Sin conexión" con *Reintentar*, en lugar de "Tu usuario no tiene alumnos vinculados", y los datos se cargan solos al volver la conexión. El login, el logout, el cierre en otras pestañas y la baja del push al salir ya estaban bien y no se tocaron.
- **Pruebas:** `test/permisos-finanzas.test.ts` (21) prueba con su método real (GET, POST, PUT, DELETE) los endpoints nuevos de tarifas, facturación y actividades:
  - 401 sin sesión;
  - 403 a Padre, Alumno y Docente, y a un Admin desactivado;
  - Admin y Directivo pasan el control de rol;
  - PDF de la factura: lo bajan la administración y la familia del alumno; 403 a otra familia y al Docente (sin armar el PDF); 404 si no existe.

  Quitando el `requireRole` de la generación o el control del Docente en el PDF, las pruebas fallan. En total hay 125 pruebas.
- **Verificado en Chromium** con el build servido por el backend, sobre una base descartable con `seed:demo`. Pasaron 17 comprobaciones:
  - el login de una familia (a 375 px) lleva a `/portal` y el del admin (a 1366 px) a `/admin`;
  - con el service worker activo y sin conexión, `/portal`, `/admin` y `/login` (el `start_url`) abren la app y no el login;
  - el logout lleva a `/login` y borra token y perfil; después, `/portal` vuelve al login, también sin conexión;
  - un token inválido con perfil guardado cierra la sesión apenas hay conexión;
  - ninguna respuesta de `/api` queda en caché, y no hay scroll horizontal ni errores de JavaScript.

  Con el `auth.ts` de `main`, la misma prueba sin conexión termina en `/login`. El lint sigue en los 46 errores de `main`.
- **Falta:**
  - Probarlo en un Android y un iPhone reales (T23).
  - **Decidido (03/10):** la sesión sigue durando 8 h para todos (`JWT_EXPIRES_IN`). Una familia con la app instalada vuelve a iniciar sesión cada día. Se puede revisar después del testing del 11/11 si las familias lo piden.

### T08 — Facturación mensual (Iván): hecho, mergeado en el PR #32

- **Qué quedó:** `backend/src/services/facturacion/`, con una estrategia por concepto (patrón Strategy, en `estrategias.ts`): cuota por nivel, deportes, transporte, comedor y beca. La beca es un porcentaje sobre la cuota, no sobre los servicios. `generar.ts` emite una factura por alumno activo con los precios vigentes el día 1 del mes y vencimiento el día 10. Volver a generar no duplica ni modifica: solo emite las que falten. A un alumno sin curso o sin tarifa no se le emite la factura, y el motivo vuelve en `errores`. `pdf.ts` arma el PDF (ítems, totales, alias de `BANCO_ALIAS` y la aclaración de que es un comprobante interno) como Buffer, para la API y para el email de T17. `routes/facturas.ts` expone generar, listar y el PDF; el PDF lo bajan la administración y la familia del alumno, no los docentes. Pantalla *Facturación* en el admin.
- **Con las vigencias de T07:** deporte, transporte y comedor salen de `vigencias_servicio`, no de las inscripciones (que se borran con la baja), así que el mes de la baja se cobra completo y el siguiente no. Si el alumno cambió de recorrido en el mes, se cobra el más reciente; si se dio de baja de un deporte o del comedor y volvió a anotarse en el mismo mes, se cobra una vez. El mes se cuenta en hora de Argentina también para las bajas (`Periodo.comienzo`): una baja el último día a la noche no cuenta como del mes siguiente. Si se borró un recorrido después de una baja, la factura usa "Recorrido N" como nombre.
- **Pruebas:** 20 en `test/facturacion.test.ts` (104 en total con las de T03, T04, T07 y T10): ítems por concepto, centavos exactos, beca, beca del 100 %, inscripción posterior al mes, cambio de recorrido, baja y vuelta en el mismo mes, baja el último día a la noche, falta de curso o de tarifa, un concepto nuevo sin tocar la generación, vigencia con baja y los cuatro estados de la factura.
- **Verificado sobre `seed:demo` (primera versión, antes de las vigencias):**
  - Noviembre con una tarifa faltante: 102 facturas y 14 errores. Al cargar la tarifa y volver a generar se emiten solo esas 14, y una tercera generación no emite nada.
  - En las 116 facturas, total = Σ ítems, vencimiento el 10 y becas exactas. Cada inscripción a deporte, transporte o comedor se facturó una vez.
  - Un cambio de precio del comedor desde el 1/12 se usa en diciembre y no toca noviembre.
  - Permisos: 403 a docentes, a la familia con el hijo de otra y a la familia en las rutas del admin. 404 si la factura no existe.
  - En el navegador, a 1366 px y a 375 px: generación, descarga del PDF y filtros, sin scroll horizontal ni errores de consola.
- **Verificado con las vigencias, sobre una base descartable con `seed:demo` y la API real:** la base migrada no tiene diferencias con el schema (incluida la migración de T07). Escenarios hechos por la API: cambio de recorrido, baja y vuelta a un deporte, y baja del comedor. Después se facturaron octubre y noviembre: 116 facturas por mes, sin errores. Se cobra solo el recorrido nuevo y el deporte una vez por mes; el comedor se cobra en octubre y no en noviembre. Total = Σ ítems en todas, ningún servicio repetido en una factura, y en noviembre los servicios facturados coinciden con las vigencias abiertas (86 deportes, 59 transportes, 45 comedores). Volver a generar noviembre omite las 116.
- **Falta:** hasta T14, "Generar cuotas" y "Registrar pago" (pantallas viejas) siguen escribiendo en `cuotas`. Para no tener dos sistemas, conviene facturar solo desde *Facturación*.

## Pruebas

Con los usuarios de `npm run seed:demo` (ampliado en T23 con tarifas, facturas y
pagos), en un Android con Chrome y un iPhone con Safari:

- [ ] **Facturación:** generar el mes → una factura por alumno con un ítem por concepto; generarlo otra vez no duplica.
- [ ] **Precios:** cambiar el precio de un recorrido → las facturas ya emitidas no cambian.
- [ ] **Transporte mensual:** baja de transporte en noviembre → la factura de noviembre no lo incluye.
- [ ] **Pago en dos transferencias:** el padre elige ítems, sube dos comprobantes; al aprobar el primero la factura queda en *Pago parcial*, al aprobar el segundo en *Pagada*.
- [ ] **Sin efectivo:** ninguna pantalla ni endpoint acepta "Efectivo".
- [ ] **Privacidad:** el archivo de un comprobante no se abre sin sesión ni con la sesión de otra familia.
- [ ] **Email del último día hábil:** con fecha simulada llega el email con la composición y el PDF; un feriado se saltea; ejecutarlo dos veces no reenvía.
- [ ] **Email del día 20:** solo llega a familias con saldo.
- [ ] **Consultas móviles:** facturas y comprobantes por rango de fechas; deuda por ítem que coincide con las facturas.
- [ ] **Reportes web:** los cinco listados, con sus totales, en PDF y CSV.
- [ ] **Recuperar contraseña:** el enlace funciona una sola vez y vence a los 30 minutos.
- [ ] **Roles:** padre sobre el hijo de otro → 403; padre sobre endpoints de admin → 403.

## Riesgos y preguntas abiertas

| Riesgo | Impacto | Cómo se mitiga |
| --- | --- | --- |
| La migración de `Cuota` a `Factura` rompe datos existentes | Alto | Probarla sobre una copia de la base y respaldar antes de desplegar |
| Gmail limita los envíos (unos 500 destinatarios por día en una cuenta gratuita) y los masivos pueden caer en spam | Medio | Un solo email por familia (no por hijo), envíos por lotes con pausa y estado en `EnvioEmail` con reintentos. Alcanza para una escuela que recién abre |
| Error en el último día hábil (feriados, zona horaria) | Alto | `ultimoDiaHabil()` aislada y con pruebas de fechas límite |
| El cron corre dos veces (reinicio, dos instancias) | Medio | Registro por tipo + período + destinatario con restricción única |
| Límites del nivel gratuito de Gemini | Bajo | Agrupar consultas y repartir el uso entre los dos |

**Preguntas abiertas**

- [x] ¿Qué proveedor de email usamos? Gmail, con contraseña de aplicación. Falta definir qué cuenta envía (`MAIL_FROM`).
- [x] ¿Qué datos bancarios van en el comprobante de pago? El alias `sanchezoliva` (variable `BANCO_ALIAS`).
- [ ] ¿La factura es un comprobante interno o tiene que tener formato fiscal (AFIP/ARCA)? Se asume interno.
- [ ] ¿La cuota vence el día 10 como hoy? El aviso de deuda del día 20 lo da por hecho.
- [ ] ¿Recargo por mora? Hoy existe el campo `recargo`; si no se define, queda en 0.
