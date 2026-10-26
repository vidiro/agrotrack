-- ============================================================
-- AGROtrack - Migración v1.6 - Datos de factura en gastos
-- Fecha: 2026-10-22
-- ============================================================
-- Cada factura es un gasto con su número, empresa y NIF/CIF.
-- Solo añade columnas vacías: no modifica ni borra datos.

ALTER TABLE gastos_manual ADD COLUMN IF NOT EXISTS num_factura   TEXT;
ALTER TABLE gastos_manual ADD COLUMN IF NOT EXISTS proveedor     TEXT;
ALTER TABLE gastos_manual ADD COLUMN IF NOT EXISTS nif_proveedor TEXT;

-- Búsquedas por empresa y número de factura
CREATE INDEX IF NOT EXISTS gastos_manual_factura_idx ON gastos_manual (nif_proveedor, num_factura);
