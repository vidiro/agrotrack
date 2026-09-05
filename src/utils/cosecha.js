// Métricas derivadas de una cosecha (kg, grados/Brix, % graso)

// Kilogrados = kg × grados (Brix). Solo aplica a la viña.
export function calcKilogrados(kg, grados) {
  const k = parseFloat(kg) || 0
  const g = parseFloat(grados) || 0
  if (!k || !g) return null
  return k * g
}

// Kilogrados de una cosecha (solo si tiene grados/Brix)
export function cosechaKilogrados(c) {
  if (!c || c.brix_baume_viina == null) return null
  return calcKilogrados(c.kg, c.brix_baume_viina)
}

// Aceite potencial (olivar) = kg × % graso / 100
export function cosechaAceite(c) {
  if (!c || c.rendimiento_graso_olivar == null) return null
  const kg = parseFloat(c.kg) || 0
  const pct = parseFloat(c.rendimiento_graso_olivar) || 0
  if (!kg || !pct) return null
  return kg * pct / 100
}

// Totales de una lista de cosechas
export function totalesCosechas(list = []) {
  const totalKg = list.reduce((s, c) => s + (parseFloat(c.kg) || 0), 0)
  const totalKilogrados = list.reduce((s, c) => s + (cosechaKilogrados(c) || 0), 0)
  const totalAceite = list.reduce((s, c) => s + (cosechaAceite(c) || 0), 0)
  return { totalKg, totalKilogrados, totalAceite }
}