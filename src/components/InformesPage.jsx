import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../data/supabaseClient'
import { format, isWithinInterval } from 'date-fns'
import { es } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts'
import { downloadCSV } from '../utils/csvExport'
import { generateReportPDF } from '../utils/pdfReport'
import { getParamValue } from '../utils/params'

const COLORES = ['#1a472a', '#d4a017', '#c0392b', '#2980b9', '#8e44ad', '#27ae60', '#e67e22', '#16a085']

/**
 * Calcula las fechas de la campaña para un año dado.
 * La campaña se define por un mes/día de inicio (ej: 15 sept) y abarca hasta esa fecha del año siguiente.
 * campaignStartMonth: mes de inicio (9 = sept)
 * campaignStartDay: día de inicio (15)
 * year: año de referencia (la campaña "2025" va de sept 2024 a sept 2025)
 */
function getCampaignDates(year, startMonth, startDay) {
  const startDate = new Date(year - 1, startMonth - 1, startDay)
  const endDate = new Date(year, startMonth - 1, startDay)
  return { startDate, endDate }
}

function InformesPage({ fincas, personal, maquinaria, params, onDataChange, amortizaciones }) {
  const [labores, setLabores] = useState([])
  const [cosechas, setCosechas] = useState([])
  const [gastos, setGastos] = useState([])
  const [ingresos, setIngresos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
  const campaignStartMonth = getParamValue(params, ['campana_mes_inicio'], 9) // sept por defecto
  const campaignStartDay = getParamValue(params, ['campana_dia_inicio'], 15) // 15 sept por defecto

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [labRes, cosechRes, gastRes, ingrRes] = await Promise.all([
        supabase.from('labores').select('*').order('fecha', { ascending: false }),
        supabase.from('cosechas').select('*').order('fecha', { ascending: false }),
        supabase.from('gastos_manual').select('*').order('fecha', { ascending: false }),
        supabase.from('ingresos').select('*').order('fecha', { ascending: false })
      ])
      if (labRes.error) throw labRes.error
      if (cosechRes.error) throw cosechRes.error
      if (gastRes.error) throw gastRes.error
      if (ingrRes.error && !ingrRes.message?.includes('Could not find the table')) throw ingrRes.error
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
      const { startDate, endDate } = getCampaignDates(selectedYear, campaignStartMonth, campaignStartDay)
      return items.filter(item => {
        if (!item.fecha) return false
        const d = new Date(item.fecha)
        return isWithinInterval(d, { start: startDate, end: endDate, inclusive: true })
      })
    }
  }

  const laboresFiltradas = filterByPeriod(labores)
  const cosechasFiltradas = filterByPeriod(cosechas)
  const gastosFiltrados = filterByPeriod(gastos)
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
    const totalAceite = cosechasFiltradas.reduce((s, c) => s + (c.aceite_potencial || 0), 0)
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

  // === Producción por finca ===
  const produccionPorFinca = useMemo(() => {
    const fincasData = {}
    cosechasFiltradas.forEach(c => {
      const nombre = fincas.find(f => String(f.id_finca) === String(c.id_finca))?.nombre || c.finca_nombre || 'Sin finca'
      if (!fincasData[nombre]) fincasData[nombre] = { kg: 0, cultivo: new Set(), aceite: 0 }
      fincasData[nombre].kg += c.kg || 0
      if (c.cultivo) fincasData[nombre].cultivo.add(c.cultivo)
      fincasData[nombre].aceite += c.aceite_potencial || 0
    })
    return Object.entries(fincasData).map(([nombre, data]) => ({
      finca: nombre,
      kg: Math.round(data.kg * 100) / 100,
      cultivos: Array.from(data.cultivo).join(', '),
      aceite: Math.round(data.aceite * 100) / 100
    })).sort((a, b) => b.kg - a.kg)
  }, [cosechasFiltradas, fincas])

  // === Costes por finca ===
  const costesPorFinca = useMemo(() => {
    const fincasData = {}
    laboresFiltradas.forEach(l => {
      let fincasAsign = []
      try {
        const asign = l.asignaciones_fincas
        if (asign) {
          const parsed = typeof asign === 'string' ? JSON.parse(asign) : asign
          if (Array.isArray(parsed)) {
            if (parsed[0].tipo_trabajo !== undefined) {
              fincasAsign = parsed.flatMap(s => s.fincas || [])
            } else {
              fincasAsign = parsed
            }
          }
        }
      } catch {}

      const numFincas = fincasAsign.length || 1
      const ids = fincasAsign.length > 0 ? fincasAsign.map(f => String(f.id_finca)) : [String(l.id_finca || '')]
      ids.forEach(id => {
        const nombre = fincas.find(f => String(f.id_finca) === id)?.nombre || 'Sin finca'
        if (!fincasData[nombre]) fincasData[nombre] = { peones: 0, maquinaria: 0, gasoil: 0, total: 0 }
        fincasData[nombre].peones += (l.coste_peones || 0) / numFincas
        fincasData[nombre].maquinaria += (l.coste_maquinaria || 0) / numFincas
        fincasData[nombre].gasoil += (l.coste_gasoil || 0) / numFincas
        fincasData[nombre].total += (l.coste_total || 0) / numFincas
      })
    })

    gastosFiltrados.forEach(g => {
      const id = g.id_finca
      const nombre = fincas.find(f => String(f.id_finca) === String(id))?.nombre || 'General'
      if (!fincasData[nombre]) fincasData[nombre] = { peones: 0, maquinaria: 0, gasoil: 0, total: 0 }
      fincasData[nombre].total += g.importe || 0
    })

    return Object.entries(fincasData).map(([nombre, data]) => ({
      finca: nombre,
      peones: Math.round(data.peones * 100) / 100,
      maquinaria: Math.round(data.maquinaria * 100) / 100,
      gasoil: Math.round(data.gasoil * 100) / 100,
      total: Math.round(data.total * 100) / 100
    })).sort((a, b) => b.total - a.total)
  }, [laboresFiltradas, gastosFiltrados, fincas])

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
        gastos: gastos.filter(g => g.fecha && g.fecha.substring(0, 4) === String(yearPrev)).reduce((s, g) => s + (g.importe || 0), 0),
        costes: labores.filter(l => l.fecha && l.fecha.substring(0, 4) === String(yearPrev)).reduce((s, l) => s + (l.coste_total || 0), 0),
        produccion: cosechas.filter(c => c.fecha && c.fecha.substring(0, 4) === String(yearPrev)).reduce((s, c) => s + (c.kg || 0), 0)
      }
    } else {
      const { startDate, endDate } = getCampaignDates(yearPrev, campaignStartMonth, campaignStartDay)
      const inRange = (d) => isWithinInterval(new Date(d), { start: startDate, end: endDate, inclusive: true })
      return {
        ingresos: ingresos.filter(i => i.fecha && inRange(i.fecha)).reduce((s, i) => s + (i.cantidad || 0), 0),
        gastos: gastos.filter(g => g.fecha && inRange(g.fecha)).reduce((s, g) => s + (g.importe || 0), 0),
        costes: labores.filter(l => l.fecha && inRange(l.fecha)).reduce((s, l) => s + (l.coste_total || 0), 0),
        produccion: cosechas.filter(c => c.fecha && inRange(c.fecha)).reduce((s, c) => s + (c.kg || 0), 0)
      }
    }
  }, [selectedYear, periodType, ingresos, gastos, labores, cosechas, campaignStartMonth, campaignStartDay])

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
    const mesNames = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    const startLabel = `${campaignStartDay} ${mesNames[campaignStartMonth]} ${selectedYear - 1}`
    const endLabel = `${campaignStartDay} ${mesNames[campaignStartMonth]} ${selectedYear}`
    return `Campaña ${selectedYear} (${startLabel} - ${endLabel})`
  }

  // === EXPORTAR PDF ===
  const handleExportPDF = () => {
    try {
      console.log('Generando PDF...', { totales, gastosPorCategoria: gastosPorCategoria.length, ingresosPorOrigen: ingresosPorOrigen.length })
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
        gastosDetallados: gastosFiltrados.map(g => ({ ...g, finca_nombre: fincas.find(f => String(f.id_finca) === String(g.id_finca))?.nombre || 'General' })),
        laboresDetalladas: laboresFiltradas,
        cosechasDetalladas: cosechasFiltradas,
        amortizaciones: amortizaciones || [],
        fincas,
        varIngresos,
        varGastos,
        varProduccion,
        periodoAnterior,
      })
      console.log('PDF generado, guardando...')
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
      { concepto: 'PRODUCCIÓN', valor: '' },
      ...produccionPorFinca.map(f => ({ concepto: f.finca, valor: f.kg + ' kg (' + f.cultivos + ')' })),
      { concepto: '', valor: '' },
      { concepto: 'GASTOS POR CATEGORÍA', valor: '' },
      ...gastosPorCategoria.map(g => ({ concepto: g.nombre, valor: g.valor.toFixed(2) + ' €' })),
      { concepto: '', valor: '' },
      { concepto: 'INGRESOS POR ORIGEN', valor: '' },
      ...ingresosPorOrigen.map(i => ({ concepto: i.nombre, valor: i.valor.toFixed(2) + ' €' })),
      { concepto: '', valor: '' },
      { concepto: 'COSTES POR FINCA', valor: '' },
      ...costesPorFinca.map(f => ({ concepto: f.finca, valor: f.total.toFixed(2) + ' €' }))
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 16 }}>
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
        <div className="card-title"> Producción por Finca</div>
        {produccionPorFinca.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Finca</th><th>Cultivos</th><th style={{ textAlign: 'right' }}>Kg</th><th style={{ textAlign: 'right' }}>Aceite</th></tr></thead>
              <tbody>
                {produccionPorFinca.map((f, i) => (
                  <tr key={i}><td>{f.finca}</td><td>{f.cultivos}</td><td style={{ textAlign: 'right' }}>{f.kg}</td><td style={{ textAlign: 'right' }}>{f.aceite > 0 ? f.aceite : '-'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><div className="empty-state-text">Sin producción en este período</div></div>
        )}
      </div>

      {/* COSTES POR FINCA */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title"> Costes por Finca</div>
        {costesPorFinca.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Finca</th><th style={{ textAlign: 'right' }}>Salarios</th><th style={{ textAlign: 'right' }}>Maq.</th><th style={{ textAlign: 'right' }}>Gasóleo</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
              <tbody>
                {costesPorFinca.map((f, i) => (
                  <tr key={i}>
                    <td>{f.finca}</td>
                    <td style={{ textAlign: 'right' }}>{f.peones.toFixed(2)} €</td>
                    <td style={{ textAlign: 'right' }}>{f.maquinaria.toFixed(2)} €</td>
                    <td style={{ textAlign: 'right' }}>{f.gasoil.toFixed(2)} €</td>
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
