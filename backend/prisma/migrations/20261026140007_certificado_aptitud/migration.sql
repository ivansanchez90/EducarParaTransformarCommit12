-- CreateTable
CREATE TABLE "certificados_aptitud" (
    "id_certificado" SERIAL NOT NULL,
    "id_alumno" INTEGER NOT NULL,
    "fecha_emision" DATE NOT NULL,
    "fecha_vencimiento" DATE NOT NULL,
    "observaciones" TEXT,
    "id_usuario_registra" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificados_aptitud_pkey" PRIMARY KEY ("id_certificado")
);

-- CreateIndex
CREATE INDEX "certificados_aptitud_id_alumno_fecha_vencimiento_idx" ON "certificados_aptitud"("id_alumno", "fecha_vencimiento");

-- AddForeignKey
ALTER TABLE "certificados_aptitud" ADD CONSTRAINT "certificados_aptitud_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumnos"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificados_aptitud" ADD CONSTRAINT "certificados_aptitud_id_usuario_registra_fkey" FOREIGN KEY ("id_usuario_registra") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;
