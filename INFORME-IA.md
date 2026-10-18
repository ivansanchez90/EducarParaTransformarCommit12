# Informe de uso de IA en programación — Parte 3

Grupo 12 · Iván Sánchez y Juan Manuel Cantero · Metodología de Sistemas II · entrega del 17/11/2026

> **Borrador de trabajo (T25).** Se escribe acá, en el repo, y se pasa al documento de
> entrega cuando esté completo. Reparto: apartados **1 y 4** Iván, **3 y 5** Juan Manuel,
> **2** los dos (es `BITACORA-IA.md`).

**Herramienta de IA.** El plan de trabajo declaró la API de Gemini en su nivel gratuito. En la
práctica, todo el desarrollo de la Parte 3 se hizo con **Claude Code** (asistente de
programación que lee el repositorio, edita archivos y corre comandos), y así figura en cada fila
de la bitácora.

## 1) Relación entre aplicación web y aplicación móvil

### La app móvil es la misma aplicación web

La app móvil **no es un segundo sistema**: es la aplicación web del colegio convertida en una
**PWA** (Progressive Web App) en el plan PWA (tareas T1 a T12, septiembre de 2026). La misma
aplicación React se instala en el celular desde el navegador, con su ícono, abre a pantalla
completa y recibe avisos push. Se descartó React Native porque habría duplicado las pantallas y
obligado a mantener dos clientes contra la misma API.

Lo que se hizo para que funcione como app:

- **Instalación y actualización:** manifest, íconos y service worker (`vite-plugin-pwa`). Cuando hay
  una versión nueva, la app muestra el aviso "Actualizar".
- **Pantallas de celular:** barra de navegación inferior (`BottomNav`) para familias, alumnos y
  docentes. Las tablas se muestran como tarjetas en pantallas angostas (`ResponsiveTable`), y se
  cuidaron los márgenes seguros del iPhone.
- **Sin conexión:** abre con la última sesión conocida y muestra el aviso "Sin conexión". Los
  botones de guardar quedan deshabilitados hasta que vuelve la señal.
- **Avisos push:** con Web Push y claves VAPID. El backend los manda junto con la notificación
  in-app.

### Qué funcionalidades ya existían en la web

Antes de la Parte 3 el sistema (Partes 1 y 2) ya tenía:

| Área | Funcionalidades |
| --- | --- |
| Sitio público | Quiénes somos, niveles educativos, noticias, galería, empleos con postulación, solicitud de inscripción y contacto |
| Acceso | Login con JWT y roles (Admin, Directivo, Docente, Padre, Alumno), logout y cambio de contraseña |
| Panel de administración | Usuarios, alumnos, docentes, cursos, materias, asignaciones, horarios, inscripciones, actividades extracurriculares (tope de 2 deportes), transporte (4 recorridos) y comedor, reservas de instalaciones, becas, sueldos, compras y reportes académicos en PDF y CSV |
| Docentes | Asistencia, calificaciones y amonestaciones |
| Portal de familias y alumnos | Selector de hijo, asistencias, calificaciones, horario, inscripción a deportes, transporte y comedor, notificaciones, y una cuota mensual con un monto único que solo registraba el admin |

### Cuáles se incorporaron en la aplicación móvil

En la Parte 3 se sumaron al portal de la PWA (lo que usa la familia en el celular):

| Funcionalidad | HU | Tarea |
| --- | --- | --- |
| Iniciar y cerrar sesión con la app instalada, también sin señal | HU01 | T09 |
| Cambiar la contraseña y recuperarla por email (enlace de un solo uso, 30 minutos) | HU02, HU03 | T10, T20 |
| Facturas pendientes y pagadas con su vencimiento, importe, estado e historial de pagos | HU10, HU11 | T11 |
| Elegir qué ítems pagar y emitir la orden de pago en PDF con el alias bancario | HU12 | T12 |
| Subir los comprobantes de transferencia (foto o PDF, varios por factura) | HU13 | T13 |
| Facturas y comprobantes por rango de fechas | HU15 | T15 |
| Historial de deuda discriminado por ítem | HU16 | T16 |
| Precio de cada servicio antes de inscribirse | HU24 | T19 |
| Avisos (in-app, push y email) de comprobante aprobado o rechazado y de deuda del día 20 | HU14, HU18 | T14, T18 |

Del lado de la administración (en la web, que también se usa desde el celular) se sumaron
*Tarifas*, *Facturación*, la bandeja de *Comprobantes* y los cinco reportes financieros. También
se agregaron dos envíos automáticos: el email del último día hábil con la factura y el aviso de
deuda del día 20.

### Qué información comparten

Toda. Web y app usan **una sola base PostgreSQL** a través de **una sola API**, así que no hay
nada que copiar entre ellas. La información financiera de la Parte 3 se apoya en la que ya
existía:

