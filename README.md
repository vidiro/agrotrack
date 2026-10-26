# AGROtrack - El papeleo del campo, hecho (v1.8)

PWA para la gestión de explotaciones de viña y olivar.

## Arranque

```bash
cp .env.example .env
# Edita .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

## Seguridad (obligatorio)

1. En Supabase, crea un usuario: Authentication → Users → Add user.
2. Desactiva el registro público (Authentication → Providers → Email → *Allow new users to sign up*): las políticas RLS dan acceso completo a cualquier usuario autenticado.
3. Ejecuta en Supabase `docs/SQL_migracion_v1.4_amortizaciones.sql` y después `docs/SQL_migracion_v1.8_papeleo.sql` (incluye las v1.5–v1.7; se puede repetir sin riesgo).
4. En Vercel, define las mismas variables que en `.env`. No incrustes claves en el código.

## Navegación

Cuatro bloques más Inicio (lista de pendientes):

- **Campo**: Labores, Tratamientos, Cosechas
- **Dinero**: Gastos, Facturas, Ingresos, Finanzas, Inversiones
- **Fincas**: Fincas, Detalle finca, Personal, Maquinaria, Inventario, Destinos
- **Papeles**: Informes, Ayudas, Vencimientos, Cuaderno de tratamientos, Jornadas, Gestoría

Escritorio: menú lateral agrupado. Móvil: barra inferior con los bloques y pestañas arriba. Ajustes, en el engranaje.

## Papeleo

- **Facturas**: foto o PDF adjunto (Supabase Storage, carpeta privada `documentos`) y lectura automática con Tesseract en el propio dispositivo (CIF, nº, fecha, total).
- **Ayudas**: expediente con lista de documentos, facturas vinculadas, justificantes de pago y descarga en ZIP con índice PDF.
- **Vencimientos**: ITV, ITEAF, seguros, carnés, PAC… con aviso en Inicio.
- **Cuaderno de tratamientos**: registro de tratamientos fitosanitarios en PDF/CSV.
- **Jornadas**: días y horas por trabajador (PDF/CSV).
- **Gestoría**: ZIP trimestral con resumen, libro de gastos/facturas, ingresos y fotos.
- **Copia de seguridad** (Ajustes): ZIP con todas las tablas en JSON y CSV.

## Uso en el campo

- PWA instalable que abre sin cobertura (vite-plugin-pwa). Las lecturas se guardan en caché y las altas de labores, cosechas, gastos y facturas sin foto se encolan y se envían al volver la señal (`src/utils/offline.js`).
- Modo campo (alto contraste, botones grandes) y tablas en tarjetas en el móvil (`src/utils/tablasMovil.js`).

## Pruebas

`npm test` (vitest): cálculos de recuperación, labores, NIF, pendientes, jornadas y lectura de facturas.

## Base de datos

Tablas: `fincas`, `personal`, `maquinaria`, `labores`, `aplicaciones`, `cosechas`, `gastos_manual`, `ingresos`, `inventario`, `params`, `destinos`, `precios_destino`, `amortizaciones`.

## Notas de código

- Para leer tablas que crecen (labores, cosechas, gastos, ingresos, aplicaciones) usa `fetchAll()` de `src/utils/fetchAll.js`: Supabase devuelve como máximo 1000 filas por consulta.
- Una labor (jornada) puede abarcar varias fincas: usa `src/utils/labores.js` (`parseSecciones`, `laborIncluyeFinca`, `laborShareFinca`) en lugar de `labor.id_finca`, que solo guarda la primera.
- Iconos: `lucide-react` con importaciones explícitas; los iconos por nombre se registran en `src/utils/lucideIcons.jsx`.
- Las páginas y la generación de PDF se cargan bajo demanda (`React.lazy` / `import()`).
- **Inversiones** (tabla `amortizaciones`): la categoría «Terreno» no se amortiza (cuota 0). Todo lo registrado con finca cuenta como inversión de esa finca.
- **Gastos de categoría «Inversión»**: se listan en Gastos y en el detalle del PDF (justificación de ayudas), pero no restan en balances ni costes (`src/utils/gastos.js`). Cuentan como inversión de su finca; si además se registran en Inversiones, vincúlalos (migración `docs/SQL_migracion_v1.5_inversiones.sql`) para no contarlos dos veces.
- **Facturas**: cada factura es un gasto con `num_factura`, `proveedor` y `nif_proveedor` (migración v1.6). La pestaña Facturas las lista, avisa de NIF incorrectos o facturas repetidas y exporta a CSV. Las empresas (nombre + CIF) se guardan en `proveedores` (migración v1.7) para autocompletar.
- **Recuperación de la inversión** (`src/utils/inversion.js`): por campaña, ingresos (cobros de cosecha o valor estimado si no hay cobro, más ayudas repartidas por hectáreas) − costes de labores − gastos (los generales, por hectáreas). Se ve en Detalle Finca e Informes.

## Tecnologías

React 18, Vite, Supabase, Recharts, date-fns, jsPDF, JSZip, Tesseract.js, vite-plugin-pwa, Vitest.
