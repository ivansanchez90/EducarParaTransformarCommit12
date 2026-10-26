# Pruebas de la Parte 3 (T23)

Tabla para recorrer la app antes del testing del 11/11. Cada fila tiene un casillero de resultado:
completarlo con ✅ (anda), ❌ (falla; anotar qué pasó y avisar) o ➖ (no aplica), con la fecha y quién probó.

## Preparar los datos

```bash
cd backend
npm run seed:demo        # vacía la base local y la llena (ver "Datos de prueba" en el README)
npm run dev
```

El seed ya carga lo necesario para esta tabla, sin cargar nada a mano:

- **Tarifas** de cuota por nivel, de cada deporte y recorrido y del comedor desde enero, con un aumento en agosto
  (cuota, transporte y comedor) y otro del comedor **programado** para el mes que viene: sirve para ver que un cambio de
  precio no toca las facturas ya emitidas.
- **Deportes** con profesor y días y horarios, para los filtros del reporte de deportes.
- **Facturas de marzo al mes actual**, generadas con el mismo motor que el botón "Generar facturas" (una por alumno, con
  un ítem por concepto y la beca en negativo cuando corresponde). Algunos alumnos se anotaron a servicios durante el año
  y cinco dejaron el comedor: sus facturas lo cobran hasta el mes de la baja.
- **Comprobantes en todos los estados** (aprobados, en revisión y rechazados, con su motivo), algunos desde una orden
  de pago, y los pagos aprobados ya imputados a los ítems. Hay facturas pagadas, pagadas en dos transferencias, con
  pago parcial y sin pagar. Todos los comprobantes abren el mismo PDF de ejemplo.

Accesos (contraseña `demo1234`): `directora@educar.local` (Directivo), `agustina.ramirez8@educar.local` (Docente),
`flia.acosta1444@mail.com` (familia) y `47003381@alumno.local` (alumno); el admin es `admin@educar.local` / `admin1234`.
Para probar a una familia **con beca** se puede entrar con `flia.ojeda5111@mail.com` (beca del 30 %) o
`flia.ruiz0783@mail.com` (50 %). El seed genera siempre los mismos datos, así que estos accesos no cambian.

Para el celular: levantar el backend con el frontend compilado (`npm run build` en `frontend/` y copiar a `backend/public`, o
usar el despliegue) y abrir la dirección desde un Android con Chrome y un iPhone con Safari.
Variables a cargar para probar todo: `BANCO_ALIAS` (si falta, la orden de pago dice que se consulte el alias) y
`SMTP_USER`, `SMTP_PASS` y `MAIL_FROM` (si faltan, los emails no salen).

## Tabla de pruebas