```text
alumnos ─ cursos (nivel) ──────────────► tarifa de la cuota
   │  └─ becas ─────────────────────────► ítem "Beca" (negativo)
   │  └─ inscripciones ─► vigencias ────► ítems de deporte, transporte y comedor
   │                                      │
   └─ usuario padre                    facturas ─ ítems ─ imputaciones ─ pagos
         │                                │                              │
         └─ órdenes de pago ──────────────┘   comprobantes de transferencia
```

### Cómo se comunican

- El backend (Node, Express y Prisma) sirve la aplicación y la API en el **mismo dominio** (Coolify
  con HTTPS). No hace falta CORS ni otra dirección para la app.
- El frontend llama a la API REST (`/api/...`) con JSON y el token JWT en la cabecera
  `Authorization: Bearer`. Los comprobantes se suben como `multipart/form-data`, y las facturas,
  las órdenes de pago y los reportes bajan en PDF o CSV.
- La API decide los permisos en cada pedido: `requireRole` para las rutas de administración y
  `assertAccesoAlumno` para que una familia solo vea a sus hijos. La app no decide nada por su
  cuenta.
- Hacia la familia, el backend avisa por tres canales: notificación en la app, push (Web Push) y
  email (nodemailer con Gmail).

### Qué modificaciones fue necesario realizar en el backend

| Cambio | Tarea |
| --- | --- |
| Modelo financiero: `Tarifa`, `Factura`, `ItemFactura`, `OrdenPago`, `ComprobanteTransferencia`, `ImputacionPago`, `EnvioEmail` y `TokenRecuperacion`. La migración pasó las cuotas existentes a facturas | T01 |
| Email (nodemailer) y tareas programadas (node-cron, feriados y último día hábil) | T02 |
| Pruebas automáticas (Vitest y Supertest) e integración continua en GitHub Actions | T03 |
| Pagos solo por transferencia y carpeta privada de comprobantes, que se descargan con sesión | T04 |
| Tarifas con vigencia, y profesor y horarios de cada deporte | T06 |
| Vigencia desde/hasta de cada servicio, para cobrar lo que se usó cada mes | T07 |
| Facturación mensual con el patrón **Strategy** (una estrategia por concepto) y PDF de la factura | T08 |
| Imputación de pagos a los ítems con bloqueo de la factura, y avisos con el patrón **Observer** | T14 |
| Endpoints del portal: facturas, pagos, órdenes, comprobantes y deuda | T11–T16 |
| Email del último día hábil, aviso del día 20 y recuperación de contraseña | T17, T18, T20 |
| Reportes financieros (ingresos, pagos completos e incompletos, por deporte y por recorrido) | T21, T22 |

### Qué información se reutiliza

- **Alumnos, cursos, niveles y familias:** el nivel del curso define la tarifa de la cuota, y el
  vínculo padre–hijo define quién ve cada factura.
- **Becas:** la facturación las aplica como un ítem negativo sobre la cuota.
- **Inscripciones a deportes, transporte y comedor:** se mantuvieron (con el tope de 2 deportes y
  el cupo) y además se registra su vigencia mes a mes.
- **Actividades y recorridos:** cada uno tiene su propio precio. A los deportes se les sumaron el
  profesor y los horarios.
- **Usuarios, roles y control de acceso:** el mismo login y las mismas funciones de permisos.
- **Notificaciones y suscripciones push** del plan PWA.
- **Formato de los reportes** (`lib/documentos.ts`): los reportes financieros usan el mismo PDF y
  CSV que los académicos.
- **Componentes de pantalla** (`ui/components.tsx`): barra inferior, tablas como tarjetas y
  diálogos.

### Cómo se mantienen sincronizados ambos sistemas

Como son la misma aplicación sobre los mismos datos, no hay sincronización entre bases: hay **una
sola fuente de verdad**. Lo que se cuidó es que el celular nunca muestre datos viejos ni cambie
los ya emitidos:

- **El service worker no guarda la API:** `/api` queda fuera de la caché a propósito
  (`vite.config.ts`), así cada pantalla pide los datos al momento. Sin conexión solo se conserva
  el último perfil (nombre y rol, sin datos personales) y no se puede guardar nada.
- **El estado de la factura se calcula al leerla**, a partir de su saldo y su vencimiento, y no
  queda desactualizado en la base.
- **Todo pago pasa por una sola función** (`aplicarPago()`), dentro de una transacción que bloquea
  la factura. La bandeja de la web y el saldo que ve la familia salen de las mismas filas, y se
  verificaron los invariantes: total = Σ ítems, saldo = Σ saldos de los ítems, saldo del ítem =
  importe − imputaciones.
- **Las tarifas tienen vigencia:** un cambio de precio rige desde una fecha y no modifica las
  facturas ya emitidas.
- **Avisos al momento:** cuando la administración aprueba o rechaza un comprobante, la familia
  recibe el aviso en la app y por push.
- **Tareas sin repeticiones:** los emails programados registran cada envío por tipo, período y
  familia, así un reinicio o una segunda corrida no reenvía.

## 2) Registro de uso de la IA — Bitácora de IA

