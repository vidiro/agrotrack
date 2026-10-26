// Inversiones (tabla amortizaciones) y recuperación de la inversión por finca
import { repartoLabor } from './labores'
import { cosechaFincaId, valorEstimadoCosecha } from './cosecha'
import { esGastoInversion } from './gastos'
import { calendarioCampanas } from './campanas'

// === CATEGORÍAS DE INVERSIÓN ===
// El terreno no se amortiza: es patrimonio, no coste de ninguna campaña.
export const CATEGORIAS_INVERSION = [
  'Terreno', 'Plantación', 'Riego / pozo', 'Construcción', 'Maquinaria', 'Equipo', 'Vehículo', 'Herramienta', 'Otro',
]
export const CATEGORIAS_NO_AMORTIZABLES = ['Terreno']

export function esAmortizable(item) {
  return !CATEGORIAS_NO_AMORTIZABLES.includes(item?.categoria)
}

export function cuotaMensual(item) {
  if (!esAmortizable(item)) return 0
  const importe = parseFloat(item.importe_compra) || 0
  const residual = parseFloat(item.valor_residual) || 0
  const meses = parseInt(item.meses_amortizacion) || 12
  return (importe - residual) / meses
}

// === CAMPAÑAS ===
// La campaña "2025" va del día de inicio de 2024 al mismo día de 2025 (igual que en Informes).
export function campanaDeFecha(fecha, startMonth, startDay) {
  const d = new Date(String(fecha).substring(0, 10) + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return null
  const inicio = new Date(d.getFullYear(), startMonth - 1, startDay)
  return d >= inicio ? d.getFullYear() + 1 : d.getFullYear()
}

const num = (v) => parseFloat(v) || 0

/**
 * Calcula, para cada finca con inversión registrada, cuánto se ha recuperado campaña a campaña.
 *
 * Lo que deja cada campaña = ingresos − costes de labores − gastos.
 *  - Ingresos de cosecha: el cobro registrado en Ingresos; si la cosecha no tiene cobro, su valor estimado.
 *  - Ayudas/subvenciones y gastos sin finca: se reparten por hectáreas.
 *  - Labores con varias fincas: el coste se reparte como en Informes.
 *  - La amortización NO se resta (lo que se recupera es justo la inversión).
 *
 * @returns {Array<{ id_finca, nombre, inversion, items, campanaInicio, campanas, recuperado, pct, media, campanaPago, estado }>}
 */
export function calcRecuperacion({
  fincas = [], inversiones = [], labores = [], cosechas = [], gastos = [], ingresos = [],
  params = [], destinos = [], preciosDestino = [], personal = [], maquinaria = [], precioGasoil = 0,
  startMonth = 9, startDay = 15, hoy = new Date(),
}) {
  // Fechas de inicio reales de cada campaña (Ajustes); si no hay, el día y mes por defecto
  const cal = calendarioCampanas([
    { clave: 'campana_mes_inicio', valor: startMonth },
    { clave: 'campana_dia_inicio', valor: startDay },
    ...(params || []).filter(p => String(p.clave || '').startsWith('campana_inicio_')),
  ])
  const campanaActual = cal.campanaDe(hoy)
  const campana = (fecha) => (fecha ? cal.campanaDe(fecha) : null)

  // Hectáreas para repartir lo que no es de ninguna finca
  const haTotal = fincas.reduce((s, f) => s + num(f.superficie_total_ha), 0)
  const cuotaHa = (idFinca) => {
    if (haTotal <= 0) return 0
    const f = fincas.find(x => String(x.id_finca) === String(idFinca))
    return num(f?.superficie_total_ha) / haTotal
  }

  // Cobros registrados por cosecha
  const cobradoPorCosecha = new Map()
  for (const i of ingresos) {
    if (i.id_cosecha) {
      const k = String(i.id_cosecha)
      cobradoPorCosecha.set(k, (cobradoPorCosecha.get(k) || 0) + num(i.cantidad))
    }
  }

  // Inversiones de cada finca = lo registrado en Inversiones + gastos de categoría «Inversión»
  // que no estén ya vinculados a una inversión (para no contar la misma compra dos veces)
  const gastosVinculados = new Set(inversiones.map(inv => inv.id_gasto).filter(Boolean).map(String))
  const inversionesDesdeGastos = gastos
    .filter(g => esGastoInversion(g) && g.id_finca != null && g.id_finca !== '' && !gastosVinculados.has(String(g.id_gasto)))
    // Red de seguridad: si hay una inversión idéntica (misma finca, fecha e importe) sin vincular, es la misma compra
    .filter(g => !inversiones.some(inv =>
      String(inv.id_finca) === String(g.id_finca) &&
      String(inv.fecha_compra || '').substring(0, 10) === String(g.fecha || '').substring(0, 10) &&
      Math.abs(num(inv.importe_compra) - num(g.importe)) < 0.01))
    .map(g => ({
      id_finca: g.id_finca, importe_compra: g.importe, fecha_compra: g.fecha,
      descripcion: g.concepto || 'Gasto de inversión', categoria: 'Inversión (Gastos)', origen: 'gasto',
    }))
  const todas = [...inversiones.filter(inv => inv.id_finca != null && inv.id_finca !== ''), ...inversionesDesdeGastos]

  const fincasConInversion = fincas.filter(f => todas.some(inv => String(inv.id_finca) === String(f.id_finca)))

  return fincasConInversion.map(finca => {
    const id = String(finca.id_finca)
    const items = todas.filter(inv => String(inv.id_finca) === id)
    const inversion = items.reduce((s, inv) => s + num(inv.importe_compra), 0)
    const fechas = items.map(inv => inv.fecha_compra).filter(Boolean).sort()
    const campanaInicio = fechas.length ? campana(fechas[0]) : campanaActual

    const porCampana = new Map()
    const fila = (c) => {
      if (!porCampana.has(c)) porCampana.set(c, { campana: c, ingresos: 0, estimado: 0, ayudas: 0, costes: 0, gastos: 0 })
      return porCampana.get(c)
    }
    const dentro = (c) => c != null && c >= campanaInicio && c <= campanaActual

    // Cosechas de la finca: cobro real o valor estimado
    for (const c of cosechas) {
      if (cosechaFincaId(c) !== id) continue
      const camp = campana(c.fecha)
      if (!dentro(camp)) continue
      const cobrado = cobradoPorCosecha.get(String(c.id_cosecha))
      if (cobrado != null) fila(camp).ingresos += cobrado
      else fila(camp).estimado += valorEstimadoCosecha(c, { params, destinos, preciosDestino })
    }

    // Ayudas / subvenciones: por hectáreas
    for (const i of ingresos) {
      if (i.id_cosecha || i.origen !== 'Ayuda') continue
      const camp = campana(i.fecha)
      if (!dentro(camp)) continue
      fila(camp).ayudas += num(i.cantidad) * cuotaHa(id)
    }

    // Costes de labores
    for (const l of labores) {
      const r = repartoLabor(l, { personal, maquinaria, precioGasoil }).get(id)
      if (!r) continue
      const camp = campana(l.fecha)
      if (!dentro(camp)) continue
      fila(camp).costes += r.total
    }

    // Gastos: de la finca, o generales repartidos por hectáreas
    for (const g of gastos) {
      if (esGastoInversion(g)) continue // es inversión, no coste de la campaña
      const camp = campana(g.fecha)
      if (!dentro(camp)) continue
      if (g.id_finca != null && g.id_finca !== '') {
        if (String(g.id_finca) === id) fila(camp).gastos += num(g.importe)
      } else {
        fila(camp).gastos += num(g.importe) * cuotaHa(id)
      }
    }

    // Serie de campañas (incluye las que no tuvieron movimientos)
    const campanas = []
    let acumulado = 0
    for (let c = campanaInicio; c <= campanaActual; c++) {
      const r = porCampana.get(c) || { campana: c, ingresos: 0, estimado: 0, ayudas: 0, costes: 0, gastos: 0 }
      const neto = r.ingresos + r.estimado + r.ayudas - r.costes - r.gastos
      acumulado += neto
      campanas.push({ ...r, neto, acumulado, enCurso: c === campanaActual })
    }

    const recuperado = acumulado
    const pct = inversion > 0 ? Math.max(0, recuperado / inversion) : 0

    // Previsión: media de las últimas 3 campañas cerradas (o la actual si no hay cerradas)
    const cerradas = campanas.filter(c => !c.enCurso)
    const base = (cerradas.length ? cerradas : campanas).slice(-3)
    const media = base.length ? base.reduce((s, c) => s + c.neto, 0) / base.length : 0

    let estado, campanaPago = null
    if (inversion <= 0) {
      estado = 'sin_inversion'
    } else if (recuperado >= inversion) {
      estado = 'recuperada'
      campanaPago = campanas.find(c => c.acumulado >= inversion)?.campana ?? campanaActual
    } else if (media > 0) {
      estado = 'en_curso'
      // Se proyecta desde la última campaña cerrada: la actual cuenta como una campaña más de previsión
      const acumCerrado = cerradas.length ? cerradas[cerradas.length - 1].acumulado : 0
      campanaPago = Math.max(campanaActual, campanaActual - 1 + Math.ceil((inversion - acumCerrado) / media))
    } else {
      estado = 'no_recupera'
    }

    return {
      id_finca: finca.id_finca, nombre: finca.nombre, inversion, items, campanaInicio,
      campanas, recuperado, pct, media, campanaPago, estado,
    }
  })
}
