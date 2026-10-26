// Jornadas (días y horas) por trabajador a partir de las labores
import { parseSecciones } from './labores'

/** Días y horas de cada trabajador según las labores registradas */
export function jornadasPorTrabajador(labores, personal, prefijoFecha) {
  const mapa = new Map()
  for (const l of labores) {
    if (!l.fecha || (prefijoFecha && !l.fecha.startsWith(prefijoFecha))) continue
    for (const sec of parseSecciones(l)) {
      for (const fa of (sec.fincas || [])) {
        for (const p of (fa.peones || [])) {
          const horas = parseFloat(p.horas) || 0
          if (!p.id_operario || horas <= 0) continue
          const k = String(p.id_operario)
          if (!mapa.has(k)) {
            const persona = personal.find(x => String(x.id_operario) === k)
            mapa.set(k, { id: k, nombre: persona?.nombre || `Trabajador ${k}`, costeH: parseFloat(persona?.coste_h) || 0, dias: new Map() })
          }
          const r = mapa.get(k)
          const dia = l.fecha.substring(0, 10)
          const d = r.dias.get(dia) || { fecha: dia, horas: 0, trabajos: new Set(), fincas: new Set() }
          d.horas += horas
          if (sec.tipo_trabajo) d.trabajos.add(sec.tipo_trabajo)
          d.fincas.add(String(fa.id_finca))
          r.dias.set(dia, d)
        }
      }
    }
  }
  return [...mapa.values()].map(r => {
    const dias = [...r.dias.values()].sort((a, b) => a.fecha.localeCompare(b.fecha))
    const horas = dias.reduce((s, d) => s + d.horas, 0)
    return { ...r, dias, numDias: dias.length, horas, coste: horas * r.costeH }
  }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}
