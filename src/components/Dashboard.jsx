import { useState, useEffect } from 'react'
import { supabase } from '../data/supabaseClient'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { format, subMonths } from 'date-fns'

function Dashboard({ fincas, personal, maquinaria, params }) {
  const [labores, setLabores] = useState([])
  const [cosechas, setCosechas] = useState([])
  const [gastos, setGastos] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      const [labRes, cosechRes, gastRes] = await Promise.all([
        supabase.from('labores').select('*').order('fecha', { ascending: false }),
        supabase.from('cosechas').select('*').order('fecha', { ascending: false }),
        supabase.from('gastos_manual').select('*').order('fecha', { ascending: false })
      ])
      setLabores(labRes.data || [])
      setCosechas(cosechRes.data || [])
      setGastos(gastRes.data || [])
      setLoading(false)
    }
    loadData()
  }, [])

  // Filtrar por mes seleccionado
  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), i)
    return format(d, 'yyyy-MM')
  })

  const laboresMes = labores.filter(l => l.fecha && l.fecha.startsWith(selectedMonth))
  const cosechasMes = cosechas.filter(c => c.fecha && c.fecha.startsWith(selectedMonth))
  const gastosMes = gastos.filter(g => g.fecha && g.fecha.startsWith(selectedMonth))

  // Costes por finca
  const costesPorFinca = fincas.map(f => {
    const costes = laboresMes.filter(l => l.id_finca === f.id_finca)
    const total = costes.reduce((sum, l) => sum + (l.coste_total || 0), 0)
    return { nombre: f.nombre, coste: total }
  }).filter(f => f.coste > 0)

  // Producción por mes (últimos 6 meses)
  const produccionPorMes = meses.map(m => {
    const cosech = cosechas.filter(c => c.fecha && c.fecha.startsWith(m))
    const totalKg = cosech.reduce((sum, c) => sum + (c.kg || 0), 0)
    return { mes: format(new Date(m + '-01'), 'MMM'), kg: totalKg }
  })

  // Gastos por categoría
  const gastosPorCategoria = {}
  gastosMes.forEach(g => {
    const cat = g.categoria || 'Sin categoría'
    gastosPorCategoria[cat] = (gastosPorCategoria[cat] || 0) + (g.importe || 0)
  })

  const datosGraficoGastos = Object.entries(gastosPorCategoria).map(([nombre, valor]) => ({ nombre, valor }))
  const COLORES = ['#1a472a', '#d4a017', '#c0392b', '#2980b9', '#8e44ad', '#27ae60']

  // Totales del mes
  const totalCostesLabores = laboresMes.reduce((sum, l) => sum + (l.coste_total || 0), 0)
  const totalGastos = gastosMes.reduce((sum, g) => sum + (g.importe || 0), 0)
  const totalProduccion = cosechasMes.reduce((sum, c) => sum + (c.kg || 0), 0)
  const numLabores = laboresMes.length
  const numCosechas = cosechasMes.length

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner"></div>
        <p className="mt-16">Cargando datos...</p>
      </div>
    )
  }

  return (
    <div>
      {/* Selector de mes */}
      <div className="flex items-center gap-12 mb-24 flex-wrap">
        <label className="form-label mb-0">Mes:</label>
        <select
          className="form-select"
          style={{ width: 'auto' }}
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
        >
          {meses.map(m => (
            <option key={m} value={m}>{format(new Date(m + '-01'), 'MMMM yyyy')}</option>
          ))}
        </select>
      </div>

      {/* Tarjetas de resumen */}
      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-value">{numLabores}</div>
          <div className="summary-label">Labores registradas</div>
        </div>
        <div className="summary-card accent">
          <div className="summary-value">{totalProduccion.toFixed(0)} kg</div>
          <div className="summary-label">Producción total</div>
        </div>
        <div className="summary-card danger">
          <div className="summary-value">{totalCostesLabores.toFixed(2)} €</div>
          <div className="summary-label">Costes de labores</div>
        </div>
        <div className="summary-card success">
          <div className="summary-value">{totalGastos.toFixed(2)} €</div>
          <div className="summary-label">Gastos manuales</div>
        </div>
      </div>

      {/* Gráficos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {/* Costes por finca */}
        <div className="card">
          <div className="card-title">📈 Costes por Finca</div>
          {costesPorFinca.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={costesPorFinca}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nombre" fontSize={10} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v) => `${v.toFixed(2)} €`} />
                <Bar dataKey="coste" fill="#1a472a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <div className="empty-state-text">Sin datos de costes este mes</div>
            </div>
          )}
        </div>

        {/* Producción por mes */}
        <div className="card">
          <div className="card-title">🍇 Producción Mensual</div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={produccionPorMes}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" fontSize={10} />
              <YAxis fontSize={12} />
              <Tooltip formatter={(v) => `${v.toFixed(0)} kg`} />
              <Line type="monotone" dataKey="kg" stroke="#1a472a" strokeWidth={2} dot={{ fill: '#1a472a' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Gastos por categoría */}
        <div className="card">
          <div className="card-title">💰 Gastos por Categoría</div>
          {datosGraficoGastos.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={datosGraficoGastos}
                  dataKey="valor"
                  nameKey="nombre"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, valor }) => `${name}: ${valor.toFixed(0)} €`}
                >
                  {datosGraficoGastos.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORES[index % COLORES.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${v.toFixed(2)} €`} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <div className="empty-state-text">Sin gastos este mes</div>
            </div>
          )}
        </div>
      </div>

      {/* Resumen rápido */}
      <div className="card mt-24">
        <div className="card-title">📋 Resumen Rápido</div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Total fincas registradas</td><td><strong>{fincas.length}</strong></td></tr>
              <tr><td>Personal registrado</td><td><strong>{personal.length}</strong></td></tr>
              <tr><td>Maquinaria registrada</td><td><strong>{maquinaria.length}</strong></td></tr>
              <tr><td>Labores este mes</td><td><strong>{numLabores}</strong></td></tr>
              <tr><td>Cosechas este mes</td><td><strong>{numCosechas}</strong></td></tr>
              <tr><td>Producción este mes</td><td><strong>{totalProduccion.toFixed(0)} kg</strong></td></tr>
              <tr><td>Costes labores este mes</td><td><strong>{totalCostesLabores.toFixed(2)} €</strong></td></tr>
              <tr><td>Gastos manuales este mes</td><td><strong>{totalGastos.toFixed(2)} €</strong></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
