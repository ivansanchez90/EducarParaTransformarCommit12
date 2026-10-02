-- AlterTable
ALTER TABLE "pagos" ADD COLUMN     "id_comprobante" INTEGER,
ADD COLUMN     "id_factura" INTEGER;

-- CreateTable
CREATE TABLE "tarifas" (
    "id_tarifa" SERIAL NOT NULL,
    "concepto" TEXT NOT NULL,
    "nivel" TEXT,
    "id_referencia" INTEGER,
    "importe" DECIMAL(12,2) NOT NULL,
    "vigente_desde" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tarifas_pkey" PRIMARY KEY ("id_tarifa")
);

-- CreateTable
CREATE TABLE "facturas" (
    "id_factura" SERIAL NOT NULL,
    "id_alumno" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "numero" SERIAL NOT NULL,
    "fecha_emision" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_vencimiento" DATE NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "saldo" DECIMAL(12,2) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'Pendiente',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facturas_pkey" PRIMARY KEY ("id_factura")
);

-- CreateTable
CREATE TABLE "items_factura" (
    "id_item" SERIAL NOT NULL,
    "id_factura" INTEGER NOT NULL,
    "concepto" TEXT NOT NULL,
    "id_referencia" INTEGER,
    "descripcion" TEXT NOT NULL,
    "importe" DECIMAL(12,2) NOT NULL,
    "saldo" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "items_factura_pkey" PRIMARY KEY ("id_item")
);

-- CreateTable
CREATE TABLE "ordenes_pago" (
    "id_orden" SERIAL NOT NULL,
    "id_factura" INTEGER NOT NULL,
    "numero" SERIAL NOT NULL,
    "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" DECIMAL(12,2) NOT NULL,
    "id_usuario" UUID,

    CONSTRAINT "ordenes_pago_pkey" PRIMARY KEY ("id_orden")
);

-- CreateTable
CREATE TABLE "ordenes_pago_items" (
    "id_orden" INTEGER NOT NULL,
    "id_item" INTEGER NOT NULL,
    "importe" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "ordenes_pago_items_pkey" PRIMARY KEY ("id_orden","id_item")
);

-- CreateTable
CREATE TABLE "comprobantes_transferencia" (
    "id_comprobante" SERIAL NOT NULL,
    "id_factura" INTEGER NOT NULL,
    "id_orden" INTEGER,
    "archivo" TEXT NOT NULL,
    "importe" DECIMAL(12,2) NOT NULL,
    "fecha_transferencia" DATE NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'En revisión',
    "motivo_rechazo" TEXT,
    "id_usuario_carga" UUID,
    "fecha_carga" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_usuario_revisa" UUID,
    "fecha_revision" TIMESTAMPTZ(6),

    CONSTRAINT "comprobantes_transferencia_pkey" PRIMARY KEY ("id_comprobante")
);

-- CreateTable
CREATE TABLE "imputaciones_pago" (
    "id_imputacion" SERIAL NOT NULL,
    "id_pago" INTEGER NOT NULL,
    "id_item" INTEGER NOT NULL,
    "importe" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "imputaciones_pago_pkey" PRIMARY KEY ("id_imputacion")
);

-- CreateTable
CREATE TABLE "envios_email" (
    "id_envio" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "id_usuario" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'Pendiente',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "enviado_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "envios_email_pkey" PRIMARY KEY ("id_envio")
);

-- CreateTable
CREATE TABLE "tokens_recuperacion" (
    "id_token" SERIAL NOT NULL,
    "id_usuario" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira_at" TIMESTAMPTZ(6) NOT NULL,
    "usado_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_recuperacion_pkey" PRIMARY KEY ("id_token")
);

-- CreateIndex
CREATE INDEX "tarifas_concepto_nivel_id_referencia_vigente_desde_idx" ON "tarifas"("concepto", "nivel", "id_referencia", "vigente_desde");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_numero_key" ON "facturas"("numero");

