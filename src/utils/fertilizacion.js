// Abonados (fertilización). Se guardan en la misma tabla que los tratamientos (aplicaciones),
// con tipo = 'fertilizante'. Desde 2026 hay que anotar en el cuaderno de explotación todas las
// labores de fertilización (RD 1051/2022 de nutrición sostenible), con los aportes de N, P₂O₅ y K₂O.

export const TIPOS_FERTILIZANTE = ['Mineral', 'Orgánico (estiércol, compost…)', 'Órgano-mineral', 'Foliar', 'Enmienda (cal, yeso…)']
export const METODOS_APLICACION = ['Abonadora (a voleo)', 'Localizado', 'Fertirrigación', 'Foliar (pulverizado)', 'Enterrado']
export const UNIDADES_DOSIS = ['kg/ha', 'L/ha', 't/ha']

const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/** Las filas antiguas (sin tipo) son tratamientos fitosanitarios */
export const esFertilizante = (a) => a?.tipo === 'fertilizante'
export const esFitosanitario = (a) => !esFertilizante(a)

/** «15-15-15», «20.5-0-0», «8/15/15» → { n, p, k } (en %). Devuelve null si no se reconoce. */
export function leerNPK(texto) {
  const m = String(texto || '').trim().match(/^(\d+(?:[.,]\d+)?)\s*[-/ ]\s*(\d+(?:[.,]\d+)?)\s*[-/ ]\s*(\d+(?:[.,]\d+)?)/)
  if (!m) return null
  return { n: num(m[1]), p: num(m[2]), k: num(m[3]) }
}

/** Dosis en kg/ha (las t/ha se pasan a kg; los L/ha se toman como kg, densidad ≈ 1) */
export function dosisKgHa(a) {
  const d = num(a?.dosis)
  return a?.unidad_dosis === 't/ha' ? d * 1000 : d
}

/**
 * Aportes de nutrientes en kg/ha (unidades fertilizantes) y totales en la superficie abonada.
 * N = dosis (kg/ha) × riqueza N (%) / 100, igual para P₂O₅ y K₂O.
 */
export function aportes(a, superficieHa = null) {
  const kg = dosisKgHa(a)
  const ha = superficieHa != null ? num(superficieHa) : num(a?.superficie_ha)
  const r = (v) => Math.round(v * 10) / 10
  const n = (kg * num(a?.riqueza_n)) / 100
  const p = (kg * num(a?.riqueza_p)) / 100
  const k = (kg * num(a?.riqueza_k)) / 100
  return {
    n: r(n), p: r(p), k: r(k),
    totalN: r(n * ha), totalP: r(p * ha), totalK: r(k * ha),
    kgTotales: a?.cantidad_total != null && a.cantidad_total !== '' ? num(a.cantidad_total) : r(kg * ha),
  }
}

/** Texto corto de riqueza: «15-15-15» */
export function textoNPK(a) {
  if (a?.riqueza_n == null && a?.riqueza_p == null && a?.riqueza_k == null) return ''
  const f = (v) => String(num(v)).replace('.', ',')
  return `${f(a.riqueza_n)}-${f(a.riqueza_p)}-${f(a.riqueza_k)}`
}
