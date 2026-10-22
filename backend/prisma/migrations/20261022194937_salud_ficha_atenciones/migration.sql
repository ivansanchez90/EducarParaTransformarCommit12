-- CreateTable
CREATE TABLE "fichas_medicas" (
    "id_ficha" SERIAL NOT NULL,
    "id_alumno" INTEGER NOT NULL,
    "grupo_sanguineo" TEXT,
    "alergias" TEXT,
    "alergias_criticas" TEXT,
    "medicacion" TEXT,
    "condiciones" TEXT,
    "observaciones" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "fichas_medicas_pkey" PRIMARY KEY ("id_ficha")
);

-- CreateTable
CREATE TABLE "atenciones_enfermeria" (
    "id_atencion" SERIAL NOT NULL,
    "id_alumno" INTEGER NOT NULL,
    "fecha_hora" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo" TEXT NOT NULL,
    "descripcion" TEXT,
    "tratamiento" TEXT,
    "id_usuario_registra" UUID,
    "familia_avisada" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atenciones_enfermeria_pkey" PRIMARY KEY ("id_atencion")
);

-- CreateTable
CREATE TABLE "auditoria_salud" (
    "id_auditoria" SERIAL NOT NULL,
    "id_alumno" INTEGER NOT NULL,
    "entidad" TEXT NOT NULL,
    "id_registro" INTEGER,
    "accion" TEXT NOT NULL,
    "cambios" JSONB,
    "id_usuario" UUID,
    "fecha_hora" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_salud_pkey" PRIMARY KEY ("id_auditoria")
);

-- CreateIndex
CREATE UNIQUE INDEX "fichas_medicas_id_alumno_key" ON "fichas_medicas"("id_alumno");

-- CreateIndex
CREATE INDEX "atenciones_enfermeria_id_alumno_fecha_hora_idx" ON "atenciones_enfermeria"("id_alumno", "fecha_hora");

-- CreateIndex
CREATE INDEX "auditoria_salud_id_alumno_fecha_hora_idx" ON "auditoria_salud"("id_alumno", "fecha_hora");

-- AddForeignKey
ALTER TABLE "fichas_medicas" ADD CONSTRAINT "fichas_medicas_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumnos"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atenciones_enfermeria" ADD CONSTRAINT "atenciones_enfermeria_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumnos"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atenciones_enfermeria" ADD CONSTRAINT "atenciones_enfermeria_id_usuario_registra_fkey" FOREIGN KEY ("id_usuario_registra") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria_salud" ADD CONSTRAINT "auditoria_salud_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumnos"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria_salud" ADD CONSTRAINT "auditoria_salud_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;
