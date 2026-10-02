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
| T02. Email (nodemailer + Gmail con contraseña de aplicación) y tareas programadas (node-cron, feriados, `ultimoDiaHabil()` con pruebas) | — | 0 | Iván | — | 1,5 días | En revisión |
| T03. Pruebas y CI: Vitest + Supertest en `backend/`, GitHub Actions con lint, build y test | — | 0 | Juan Manuel | — | 1 día | Pendiente |
| T04. Quitar "Efectivo" (backend, `constants`, `RegistrarPagos`) y bucket privado de comprobantes con descarga autenticada | — | 0 | Juan Manuel | — | 1 día | Pendiente |
| T05. `BITACORA-IA.md` con la plantilla de la consigna | — | 0 | Juan Manuel | — | 0,5 días | Pendiente |
| T06. Tarifas: ABM por concepto con vigencia y pantalla admin; horario y profesor del deporte (deuda de la Parte 2) | HU04–HU07 | 1 | Iván | T01 | 2,5 días | Pendiente |
| T07. Inscripciones con vigencia (transporte, comedor, deportes) sin romper el tope de 2 ni el cupo | HU08 | 1 | Juan Manuel | T01 | 2 días | Pendiente |
| T08. Facturación mensual con Strategy, becas, PDF de la factura y botón "Generar facturas" | HU09 | 1 | Iván | T06, T07 | 3 días | Pendiente |
| T09. Login/logout en la PWA instalada y pruebas 401/403 de los endpoints nuevos | HU01 | 1 | Iván | T03 | 0,5 días | Pendiente |
| T10. Cambio de contraseña en la PWA y su prueba automática | HU02 | 1 | Juan Manuel | T03 | 0,5 días | Pendiente |
| T11. Portal: cuotas pendientes y pagadas, e historial de pagos | HU10, HU11 | 2 | Juan Manuel | T08 | 2 días | Pendiente |
| T12. Portal: elegir ítems y emitir el comprobante de pago (PDF con datos bancarios) | HU12 | 2 | Juan Manuel | T08 | 2,5 días | Pendiente |
| T13. Portal: subir comprobantes de transferencia (foto o PDF, varios por factura) | HU13 | 2 | Juan Manuel | T04, T08 | 1,5 días | Pendiente |
| T14. Admin: bandeja de comprobantes, aprobar/rechazar, imputación, saldo (`services/saldos.ts`) y `EmailObserver` | HU14 | 2 | Iván | T02, T13 (contrato) | 2,5 días | Pendiente |
| T15. Portal: facturas y comprobantes por rango de fechas | HU15 | 3 | Juan Manuel | T13 | 1,5 días | Pendiente |
| T16. Portal: deuda por ítem | HU16 | 3 | Juan Manuel | T14 | 1,5 días | Pendiente |
| T17. Email del último día hábil con la composición y la factura adjunta | HU17 | 3 | Iván | T02, T08 | 2,5 días | Pendiente |
| T18. Email del día 20 con la deuda (más in-app y push) | HU18 | 3 | Iván | T14 | 1,5 días | Pendiente |
| T19. Portal: precio de cada servicio en "Transporte y comedor" y "Extracurriculares" | HU24 | 3 | Juan Manuel | T06 | 0,5 días | Pendiente |
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
- `GET /api/alumnos/:id/deuda` → saldo por ítem y período (usa `services/saldos.ts` de T14).
- `POST /api/facturas/:id/ordenes-pago` con `{ items: number[] }` → 201 con la orden; `GET /api/ordenes-pago/:id/pdf` (el PDF muestra el alias de `BANCO_ALIAS`).
- `POST /api/facturas/:id/comprobantes` (multipart: `archivo`, `importe`, `fecha_transferencia`, `id_orden?`) → 201 en `En revisión`.
- `GET /api/comprobantes/:id/archivo` → descarga con sesión (familia dueña o admin).
- `GET /api/facturas/:id/pdf` → PDF de la factura (lo genera T08; la ruta la expone Iván).

**Endpoints de administración** (Iván; `requireRole(ROLES_ADMIN)`):

- `GET|POST|PUT /api/tarifas`.
- `POST /api/facturas/generar` con `{ anio, mes }` → `{ generadas, omitidas, errores[] }`.
- `GET /api/comprobantes?estado=En revisión`; `PATCH /api/comprobantes/:id/aprobar` con `{ importe }`; `PATCH /api/comprobantes/:id/rechazar` con `{ motivo }`.
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

### T02 — Email y tareas programadas (Iván): en revisión

- **Qué quedó:** `backend/src/services/email.ts` (`enviarEmail` con nodemailer por el SMTP de Gmail, con adjuntos). Sin `SMTP_USER` y `SMTP_PASS` el envío queda apagado, como el push. Al arrancar se prueba el login con Gmail y, si falla, queda en el log sin tumbar la API. `backend/src/jobs/calendario.ts` tiene la tabla de feriados y días no laborables turísticos de 2026 y 2027, `esDiaHabil`, `ultimoDiaHabil` y `diaEnZona`, que da el día de Argentina y no el de UTC. `backend/src/jobs/index.ts` es el programador con node-cron en hora de Argentina: cada tarea tiene una condición `corresponde` (por ejemplo, `esUltimoDiaHabil`), no se superpone consigo misma y sus errores no tumban el backend. Variables nuevas en `.env.example` y en el README.
- **Pruebas:** `npm test` (Vitest, `backend/test/`) corre 23 pruebas: el último día hábil de los 12 meses de 2026 calculado a mano, feriados al final del mes, años bisiestos, feriados trasladados, el cambio de día entre Argentina y UTC, y que una tarea no se ejecuta si no corresponde ni propaga sus errores. Vitest quedó instalado con `vitest.config.ts`; T03 suma Supertest y la CI sobre esta base.
- **Verificado:** `typecheck` sin errores. La API arranca sin claves de email (envío apagado) y con una contraseña inválida (Gmail la rechaza, sale en el log y la API sigue). Un cron real de prueba se ejecuta cada segundo con el día de Argentina.
- **Falta:** crear la contraseña de aplicación en la cuenta que va a enviar, definir `MAIL_FROM` y cargarlos en Coolify. Agregar los días no laborables turísticos de 2027 cuando se publiquen. Las tareas concretas (emails del último día hábil y del día 20) se suman en T17 y T18.

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
