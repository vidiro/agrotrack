import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../data/supabaseClient'
import { fetchAll, isMissingTable } from '../utils/fetchAll'
import { gastosCorrientes, gastosInversion, esGastoInversion } from '../utils/gastos'
import { repartoLabor } from '../utils/labores'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts'
import { downloadCSV } from '../utils/csvExport'
import { cosechaKilogrados, cosechaAceite } from '../utils/cosecha'
import { getParamValue } from '../utils/params'
import { calendarioCampanas } from '../utils/campanas'
import { useRecuperacion } from '../utils/useRecuperacion'
import { textoEstado, etiquetaCampana, eur } from './RecuperacionInversion'

const COLORES = ['#1a472a', '#d4a017', '#c0392b', '#2980b9', '#8e44ad', '#27ae60', '#e67e22', '#16a085']


// ¿La fecha (yyyy-MM-dd) cae dentro de la campaña? Inicio incluido, fin excluido,
// para que el día de cambio de campaña no cuente en dos campañas a la vez.
function inCampaign(fecha, startDate, endDate) {
  const d = new Date(String(fecha).substring(0, 10) + 'T00:00:00')
  return d >= startDate && d < endDate
}

function InformesPage({ fincas, personal, maquinaria, params, destinos, preciosDestino, onDataChange, onNavigate, amortizaciones }) {
  const [labores, setLabores] = useState([])
  const [cosechas, setCosechas] = useState([])
  const [gastos, setGastos] = useState([])
  const [ingresos, setIngresos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const recuperacion = useRecuperacion({ fincas, amortizaciones, params, destinos, preciosDestino, personal, maquinaria })

  // Período seleccionado: 'fiscal' o 'campana'
  const [periodType, setPeriodType] = useState('fiscal')
  // Año seleccionado
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  // Años disponibles
  const availableYears = useMemo(() => {
    const years = new Set()
    for (let y = currentYear - 4; y <= currentYear + 1; y++) years.add(y)
    // Añadir años con datos reales
    const allDates = [...labores, ...cosechas, ...gastos, ...ingresos]
      .filter(i => i.fecha)
      .map(i => i.fecha.substring(0, 4))
    allDates.forEach(y => years.add(Number(y)))
    return Array.from(years).sort()
  }, [currentYear, labores, cosechas, gastos, ingresos])

  // Configuración de campaña desde params
  // Campañas: cada año puede empezar un día distinto (Ajustes → Campañas)
  const cal = useMemo(() => calendarioCampanas(params), [params])
  const getCampaignDates = (n) => { const r = cal.rango(n); return { startDate: r.start, endDate: r.end } }

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [labRes, cosechRes, gastRes, ingrRes] = await Promise.all([
        fetchAll('labores', q => q.order('fecha', { ascending: false })),
        fetchAll('cosechas', q => q.order('fecha', { ascending: false })),
        fetchAll('gastos_manual', q => q.order('fecha', { ascending: false })),
        fetchAll('ingresos', q => q.order('fecha', { ascending: false }))
      ])
      if (labRes.error) throw labRes.error
      if (cosechRes.error) throw cosechRes.error
      if (gastRes.error) throw gastRes.error
      if (ingrRes.error && !isMissingTable(ingrRes.error)) throw ingrRes.error
      setLabores(labRes.data || [])
      setCosechas(cosechRes.data || [])
      setGastos(gastRes.data || [])
      setIngresos(ingrRes.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filtrar datos por período
  const filterByPeriod = (items) => {
    if (!items.length) return []
    if (periodType === 'fiscal') {
      return items.filter(item => {
        if (!item.fecha) return false
        return item.fecha.substring(0, 4) === String(selectedYear)
      })
    } else {
      const { startDate, endDate } = getCampaignDates(selectedYear)
      return items.filter(item => {
        if (!item.fecha) return false
        return inCampaign(item.fecha, startDate, endDate)
      })
    }
  }

  const laboresFiltradas = filterByPeriod(labores)
  const cosechasFiltradas = filterByPeriod(cosechas)
  // Las compras de categoría «Inversión» no son coste corriente: se informan aparte
  const gastosFiltrados = filterByPeriod(gastosCorrientes(gastos))
  const inversionesFiltradas = filterByPeriod(gastosInversion(gastos))
  const totalInversiones = inversionesFiltradas.reduce((s, g) => s + (g.importe || 0), 0)
  const ingresosFiltrados = filterByPeriod(ingresos)

  // === CÁLCULOS ===
  const totales = useMemo(() => {
    const totalCostesLabores = laboresFiltradas.reduce((s, l) => s + (l.coste_total || 0), 0)
    const totalCostePeones = laboresFiltradas.reduce((s, l) => s + (l.coste_peones || 0), 0)
    const totalCosteMaquinaria = laboresFiltradas.reduce((s, l) => s + (l.coste_maquinaria || 0), 0)
    const totalCosteGasoil = laboresFiltradas.reduce((s, l) => s + (l.coste_gasoil || 0), 0)
    const totalGastos = gastosFiltrados.reduce((s, g) => s + (g.importe || 0), 0)
    const totalIngresos = ingresosFiltrados.reduce((s, i) => s + (i.cantidad || 0), 0)
    const totalProduccion = cosechasFiltradas.reduce((s, c) => s + (c.kg || 0), 0)
    const totalAceite = cosechasFiltradas.reduce((s, c) => s + (cosechaAceite(c) || 0), 0)
    const balance = totalIngresos - totalGastos - totalCostesLabores

    return {
      totalCostesLabores, totalCostePeones, totalCosteMaquinaria, totalCosteGasoil,
      totalGastos, totalIngresos, totalProduccion, totalAceite, balance,
      numLabores: laboresFiltradas.length,
      numCosechas: cosechasFiltradas.length,
      numGastos: gastosFiltrados.length,
      numIngresos: ingresosFiltrados.length
    }
  }, [laboresFiltradas, cosechasFiltradas, gastosFiltrados, ingresosFiltrados])

  // === Gastos por categoría ===
  const gastosPorCategoria = useMemo(() => {
    const cats = {}
    gastosFiltrados.forEach(g => {
      const cat = g.categoria || 'Sin categoría'
      cats[cat] = (cats[cat] || 0) + (g.importe || 0)
    })
    if (totales.totalCostePeones > 0) cats['Salarios'] = (cats['Salarios'] || 0) + totales.totalCostePeones
    if (totales.totalCosteMaquinaria > 0) cats['Maquinaria'] = (cats['Maquinaria'] || 0) + totales.totalCosteMaquinaria
    if (totales.totalCosteGasoil > 0) cats['Gasóleo'] = (cats['Gasóleo'] || 0) + totales.totalCosteGasoil
    return Object.entries(cats).map(([nombre, valor]) => ({ nombre, valor: Math.round(valor * 100) / 100 })).sort((a, b) => b.valor - a.valor)
  }, [gastosFiltrados, totales])

  // === Ingresos por origen ===
  const ingresosPorOrigen = useMemo(() => {
    const origens = {}
    ingresosFiltrados.forEach(i => {
      const origen = i.origen || i.tipo || 'Sin origen'
      origens[origen] = (origens[origen] || 0) + (i.cantidad || 0)
    })
    return Object.entries(origens).map(([nombre, valor]) => ({ nombre, valor: Math.round(valor * 100) / 100 })).sort((a, b) => b.valor - a.valor)
  }, [ingresosFiltrados])

  // === Producción por finca (separada por cultivo: Viña u Olivar) ===
  const produccionPorFinca = useMemo(() => {
    const grupos = { Viña: {}, Olivar: {} }
    cosechasFiltradas.forEach(c => {
      const nombre = fincas.find(f => String(f.id_finca) === String(c.id_finca))?.nombre || c.finca_nombre || 'Sin finca'
      const esOlivar = (c.cultivo || '').toUpperCase().includes('OLIVAR')
      const tipo = esOlivar ? 'Olivar' : 'Viña'
      const bucket = grupos[tipo]
      if (!bucket[nombre]) bucket[nombre] = { kg: 0, kilogrados: 0, aceite: 0 }
      bucket[nombre].kg += parseFloat(c.kg) || 0
      if (tipo === 'Viña') bucket[nombre].kilogrados += cosechaKilogrados(c) || 0
      else bucket[nombre].aceite += cosechaAceite(c) || 0
    })
    const armar = (obj) => Object.entries(obj)
      .map(([nombre, d]) => ({
        finca: nombre,
        kg: Math.round(d.kg * 100) / 100,
        kilogrados: Math.round(d.kilogrados),
        aceite: Math.round(d.aceite * 100) / 100
      }))
      .sort((a, b) => b.kg - a.kg)
    return { vina: armar(grupos['Viña']), olivar: armar(grupos['Olivar']) }
  }, [cosechasFiltradas, fincas])

  // === Costes por finca ===
  const costesPorFinca = useMemo(() => {
    const fincasData = {}
    // Cada jornada se reparte según lo hecho en cada finca (horas de peones, maquinaria de cada sección)
    const ctxReparto = { personal, maquinaria, precioGasoil: getParamValue(params, ['precio_gasoil_l', 'coste_gasoleo'], 0) }
    laboresFiltradas.forEach(l => {
      const reparto = repartoLabor(l, ctxReparto)
      if (reparto.size === 0) reparto.set('', { peones: l.coste_peones || 0, maquinaria: l.coste_maquinaria || 0, gasoil: l.coste_gasoil || 0, total: l.coste_total || 0 })
      reparto.forEach((r, id) => {
        const nombre = fincas.find(f => String(f.id_finca) === id)?.nombre || 'Sin finca'
        if (!fincasData[nombre]) fincasData[nombre] = { peones: 0, maquinaria: 0, gasoil: 0, gastos: 0, total: 0 }
        fincasData[nombre].peones += r.peones
        fincasData[nombre].maquinaria += r.maquinaria
        fincasData[nombre].gasoil += r.gasoil
        fincasData[nombre].total += r.total
      })
    })

    gastosFiltrados.forEach(g => {
      const id = g.id_finca
      const nombre = fincas.find(f => String(f.id_finca) === String(id))?.nombre || 'General'
      if (!fincasData[nombre]) fincasData[nombre] = { peones: 0, maquinaria: 0, gasoil: 0, gastos: 0, total: 0 }
      fincasData[nombre].gastos += g.importe || 0
      fincasData[nombre].total += g.importe || 0
    })

    return Object.entries(fincasData).map(([nombre, data]) => ({
      finca: nombre,
      peones: Math.round(data.peones * 100) / 100,
      maquinaria: Math.round(data.maquinaria * 100) / 100,
      gasoil: Math.round(data.gasoil * 100) / 100,
      gastos: Math.round(data.gastos * 100) / 100,
      total: Math.round(data.total * 100) / 100
    })).sort((a, b) => b.total - a.total)
  }, [laboresFiltradas, gastosFiltrados, fincas, personal, maquinaria, params])

  // === Evolución mensual del período ===
  const evolucionMensual = useMemo(() => {
    const meses = {}
    const addMonth = (item, field, target) => {
      if (!item.fecha) return
      const key = item.fecha.substring(0, 7)
      if (!meses[key]) meses[key] = { mes: key, ingresos: 0, gastos: 0, costes: 0, produccion: 0 }
      meses[key][target] += item[field] || 0
    }
    ingresosFiltrados.forEach(i => addMonth(i, 'cantidad', 'ingresos'))
    gastosFiltrados.forEach(g => addMonth(g, 'importe', 'gastos'))
    laboresFiltradas.forEach(l => addMonth(l, 'coste_total', 'costes'))
    cosechasFiltradas.forEach(c => addMonth(c, 'kg', 'produccion'))

    return Object.values(meses)
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .map(m => ({
        mes: m.mes,
        ingresos: Math.round(m.ingresos * 100) / 100,
        gastos: Math.round((m.gastos + m.costes) * 100) / 100,
        produccion: Math.round(m.produccion * 100) / 100
      }))
  }, [ingresosFiltrados, gastosFiltrados, laboresFiltradas, cosechasFiltradas])

  // === Comparativa con período anterior ===
  const periodoAnterior = useMemo(() => {
    const yearPrev = selectedYear - 1
    if (periodType === 'fiscal') {
      return {
        ingresos: ingresos.filter(i => i.fecha && i.fecha.substring(0, 4) === String(yearPrev)).reduce((s, i) => s + (i.cantidad || 0), 0),
        gastos: gastosCorrientes(gastos).filter(g => g.fecha && g.fecha.substring(0, 4) === String(yearPrev)).reduce((s, g) => s + (g.importe || 0), 0),
        costes: labores.filter(l => l.fecha && l.fecha.substring(0, 4) === String(yearPrev)).reduce((s, l) => s + (l.coste_total || 0), 0),
        produccion: cosechas.filter(c => c.fecha && c.fecha.substring(0, 4) === String(yearPrev)).reduce((s, c) => s + (c.kg || 0), 0)
      }
    } else {
      const { startDate, endDate } = getCampaignDates(yearPrev)
      const inRange = (d) => inCampaign(d, startDate, endDate)
      return {
        ingresos: ingresos.filter(i => i.fecha && inRange(i.fecha)).reduce((s, i) => s + (i.cantidad || 0), 0),
        gastos: gastosCorrientes(gastos).filter(g => g.fecha && inRange(g.fecha)).reduce((s, g) => s + (g.importe || 0), 0),
        costes: labores.filter(l => l.fecha && inRange(l.fecha)).reduce((s, l) => s + (l.coste_total || 0), 0),
        produccion: cosechas.filter(c => c.fecha && inRange(c.fecha)).reduce((s, c) => s + (c.kg || 0), 0)
      }
    }
  }, [selectedYear, periodType, ingresos, gastos, labores, cosechas, cal])

  const calcVar = (actual, anterior) => {
    if (anterior === 0) return { pct: 0, positive: actual > 0 }
    const pct = ((actual - anterior) / anterior * 100)
    return { pct, positive: pct > 0 }
  }

  const varIngresos = calcVar(totales.totalIngresos, periodoAnterior.ingresos)
  const varGastos = calcVar(totales.totalGastos + totales.totalCostesLabores, periodoAnterior.gastos + periodoAnterior.costes)
  const varProduccion = calcVar(totales.totalProduccion, periodoAnterior.produccion)

  // === PERIODO LABEL ===
  const getPeriodLabel = () => {
    if (periodType === 'fiscal') return `Año Fiscal ${selectedYear} (1 ene - 31 dic)`
    return cal.etiqueta(selectedYear)
  }

  // === EXPORTAR PDF ===
  const handleExportPDF = async () => {
    try {
      // jsPDF pesa mucho: se carga solo al exportar
      const { generateReportPDF } = await import('../utils/pdfReport')
      const doc = generateReportPDF({
        title: periodType === 'fiscal' ? 'Informe Económico - Año Fiscal' : 'Informe Económico - Campaña',
        periodLabel: getPeriodLabel(),
        periodType,
        selectedYear,
        totales,
        gastosPorCategoria,
        ingresosPorOrigen,
        evolucionMensual,
        produccionPorFinca,
        costesPorFinca,
        ingresosDetallados: ingresosFiltrados,
        totalInversiones,
        gastosDetallados: [...gastosFiltrados, ...inversionesFiltradas].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).map(g => ({ ...g, finca_nombre: fincas.find(f => String(f.id_finca) === String(g.id_finca))?.nombre || 'General' })),
        laboresDetalladas: laboresFiltradas,
        cosechasDetalladas: cosechasFiltradas,
        amortizaciones: amortizaciones || [],
        fincas,
        varIngresos,
        varGastos,
        varProduccion,
        periodoAnterior,
      })
      doc.save(`informe_${periodType}_${selectedYear}.pdf`)
      setSuccess('PDF exportado correctamente')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error('Error generando PDF:', err)
      setError(`Error al generar PDF: ${err.message}`)
    }
  }

  // === EXPORTAR CSV ===
  const handleExportCSV = () => {
    const rows = [
      { concepto: 'RESUMEN', valor: '' },
      { concepto: 'Ingresos', valor: totales.totalIngresos.toFixed(2) + ' €' },
      { concepto: 'Gastos directos', valor: totales.totalGastos.toFixed(2) + ' €' },
      { concepto: 'Costes labores', valor: totales.totalCostesLabores.toFixed(2) + ' €' },
      { concepto: '  - Salarios', valor: totales.totalCostePeones.toFixed(2) + ' €' },
      { concepto: '  - Maquinaria', valor: totales.totalCosteMaquinaria.toFixed(2) + ' €' },
      { concepto: '  - Gasóleo', valor: totales.totalCosteGasoil.toFixed(2) + ' €' },
      { concepto: 'Balance', valor: totales.balance.toFixed(2) + ' €' },
      { concepto: '', valor: '' },
      { concepto: 'PRODUCCIÓN — VIÑA', valor: '' },
      ...produccionPorFinca.vina.map(f => ({ concepto: f.finca, valor: `${f.kg} kg${f.kilogrados > 0 ? ` · ${f.kilogrados} kg°` : ''}` })),
      { concepto: '', valor: '' },
      { concepto: 'PRODUCCIÓN — OLIVAR', valor: '' },
      ...produccionPorFinca.olivar.map(f => ({ concepto: f.finca, valor: `${f.kg} kg${f.aceite > 0 ? ` · ${f.aceite.toFixed(1)} kg aceite` : ''}` })),
      { concepto: '', valor: '' },
      { concepto: 'GASTOS POR CATEGORÍA', valor: '' },
      ...gastosPorCategoria.map(g => ({ concepto: g.nombre, valor: g.valor.toFixed(2) + ' €' })),
      { concepto: '', valor: '' },
      { concepto: 'INGRESOS POR ORIGEN', valor: '' },
      ...ingresosPorOrigen.map(i => ({ concepto: i.nombre, valor: i.valor.toFixed(2) + ' €' })),
      { concepto: '', valor: '' },
      { concepto: 'COSTES POR FINCA', valor: '' },
      ...costesPorFinca.map(f => ({ concepto: f.finca, valor: f.total.toFixed(2) + ' €' })),
      { concepto: '', valor: '' },
      { concepto: 'DETALLE DE GASTOS Y FACTURAS (fecha · nº factura · empresa · CIF · concepto)', valor: '' },
      ...[...gastosFiltrados, ...inversionesFiltradas]
        .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
        .map(g => ({
          concepto: [
            g.fecha ? `${g.fecha.substring(8, 10)}/${g.fecha.substring(5, 7)}/${g.fecha.substring(0, 4)}` : '-',
            g.num_factura ? `Fra. ${g.num_factura}` : 'Sin nº factura',
            g.proveedor || 'Sin empresa',
            g.nif_proveedor || 'Sin CIF',
            (g.concepto || '-') + (esGastoInversion(g) ? ' (inversión)' : ''),
          ].join(' · '),
          valor: (g.importe || 0).toFixed(2) + ' €',
        }))
    ]
    downloadCSV(`informe_${periodType}_${selectedYear}`, ['concepto', 'valor'], rows)
  }

  if (loading) {
    return (
      <div className="empty-state" aria-busy="true">
        <div className="spinner"></div>
        <p className="mt-16">Cargando informe...</p>
      </div>
    )
  }

  return (
    <div>
      {success && <div className="alert alert-success" role="status">{success}</div>}
      {error && (
        <div className="alert alert-error" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span> {error}</span>
          <button className="btn btn-small btn-primary" onClick={loadData} aria-label="Reintentar"> Reintentar</button>
        </div>
      )}

      {/* SELECTORES */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title"> Informe Económico Detallado</div>
        <div className="form-row" style={{ alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Tipo de período</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className={`btn ${periodType === 'fiscal' ? 'btn-primary' : 'btn-accent'}`}
                style={{ flex: 1, borderStyle: periodType === 'fiscal' ? 'solid' : 'dashed' }}
                onClick={() => setPeriodType('fiscal')}
              >
                📅 Fiscal (Ene-Dic)
              </button>
              <button
                className={`btn ${periodType === 'campana' ? 'btn-primary' : 'btn-accent'}`}
                style={{ flex: 1, borderStyle: periodType === 'campana' ? 'solid' : 'dashed' }}
                onClick={() => setPeriodType('campana')}
              >
                 Campaña
              </button>
            </div>
          </div>
          <div className="form-group" style={{ width: 'auto' }}>
            <label className="form-label">Año</label>
            <select className="form-select" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--color-text-secondary)' }}>
           {getPeriodLabel()}
        </div>
      </div>

      {/* TARJETAS RESUMEN */}
      <div className="summary-grid">
        <div className="summary-card success">
          <div className="summary-value">{totales.totalIngresos.toFixed(2)} €</div>
          <div className="summary-label">Ingresos ({totales.numIngresos})</div>
          {periodoAnterior.ingresos > 0 && (
            <div style={{ fontSize: 12, color: varIngresos.positive ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {varIngresos.positive ? '↑' : '↓'} {Math.abs(varIngresos.pct).toFixed(1)}% vs anterior
            </div>
          )}
        </div>
        <div className="summary-card danger">
          <div className="summary-value">{(totales.totalGastos + totales.totalCostesLabores).toFixed(2)} €</div>
          <div className="summary-label">Gastos totales</div>
          {periodoAnterior.gastos > 0 && (
            <div style={{ fontSize: 12, color: !varGastos.positive ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {varGastos.positive ? '↑' : '↓'} {Math.abs(varGastos.pct).toFixed(1)}% vs anterior
            </div>
          )}
        </div>
        <div className="summary-card">
          <div className="summary-value" style={{ color: totales.balance >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {totales.balance >= 0 ? '+' : ''}{totales.balance.toFixed(2)} €
          </div>
          <div className="summary-label">{totales.balance >= 0 ? ' Superávit' : ' Déficit'}</div>
        </div>
        <div className="summary-card accent">
          <div className="summary-value">{totales.totalProduccion.toFixed(0)} kg</div>
          <div className="summary-label">Producción ({totales.numCosechas})</div>
          {periodoAnterior.produccion > 0 && (
            <div style={{ fontSize: 12, color: varProduccion.positive ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {varProduccion.positive ? '↑' : '↓'} {Math.abs(varProduccion.pct).toFixed(1)}% vs anterior
            </div>
          )}
        </div>
      </div>

      {/* DESGLOSE DETALLADO */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title"> Desglose de Costes</div>
        <table className="data-table">
          <thead><tr><th>Concepto</th><th style={{ textAlign: 'right' }}>Importe</th></tr></thead>
          <tbody>
            <tr><td> Salarios (labores)</td><td style={{ textAlign: 'right' }}><strong>{totales.totalCostePeones.toFixed(2)} €</strong></td></tr>
            <tr><td> Maquinaria</td><td style={{ textAlign: 'right' }}><strong>{totales.totalCosteMaquinaria.toFixed(2)} €</strong></td></tr>
            <tr><td> Gasóleo</td><td style={{ textAlign: 'right' }}><strong>{totales.totalCosteGasoil.toFixed(2)} €</strong></td></tr>
            <tr style={{ background: 'var(--color-bg)' }}>
              <td><strong>Subtotal costes labores ({totales.numLabores} registros)</strong></td>
              <td style={{ textAlign: 'right' }}><strong>{totales.totalCostesLabores.toFixed(2)} €</strong></td>
            </tr>
            <tr><td> Gastos directos ({totales.numGastos} registros)</td><td style={{ textAlign: 'right' }}><strong>{totales.totalGastos.toFixed(2)} €</strong></td></tr>
            <tr style={{ background: 'var(--color-bg)' }}>
              <td><strong>Total gastos + costes</strong></td>
              <td style={{ textAlign: 'right' }}><strong style={{ color: 'var(--color-danger)' }}>{(totales.totalGastos + totales.totalCostesLabores).toFixed(2)} €</strong></td>
            </tr>
            {totalInversiones > 0 && (
              <tr>
                <td>
                  Inversiones ({inversionesFiltradas.length} registros)
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Gastos de categoría «Inversión»: aparecen en el detalle de gastos, pero no restan en el balance</div>
                </td>
                <td style={{ textAlign: 'right' }}><strong>{totalInversiones.toFixed(2)} €</strong></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* INGRESOS DETALLADOS */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title"> Desglose de Ingresos</div>
        {ingresosPorOrigen.length > 0 ? (
          <table className="data-table">
            <thead><tr><th>Origen</th><th style={{ textAlign: 'right' }}>Importe</th></tr></thead>
            <tbody>
              {ingresosPorOrigen.map((item, i) => (
                <tr key={i}><td>{item.nombre}</td><td style={{ textAlign: 'right' }}><strong>{item.valor.toFixed(2)} €</strong></td></tr>
              ))}
              <tr style={{ background: 'var(--color-bg)' }}>
                <td><strong>Total ingresos</strong></td>
                <td style={{ textAlign: 'right' }}><strong style={{ color: 'var(--color-success)' }}>{totales.totalIngresos.toFixed(2)} €</strong></td></tr>
            </tbody>
          </table>
        ) : (
          <div className="empty-state"><div className="empty-state-text">Sin ingresos en este período</div></div>
        )}
      </div>

      {/* GRÁFICOS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 16, marginBottom: 16 }}>
        {/* Gastos por categoría */}
        <div className="card">
          <div className="card-title"> Gastos por Categoría</div>
          {gastosPorCategoria.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={gastosPorCategoria} dataKey="valor" nameKey="nombre" cx="50%" cy="45%" outerRadius={90}>
                  {gastosPorCategoria.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORES[index % COLORES.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${v.toFixed(2)} €`} />
                <Legend verticalAlign="bottom" height={36} formatter={(value) => <span style={{ fontSize: '0.75rem' }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state"><div className="empty-state-text">Sin datos</div></div>
          )}
        </div>

        {/* Ingresos por origen */}
        <div className="card">
          <div className="card-title"> Ingresos por Origen</div>
          {ingresosPorOrigen.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={ingresosPorOrigen} dataKey="valor" nameKey="nombre" cx="50%" cy="45%" outerRadius={90}>
                  {ingresosPorOrigen.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#27ae60', '#2ecc71', '#1abc9c', '#3498db', '#9b59b6'][index % 5]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${v.toFixed(2)} €`} />
                <Legend verticalAlign="bottom" height={36} formatter={(value) => <span style={{ fontSize: '0.75rem' }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state"><div className="empty-state-text">Sin datos</div></div>
          )}
        </div>
      </div>

      {/* EVOLUCIÓN MENSUAL */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title"> Evolución Mensual</div>
        {evolucionMensual.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={evolucionMensual}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" fontSize={11} tickFormatter={(value) => {
                const d = new Date(value + '-01')
                return format(d, 'MMM yyyy', { locale: es })
              }} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(v, name) => [`${v.toFixed(2)} ${name === 'produccion' ? 'kg' : '€'}`, name === 'produccion' ? 'Producción' : name === 'ingresos' ? 'Ingresos' : 'Gastos + Costes']} />
              <Area type="monotone" dataKey="ingresos" stackId="1" stroke="#27ae60" fill="#27ae60" name="ingresos" />
              <Area type="monotone" dataKey="gastos" stackId="2" stroke="#c0392b" fill="#c0392b" name="gastos" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="empty-state"><div className="empty-state-text">Sin datos mensuales</div></div>
        )}
      </div>

      {/* PRODUCCIÓN POR FINCA */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title"> 🌱 Producción por Finca</div>
        {produccionPorFinca.vina.length > 0 || produccionPorFinca.olivar.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {produccionPorFinca.vina.length > 0 && (
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--vina-accent)', marginBottom: 6 }}>{'🍇 Viña'}</div>
                <div className="table-container">
                  <table className="data-table">
                    <thead><tr><th>Finca</th><th style={{ textAlign: 'right' }}>Kg uva</th><th style={{ textAlign: 'right' }}>Kilogrados</th></tr></thead>
                    <tbody>
                      {produccionPorFinca.vina.map((f, i) => (
                        <tr key={i}><td>{f.finca}</td><td style={{ textAlign: 'right' }}>{f.kg}</td><td style={{ textAlign: 'right' }}>{f.kilogrados > 0 ? f.kilogrados : '-'}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {produccionPorFinca.olivar.length > 0 && (
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--olivar-accent)', marginBottom: 6 }}>{'🫒 Olivar'}</div>
                <div className="table-container">
                  <table className="data-table">
                    <thead><tr><th>Finca</th><th style={{ textAlign: 'right' }}>Kg aceituna</th><th style={{ textAlign: 'right' }}>Aceite pot.</th></tr></thead>
                    <tbody>
                      {produccionPorFinca.olivar.map((f, i) => (
                        <tr key={i}><td>{f.finca}</td><td style={{ textAlign: 'right' }}>{f.kg}</td><td style={{ textAlign: 'right' }}>{f.aceite > 0 ? f.aceite.toFixed(1) : '-'}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="empty-state"><div className="empty-state-text">Sin producción en este período</div></div>
        )}
      </div>

      {/* COSTES POR FINCA */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title"> Costes por Finca</div>
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '-4px 0 12px' }}>
          «Gastos» son los registrados en la página Gastos para cada finca. Las compras de tierra, plantaciones o maquinaria deben ir en Inversiones, no aquí.
        </p>
        {costesPorFinca.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Finca</th><th style={{ textAlign: 'right' }}>Salarios</th><th style={{ textAlign: 'right' }}>Maq.</th><th style={{ textAlign: 'right' }}>Gasóleo</th><th style={{ textAlign: 'right' }}>Gastos</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
              <tbody>
                {costesPorFinca.map((f, i) => (
                  <tr key={i}>
                    <td>{f.finca}</td>
                    <td style={{ textAlign: 'right' }}>{f.peones.toFixed(2)} €</td>
                    <td style={{ textAlign: 'right' }}>{f.maquinaria.toFixed(2)} €</td>
                    <td style={{ textAlign: 'right' }}>{f.gasoil.toFixed(2)} €</td>
                    <td style={{ textAlign: 'right' }}>{f.gastos.toFixed(2)} €</td>
                    <td style={{ textAlign: 'right' }}><strong>{f.total.toFixed(2)} €</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><div className="empty-state-text">Sin costes en este período</div></div>
        )}
      </div>

      {/* RECUPERACIÓN DE INVERSIONES (todo el histórico, no depende del período) */}
      {recuperacion.resultados.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Recuperación de inversiones por finca</div>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '-4px 0 12px' }}>
            Desde la compra hasta hoy, sin depender del período elegido arriba. Pulsa una finca para ver el detalle.
          </p>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Finca</th>
                  <th style={{ textAlign: 'right' }}>Inversión</th>
                  <th style={{ textAlign: 'right' }}>Recuperado</th>
                  <th style={{ textAlign: 'right' }}>%</th>
                  <th>Se paga</th>
                </tr>
              </thead>
              <tbody>
                {recuperacion.resultados.map(r => (
                  <tr key={r.id_finca}>
                    <td>
                      <button type="button" className="btn-link" onClick={() => onNavigate?.('finca_detalle', r.id_finca)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-primary)', cursor: 'pointer', font: 'inherit', textDecoration: 'underline' }}>
                        {r.nombre}
                      </button>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{eur(r.inversion)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{eur(r.recuperado)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{Math.round(r.pct * 100)} %</td>
                    <td style={{ fontSize: 13 }} title={textoEstado(r)}>
                      {r.estado === 'recuperada' ? `Pagada (${etiquetaCampana(r.campanaPago)})`
                        : r.estado === 'en_curso' ? `≈ ${etiquetaCampana(r.campanaPago)}`
                        : 'No al ritmo actual'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BOTONES EXPORTAR */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button className="btn btn-primary btn-full" onClick={handleExportPDF} aria-label="Exportar informe como PDF" style={{ flex: 2 }}>
           Exportar PDF
        </button>
        <button className="btn btn-accent btn-full" onClick={handleExportCSV} aria-label="Exportar informe como CSV" style={{ flex: 1 }}>
           CSV
        </button>
      </div>
      <div style={{ height: 32 }} />
    </div>
  )
}

export default InformesPage