-- CreateIndex
CREATE INDEX "facturas_anio_mes_idx" ON "facturas"("anio", "mes");

-- CreateIndex
CREATE INDEX "facturas_estado_idx" ON "facturas"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_id_alumno_anio_mes_key" ON "facturas"("id_alumno", "anio", "mes");

-- CreateIndex
CREATE INDEX "items_factura_id_factura_idx" ON "items_factura"("id_factura");

-- CreateIndex
CREATE INDEX "items_factura_concepto_id_referencia_idx" ON "items_factura"("concepto", "id_referencia");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_pago_numero_key" ON "ordenes_pago"("numero");

-- CreateIndex
CREATE INDEX "ordenes_pago_id_factura_idx" ON "ordenes_pago"("id_factura");

-- CreateIndex
CREATE INDEX "comprobantes_transferencia_id_factura_idx" ON "comprobantes_transferencia"("id_factura");

-- CreateIndex
CREATE INDEX "comprobantes_transferencia_estado_idx" ON "comprobantes_transferencia"("estado");

-- CreateIndex
CREATE INDEX "imputaciones_pago_id_item_idx" ON "imputaciones_pago"("id_item");

-- CreateIndex
CREATE UNIQUE INDEX "imputaciones_pago_id_pago_id_item_key" ON "imputaciones_pago"("id_pago", "id_item");

