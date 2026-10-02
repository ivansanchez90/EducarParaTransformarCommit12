-- AlterTable
ALTER TABLE "actividades_extracurriculares" ADD COLUMN     "id_docente" INTEGER;

-- CreateTable
CREATE TABLE "horarios_actividades" (
    "id_horario_actividad" SERIAL NOT NULL,
    "id_actividad" INTEGER NOT NULL,
    "dia_semana" TEXT NOT NULL,
    "hora_inicio" TIME(0) NOT NULL,
    "hora_fin" TIME(0) NOT NULL,

    CONSTRAINT "horarios_actividades_pkey" PRIMARY KEY ("id_horario_actividad")
);

-- CreateIndex
CREATE INDEX "horarios_actividades_id_actividad_idx" ON "horarios_actividades"("id_actividad");

-- CreateIndex
CREATE INDEX "actividades_extracurriculares_id_docente_idx" ON "actividades_extracurriculares"("id_docente");

-- AddForeignKey
ALTER TABLE "actividades_extracurriculares" ADD CONSTRAINT "actividades_extracurriculares_id_docente_fkey" FOREIGN KEY ("id_docente") REFERENCES "docentes"("id_docente") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios_actividades" ADD CONSTRAINT "horarios_actividades_id_actividad_fkey" FOREIGN KEY ("id_actividad") REFERENCES "actividades_extracurriculares"("id_actividad") ON DELETE CASCADE ON UPDATE CASCADE;