La bitácora completa está en [`BITACORA-IA.md`](BITACORA-IA.md), con las columnas que pide la
consigna (problema, prompt, herramienta, respuesta, si funcionó, modificaciones y resultado). Se
fue completando en cada PR, en el momento de cada uso.

_Pendiente (los dos): pasar la tabla al documento de entrega al cerrar el desarrollo._

## 3) IA vs. conocimiento del sistema

_Pendiente (Juan Manuel)._

## 4) Comparación: desarrollo tradicional vs. desarrollo asistido por IA

La columna "Con IA" sale de lo que pasó en la Parte 3 (bitácora, PRs y tablero). La columna
"Sin IA" describe cómo se trabajó, o se habría trabajado, en las mismas tareas sin el asistente.

| Aspecto | Sin IA | Con IA |
| --- | --- | --- |
| **Generación de código** | Se escribe todo a mano, buscando en la documentación de Prisma, Express o pdfkit cada vez que hace falta. | El asistente escribió la primera versión de cada tarea: rutas, servicios, pantallas, migraciones y pruebas, siguiendo el estilo del repo. Nosotros definimos el contrato (modelos, endpoints, invariantes) en el plan antes de pedirle el código. |
| **Tiempo de desarrollo** | El cronograma estimaba 35,5 días-persona para T01 a T22, repartidos en los sprints 0 a 4, del 29/09 al 10/11. | T01 a T20 quedaron mergeadas entre el 2 y el 3/10, y T21 y T22, el 13 y el 18/10. El tiempo se fue a revisar, probar e integrar, más que a escribir. |
| **Comprensión del código** | Se entiende mientras se escribe. | Hay que leer lo generado y pedirle que explique las decisiones. Cada PR tiene una entrada en el plan con qué quedó y por qué, y la revisa el compañero. Lo que no se entendía no se mergeaba. |
| **Detección de errores** | Los errores aparecen al probar a mano o en producción. | El asistente corre las pruebas, el typecheck y la API real. Detectó problemas que no buscábamos: una baja a la noche del último día contaba como del mes siguiente por el huso horario (bitácora 6), y dos corridas simultáneas del email cortaban una (11). Pero también dejó errores propios: la orden de pago con beca pedía de más (23) y un diálogo quedaba tapado en el celular (10). Se encontraron con la prueba integral o mirando la pantalla. |
| **Documentación** | Suele quedar para el final y ser escasa. | Cada PR actualiza el tablero, la entrada de la tarea y la bitácora, y el código explica el porqué de las reglas no obvias. La documentación queda al día porque se escribe junto con el cambio. |
| **Aprendizaje** | Se aprende investigando cada tema desde cero. | Aprendimos patrones (Strategy, Observer), transacciones con bloqueo, la caché de un service worker y pruebas con dobles, viéndolos aplicados a nuestro sistema. El riesgo es aceptar sin entender, y por eso se pidió justificar cada decisión. |
| **Integración** | Dos personas en paralelo tienden a pisarse en los mismos archivos. | Se repartieron los archivos por dueño y se fijaron los contratos en el plan. Aun así hubo choques: casi todos los PRs chocaron en la bitácora y el tablero, y los dos hicimos el mismo seed de T23 por separado (24). La IA resuelve bien el conflicto, pero decidir qué versión queda lo decidimos nosotros. |
| **Seguridad** | Depende de lo que el programador recuerde revisar. | Se pidió explícitamente: comprobantes en una carpeta privada (4), el tipo de archivo validado por su contenido (15), y un token de recuperación guardado como hash, de un solo uso y sin revelar qué emails existen (14). Codacy igual marcó avisos después de mergear, que hubo que corregir en PRs aparte (3, 16 y 19). |
| **Mantenimiento** | El código queda como lo escribió cada uno. | Se pidió seguir los patrones existentes y dejar las reglas en un solo lugar (`aplicarPago()`, `estadoFactura()`, `tarifasVigentes()`). Al pasar de 0 a 456 pruebas automáticas, un cambio que rompe una regla se detecta en la CI. |
| **Calidad del resultado** | Depende del tiempo disponible para probar. | Cada tarea se dio por hecha con pruebas, verificación con la API real sobre una base descartable y, en las pantallas, en el navegador a 375 px. La calidad no vino sola: en 3 de 25 usos la primera respuesta fue solo parcial (7, 10 y 11) y los defectos de la prueba integral se corrigieron a mano o con nuevas indicaciones. |

**Lo que muestra la experiencia:** la IA acelera mucho la escritura del código. Pero el
resultado fue correcto porque el equipo:

- fijó antes las reglas del sistema (contratos e invariantes en `PLAN-P3.md`);
- comprobó que cada prueba falla si se rompe la regla que dice probar;
- probó contra la base real;
- revisó cada PR entre los dos.

Los números citados salen de `BITACORA-IA.md` (los números entre paréntesis son sus filas), de
`PLAN-P3.md` y del historial de PRs de GitHub.

## 5) Reflexión crítica

_Pendiente (Juan Manuel)._
