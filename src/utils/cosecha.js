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

/**
 * Ingreso previsto de una cosecha.
 * Usa el precio del destino (precios_destino) y, si no hay, los precios base de Ajustes (params).
 */
export function valorEstimadoCosecha(c, { params = [], destinos = [], preciosDestino = [] } = {}) {
  const getParam = (clave) => {
    if (!Array.isArray(params)) return 0
    const p = params.find(pr => pr.clave === clave)
    return p ? (parseFloat(p.valor) || 0) : 0
  }

  const getPrecioDestino = (nombreDestino, tipoProducto) => {
    if (!Array.isArray(destinos) || !nombreDestino) return 0
    const dest = destinos.find(d => d.nombre === nombreDestino)
    if (!dest) return 0
    const precio = (preciosDestino || []).find(p => String(p.id_destino) === String(dest.id_destino) && p.tipo_producto === tipoProducto)
    return precio ? (parseFloat(precio.precio) || 0) : 0
  }

  const tipoAceituna = (variedad) => {
    if (variedad.includes('manzanilla')) return 'manzanilla'
    if (variedad.includes('carrasquena') || variedad.includes('carrasqueña')) return 'carrasquena'
    return null
  }

  try {
    const kg = parseFloat(c.kg) || 0
    const kgPerdigon = parseFloat(c.kg_perdigon) || 0
    const kilogrados = cosechaKilogrados(c) || 0
    const cult = (c.cultivo || '').toLowerCase()
    const variedad = (c.variedad || '').toLowerCase()
    const esVina = cult === 'viña' || cult === 'viña y olivar'
    const esOlivar = cult === 'olivar' || cult === 'viña y olivar'
    let total = 0

    // 1) Precio por destino
    if (c.destino) {
      if (esVina) {
        const p = getPrecioDestino(c.destino, 'uva')
        if (p > 0 && kilogrados > 0) total += kilogrados * p
      }
      if (esOlivar) {
        if (kgPerdigon > 0) total += kgPerdigon * getPrecioDestino(c.destino, 'perdigon')
        if (kg > 0) total += kg * getPrecioDestino(c.destino, tipoAceituna(variedad) || 'aceituna')
      }
    }

    // 2) Precios base de Ajustes
    if (total === 0) {
      if (esVina) {
        const precio = getParam('precio_uva_kilogrado')
        if (precio > 0 && kilogrados > 0) total += kilogrados * precio
      }
      if (esOlivar) {
        if (kgPerdigon > 0) total += kgPerdigon * getParam('precio_perdigon_kg')
        if (kg > 0) {
          const tipo = tipoAceituna(variedad)
          const precio = getParam(tipo === 'manzanilla' ? 'precio_manzanilla_kg' : tipo === 'carrasquena' ? 'precio_carrasquena_kg' : 'precio_basta_kg')
          if (precio > 0) total += kg * precio
        }
      }
    }

    return total
  } catch {
    return 0
  }
}

/** Finca de una cosecha (algunos registros la guardan en id_parcela) */
export function cosechaFincaId(c) {
  const id = c?.id_finca ?? c?.id_parcela
  return id == null || id === '' ? null : String(id)
}
