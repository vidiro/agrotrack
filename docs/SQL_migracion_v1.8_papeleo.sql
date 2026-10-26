-- ============================================================
-- AGROtrack - Migración v1.8 - Papeleo (todo en uno)
-- Fecha: 2026-10-22
-- ============================================================
-- Se puede ejecutar aunque ya aplicaras la v1.5, v1.6 o v1.7: todo es «si no existe».
-- Solo añade columnas y tablas nuevas: no modifica ni borra datos.
-- Supabase → SQL Editor → New query → pegar → Run.

-- ---------- Facturas (v1.6) + foto y justificante de pago ----------
ALTER TABLE gastos_manual ADD COLUMN IF NOT EXISTS num_factura            TEXT;
ALTER TABLE gastos_manual ADD COLUMN IF NOT EXISTS proveedor              TEXT;
ALTER TABLE gastos_manual ADD COLUMN IF NOT EXISTS nif_proveedor          TEXT;
ALTER TABLE gastos_manual ADD COLUMN IF NOT EXISTS adjunto_path           TEXT;
ALTER TABLE gastos_manual ADD COLUMN IF NOT EXISTS justificante_pago_path TEXT;
ALTER TABLE gastos_manual ADD COLUMN IF NOT EXISTS fecha_pago             DATE;
CREATE INDEX IF NOT EXISTS gastos_manual_factura_idx ON gastos_manual (nif_proveedor, num_factura);

-- ---------- Inversiones vinculadas a gastos (v1.5) ----------
ALTER TABLE IF EXISTS amortizaciones ADD COLUMN IF NOT EXISTS id_gasto TEXT;

-- ---------- Cuaderno de tratamientos ----------
ALTER TABLE aplicaciones ADD COLUMN IF NOT EXISTS fecha_aplicacion DATE;
ALTER TABLE aplicaciones ADD COLUMN IF NOT EXISTS num_registro     TEXT;
ALTER TABLE aplicaciones ADD COLUMN IF NOT EXISTS cultivo          TEXT;
ALTER TABLE aplicaciones ADD COLUMN IF NOT EXISTS superficie_ha    NUMERIC(10,2);
ALTER TABLE aplicaciones ADD COLUMN IF NOT EXISTS aplicador        TEXT;
ALTER TABLE aplicaciones ADD COLUMN IF NOT EXISTS carnet_aplicador TEXT;
ALTER TABLE aplicaciones ADD COLUMN IF NOT EXISTS id_equipo        TEXT;

-- ---------- Empresas guardadas (v1.7) ----------
CREATE TABLE IF NOT EXISTS proveedores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  nif TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS proveedores_nombre_unico ON proveedores (lower(nombre));

-- ---------- Datos del titular ----------
CREATE TABLE IF NOT EXISTS explotacion (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre_titular TEXT,
  nif_titular TEXT,
  rega TEXT,
  direccion TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- Vencimientos (ITV, seguros, carnés, PAC…) ----------
CREATE TABLE IF NOT EXISTS vencimientos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL DEFAULT 'Otro',
  descripcion TEXT,
  fecha DATE NOT NULL,
  aviso_dias INTEGER DEFAULT 30,
  id_equipo TEXT,
  id_operario TEXT,
  hecho BOOLEAN DEFAULT false,
  notas TEXT,
  adjunto_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- Ayudas: expedientes, documentos y facturas ----------
CREATE TABLE IF NOT EXISTS expedientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  organismo TEXT,
  convocatoria TEXT,
  fecha_limite DATE,
  estado TEXT DEFAULT 'Preparando',
  importe_solicitado NUMERIC(12,2),
  id_finca TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expediente_requisitos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_expediente UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  hecho BOOLEAN DEFAULT false,
  orden INTEGER DEFAULT 0,
  adjunto_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expediente_gastos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_expediente UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  id_gasto TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (id_expediente, id_gasto)
);

-- ---------- Acceso: solo usuarios con sesión iniciada ----------

ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "proveedores_todo" ON proveedores;
CREATE POLICY "proveedores_todo" ON proveedores FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE explotacion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "explotacion_todo" ON explotacion;
CREATE POLICY "explotacion_todo" ON explotacion FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE vencimientos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vencimientos_todo" ON vencimientos;
CREATE POLICY "vencimientos_todo" ON vencimientos FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE expedientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "expedientes_todo" ON expedientes;
CREATE POLICY "expedientes_todo" ON expedientes FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE expediente_requisitos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "expediente_requisitos_todo" ON expediente_requisitos;
CREATE POLICY "expediente_requisitos_todo" ON expediente_requisitos FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE expediente_gastos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "expediente_gastos_todo" ON expediente_gastos;
CREATE POLICY "expediente_gastos_todo" ON expediente_gastos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------- Carpeta privada para fotos y PDF ----------
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "documentos_leer" ON storage.objects;
CREATE POLICY "documentos_leer" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documentos');
DROP POLICY IF EXISTS "documentos_subir" ON storage.objects;
CREATE POLICY "documentos_subir" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documentos');
DROP POLICY IF EXISTS "documentos_cambiar" ON storage.objects;
CREATE POLICY "documentos_cambiar" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'documentos');
DROP POLICY IF EXISTS "documentos_borrar" ON storage.objects;
CREATE POLICY "documentos_borrar" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documentos');

-- ---------- Rellenar empresas guardadas con las que ya hay en gastos ----------
INSERT INTO proveedores (nombre, nif)
SELECT DISTINCT ON (lower(trim(proveedor))) trim(proveedor), nif_proveedor
FROM gastos_manual
WHERE proveedor IS NOT NULL AND trim(proveedor) <> ''
ORDER BY lower(trim(proveedor)), (nif_proveedor IS NULL), fecha DESC
ON CONFLICT DO NOTHING;