| Quién | Qué probar | HU | Tarea | Cómo probarlo | Resultado |
| --- | --- | --- | --- | --- | --- |
| Familia (PWA) | Iniciar y cerrar sesión con la app instalada, también sin señal | HU01 | T09 | Instalar la PWA, entrar y salir; abrirla en modo avión | |
| Familia | Cambiar la contraseña desde "Mi contraseña" | HU02 | T10 | Cambiarla y volver a entrar con la nueva | |
| Familia | Recuperar la contraseña por email; el enlace sirve una vez y vence a los 30 min | HU03 | T20 | Pedir el enlace, usarlo dos veces y esperar el vencimiento | |
| Familia | Precio de cada servicio en "Transporte y comedor" y "Extracurriculares"; "Precio a confirmar" si falta la tarifa | HU24 | T19 | Mirar con la tarifa cargada y, en *Tarifas*, probar con un servicio sin precio | |
| Familia | Facturas pendientes y pagadas, detalle e historial de pagos | HU10, HU11 | T11 | Pestaña *Cuotas* → Facturas y Pagos | |
| Familia | Elegir ítems y emitir la orden de pago en PDF con el alias | HU12 | T12 | "Pagar por transferencia", tildar ítems, bajar el PDF y revisar el alias | |
| Familia | **Con beca:** la orden descuenta la beca y el total coincide con lo que se debe | HU12 | T12 | Familia con beca: el total de la orden = saldo de la factura; subir el comprobante y aprobarlo desde la bandeja | |
| Familia | Subir comprobantes (JPG, PNG, PDF, AVIF y foto del iPhone), varios por factura | HU13 | T13 | Subir uno de cada; probar uno de más de 10 MB y un archivo con extensión falsa | |
| Familia | Filtrar facturas y comprobantes por fechas (Desde/Hasta) | HU15 | T15 | Filtros con uno y con los dos extremos, y un rango al revés | |
| Familia | Deuda por ítem, con la beca en negativo | HU16 | T16 | Pestaña *Cuotas* → Deuda, con una familia con beca | |
| Familia | Que una familia no vea datos de otra | — | T09 | Con otra sesión, abrir una factura o un comprobante ajeno: error | |
| Admin | ABM de tarifas con vigencia, más horario y profesor de cada deporte | HU04–07 | T06 | Cargar una tarifa programada y ver que las facturas ya emitidas no cambian | |
| Familia | No se puede inscribir a dos deportes que se superponen; el mensaje dice con cuál choca y en qué franja | HU 2 (Parte 2) | — | Con un hijo en Atletismo (lunes 17:00–18:00), anotarlo en un deporte de los lunes 17:30; después probar uno que empiece a las 18:00 (se acepta) | |
| Admin | No se puede cambiar el horario de un deporte si deja a un inscripto con dos clases a la vez | HU 2 (Parte 2) | — | En *Extracurriculares*, mover Fútbol a los lunes 17:00: avisa qué alumnos chocarían y no guarda | |
| Admin | Reporte "Alumnos por deporte" con profesor y horario, y filtros por día, horario y profesor | HU 2 (Parte 2) | — | Filtrar lunes 18:30 y un profesor; mirar la ficha de un alumno con deportes; bajar PDF y CSV | |
| Admin | Alta y edición de un docente; DNI repetido avisa "Ya existe un profesor registrado con ese DNI" | HU 4 (Parte 2) | — | En *Docentes*, crear uno, entrar con su correo y la contraseña inicial, editarlo y probar con el DNI de otro | |
| Admin | Asignar a un docente una materia que ya tiene profesor en ese curso: avisa y permite reemplazarlo | HU 4 (Parte 2) | — | Botón *Materias* del docente; aceptar el reemplazo y mirar que el horario del curso muestre al nuevo profesor | |
| Admin | Reportes *Docentes por nivel* y *Ficha del docente* | HU 4 (Parte 2) | — | Filtrar por nivel; ver la ficha de un docente con horarios; bajar PDF y CSV | |
| Seguridad | Los documentos del legajo no se abren sin sesión; "Ver" los abre en otra pestaña; solo se suben fotos y PDF | — | — | Copiar la dirección `/uploads/documentos-alumnos/...` de un documento: no abre. Desde el legajo, "Ver" un PDF y una foto (también en el celular). Subir un archivo que no sea foto ni PDF: lo rechaza | |
| Admin | Inscripciones con vigencia (transporte, comedor y deportes por mes) | HU08 | T07 | Dar de baja el transporte y mirar la factura del mes siguiente | |
| Admin | Botón "Generar facturas": una por alumno, un ítem por concepto, becas y PDF; generar dos veces no duplica | HU09 | T08 | Generar un mes nuevo, repetirlo y bajar un PDF | |
| Admin | Bandeja de comprobantes: aprobar con el importe acreditado, rechazar con motivo | HU14 | T14 | Aprobar uno y revisar saldo y estado; rechazar otro y ver el aviso a la familia | |
| Admin | Pago en dos transferencias: primero Pago parcial, después Pagada | HU14 | T14 | Aprobar dos comprobantes de la misma factura | |
| Admin | Reportes de ingresos, pagos completos e incompletos (pantalla, PDF y CSV) | HU19–21 | T21 | Probar los tres, con año, nivel y un alumno; comparar un total con la bandeja | |
| Admin | Reportes de pagos por deporte y por recorrido | HU22, HU23 | T22 | Probar los dos en PDF y CSV | |
| Admin | Que no se acepte "Efectivo" en ningún lado | — | T04 | Buscar la opción en las pantallas y probar el endpoint | |
| Automático | Email del último día hábil con la composición y la factura adjunta; un feriado se saltea; ejecutarlo dos veces no reenvía | HU17 | T17 | Ejecutar a mano con fecha simulada, dos veces | |
| Automático | Aviso de deuda del día 20 por email, en la app y por push; solo a familias con saldo | HU18 | T18 | Ejecutar a mano y mirar los tres canales | |
| Seguridad | El archivo de un comprobante no se abre sin sesión ni con otra familia | — | T04 | Abrir la URL del archivo sin iniciar sesión | |
| Celular | Todas las pantallas nuevas a 375 px, sin scroll horizontal ni errores | — | T23 | Android con Chrome y iPhone con Safari | |