-- CreateIndex
CREATE INDEX "envios_email_estado_idx" ON "envios_email"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "envios_email_tipo_anio_mes_id_usuario_key" ON "envios_email"("tipo", "anio", "mes", "id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_recuperacion_token_hash_key" ON "tokens_recuperacion"("token_hash");

-- CreateIndex
CREATE INDEX "tokens_recuperacion_id_usuario_idx" ON "tokens_recuperacion"("id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_id_comprobante_key" ON "pagos"("id_comprobante");

-- CreateIndex
CREATE INDEX "pagos_id_factura_idx" ON "pagos"("id_factura");

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_id_factura_fkey" FOREIGN KEY ("id_factura") REFERENCES "facturas"("id_factura") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_id_comprobante_fkey" FOREIGN KEY ("id_comprobante") REFERENCES "comprobantes_transferencia"("id_comprobante") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumnos"("id_alumno") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_factura" ADD CONSTRAINT "items_factura_id_factura_fkey" FOREIGN KEY ("id_factura") REFERENCES "facturas"("id_factura") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_pago" ADD CONSTRAINT "ordenes_pago_id_factura_fkey" FOREIGN KEY ("id_factura") REFERENCES "facturas"("id_factura") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_pago" ADD CONSTRAINT "ordenes_pago_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_pago_items" ADD CONSTRAINT "ordenes_pago_items_id_orden_fkey" FOREIGN KEY ("id_orden") REFERENCES "ordenes_pago"("id_orden") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_pago_items" ADD CONSTRAINT "ordenes_pago_items_id_item_fkey" FOREIGN KEY ("id_item") REFERENCES "items_factura"("id_item") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes_transferencia" ADD CONSTRAINT "comprobantes_transferencia_id_factura_fkey" FOREIGN KEY ("id_factura") REFERENCES "facturas"("id_factura") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes_transferencia" ADD CONSTRAINT "comprobantes_transferencia_id_orden_fkey" FOREIGN KEY ("id_orden") REFERENCES "ordenes_pago"("id_orden") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes_transferencia" ADD CONSTRAINT "comprobantes_transferencia_id_usuario_carga_fkey" FOREIGN KEY ("id_usuario_carga") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes_transferencia" ADD CONSTRAINT "comprobantes_transferencia_id_usuario_revisa_fkey" FOREIGN KEY ("id_usuario_revisa") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imputaciones_pago" ADD CONSTRAINT "imputaciones_pago_id_pago_fkey" FOREIGN KEY ("id_pago") REFERENCES "pagos"("id_pago") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imputaciones_pago" ADD CONSTRAINT "imputaciones_pago_id_item_fkey" FOREIGN KEY ("id_item") REFERENCES "items_factura"("id_item") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envios_email" ADD CONSTRAINT "envios_email_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens_recuperacion" ADD CONSTRAINT "tokens_recuperacion_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- Migración de datos: cada cuota existente pasa a ser una factura del mismo
-- alumno y período, con un ítem "Cuota", un ítem "Recargo" si tenía recargo y
-- un ítem "Beca" (negativo) si tenía descuento. La tabla `cuotas` no se toca:
-- las pantallas actuales la siguen usando hasta que T08 las reemplace.
-- ─────────────────────────────────────────────────────────────

-- Facturas, numeradas en orden cronológico.
INSERT INTO "facturas" ("id_alumno", "anio", "mes", "fecha_emision", "fecha_vencimiento", "total", "saldo", "estado", "created_at")
SELECT
    c."id_alumno",
    c."anio",
    c."mes",
    (c."created_at" AT TIME ZONE 'America/Argentina/Buenos_Aires')::date,
    c."fecha_vencimiento",
    c."monto_base" + COALESCE(c."recargo", 0) - COALESCE(c."descuento", 0),
    CASE WHEN c."estado" = 'Pagada' THEN 0
         ELSE c."monto_base" + COALESCE(c."recargo", 0) - COALESCE(c."descuento", 0) END,
    CASE c."estado" WHEN 'Pagada' THEN 'Pagada'
                    WHEN 'Pendiente' THEN 'Pendiente'
                    ELSE 'Vencida' END,
    c."created_at"
FROM "cuotas" c
ORDER BY c."anio", c."mes", c."id_cuota";

-- Ítems de cada factura. Las facturas pagadas quedan con saldo 0 en todos.
INSERT INTO "items_factura" ("id_factura", "concepto", "descripcion", "importe", "saldo")
SELECT f."id_factura", i."concepto", i."descripcion", i."importe",
       CASE WHEN c."estado" = 'Pagada' THEN 0 ELSE i."importe" END
FROM "cuotas" c
JOIN "facturas" f ON f."id_alumno" = c."id_alumno" AND f."anio" = c."anio" AND f."mes" = c."mes"
CROSS JOIN LATERAL (
    VALUES
        (1, 'Cuota', 'Cuota ' || (ARRAY['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'])[c."mes"] || ' ' || c."anio", c."monto_base"),
        (2, 'Recargo', 'Recargo por mora', COALESCE(c."recargo", 0)),
        (3, 'Beca', 'Beca', -COALESCE(c."descuento", 0))
) AS i("orden", "concepto", "descripcion", "importe")
WHERE i."concepto" = 'Cuota' OR i."importe" <> 0
ORDER BY f."id_factura", i."orden";

-- Los pagos registrados sobre una cuota quedan ligados a su factura.
UPDATE "pagos" p
SET "id_factura" = f."id_factura"
FROM "cuotas" c
JOIN "facturas" f ON f."id_alumno" = c."id_alumno" AND f."anio" = c."anio" AND f."mes" = c."mes"
WHERE p."id_cuota" = c."id_cuota";

-- El pago de cada factura pagada se imputa a todos sus ítems. Si una cuota
-- tuviera más de un pago, se imputa el más reciente.
INSERT INTO "imputaciones_pago" ("id_pago", "id_item", "importe")
SELECT p."id_pago", it."id_item", it."importe"
FROM (
    SELECT DISTINCT ON (p."id_factura") p."id_pago", p."id_factura"
    FROM "pagos" p
    JOIN "facturas" f ON f."id_factura" = p."id_factura"
    WHERE f."estado" = 'Pagada'
    ORDER BY p."id_factura", p."fecha_pago" DESC NULLS LAST, p."id_pago" DESC
) p
JOIN "items_factura" it ON it."id_factura" = p."id_factura";
