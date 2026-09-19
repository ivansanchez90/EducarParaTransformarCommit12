-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "usuarios" (
    "id_usuario" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL DEFAULT '',
    "apellido" TEXT NOT NULL DEFAULT '',
    "rol" TEXT NOT NULL,
    "telefono" TEXT,
    "foto_perfil_url" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "periodos_academicos" (
    "id_periodo" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "periodos_academicos_pkey" PRIMARY KEY ("id_periodo")
);

-- CreateTable
CREATE TABLE "cursos" (
    "id_curso" SERIAL NOT NULL,
    "nivel" TEXT NOT NULL,
    "grado_anio" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "capacidad_maxima" INTEGER DEFAULT 30,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "id_periodo" INTEGER,

    CONSTRAINT "cursos_pkey" PRIMARY KEY ("id_curso")
);

-- CreateTable
CREATE TABLE "materias" (
    "id_materia" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "horas_semanales" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "materias_pkey" PRIMARY KEY ("id_materia")
);

-- CreateTable
CREATE TABLE "docentes" (
    "id_docente" SERIAL NOT NULL,
    "id_usuario" UUID,
    "dni" TEXT,
    "titulo" TEXT,
    "especialidad" TEXT,
    "fecha_ingreso" DATE,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "docentes_pkey" PRIMARY KEY ("id_docente")
);

-- CreateTable
CREATE TABLE "asignaciones" (
    "id_asignacion" SERIAL NOT NULL,
    "id_docente" INTEGER NOT NULL,
    "id_materia" INTEGER NOT NULL,
    "id_curso" INTEGER NOT NULL,
    "id_periodo" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "asignaciones_pkey" PRIMARY KEY ("id_asignacion")
);

-- CreateTable
CREATE TABLE "horarios" (
    "id_horario" SERIAL NOT NULL,
    "id_asignacion" INTEGER NOT NULL,
    "dia_semana" TEXT NOT NULL,
    "hora_inicio" TIME(0) NOT NULL,
    "hora_fin" TIME(0) NOT NULL,
    "aula" TEXT,

    CONSTRAINT "horarios_pkey" PRIMARY KEY ("id_horario")
);

-- CreateTable
CREATE TABLE "alumnos" (
    "id_alumno" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "fecha_nacimiento" DATE NOT NULL,
    "direccion" TEXT,
    "telefono_emergencia" TEXT,
    "nombre_contacto_emergencia" TEXT,
    "obra_social" TEXT,
    "nro_obra_social" TEXT,
    "id_curso" INTEGER,
    "id_usuario" UUID,
    "id_usuario_padre" UUID,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alumnos_pkey" PRIMARY KEY ("id_alumno")
);

-- CreateTable
CREATE TABLE "asistencias" (
    "id_asistencia" SERIAL NOT NULL,
    "id_alumno" INTEGER NOT NULL,
    "id_asignacion" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "estado" TEXT NOT NULL,
    "observacion" TEXT,
    "registrado_por" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asistencias_pkey" PRIMARY KEY ("id_asistencia")
);

-- CreateTable
CREATE TABLE "calificaciones" (
    "id_calificacion" SERIAL NOT NULL,
    "id_alumno" INTEGER NOT NULL,
    "id_asignacion" INTEGER NOT NULL,
    "id_periodo" INTEGER,
    "trimestre" INTEGER NOT NULL,
    "tipo_evaluacion" TEXT,
    "nota" DECIMAL(4,2) NOT NULL,
    "descripcion" TEXT,
    "fecha_carga" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calificaciones_pkey" PRIMARY KEY ("id_calificacion")
);

-- CreateTable
CREATE TABLE "amonestaciones" (
    "id_amonestacion" SERIAL NOT NULL,
    "id_alumno" INTEGER NOT NULL,
    "id_docente" INTEGER,
    "tipo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fecha" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "amonestaciones_pkey" PRIMARY KEY ("id_amonestacion")
);

-- CreateTable
CREATE TABLE "documentos_alumno" (
    "id_documento" SERIAL NOT NULL,
    "id_alumno" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT,
    "url_archivo" TEXT NOT NULL,
    "fecha_carga" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_alumno_pkey" PRIMARY KEY ("id_documento")
);

-- CreateTable
CREATE TABLE "cuotas" (
    "id_cuota" SERIAL NOT NULL,
    "id_alumno" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "monto_base" DECIMAL(12,2) NOT NULL,
    "recargo" DECIMAL(12,2) DEFAULT 0,
    "descuento" DECIMAL(12,2) DEFAULT 0,
    "fecha_vencimiento" DATE NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'Pendiente',
    "fecha_pago" DATE,
    "metodo_pago" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuotas_pkey" PRIMARY KEY ("id_cuota")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id_pago" SERIAL NOT NULL,
    "id_cuota" INTEGER,
    "fecha_pago" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "monto_pagado" DECIMAL(12,2) NOT NULL,
    "metodo_pago" TEXT,
    "nro_comprobante" TEXT,
    "id_usuario_registra" UUID,
    "observaciones" TEXT,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id_pago")
);

-- CreateTable
CREATE TABLE "becas" (
    "id_beca" SERIAL NOT NULL,
    "id_alumno" INTEGER NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "motivo" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_otorgamiento" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "becas_pkey" PRIMARY KEY ("id_beca")
);

-- CreateTable
CREATE TABLE "sueldos" (
    "id_sueldo" SERIAL NOT NULL,
    "id_usuario" UUID,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'Pendiente',
    "fecha_pago" DATE,
    "fecha_registro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sueldos_pkey" PRIMARY KEY ("id_sueldo")
);

-- CreateTable
CREATE TABLE "compras_insumos" (
    "id_compra" SERIAL NOT NULL,
    "descripcion" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "monto" DECIMAL(12,2) NOT NULL,
    "proveedor" TEXT,
    "fecha_compra" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_registro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compras_insumos_pkey" PRIMARY KEY ("id_compra")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id_notificacion" SERIAL NOT NULL,
    "id_usuario_destino" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "fecha_envio" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id_notificacion")
);

-- CreateTable
CREATE TABLE "actividades_extracurriculares" (
    "id_actividad" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descripcion" TEXT,
    "cupo_maximo" INTEGER NOT NULL DEFAULT 20,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "actividades_extracurriculares_pkey" PRIMARY KEY ("id_actividad")
);

-- CreateTable
CREATE TABLE "inscripciones_actividades" (
    "id_inscripcion_act" SERIAL NOT NULL,
    "id_actividad" INTEGER NOT NULL,
    "id_alumno" INTEGER NOT NULL,
    "fecha_inscripcion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inscripciones_actividades_pkey" PRIMARY KEY ("id_inscripcion_act")
);

-- CreateTable
CREATE TABLE "instalaciones" (
    "id_instalacion" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "instalaciones_pkey" PRIMARY KEY ("id_instalacion")
);

-- CreateTable
CREATE TABLE "reservas_instalaciones" (
    "id_reserva" SERIAL NOT NULL,
    "id_instalacion" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "hora_inicio" TIME(0) NOT NULL,
    "hora_fin" TIME(0) NOT NULL,
    "motivo" TEXT,
    "reservado_por" UUID,
    "fecha_registro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservas_instalaciones_pkey" PRIMARY KEY ("id_reserva")
);

-- CreateTable
CREATE TABLE "inscripciones" (
    "id_inscripcion" SERIAL NOT NULL,
    "nombre_aspirante" TEXT NOT NULL,
    "apellido_aspirante" TEXT,
    "fecha_nacimiento_aspirante" DATE,
    "dni_aspirante" TEXT NOT NULL,
    "nombre_tutor" TEXT NOT NULL,
    "email_tutor" TEXT NOT NULL,
    "telefono_tutor" TEXT,
    "nivel_solicitado" TEXT NOT NULL,
    "grado_anio_solicitado" TEXT,
    "documentacion_completa" BOOLEAN NOT NULL DEFAULT false,
    "observaciones" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'Pendiente',
    "fecha_solicitud" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_alumno_creado" INTEGER,

    CONSTRAINT "inscripciones_pkey" PRIMARY KEY ("id_inscripcion")
);

-- CreateTable
CREATE TABLE "mensajes_contacto" (
    "id_mensaje" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "leido" BOOLEAN NOT NULL DEFAULT false,
    "fecha_envio" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensajes_contacto_pkey" PRIMARY KEY ("id_mensaje")
);

-- CreateTable
CREATE TABLE "noticias" (
    "id_noticia" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "resumen" TEXT,
    "contenido" TEXT NOT NULL DEFAULT '',
    "url_imagen" TEXT,
    "fecha_publicacion" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "destacada" BOOLEAN NOT NULL DEFAULT false,
    "id_autor" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "noticias_pkey" PRIMARY KEY ("id_noticia")
);

-- CreateTable
CREATE TABLE "galeria" (
    "id_imagen" SERIAL NOT NULL,
    "titulo" TEXT,
    "descripcion" TEXT,
    "categoria" TEXT,
    "url_imagen" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "id_autor" UUID,
    "fecha_subida" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "galeria_pkey" PRIMARY KEY ("id_imagen")
);

-- CreateTable
CREATE TABLE "empleos" (
    "id_empleo" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "area" TEXT,
    "requisitos" TEXT,
    "tipo_contrato" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_publicacion" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_cierre" DATE,
    "id_autor" UUID,

    CONSTRAINT "empleos_pkey" PRIMARY KEY ("id_empleo")
);

-- CreateTable
CREATE TABLE "postulaciones" (
    "id_postulacion" SERIAL NOT NULL,
    "id_empleo" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT,
    "mensaje" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'Recibida',
    "fecha_postulacion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "postulaciones_pkey" PRIMARY KEY ("id_postulacion")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "docentes_id_usuario_key" ON "docentes"("id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "docentes_dni_key" ON "docentes"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "alumnos_dni_key" ON "alumnos"("dni");

-- CreateIndex
CREATE INDEX "alumnos_id_curso_idx" ON "alumnos"("id_curso");

-- CreateIndex
CREATE INDEX "alumnos_id_usuario_idx" ON "alumnos"("id_usuario");

-- CreateIndex
CREATE INDEX "alumnos_id_usuario_padre_idx" ON "alumnos"("id_usuario_padre");

-- CreateIndex
CREATE UNIQUE INDEX "asistencias_id_alumno_id_asignacion_fecha_key" ON "asistencias"("id_alumno", "id_asignacion", "fecha");

-- CreateIndex
CREATE INDEX "calificaciones_id_alumno_idx" ON "calificaciones"("id_alumno");

-- CreateIndex
CREATE INDEX "calificaciones_id_asignacion_idx" ON "calificaciones"("id_asignacion");

-- CreateIndex
CREATE INDEX "cuotas_estado_idx" ON "cuotas"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "cuotas_id_alumno_mes_anio_key" ON "cuotas"("id_alumno", "mes", "anio");

-- CreateIndex
CREATE UNIQUE INDEX "becas_id_alumno_key" ON "becas"("id_alumno");

-- CreateIndex
CREATE INDEX "notificaciones_id_usuario_destino_idx" ON "notificaciones"("id_usuario_destino");

-- CreateIndex
CREATE UNIQUE INDEX "inscripciones_actividades_id_actividad_id_alumno_key" ON "inscripciones_actividades"("id_actividad", "id_alumno");

-- CreateIndex
CREATE INDEX "reservas_instalaciones_id_instalacion_fecha_idx" ON "reservas_instalaciones"("id_instalacion", "fecha");

-- AddForeignKey
ALTER TABLE "cursos" ADD CONSTRAINT "cursos_id_periodo_fkey" FOREIGN KEY ("id_periodo") REFERENCES "periodos_academicos"("id_periodo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docentes" ADD CONSTRAINT "docentes_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_id_docente_fkey" FOREIGN KEY ("id_docente") REFERENCES "docentes"("id_docente") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_id_materia_fkey" FOREIGN KEY ("id_materia") REFERENCES "materias"("id_materia") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_id_curso_fkey" FOREIGN KEY ("id_curso") REFERENCES "cursos"("id_curso") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_id_periodo_fkey" FOREIGN KEY ("id_periodo") REFERENCES "periodos_academicos"("id_periodo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios" ADD CONSTRAINT "horarios_id_asignacion_fkey" FOREIGN KEY ("id_asignacion") REFERENCES "asignaciones"("id_asignacion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumnos" ADD CONSTRAINT "alumnos_id_curso_fkey" FOREIGN KEY ("id_curso") REFERENCES "cursos"("id_curso") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumnos" ADD CONSTRAINT "alumnos_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumnos" ADD CONSTRAINT "alumnos_id_usuario_padre_fkey" FOREIGN KEY ("id_usuario_padre") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumnos"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_id_asignacion_fkey" FOREIGN KEY ("id_asignacion") REFERENCES "asignaciones"("id_asignacion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calificaciones" ADD CONSTRAINT "calificaciones_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumnos"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calificaciones" ADD CONSTRAINT "calificaciones_id_asignacion_fkey" FOREIGN KEY ("id_asignacion") REFERENCES "asignaciones"("id_asignacion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calificaciones" ADD CONSTRAINT "calificaciones_id_periodo_fkey" FOREIGN KEY ("id_periodo") REFERENCES "periodos_academicos"("id_periodo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amonestaciones" ADD CONSTRAINT "amonestaciones_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumnos"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amonestaciones" ADD CONSTRAINT "amonestaciones_id_docente_fkey" FOREIGN KEY ("id_docente") REFERENCES "docentes"("id_docente") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_alumno" ADD CONSTRAINT "documentos_alumno_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumnos"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuotas" ADD CONSTRAINT "cuotas_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumnos"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_id_cuota_fkey" FOREIGN KEY ("id_cuota") REFERENCES "cuotas"("id_cuota") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_id_usuario_registra_fkey" FOREIGN KEY ("id_usuario_registra") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "becas" ADD CONSTRAINT "becas_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumnos"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sueldos" ADD CONSTRAINT "sueldos_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_id_usuario_destino_fkey" FOREIGN KEY ("id_usuario_destino") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripciones_actividades" ADD CONSTRAINT "inscripciones_actividades_id_actividad_fkey" FOREIGN KEY ("id_actividad") REFERENCES "actividades_extracurriculares"("id_actividad") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripciones_actividades" ADD CONSTRAINT "inscripciones_actividades_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumnos"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_instalaciones" ADD CONSTRAINT "reservas_instalaciones_id_instalacion_fkey" FOREIGN KEY ("id_instalacion") REFERENCES "instalaciones"("id_instalacion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_instalaciones" ADD CONSTRAINT "reservas_instalaciones_reservado_por_fkey" FOREIGN KEY ("reservado_por") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_id_alumno_creado_fkey" FOREIGN KEY ("id_alumno_creado") REFERENCES "alumnos"("id_alumno") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "noticias" ADD CONSTRAINT "noticias_id_autor_fkey" FOREIGN KEY ("id_autor") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "galeria" ADD CONSTRAINT "galeria_id_autor_fkey" FOREIGN KEY ("id_autor") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empleos" ADD CONSTRAINT "empleos_id_autor_fkey" FOREIGN KEY ("id_autor") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postulaciones" ADD CONSTRAINT "postulaciones_id_empleo_fkey" FOREIGN KEY ("id_empleo") REFERENCES "empleos"("id_empleo") ON DELETE CASCADE ON UPDATE CASCADE;

