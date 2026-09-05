import { useState, useEffect } from 'react'
import { supabase } from '../data/supabaseClient'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts'
import { format, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { cosechaKilogrados, cosechaAceite } from '../utils/cosecha'

function Dashboard({ fincas, personal, maquinaria, params }) {
  const [labores, setLabores] = useState([])
  const [cosechas, setCosechas] = useState([])
  const [gastos, setGastos] = useState([])
  const [ingresos, setIngresos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))

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
      // Si la tabla ingresos no existe, lo toleramos
      if (ingrRes.error && !ingrRes.message?.includes('Could not find the table')) {
        throw ingrRes.error
      }
      setLabores(labRes.data || [])
      setCosechas(cosechRes.data || [])
      setGastos(gastRes.data || [])
      setIngresos(ingrRes.data || [])
      // Si no hay tabla de ingresos, mostrar aviso
      if (ingrRes.error && !ingrRes.data) {
        setError('Tabla "ingresos" no encontrada en la base de datos. Crea la tabla en Supabase para usar esta función.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
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
  const ingresosMes = ingresos.filter(i => i.fecha && i.fecha.startsWith(selectedMonth))

  // Totales del mes — separando GASTOS directos de COSTES de labores
  const totalCostesLabores = laboresMes.reduce((sum, l) => sum + (l.coste_total || 0), 0)
  const totalCostePeones = laboresMes.reduce((sum, l) => sum + (l.coste_peones || 0), 0)
  const totalCosteMaquinaria = laboresMes.reduce((sum, l) => sum + (l.coste_maquinaria || 0), 0)
  const totalCosteGasoil = laboresMes.reduce((sum, l) => sum + (l.coste_gasoil || 0), 0)
  const totalGastos = gastosMes.reduce((sum, g) => sum + (g.importe || 0), 0)
  const totalIngresos = ingresosMes.reduce((sum, i) => sum + (i.cantidad || 0), 0)
  const totalProduccion = cosechasMes.reduce((sum, c) => sum + (c.kg || 0), 0)
  const totalKilogrados = cosechasMes.reduce((sum, c) => sum + (cosechaKilogrados(c) || 0), 0)
  const totalAceite = cosechasMes.reduce((sum, c) => sum + (cosechaAceite(c) || 0), 0)
  const numLabores = laboresMes.length
  const numCosechas = cosechasMes.length
  // Balance contable completo (gastos + todos los costes)
  const balanceContable = totalIngresos - totalGastos - totalCostesLabores
  // Balance sin costes de salarios (solo gastos directos + maquinaria/gasoil)
  const balanceSinSalarios = totalIngresos - totalGastos - totalCosteMaquinaria - totalCosteGasoil
  // Balance neto de caja (solo gastos directos)
  const balanceCaja = totalIngresos - totalGastos

  // === GRÁFICO 1: Gastos y Costes por categoría (mes actual) ===
  const gastosPorCategoria = {}
  gastosMes.forEach(g => {
    const cat = g.categoria || 'Gastos directos'
    gastosPorCategoria[cat] = (gastosPorCategoria[cat] || 0) + (g.importe || 0)
  })
  // Añadir los 3 componentes de costes de labores por separado
  if (totalCostePeones > 0) {
    gastosPorCategoria['Salarios'] = (gastosPorCategoria['Salarios'] || 0) + totalCostePeones
  }
  if (totalCosteMaquinaria > 0) {
    gastosPorCategoria['Maquinaria'] = (gastosPorCategoria['Maquinaria'] || 0) + totalCosteMaquinaria
  }
  if (totalCosteGasoil > 0) {
    gastosPorCategoria['Gasoleo'] = (gastosPorCategoria['Gasoleo'] || 0) + totalCosteGasoil
  }
  const datosGraficoGastos = Object.entries(gastosPorCategoria).map(([nombre, valor]) => ({ nombre, valor }))
  const COLORES = ['#1a472a', '#d4a017', '#c0392b', '#2980b9', '#8e44ad', '#27ae60', '#e67e22', '#16a085']

  // === GRÁFICO 2: Producción anual por tipo de cultivo ===
  const anosUnicos = [...new Set(cosechas.filter(c => c.fecha).map(c => c.fecha.substring(0, 4)))].sort()
  const tiposCultivo = [...new Set(cosechas.map(c => c.cultivo).filter(Boolean))]
  const datosProduccionAnual = anosUnicos.map(anio => {
    const row = { año: anio }
    tiposCultivo.forEach(cultivo => {
      const kg = cosechas
        .filter(c => c.fecha && c.fecha.startsWith(anio) && c.cultivo === cultivo)
        .reduce((sum, c) => sum + (c.kg || 0), 0)
      row[cultivo] = kg
    })
    return row
  })

  // === GRÁFICO 3: Ingresos vs Gastos anuales ===
  const datosAnuales = anosUnicos.map(anio => {
    // Gastos del año (gastos manuales + costes labores)
    const gastosAnio = gastos
      .filter(g => g.fecha && g.fecha.startsWith(anio))
      .reduce((sum, g) => sum + (g.importe || 0), 0)
    const laboresAnio = labores
      .filter(l => l.fecha && l.fecha.startsWith(anio))
      .reduce((sum, l) => sum + (l.coste_total || 0), 0)
    // Ingresos del año
    const ingresosAnio = ingresos
      .filter(i => i.fecha && i.fecha.startsWith(anio))
      .reduce((sum, i) => sum + (i.cantidad || 0), 0)
    // Producción del año
    const produccionAnio = cosechas
      .filter(c => c.fecha && c.fecha.startsWith(anio))
      .reduce((sum, c) => sum + (c.kg || 0), 0)

    return {
      año: anio,
      gastos: gastosAnio + laboresAnio,
      ingresos: ingresosAnio,
      produccion: produccionAnio
    }
  })

  if (loading) {
    return (
      <div className="empty-state" aria-busy="true">
        <div className="spinner"></div>
        <p className="mt-16">Cargando datos...</p>
      </div>
    )
  }

  return (
    <div>
      {error && (
        <div className="alert alert-error" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span>⚠️ {error}</span>
          <button className="btn btn-small btn-primary" onClick={loadData} aria-label="Reintentar">🔄 Reintentar</button>
        </div>
      )}
      {/* Selector de mes */}
      <div className="flex items-center gap-12 mb-24 flex-wrap">
        <label className="form-label mb-0">Mes:</label>
        <select
          className="form-select"
          style={{ width: 'auto' }}
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          aria-label="Seleccionar mes"
        >
          {meses.map(m => (
            <option key={m} value={m}>{format(new Date(m + '-01'), 'MMMM yyyy', { locale: es })}</option>
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
        {totalKilogrados > 0 || totalAceite > 0 ? (
          <div className="summary-card">
            <div className="summary-value">{(totalKilogrados || totalAceite).toFixed(0)}</div>
            <div className="summary-label">{totalKilogrados > 0 ? 'Kilogrados (kg°)' : 'Aceite potencial (kg)'}</div>
          </div>
        ) : null}
        <div className="summary-card danger">
          <div className="summary-value">{totalGastos.toFixed(2)} €</div>
          <div className="summary-label">Gastos directos</div>
        </div>
        <div className="summary-card success">
          <div className="summary-value">{totalIngresos.toFixed(2)} €</div>
          <div className="summary-label">Ingresos mes</div>
        </div>
      </div>

      {/* Balance del mes — tres vistas */}
      <div className="card" style={{ background: balanceContable >= 0 ? 'var(--color-success-light)' : 'var(--color-danger-light)', borderColor: balanceContable >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>💰 Balance del mes</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>Caja (sin salarios)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: balanceCaja >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {balanceCaja >= 0 ? '+' : ''}{balanceCaja.toFixed(0)} €
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>Sin salarios (con maq.)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: balanceSinSalarios >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {balanceSinSalarios >= 0 ? '+' : ''}{balanceSinSalarios.toFixed(0)} €
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>Contable completo</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: balanceContable >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {balanceContable >= 0 ? '+' : ''}{balanceContable.toFixed(0)} €
              </div>
            </div>
          </div>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
          <div>Ingresos: <strong>{totalIngresos.toFixed(2)} €</strong> · Gastos directos: <strong>{totalGastos.toFixed(2)} €</strong></div>
          <div>Costes labores: <strong>{totalCostesLabores.toFixed(2)} €</strong> (salarios {totalCostePeones.toFixed(0)} + maq. {totalCosteMaquinaria.toFixed(0)} + gasóleo {totalCosteGasoil.toFixed(0)})</div>
        </div>
      </div>

      {/* Gráficos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {/* Gastos por categoría */}
        <div className="card">
          <div className="card-title">💰 Gastos por Categoría ({format(new Date(selectedMonth + '-01'), 'MMMM yyyy', { locale: es })})</div>
          {datosGraficoGastos.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={datosGraficoGastos}
                  dataKey="valor"
                  nameKey="nombre"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                >
                  {datosGraficoGastos.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORES[index % COLORES.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => `${v.toFixed(2)} €`} />
                <Legend
                  verticalAlign="bottom"
                  height={40}
                  formatter={(value) => (
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <div className="empty-state-text">Sin gastos este mes</div>
            </div>
          )}
        </div>

        {/* Producción anual por cultivo */}
        <div className="card">
          <div className="card-title">🍇 Producción Anual por Cultivo</div>
          {datosProduccionAnual.length > 0 && tiposCultivo.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={datosProduccionAnual}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="año" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v) => `${v.toFixed(0)} kg`} />
                {tiposCultivo.map((cultivo, i) => (
                  <Bar key={cultivo} dataKey={cultivo} fill={COLORES[i % COLORES.length]} name={cultivo} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <div className="empty-state-text">Sin datos de producción</div>
            </div>
          )}
        </div>

        {/* Ingresos vs Gastos anuales */}
        <div className="card">
          <div className="card-title">📊 Ingresos vs Gastos Anual</div>
          {datosAnuales.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={datosAnuales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="año" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v) => `${v.toFixed(2)} €`} />
                <Bar dataKey="ingresos" fill="#1a472a" name="Ingresos (€)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="gastos" fill="#c0392b" name="Gastos (€)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <div className="empty-state-text">Sin datos anuales</div>
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
              {totalKilogrados > 0 && <tr><td>Kilogrados (viña)</td><td><strong>{totalKilogrados.toFixed(0)} kg°</strong></td></tr>}
              {totalAceite > 0 && <tr><td>Aceite potencial (olivar)</td><td><strong>{totalAceite.toFixed(0)} kg</strong></td></tr>}
              <tr><td>Costes labores este mes</td><td><strong>{totalCostesLabores.toFixed(2)} €</strong></td></tr>
              <tr><td>Gastos manuales este mes</td><td><strong>{totalGastos.toFixed(2)} €</strong></td></tr>
              <tr><td>Ingresos este mes</td><td><strong style={{ color: 'var(--color-success)' }}>{totalIngresos.toFixed(2)} €</strong></td></tr>
              <tr><td>— Salarios</td><td><strong>{totalCostePeones.toFixed(2)} €</strong></td></tr>
              <tr><td>— Maquinaria</td><td><strong>{totalCosteMaquinaria.toFixed(2)} €</strong></td></tr>
              <tr><td>— Gasóleo</td><td><strong>{totalCosteGasoil.toFixed(2)} €</strong></td></tr>
              <tr style={{ background: balanceContable >= 0 ? 'var(--color-success-light)' : 'var(--color-danger-light)' }}>
                <td><strong>{balanceContable >= 0 ? '✅ Superávit' : '⚠️ Déficit'} (contable)</strong></td>
                <td><strong style={{ color: balanceContable >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  {balanceContable >= 0 ? '+' : ''}{balanceContable.toFixed(2)} €
                </strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
