-- ============================================================
-- AGROtrack - Migración v1.5 - Vincular inversiones con gastos
-- Fecha: 2026-10-22
-- ============================================================
-- Permite que una inversión (tabla amortizaciones) apunte al gasto
-- que la justifica (tabla gastos_manual, categoría «Inversión»),
-- para que la compra no se cuente dos veces en la recuperación.
-- Es opcional: sin ella la app funciona, pero no se puede vincular.

ALTER TABLE amortizaciones ADD COLUMN IF NOT EXISTS id_gasto TEXT;

COMMENT ON COLUMN amortizaciones.id_gasto IS 'Gasto (gastos_manual.id_gasto) que justifica esta inversión';
