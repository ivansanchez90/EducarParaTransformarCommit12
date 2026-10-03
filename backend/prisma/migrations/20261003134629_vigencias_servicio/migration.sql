-- CreateTable
CREATE TABLE "vigencias_servicio" (
    "id_vigencia" SERIAL NOT NULL,
    "id_alumno" INTEGER NOT NULL,
    "concepto" TEXT NOT NULL,
    "id_referencia" INTEGER,
    "desde" TIMESTAMPTZ(6) NOT NULL,
    "hasta" TIMESTAMPTZ(6),

    CONSTRAINT "vigencias_servicio_pkey" PRIMARY KEY ("id_vigencia")
);

-- CreateIndex
CREATE INDEX "vigencias_servicio_id_alumno_concepto_idx" ON "vigencias_servicio"("id_alumno", "concepto");

-- AddForeignKey
ALTER TABLE "vigencias_servicio" ADD CONSTRAINT "vigencias_servicio_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumnos"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- Lo que ya está inscripto queda vigente desde su fecha de inscripción. De las
-- actividades solo los deportes: es lo único que se factura.
INSERT INTO "vigencias_servicio" ("id_alumno", "concepto", "id_referencia", "desde")
SELECT i."id_alumno", 'Deporte', i."id_actividad", i."fecha_inscripcion"
FROM "inscripciones_actividades" i
JOIN "actividades_extracurriculares" a ON a."id_actividad" = i."id_actividad"
WHERE a."tipo" = 'Deporte'
UNION ALL
SELECT "id_alumno", 'Transporte', "id_recorrido", "fecha_inscripcion" FROM "inscripciones_transporte"
UNION ALL
SELECT "id_alumno", 'Comedor', NULL, "fecha_inscripcion" FROM "inscripciones_comedor";
