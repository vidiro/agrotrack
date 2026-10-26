-- ============================================================
-- AGROtrack - Migración v1.7 - Empresas guardadas (proveedores)
-- Fecha: 2026-10-22
-- ============================================================
-- Guarda nombre y NIF/CIF de cada empresa para autocompletar facturas.
-- Crea una tabla nueva: no modifica ni borra datos existentes.

-- (Por si no se aplicó la v1.6: columnas de factura en gastos)
ALTER TABLE gastos_manual ADD COLUMN IF NOT EXISTS num_factura   TEXT;
ALTER TABLE gastos_manual ADD COLUMN IF NOT EXISTS proveedor     TEXT;
ALTER TABLE gastos_manual ADD COLUMN IF NOT EXISTS nif_proveedor TEXT;

CREATE TABLE IF NOT EXISTS proveedores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  nif TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Un mismo nombre no se guarda dos veces (sin distinguir mayúsculas)
CREATE UNIQUE INDEX IF NOT EXISTS proveedores_nombre_unico ON proveedores (lower(nombre));

-- Mismas reglas de acceso que el resto de tablas: solo usuarios autenticados
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "proveedores_read" ON proveedores;
CREATE POLICY "proveedores_read" ON proveedores FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "proveedores_insert" ON proveedores;
CREATE POLICY "proveedores_insert" ON proveedores FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "proveedores_update" ON proveedores;
CREATE POLICY "proveedores_update" ON proveedores FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "proveedores_delete" ON proveedores;
CREATE POLICY "proveedores_delete" ON proveedores FOR DELETE TO authenticated USING (true);

-- Rellena la tabla con las empresas que ya tienes en gastos/facturas
INSERT INTO proveedores (nombre, nif)
SELECT DISTINCT ON (lower(trim(proveedor))) trim(proveedor), nif_proveedor
FROM gastos_manual
WHERE proveedor IS NOT NULL AND trim(proveedor) <> ''
ORDER BY lower(trim(proveedor)), (nif_proveedor IS NULL), fecha DESC
ON CONFLICT DO NOTHING;
