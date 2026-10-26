// Campañas agrícolas con fecha de inicio distinta cada año.
//
// La «Campaña 2026» empieza en 2025 (p. ej. 18/08/2025) y termina el día antes de que empiece la 2027.
// La fecha real de inicio de cada campaña se guarda en Ajustes (tabla params, clave «campana_inicio_2026»,
// valor 20250818). Si una campaña no tiene fecha propia, se usa el día y mes por defecto de Ajustes.
import { getParamValue } from './params'

const PREFIJO = 'campana_inicio_'
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']

/** Clave en params para la fecha de inicio de la campaña n */
export const claveInicio = (n) => `${PREFIJO}${n}`

/** 20250818 → Date(2025-08-18) */
function deNumero(v) {
  const s = String(Math.round(Number(v)))
  if (!/^\d{8}$/.test(s)) return null
  const d = new Date(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8)))
  return Number.isNaN(d.getTime()) ? null : d
}

/** Date o 'yyyy-mm-dd' → 20250818 */
export function aNumero(fecha) {
  const s = typeof fecha === 'string' ? fecha.substring(0, 10) : `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`
  return Number(s.replace(/-/g, ''))
}

export const aISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * Construye el calendario de campañas a partir de los parámetros de Ajustes.
 * @returns {{ inicio(n): Date, rango(n): {start: Date, end: Date}, campanaDe(fecha): number|null, etiqueta(n): string, propias: Map<number, Date> }}
 */
export function calendarioCampanas(params = []) {
  const mes = getParamValue(params, ['campana_mes_inicio'], 9)
  const dia = getParamValue(params, ['campana_dia_inicio'], 15)
  const propias = new Map()
  for (const p of params || []) {
    if (!String(p.clave || '').startsWith(PREFIJO)) continue
    const n = parseInt(p.clave.slice(PREFIJO.length), 10)
    const d = deNumero(p.valor)
    if (n && d) propias.set(n, d)
  }

  const inicio = (n) => propias.get(n) || new Date(n - 1, mes - 1, dia)
  // Fin: el día en que empieza la siguiente (no incluido)
  const rango = (n) => ({ start: inicio(n), end: inicio(n + 1) })

  const campanaDe = (fecha) => {
    if (!fecha) return null
    const d = fecha instanceof Date ? new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()) : new Date(String(fecha).substring(0, 10) + 'T00:00:00')
    if (Number.isNaN(d.getTime())) return null
    // Una fecha del año Y pertenece a la campaña Y (si aún no empezó la Y+1) o a la Y+1
    const y = d.getFullYear()
    for (const n of [y + 1, y, y + 2, y - 1]) {
      const { start, end } = rango(n)
      if (d >= start && d < end) return n
    }
    return null
  }

  const corta = (d) => `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`
  const etiqueta = (n) => {
    const { start, end } = rango(n)
    const fin = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1)
    return `Campaña ${n} (${corta(start)} – ${corta(fin)})`
  }

  return { inicio, rango, campanaDe, etiqueta, propias, mes, dia }
}
