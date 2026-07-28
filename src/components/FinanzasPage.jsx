import { useState, useEffect } from 'react'
import { supabase } from '../data/supabaseClient'
import { format, subMonths } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

function FinanzasPage({ fincas, params }) {
  const [gastos, setGastos] = useState([])
  const [labores, setLabores] = useState([])
  const [cosechas, setCosechas] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [gastRes, labRes, cosechRes] = await Promise.all([
        supabase.from('gastos_manual').select('*'),
        supabase.from('labores').select('*'),
        supabase.from('cosechas').select('*')
      ])
      setGastos(gastRes.data || [])
      setLabores(labRes.data || [])
      setCosechas(cosechRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const meses = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), i)
    return format(d, 'yyyy-MM')
  })

  const datosMes = meses.map(m => {
    const gastosMes = gastos.filter(g => g.fecha && g.fecha.startsWith(m))
    const laboresMes = labores.filter(l => l.fecha && l.fecha.startsWith(m))
    const cosechasMes = cosechas.filter(c => c.fecha && c.fecha.startsWith(m))
    
    const totalGastos = gastosMes.reduce((sum, g) => sum + (g.importe || 0), 0)
    const totalLabores = laboresMes.reduce((sum, l) => sum + (l.coste_total || 0), 0)
    const totalProduccion = cosechasMes.reduce((sum, c) => sum + (c.kg || 0), 0)
    
    return {
      mes: format(new Date(m + '-01'), 'MMM yyyy'),
      mesKey: m,
      gastos: totalGastos,
      labores: totalLabores,
      produccion: totalProduccion
    }
  })

  const datosActuales = datosMes.find(d => d.mesKey === selectedMonth)
  const totalGastosMes = datosActuales ? datosActuales.gastos : 0
  const totalLaboresMes = datosActuales ? datosActuales.labores : 0
  const totalProduccionMes = datosActuales ? datosActuales.produccion : 0
  const totalGastosAnual = datosMes.reduce((sum, d) => sum + d.gastos, 0)
  const totalLaboresAnual = datosMes.reduce((sum, d) => sum + d.labores, 0)

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner"></div>
        <p className="mt-16">Cargando finanzas...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex gap-16 mb-24 flex-wrap">
        <label className="form-label mb-0">Mes:</label>
        <select className="form-select" style={{ width: 'auto' }} value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
          {meses.map(m => (
            <option key={m} value={m}>{format(new Date(m + '-01'), 'MMMM yyyy')}</option>
          ))}
        </select>
      </div>

      {/* Resumen del mes */}
      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-value">{totalGastosMes.toFixed(2)} €</div>
          <div className="summary-label">Gastos manuales</div>
        </div>
        <div className="summary-card accent">
          <div className="summary-value">{totalLaboresMes.toFixed(2)} €</div>
          <div className="summary-label">Costes de labores</div>
        </div>
        <div className="summary-card danger">
          <div className="summary-value">{(totalGastosMes + totalLaboresMes).toFixed(2)} €</div>
          <div className="summary-label">Total gastos mes</div>
        </div>
        <div className="summary-card success">
          <div className="summary-value">{totalProduccionMes.toFixed(0)} kg</div>
          <div className="summary-label">Producción mes</div>
        </div>
      </div>

      {/* Gráfico de evolución mensual */}
      <div className="card">
        <div className="card-title">📈 Evolución de Gastos (últimos 12 meses)</div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={datosMes}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="mes" fontSize={10} />
            <YAxis fontSize={12} />
            <Tooltip formatter={(v) => `${v.toFixed(2)} €`} />
            <Bar dataKey="gastos" fill="#c0392b" name="Gastos manuales" radius={[4, 4, 0, 0]} />
            <Bar dataKey="labores" fill="#1a472a" name="Costes labores" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detalle del mes */}
      <div className="card">
        <div className="card-title">📋 Detalle del mes: {datosActuales ? format(new Date(datosActuales.mesKey + '-01'), 'MMMM yyyy') : ''}</div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Concepto</th>
                <th>Categoría</th>
                <th>Importe</th>
              </tr>
            </thead>
            <tbody>
              {gastos
                .filter(g => g.fecha && g.fecha.startsWith(selectedMonth))
                .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
                .map(g => (
                  <tr key={g.id_gasto}>
                    <td>{g.fecha ? format(new Date(g.fecha), 'dd/MM/yyyy') : '-'}</td>
                    <td>{g.concepto || '-'}</td>
                    <td>{g.categoria || '-'}</td>
                    <td><strong>{g.importe ? `${g.importe.toFixed(2)} €` : '-'}</strong></td>
                  </tr>
                ))}
              <tr style={{ borderTop: '2px solid var(--color-primary)' }}>
                <td colSpan="3"><strong>TOTAL GASTOS</strong></td>
                <td><strong>{totalGastosMes.toFixed(2)} €</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Resumen anual */}
      <div className="card">
        <div className="card-title">📊 Resumen Anual (últimos 12 meses)</div>
        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-value">{totalGastosAnual.toFixed(2)} €</div>
            <div className="summary-label">Total gastos manuales</div>
          </div>
          <div className="summary-card accent">
            <div className="summary-value">{totalLaboresAnual.toFixed(2)} €</div>
            <div className="summary-label">Total costes labores</div>
          </div>
          <div className="summary-card danger">
            <div className="summary-value">{(totalGastosAnual + totalLaboresAnual).toFixed(2)} €</div>
            <div className="summary-label">Total anual</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FinanzasPage