## Salud y enfermería (desafío)

Con `npm run seed:demo` hay un usuario de enfermería (`enfermeria@educar.local`, clave `demo1234`), unas 90 fichas
médicas (algunas con alergias críticas) y unas 57 atenciones, todas con su auditoría.

| Quién | Qué probar | Cómo probarlo | Resultado |
| --- | --- | --- | --- |
| Enfermería | Entra al panel y ve solo *Salud y enfermería* | Iniciar sesión como enfermería; el menú tiene una sola opción | |
| Enfermería | Buscar un alumno por nombre, apellido o DNI y abrir su ficha | Buscar, ver las marcas "Con ficha" y "Alergias críticas" y abrir una | |
| Enfermería | Crear o editar la ficha; un grupo sanguíneo inválido o un texto larguísimo se rechazan | Guardar con cambios, sin cambios y con datos inválidos | |
| Enfermería | Registrar y corregir una atención; no se puede cargar sin motivo ni con fecha futura | Pestaña *Atenciones* | |
| Enfermería → Familia | Al registrar una atención, la familia recibe el aviso (en la app y por push) **sin el motivo ni el tratamiento**; en la atención figura "Familia avisada" | Registrar una atención y entrar como la familia: *Notificaciones* y pestaña *Salud*; con el celular bloqueado, mirar el push | |
| Enfermería | Corregir una atención o guardar la ficha no vuelve a avisar a la familia | Corregir una atención y mirar *Notificaciones* de la familia | |
| Enfermería | Cada alta y cada cambio quedan en *Historial de cambios*, con quién y qué cambió; guardar sin cambios no deja nada | Editar una ficha y mirar el historial | |
| Docente | En el legajo del alumno ve solo el resumen (alergias críticas y contacto), nunca la ficha completa | Abrir un legajo con y sin alergias críticas | |
| Familia | En el portal, pestaña *Salud*: ve la ficha y las atenciones de su hijo, solo para leer | Entrar como familia y mirar *Salud* | |
| Familia | No ve la ficha de otro alumno | Con la sesión de otra familia, pedir la ficha de un alumno ajeno: error | |
| Alumno | El propio alumno no tiene la pestaña *Salud* | Entrar como alumno | |
| Admin | Ve y carga todo desde *Salud y enfermería* | Entrar como Admin o Directivo | |

## Defectos encontrados

Anotar acá lo que falle, con la pantalla, el mensaje y la tarea; se corrige en T24.

| # | Fecha | Quién lo encontró | Dónde | Qué pasó | Estado |
| --- | --- | --- | --- | --- | --- |
| 1 | 2026-10-18 | Juan Manuel (con el seed ampliado) | T12, orden de pago | A una familia con beca la orden le pedía transferir el valor completo de la cuota, sin descontar la beca; la bandeja no podía aprobar ese importe ("supera el saldo") | Corregido en el mismo PR de T23 |
| 2 | 2026-10-18 | Iván (Chromium a 375 px) | Admin, Dashboard | Las cuatro tarjetas de arriba tienen scroll horizontal: `gridTemplateColumns: 'repeat(4,1fr)'` en `features/dashboard/Dashboard.tsx` no se acomoda al ancho (viene de antes de la PWA) | Corregido: dos columnas en el celular y cuatro desde 768 px |
