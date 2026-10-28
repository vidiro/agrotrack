-- AGROtrack v2.0 · Abonados (fertilización) en la pestaña Tratamientos
-- Desde el 1 de enero de 2026 hay que anotar todas las labores de fertilización en el cuaderno
-- de explotación (RD 1051/2022). Los abonados se guardan en la tabla de tratamientos con tipo = 'fertilizante'.
-- Pegar en Supabase → SQL Editor → New query → Run. Se puede ejecutar más de una vez.

ALTER TABLE aplicaciones ADD COLUMN IF NOT EXISTS tipo              TEXT NOT NULL DEFAULT 'fitosanitario';
ALTER TABLE aplicaciones ADD COLUMN IF NOT EXISTS tipo_fertilizante TEXT;
ALTER TABLE aplicaciones ADD COLUMN IF NOT EXISTS riqueza_n         NUMERIC(6,2);
ALTER TABLE aplicaciones ADD COLUMN IF NOT EXISTS riqueza_p         NUMERIC(6,2);
ALTER TABLE aplicaciones ADD COLUMN IF NOT EXISTS riqueza_k         NUMERIC(6,2);
ALTER TABLE aplicaciones ADD COLUMN IF NOT EXISTS unidad_dosis      TEXT;
ALTER TABLE aplicaciones ADD COLUMN IF NOT EXISTS cantidad_total    NUMERIC(12,2);
ALTER TABLE aplicaciones ADD COLUMN IF NOT EXISTS metodo_aplicacion TEXT;

CREATE INDEX IF NOT EXISTS aplicaciones_tipo_idx ON aplicaciones (tipo);

NOTIFY pgrst, 'reload schema';
