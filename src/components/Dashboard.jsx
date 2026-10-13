import { useState, useEffect } from 'react'
import { supabase } from '../data/supabaseClient'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts'
import { format, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { cosechaKilogrados, cosechaAceite } from '../utils/cosecha'
import { getIcon } from '../utils/lucideIcons'
import { getParamValue } from '../utils/params'

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
      if (ingrRes.error && !ingrRes.message?.includes('Could not find the table')) throw ingrRes.error
      setLabores(labRes.data || [])
      setCosechas(cosechRes.data || [])
      setGastos(gastRes.data || [])
      setIngresos(ingrRes.data || [])
      if (ingrRes.error && !ingrRes.data) {
        setError('Tabla "ingresos" no encontrada en la base de datos.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), i)
    return format(d, 'yyyy-MM')
  })

  const laboresMes = labores.filter(l => l.fecha && l.fecha.startsWith(selectedMonth))
  const cosechasMes = cosechas.filter(c => c.fecha && c.fecha.startsWith(selectedMonth))
  const gastosMes = gastos.filter(g => g.fecha && g.fecha.startsWith(selectedMonth))
  const ingresosMes = ingresos.filter(i => i.fecha && i.fecha.startsWith(selectedMonth))

  const totalCostesLabores = laboresMes.reduce((s, l) => s + (l.coste_total || 0), 0)
  const totalCostePeones = laboresMes.reduce((s, l) => s + (l.coste_peones || 0), 0)
  const totalCosteMaquinaria = laboresMes.reduce((s, l) => s + (l.coste_maquinaria || 0), 0)
  const totalCosteGasoil = laboresMes.reduce((s, l) => s + (l.coste_gasoil || 0), 0)
  const totalGastos = gastosMes.reduce((s, g) => s + (g.importe || 0), 0)
  const totalIngresos = ingresosMes.reduce((s, i) => s + (i.cantidad || 0), 0)
  const totalProduccion = cosechasMes.reduce((s, c) => s + (c.kg || 0), 0)
  const totalKilogrados = cosechasMes.reduce((s, c) => s + (cosechaKilogrados(c) || 0), 0)
  const totalAceite = cosechasMes.reduce((s, c) => s + (cosechaAceite(c) || 0), 0)
  const numLabores = laboresMes.length
  const numCosechas = cosechasMes.length
  const balanceContable = totalIngresos - totalGastos - totalCostesLabores
  const balanceSinSalarios = totalIngresos - totalGastos - totalCosteMaquinaria - totalCosteGasoil
  const balanceCaja = totalIngresos - totalGastos

  // Gastos por categoría
  const gastosPorCategoria = {}
  gastosMes.forEach(g => {
    const cat = g.categoria || 'Gastos directos'
    gastosPorCategoria[cat] = (gastosPorCategoria[cat] || 0) + (g.importe || 0)
  })
  if (totalCostePeones > 0) gastosPorCategoria['Salarios'] = (gastosPorCategoria['Salarios'] || 0) + totalCostePeones
  if (totalCosteMaquinaria > 0) gastosPorCategoria['Maquinaria'] = (gastosPorCategoria['Maquinaria'] || 0) + totalCosteMaquinaria
  if (totalCosteGasoil > 0) gastosPorCategoria['Gasóleo'] = (gastosPorCategoria['Gasóleo'] || 0) + totalCosteGasoil
  const datosGraficoGastos = Object.entries(gastosPorCategoria).map(([nombre, valor]) => ({ nombre, valor }))

  // Producción anual por cultivo
  const anosUnicos = [...new Set(cosechas.filter(c => c.fecha).map(c => c.fecha.substring(0, 4)))].sort()
  const tiposCultivo = [...new Set(cosechas.map(c => c.cultivo).filter(Boolean))]
  const datosProduccionAnual = anosUnicos.map(anio => {
    const row = { año: anio }
    tiposCultivo.forEach(cultivo => {
      const kg = cosechas.filter(c => c.fecha && c.fecha.startsWith(anio) && c.cultivo === cultivo).reduce((s, c) => s + (c.kg || 0), 0)
      row[cultivo] = kg
    })
    return row
  })

  // Ingresos vs Gastos anuales
  const datosAnuales = anosUnicos.map(anio => {
    const gastosAnio = gastos.filter(g => g.fecha && g.fecha.startsWith(anio)).reduce((s, g) => s + (g.importe || 0), 0)
    const laboresAnio = labores.filter(l => l.fecha && l.fecha.startsWith(anio)).reduce((s, l) => s + (l.coste_total || 0), 0)
    const ingresosAnio = ingresos.filter(i => i.fecha && i.fecha.startsWith(anio)).reduce((s, i) => s + (i.cantidad || 0), 0)
    return { año: anio, gastos: gastosAnio + laboresAnio, ingresos: ingresosAnio }
  })

  // Colores del tema CSS
  const verdeCampo = '#1f4d33'
  const trigo = '#e9b949'
  const rojo = '#a63a2b'
  const tierra = '#7a4a1f'
  const vina = '#6b2f6b'
  const olivar = '#5d8a3f'

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
          <span>{error}</span>
          <button className="btn btn-small btn-primary" onClick={loadData} aria-label="Reintentar">
            {getIcon('RefreshCw', { size: 16 })} Reintentar
          </button>
        </div>
      )}

      {/* Selector de mes */}
      <div className="flex items-center gap-12 mb-24 flex-wrap" style={{ justifyContent: 'flex-end' }}>
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
        <div className="summary-card danger">
          <div className="summary-value">{totalGastos.toFixed(2)} €</div>
          <div className="summary-label">Gastos directos</div>
        </div>
        <div className="summary-card success">
          <div className="summary-value">{totalIngresos.toFixed(2)} €</div>
          <div className="summary-label">Ingresos mes</div>
        </div>
      </div>

      {/* Balance del mes */}
      <div className="card" style={{ borderColor: balanceContable >= 0 ? 'var(--exito)' : 'var(--error)' }}>
        <div className="card-title" style={{ gap: 8 }}>
          Balance del mes
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <div style={{ textAlign: 'center', padding: 12, background: 'var(--fondo)', borderRadius: 'var(--radio-campo)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--texto-suave)' }}>Caja</div>
            <div style={{ fontFamily: 'var(--fuente-titulo)', fontSize: '1.25rem', fontWeight: 700, color: balanceCaja >= 0 ? 'var(--exito)' : 'var(--error)' }}>
              {balanceCaja >= 0 ? '+' : '−'}{Math.abs(balanceCaja).toFixed(0)} €
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: 12, background: 'var(--fondo)', borderRadius: 'var(--radio-campo)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--texto-suave)' }}>Sin salarios</div>
            <div style={{ fontFamily: 'var(--fuente-titulo)', fontSize: '1.25rem', fontWeight: 700, color: balanceSinSalarios >= 0 ? 'var(--exito)' : 'var(--error)' }}>
              {balanceSinSalarios >= 0 ? '+' : '−'}{Math.abs(balanceSinSalarios).toFixed(0)} €
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: 12, background: 'var(--fondo)', borderRadius: 'var(--radio-campo)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--texto-suave)' }}>Contable</div>
            <div style={{ fontFamily: 'var(--fuente-titulo)', fontSize: '1.25rem', fontWeight: 700, color: balanceContable >= 0 ? 'var(--exito)' : 'var(--error)' }}>
              {balanceContable >= 0 ? '+' : '−'}{Math.abs(balanceContable).toFixed(0)} €
            </div>
          </div>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--texto-suave)', borderTop: '1px solid var(--borde)', paddingTop: 12, marginTop: 12 }}>
          Ingresos: <strong>{totalIngresos.toFixed(2)} €</strong> · Gastos directos: <strong>{totalGastos.toFixed(2)} €</strong> · Costes labores: <strong>{totalCostesLabores.toFixed(2)} €</strong>
        </div>
      </div>

      {/* Gráficos - Barras horizontales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {/* Gastos por categoría */}
        <div className="card">
          <div className="card-title">Gastos por Categoría</div>
          {datosGraficoGastos.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={datosGraficoGastos} layout="vertical" margin={{ right: 60 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="nombre" width={80} fontSize={12} tick={{ fill: 'var(--tinta)' }} />
                <Tooltip formatter={(v) => v.toFixed(2) + ' €'} />
                <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                  {datosGraficoGastos.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={[verdeCampo, trigo, rojo, '#2980b9', vina, olivar, '#e67e22', '#16a085'][index % 8]} />
                  ))}
                </Bar>
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">
              <div className="empty-state-text">Sin gastos este mes</div>
            </div>
          )}
        </div>

        {/* Producción anual por cultivo */}
        <div className="card">
          <div className="card-title">Producción Anual por Cultivo</div>
          {datosProduccionAnual.length > 0 && tiposCultivo.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={datosProduccionAnual}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="año" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v) => v.toFixed(0) + ' kg'} />
                {tiposCultivo.map((cultivo, i) => (
                  <Bar key={cultivo} dataKey={cultivo} fill={i === 0 ? vina : olivar} name={cultivo} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">
              <div className="empty-state-text">Sin datos de producción</div>
            </div>
          )}
        </div>

        {/* Ingresos vs Gastos anuales */}
        <div className="card">
          <div className="card-title">Ingresos vs Gastos Anual</div>
          {datosAnuales.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={datosAnuales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="año" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v) => v.toFixed(2) + ' €'} />
                <Bar dataKey="ingresos" fill={verdeCampo} name="Ingresos (€)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="gastos" fill={rojo} name="Gastos (€)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">
              <div className="empty-state-text">Sin datos anuales</div>
            </div>
          )}
        </div>
      </div>

      {/* Balance de campaña */}
      {(() => {
        const getVal = (keys, def) => {
          for (const k of keys) {
            const p = params.find(p => p.clave === k)
            if (p) return parseFloat(p.valor) || def
          }
          return def
        }
        const campaignStartMonth = getVal(['campana_mes_inicio'], 9)
        const campaignStartDay = getVal(['campana_dia_inicio'], 15)
        const currentYear = new Date().getFullYear()
        const startDate = new Date(currentYear - 1, campaignStartMonth - 1, campaignStartDay)
        const endDate = new Date(currentYear, campaignStartMonth - 1, campaignStartDay)
        const isWithin = (d) => { const date = new Date(d); return date >= startDate && date <= endDate }

        const ingCampana = ingresos.filter(i => i.fecha && isWithin(i.fecha)).reduce((s, i) => s + (i.cantidad || 0), 0)
        const gastCampana = gastos.filter(g => g.fecha && isWithin(g.fecha)).reduce((s, g) => s + (g.importe || 0), 0)
        const costCampana = labores.filter(l => l.fecha && isWithin(l.fecha)).reduce((s, l) => s + (l.coste_total || 0), 0)
        const balCampana = ingCampana - gastCampana - costCampana

        const mesNames = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
        const label = `Campaña ${currentYear} (${campaignStartDay} ${mesNames[campaignStartMonth]} ${currentYear-1} - ${campaignStartDay} ${mesNames[campaignStartMonth]} ${currentYear})`

        return (
          <div className="card" style={{ borderColor: balCampana >= 0 ? 'var(--exito)' : 'var(--error)', marginTop: 16 }}>
            <div className="card-title">Balance de Campaña</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--texto-suave)', marginBottom: 12 }}>{label}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <div style={{ textAlign: 'center', padding: 12, background: 'var(--fondo)', borderRadius: 'var(--radio-campo)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--texto-suave)' }}>Ingresos</div>
                <div style={{ fontFamily: 'var(--fuente-titulo)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--exito)' }}>{ingCampana.toFixed(0)} €</div>
              </div>
              <div style={{ textAlign: 'center', padding: 12, background: 'var(--fondo)', borderRadius: 'var(--radio-campo)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--texto-suave)' }}>Gastos</div>
                <div style={{ fontFamily: 'var(--fuente-titulo)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--error)' }}>{gastCampana.toFixed(0)} €</div>
              </div>
              <div style={{ textAlign: 'center', padding: 12, background: 'var(--fondo)', borderRadius: 'var(--radio-campo)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--texto-suave)' }}>Costes</div>
                <div style={{ fontFamily: 'var(--fuente-titulo)', fontSize: '1.1rem', fontWeight: 700 }}>{costCampana.toFixed(0)} €</div>
              </div>
              <div style={{ textAlign: 'center', padding: 12, background: 'var(--fondo)', borderRadius: 'var(--radio-campo)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--texto-suave)' }}>Balance</div>
                <div style={{ fontFamily: 'var(--fuente-titulo)', fontSize: '1.1rem', fontWeight: 700, color: balCampana >= 0 ? 'var(--exito)' : 'var(--error)' }}>
                  {balCampana >= 0 ? '+' : '−'}{Math.abs(balCampana).toFixed(0)} €
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Resumen rápido */}
      <div className="card mt-24">
        <div className="card-title">Resumen Rápido</div>
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>Concepto</th><th>Valor</th></tr></thead>
            <tbody>
              <tr><td>Total fincas</td><td><strong>{fincas.length}</strong></td></tr>
              <tr><td>Personal</td><td><strong>{personal.length}</strong></td></tr>
              <tr><td>Maquinaria</td><td><strong>{maquinaria.length}</strong></td></tr>
              <tr><td>Labores este mes</td><td><strong>{numLabores}</strong></td></tr>
              <tr><td>Cosechas este mes</td><td><strong>{numCosechas}</strong></td></tr>
              <tr><td>Producción</td><td><strong>{totalProduccion.toFixed(0)} kg</strong></td></tr>
              {totalKilogrados > 0 && <tr><td>Kilogrados (viña)</td><td><strong>{totalKilogrados.toFixed(0)} kg°</strong></td></tr>}
              {totalAceite > 0 && <tr><td>Aceite potencial</td><td><strong>{totalAceite.toFixed(0)} kg</strong></td></tr>}
              <tr><td>Costes labores</td><td><strong>{totalCostesLabores.toFixed(2)} €</strong></td></tr>
              <tr><td>Gastos manuales</td><td><strong>{totalGastos.toFixed(2)} €</strong></td></tr>
              <tr><td>Ingresos</td><td><strong style={{ color: 'var(--exito)' }}>{totalIngresos.toFixed(2)} €</strong></td></tr>
              <tr style={{ background: balanceContable >= 0 ? 'var(--exito-fondo)' : 'var(--error-fondo)' }}>
                <td><strong>{balanceContable >= 0 ? 'Superávit' : 'Déficit'} (contable)</strong></td>
                <td><strong style={{ color: balanceContable >= 0 ? 'var(--exito)' : 'var(--error)' }}>
                  {balanceContable >= 0 ? '+' : '−'}{Math.abs(balanceContable).toFixed(2)} €
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
