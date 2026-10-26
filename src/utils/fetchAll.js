import { supabase } from '../data/supabaseClient'

const PAGE_SIZE = 1000

// Clave primaria por tabla: se añade como orden secundario para que la paginación sea estable
// (si solo se ordena por fecha, filas con la misma fecha podrían repetirse o saltarse entre páginas)
const PRIMARY_KEYS = {
  labores: 'id_labor',
  cosechas: 'id_cosecha',
  gastos_manual: 'id_gasto',
  ingresos: 'id_ingreso',
  aplicaciones: 'id_aplicacion',
}

/**
 * Descarga todas las filas de una tabla, paginando de 1000 en 1000.
 * Supabase devuelve como máximo 1000 filas por consulta; sin paginar,
 * los totales y los informes se quedarían cortos sin avisar.
 *
 * @param {string} table - Nombre de la tabla
 * @param {(q: any) => any} [build] - Para añadir filtros/orden: q => q.eq(...).order(...)
 * @returns {Promise<{ data: any[] | null, error: any }>}
 */
export async function fetchAll(table, build) {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase.from(table).select('*')
    if (build) query = build(query)
    if (PRIMARY_KEYS[table]) query = query.order(PRIMARY_KEYS[table], { ascending: true })
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1)
    if (error) return { data: null, error }
    rows.push(...(data || []))
    if (!data || data.length < PAGE_SIZE) break
  }
  return { data: rows, error: null }
}

// true si el error indica que la tabla aún no existe (migración pendiente)
export function isMissingTable(error) {
  const msg = error?.message || ''
  return error?.code === '42P01' || error?.code === 'PGRST205' || msg.includes('Could not find the table') || msg.includes('does not exist')
}
