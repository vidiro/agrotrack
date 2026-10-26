// Coste de una jornada a partir de sus secciones (mismo cálculo que la página Labores)

export function costesSecciones(secciones, { personal = [], maquinaria = [], precioGasoil = 0 } = {}) {
  const num = (v) => parseFloat(v) || 0
  let costePeones = 0
  let costeMaquinaria = 0
  let costeGasoil = 0
  for (const sec of secciones || []) {
    for (const fa of sec.fincas || []) {
      for (const p of fa.peones || []) {
        const op = personal.find(x => String(x.id_operario) === String(p.id_operario))
        costePeones += num(p.horas) * (op ? (num(op.coste_h) || 10) : 10)
      }
    }
    for (const m of sec.maquinaria || []) {
      const eq = maquinaria.find(x => String(x.id_equipo) === String(m.id_equipo))
      if (!eq) continue
      costeMaquinaria += num(m.horas) * num(eq.coste_h)
      if (sec.include_gasoil && num(eq.consumo_l_h) && num(precioGasoil)) costeGasoil += num(m.horas) * num(eq.consumo_l_h) * num(precioGasoil)
    }
  }
  const r2 = (v) => Math.round(v * 100) / 100
  return { costePeones: r2(costePeones), costeMaquinaria: r2(costeMaquinaria), costeGasoil: r2(costeGasoil), total: r2(costePeones + costeMaquinaria + costeGasoil) }
}

/** Fila de «labores» lista para guardar a partir de una o varias secciones */
export function laborDesdeSecciones({ fecha, secciones, notas }, ctx) {
  const c = costesSecciones(secciones, ctx)
  const fincas = secciones.flatMap(s => s.fincas || [])
  return {
    fecha,
    tipo_trabajo: secciones.map(s => s.tipo_trabajo).filter(Boolean).join(', '),
    id_finca: fincas[0]?.id_finca ?? null,
    asignaciones_fincas: JSON.stringify(secciones),
    asignaciones_maquinaria: JSON.stringify(secciones.flatMap(s => s.maquinaria || [])),
    coste_total: c.total,
    coste_peones: c.costePeones,
    coste_maquinaria: c.costeMaquinaria,
    coste_gasoil: c.costeGasoil,
    include_gasoil: true,
    notas: notas || null,
  }
}
