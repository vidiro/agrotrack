# AGROtrack - Gestión Agrícola (v1.3)

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
2. Ejecuta `../docs/SQL_migracion_v1.3.sql` (tabla ingresos, gasóleo y RLS).
3. En Vercel, define las mismas variables que en `.env`. No incrustes claves en el código.

## Navegación

- Escritorio: menú lateral completo.
- Móvil: Inicio, Labores, Cosechas, Finanzas y **Más** (resto de secciones).

## Base de datos

Tablas: `fincas`, `personal`, `maquinaria`, `labores`, `aplicaciones`, `cosechas`, `gastos_manual`, `ingresos`, `inventario`, `params`.

## Tecnologías

React 18, Vite, Supabase, Recharts, date-fns.
