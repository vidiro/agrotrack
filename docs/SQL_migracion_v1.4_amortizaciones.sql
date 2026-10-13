-- ============================================================
-- AGROtrack - Migración v1.4 - Tabla de Amortizaciones
-- Fecha: 2026-09-26
-- ============================================================

-- Tabla de amortizaciones
CREATE TABLE IF NOT EXISTS amortizaciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_finca TEXT,
  fecha_compra TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  categoria TEXT DEFAULT 'Otro',
  importe_compra NUMERIC(12,2) NOT NULL DEFAULT 0,
  meses_amortizacion INTEGER NOT NULL DEFAULT 12,
  valor_residual NUMERIC(12,2) DEFAULT 0,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE amortizaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "amortizaciones_read" ON amortizaciones;
CREATE POLICY "amortizaciones_read" ON amortizaciones FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "amortizaciones_insert" ON amortizaciones;
CREATE POLICY "amortizaciones_insert" ON amortizaciones FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "amortizaciones_update" ON amortizaciones;
CREATE POLICY "amortizaciones_update" ON amortizaciones FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "amortizaciones_delete" ON amortizaciones;
CREATE POLICY "amortizaciones_delete" ON amortizaciones FOR DELETE
  TO authenticated USING (true);

-- FK reference (optional, text-based)
-- COMMENT ON COLUMN amortizaciones.id_finca IS 'Referencia a fincas.id_finca (text)';
