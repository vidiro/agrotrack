// Utilidades compartidas para leer las labores (formato nuevo por secciones y formato antiguo)

const parseJSON = (raw) => {
  if (!raw) return null
  if (typeof raw !== 'string') return raw
  try { return JSON.parse(raw) } catch { return null }
}

/**
 * Devuelve las secciones de una labor:
 * [{ tipo_trabajo, fincas: [{ id_finca, peones: [{ id_operario, horas }] }], maquinaria: [{ id_equipo, horas }], include_gasoil }]
 */
export function parseSecciones(labor) {
  const parsed = parseJSON(labor?.asignaciones_fincas)
  if (Array.isArray(parsed) && parsed.length > 0) {
    // Formato secciones
    if (parsed[0]?.tipo_trabajo !== undefined) return parsed
    // Formato antiguo: array de fincas sin tipo_trabajo
    if (parsed[0]?.id_finca !== undefined) {
      const maq = parseJSON(labor.asignaciones_maquinaria)
      return [{
        tipo_trabajo: labor.tipo_trabajo || '',
        fincas: parsed,
        maquinaria: Array.isArray(maq) ? maq : [],
        include_gasoil: labor.include_gasoil !== false,
      }]
    }
  }
  return [{
    tipo_trabajo: labor?.tipo_trabajo || '',
    fincas: [],
    maquinaria: [],
    include_gasoil: labor?.include_gasoil !== false,
  }]
}

/** IDs de finca de una labor (una entrada por aparición, puede repetirse entre secciones) */
export function laborFincaIds(labor) {
  const ids = parseSecciones(labor).flatMap(s => (s.fincas || []).map(f => String(f.id_finca)))
  if (ids.length > 0) return ids
  return labor?.id_finca != null && labor.id_finca !== '' ? [String(labor.id_finca)] : []
}

/** ¿La labor afecta a esta finca? */
export function laborIncluyeFinca(labor, fincaId) {
  return laborFincaIds(labor).includes(String(fincaId))
}

/**
 * Parte del coste de la labor que corresponde a una finca.
 * Mismo criterio que Informes: el coste se reparte a partes iguales entre las fincas de la jornada.
 */
export function laborShareFinca(labor, fincaId) {
  const ids = laborFincaIds(labor)
  if (ids.length === 0) return 0
  return ids.filter(id => id === String(fincaId)).length / ids.length
}

/**
 * Reparte una jornada entre sus fincas según lo que se hizo en cada una:
 *  - peones: las horas de cada peón en cada finca (a su €/hora),
 *  - maquinaria y gasóleo: los de cada sección, a partes iguales entre las fincas de esa sección.
 * Los importes se ajustan a los costes guardados en la labor (coste_peones, coste_maquinaria,
 * coste_gasoil, coste_total), así que la suma de todas las fincas es siempre el coste de la jornada.
 * Si no hay datos para repartir un concepto, ese concepto se reparte a partes iguales.
 *
 * @returns {Map<string, { peones, maquinaria, gasoil, total, horasPeones, horasMaq, tipos: string[] }>}
 */
export function repartoLabor(labor, { personal = [], maquinaria = [], precioGasoil = 0 } = {}) {
  const num = (v) => parseFloat(v) || 0
  const secciones = parseSecciones(labor)
  const est = new Map() // finca -> estimación
  const fila = (id) => {
    if (!est.has(id)) est.set(id, { peones: 0, maquinaria: 0, gasoil: 0, horasPeones: 0, horasMaq: 0, tipos: new Set() })
    return est.get(id)
  }

  for (const sec of secciones) {
    const fincasSec = (sec.fincas || []).map(f => String(f.id_finca))
    if (!fincasSec.length) continue
    for (const fa of sec.fincas) {
      const r = fila(String(fa.id_finca))
      if (sec.tipo_trabajo) r.tipos.add(sec.tipo_trabajo)
      for (const p of (fa.peones || [])) {
        const h = num(p.horas)
        const op = personal.find(x => String(x.id_operario) === String(p.id_operario))
        r.horasPeones += h
        r.peones += h * (op ? (num(op.coste_h) || 10) : 10)
      }
    }
    for (const m of (sec.maquinaria || [])) {
      const h = num(m.horas)
      const eq = maquinaria.find(x => String(x.id_equipo) === String(m.id_equipo))
      const costeMaq = h * num(eq?.coste_h)
      const costeGas = sec.include_gasoil !== false && eq ? h * num(eq.consumo_l_h) * num(precioGasoil) : 0
      for (const id of fincasSec) {
        const r = fila(id)
        r.horasMaq += h / fincasSec.length
        r.maquinaria += costeMaq / fincasSec.length
        r.gasoil += costeGas / fincasSec.length
      }
    }
  }

  // Labor antigua sin secciones: todo a su finca
  const ids = [...est.keys()]
  if (!ids.length) {
    const id = labor?.id_finca != null && labor.id_finca !== '' ? String(labor.id_finca) : null
    if (!id) return new Map()
    return new Map([[id, {
      peones: num(labor.coste_peones), maquinaria: num(labor.coste_maquinaria), gasoil: num(labor.coste_gasoil), total: num(labor.coste_total),
      horasPeones: num(labor.hh_persona), horasMaq: num(labor.h_maquinaria), tipos: labor.tipo_trabajo ? [labor.tipo_trabajo] : [],
    }]])
  }

  // Ajuste a los costes guardados en la labor
  const ajustar = (campo, guardado) => {
    const totalEst = ids.reduce((t, id) => t + est.get(id)[campo], 0)
    const out = new Map()
    for (const id of ids) out.set(id, totalEst > 0 ? guardado * est.get(id)[campo] / totalEst : guardado / ids.length)
    return out
  }
  const peones = ajustar('peones', num(labor.coste_peones))
  const maq = ajustar('maquinaria', num(labor.coste_maquinaria))
  const gas = ajustar('gasoil', num(labor.coste_gasoil))
  const sumaPartes = num(labor.coste_peones) + num(labor.coste_maquinaria) + num(labor.coste_gasoil)
  const totalGuardado = num(labor.coste_total)

  const res = new Map()
  for (const id of ids) {
    const e = est.get(id)
    const p = peones.get(id); const m = maq.get(id); const g = gas.get(id)
    // Si la labor solo tiene coste_total (sin desglose), se reparte por la estimación total
    let total = p + m + g
    if (sumaPartes === 0 && totalGuardado > 0) {
      const estTotal = ids.reduce((t, k) => { const x = est.get(k); return t + x.peones + x.maquinaria + x.gasoil }, 0)
      total = estTotal > 0 ? totalGuardado * (e.peones + e.maquinaria + e.gasoil) / estTotal : totalGuardado / ids.length
    } else if (sumaPartes > 0 && totalGuardado > 0 && Math.abs(sumaPartes - totalGuardado) > 0.01) {
      total = total * totalGuardado / sumaPartes
    }
    res.set(id, { peones: p, maquinaria: m, gasoil: g, total, horasPeones: e.horasPeones, horasMaq: e.horasMaq, tipos: [...e.tipos] })
  }
  return res
}
