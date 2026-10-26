// Unir varias fincas en una: se pasan a la finca que queda todas sus labores, cosechas,
// gastos, inversiones y ayudas, y después se borran las fincas unidas.
import { supabase } from '../data/supabaseClient'
import { fetchAll, isMissingTable } from './fetchAll'
import { parseSecciones } from './labores'

const s = (v) => (v == null ? '' : String(v))

/**
 * Cambia las fincas de una labor (formato de secciones o antiguo) a la finca destino.
 * Si en una misma sección quedan dos veces la misma finca, se juntan sus peones.
 * @returns {{ cambiada: boolean, asignaciones_fincas: string|null, id_finca: any }}
 */
export function remapLabor(labor, origenes, destino) {
  const set = new Set(origenes.map(s))
  const dest = s(destino)
  let cambiada = false
  let idFinca = labor.id_finca
  if (set.has(s(labor.id_finca))) { idFinca = dest; cambiada = true }

  const raw = labor.asignaciones_fincas
  if (!raw) return { cambiada, asignaciones_fincas: raw ?? null, id_finca: idFinca }

  const secciones = parseSecciones(labor)
  const nuevas = secciones.map(sec => {
    const porFinca = new Map()
    for (const fa of (sec.fincas || [])) {
      const id = set.has(s(fa.id_finca)) ? dest : s(fa.id_finca)
      if (id !== s(fa.id_finca)) cambiada = true
      const previa = porFinca.get(id)
      if (previa) previa.peones = [...(previa.peones || []), ...(fa.peones || [])]
      else porFinca.set(id, { ...fa, id_finca: id, peones: [...(fa.peones || [])] })
    }
    return { ...sec, fincas: [...porFinca.values()] }
  })
  return { cambiada, asignaciones_fincas: cambiada ? JSON.stringify(nuevas) : raw, id_finca: idFinca }
}

/** Datos de la finca resultante: suma superficies y junta las parcelas */
export function fincaUnida(destino, origenes) {
  const todas = [destino, ...origenes]
  const ha = todas.reduce((t, f) => t + (parseFloat(f.superficie_total_ha) || 0), 0)
  const mismoPoligono = todas.every(f => s(f.poligono) === s(destino.poligono))
  const parcelas = mismoPoligono
    ? todas.map(f => s(f.parcela)).filter(Boolean).join(', ')
    : todas.map(f => [f.poligono && `pol. ${f.poligono}`, f.parcela && `parc. ${f.parcela}`].filter(Boolean).join(' ')).filter(Boolean).join('; ')
  const nota = `Unión de ${origenes.map(f => `${f.id_finca} (${f.nombre}${f.parcela ? `, parc. ${f.parcela}` : ''}${f.superficie_total_ha ? `, ${f.superficie_total_ha} ha` : ''})`).join(', ')} el ${new Date().toLocaleDateString('es-ES')}.`
  return {
    superficie_total_ha: Math.round(ha * 10000) / 10000,
    poligono: mismoPoligono ? destino.poligono : null,
    parcela: parcelas || null,
    notas: [destino.notas, nota].filter(Boolean).join('\n'),
  }
}

/** Cuenta lo que se va a mover (para enseñarlo antes de confirmar) */
export async function resumenUnion(origenIds) {
  const set = new Set(origenIds.map(s))
  const [lab, cos, gas] = await Promise.all([fetchAll('labores'), fetchAll('cosechas'), fetchAll('gastos_manual')])
  return {
    labores: (lab.data || []).filter(l => remapLabor(l, origenIds, '__x__').cambiada).length,
    cosechas: (cos.data || []).filter(c => set.has(s(c.id_finca)) || set.has(s(c.id_parcela))).length,
    gastos: (gas.data || []).filter(g => set.has(s(g.id_finca))).length,
  }
}

/**
 * Ejecuta la unión. Primero mueve todo; solo si no hay errores borra las fincas unidas.
 * @param {object} destino - finca que queda
 * @param {object[]} origenes - fincas que se unen a ella y desaparecen
 */
export async function unirFincas(destino, origenes, onProgreso) {
  const ids = origenes.map(f => s(f.id_finca))
  const dest = destino.id_finca
  const comprobar = (r) => { if (r.error && !isMissingTable(r.error)) throw r.error }

  onProgreso?.('Moviendo labores…')
  const lab = await fetchAll('labores')
  comprobar(lab)
  for (const l of lab.data || []) {
    const r = remapLabor(l, ids, dest)
    if (!r.cambiada) continue
    comprobar(await supabase.from('labores').update({ id_finca: r.id_finca, asignaciones_fincas: r.asignaciones_fincas }).eq('id_labor', l.id_labor))
  }

  onProgreso?.('Moviendo cosechas, gastos, inversiones y ayudas…')
  comprobar(await supabase.from('cosechas').update({ id_finca: dest }).in('id_finca', ids))
  comprobar(await supabase.from('cosechas').update({ id_parcela: dest }).in('id_parcela', ids))
  comprobar(await supabase.from('gastos_manual').update({ id_finca: dest }).in('id_finca', ids))
  comprobar(await supabase.from('amortizaciones').update({ id_finca: dest }).in('id_finca', ids))
  comprobar(await supabase.from('expedientes').update({ id_finca: dest }).in('id_finca', ids))

  onProgreso?.('Actualizando la finca…')
  comprobar(await supabase.from('fincas').update(fincaUnida(destino, origenes)).eq('id_finca', dest))

  onProgreso?.('Quitando las fincas unidas…')
  comprobar(await supabase.from('fincas').delete().in('id_finca', ids))
}
