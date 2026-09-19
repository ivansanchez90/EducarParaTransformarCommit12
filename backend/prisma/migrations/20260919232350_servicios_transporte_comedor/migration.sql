-- CreateTable
CREATE TABLE "recorridos_transporte" (
    "id_recorrido" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "zona" TEXT,
    "paradas" TEXT,
    "hora_ida" TIME(0),
    "hora_vuelta" TIME(0),
    "capacidad" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recorridos_transporte_pkey" PRIMARY KEY ("id_recorrido")
);

-- CreateTable
CREATE TABLE "inscripciones_transporte" (
    "id_inscripcion_transporte" SERIAL NOT NULL,
    "id_alumno" INTEGER NOT NULL,
    "id_recorrido" INTEGER NOT NULL,
    "observaciones" TEXT,
    "fecha_inscripcion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inscripciones_transporte_pkey" PRIMARY KEY ("id_inscripcion_transporte")
);

-- CreateTable
CREATE TABLE "inscripciones_comedor" (
    "id_inscripcion_comedor" SERIAL NOT NULL,
    "id_alumno" INTEGER NOT NULL,
    "observaciones" TEXT,
    "fecha_inscripcion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inscripciones_comedor_pkey" PRIMARY KEY ("id_inscripcion_comedor")
);

-- CreateIndex
CREATE UNIQUE INDEX "inscripciones_transporte_id_alumno_key" ON "inscripciones_transporte"("id_alumno");

-- CreateIndex
CREATE INDEX "inscripciones_transporte_id_recorrido_idx" ON "inscripciones_transporte"("id_recorrido");

-- CreateIndex
CREATE UNIQUE INDEX "inscripciones_comedor_id_alumno_key" ON "inscripciones_comedor"("id_alumno");

-- AddForeignKey
ALTER TABLE "inscripciones_transporte" ADD CONSTRAINT "inscripciones_transporte_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumnos"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripciones_transporte" ADD CONSTRAINT "inscripciones_transporte_id_recorrido_fkey" FOREIGN KEY ("id_recorrido") REFERENCES "recorridos_transporte"("id_recorrido") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripciones_comedor" ADD CONSTRAINT "inscripciones_comedor_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumnos"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;
