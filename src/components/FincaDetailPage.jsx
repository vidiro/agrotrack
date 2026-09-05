import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../data/supabaseClient'
import { format, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { cosechaKilogrados, cosechaAceite } from '../utils/cosecha'

function FincaDetailPage({ fincas, personal, maquinaria, params, selectedFincaForDetail, onNavigate }) {
  const [selectedFinca, setSelectedFinca] = useState(selectedFincaForDetail || '')
  const [filterMonth, setFilterMonth] = useState('') // vacío = todo
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [labores, setLabores] = useState([])
  const [aplicaciones, setAplicaciones] = useState([])
  const [cosechas, setCosechas] = useState([])
  const [gastos, setGastos] = useState([])

  const meses = ['', ...Array.from({ length: 6 }, (_, i) => format(subMonths(new Date(), i), 'yyyy-MM'))]

  // Sincronizar si viene de FincasPage con una finca preseleccionada
  useEffect(() => {
    if (selectedFincaForDetail) {
      setSelectedFinca(selectedFincaForDetail)
    }
  }, [selectedFincaForDetail])

  const fincaSeleccionada = fincas.find(f => f.id_finca === selectedFinca)

  // Cargar datos al seleccionar finca o mes
  useEffect(() => {
    if (!selectedFinca) return
    loadData()
  }, [selectedFinca, filterMonth])

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const monthFilter = filterMonth ? `.gte('fecha', ${filterMonth}-01).lte('fecha', ${filterMonth}-31)` : ''

      // Labores de la finca
      let labQuery = supabase.from('labores').select('*').eq('id_finca', selectedFinca).order('fecha', { ascending: false })
      if (filterMonth) labQuery = labQuery.gte('fecha', filterMonth + '-01').lte('fecha', filterMonth + '-28')
      const labRes = await labQuery

      // Aplicaciones (vía labores de la finca)
      let appQuery = supabase.from('aplicaciones').select('*, labores(id_finca)').order('creado_en', { ascending: false })
      const appRes = await appQuery

      // Cosechas de la finca
      let cosQuery = supabase.from('cosechas').select('*').eq('id_finca', selectedFinca).order('fecha', { ascending: false })
      if (filterMonth) cosQuery = cosQuery.gte('fecha', filterMonth + '-01').lte('fecha', filterMonth + '-28')
      const cosRes = await cosQuery

      // Gastos asociados a la finca
      let gasQuery = supabase.from('gastos_manual').select('*').eq('id_finca', selectedFinca).order('fecha', { ascending: false })
      if (filterMonth) gasQuery = gasQuery.gte('fecha', filterMonth + '-01').lte('fecha', filterMonth + '-28')
      const gasRes = await gasQuery

      if (labRes.error) throw labRes.error

      setLabores(labRes.data || [])
      // Filtrar aplicaciones por la finca seleccionada
      setAplicaciones((appRes.data || []).filter(a => a.labores?.id_finca === selectedFinca))
      setCosechas(cosRes.data || [])
      setGastos(gasRes.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // === CÁLCULOS ===
  const stats = useMemo(() => {
    const totalHoras = labores.reduce((s, l) => s + (l.h_maquinaria || 0) + (l.hh_persona || 0), 0)
    const totalCoste = labores.reduce((s, l) => s + (l.coste_total || 0), 0)
    const totalProduccion = cosechas.reduce((s, c) => s + (c.kg || 0), 0)
    const totalKilogrados = cosechas.reduce((s, c) => s + (cosechaKilogrados(c) || 0), 0)
    const totalAceite = cosechas.reduce((s, c) => s + (cosechaAceite(c) || 0), 0)
    const totalGastos = gastos.reduce((s, g) => s + (g.importe || 0), 0)
    const numAplicaciones = aplicaciones.length

    return { totalHoras, totalCoste, totalProduccion, totalKilogrados, totalAceite, totalGastos, numAplicaciones, numLabores: labores.length, numCosechas: cosechas.length }
  }, [labores, aplicaciones, cosechas, gastos])

  return (
    <div>
      {/* Botón volver */}
      <button className="btn btn-small mb-12" onClick={() => onNavigate?.('fincas')} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer' }}>
        ← Volver a Fincas
      </button>

      {/* Selector de finca */}
      <div className="flex items-center gap-12 mb-16 flex-wrap">
        <label className="form-label mb-0">Finca:</label>
        <select className="form-select" value={selectedFinca} onChange={e => setSelectedFinca(e.target.value)} aria-label="Seleccionar finca">
          <option value="">— Elegir finca —</option>
          {fincas.map(f => (
            <option key={f.id_finca} value={f.id_finca}>{f.nombre}</option>
          ))}
        </select>
        <label className="form-label mb-0">Mes:</label>
        <select className="form-select" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} aria-label="Filtrar por mes" style={{ width: 'auto' }}>
          {meses.map(m => (
            <option key={m || 'all'} value={m || ''}>{m ? format(new Date(m + '-01'), 'MMMM yyyy', { locale: es }) : 'Todo'}</option>
          ))}
        </select>
      </div>

      {!selectedFinca ? (
        <div className="empty-state">
          <div className="empty-state-icon">🌍</div>
          <div className="empty-state-text">Selecciona una finca para ver su detalle</div>
        </div>
      ) : loading ? (
        <div className="empty-state" aria-busy="true">
          <div className="spinner"></div>
          <p className="mt-16">Cargando datos de {fincaSeleccionada?.nombre}...</p>
        </div>
      ) : (
        <div>
          {error && <div className="alert alert-error">⚠️ {error}</div>}

          {/* Cabecera con nombre de finca */}
          <div className="card mb-16" style={{ background: 'var(--color-primary-light)', borderColor: 'var(--color-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem' }}>🌍 {fincaSeleccionada?.nombre}</h2>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                  {fincaSeleccionada?.cultivo} {fincaSeleccionada?.variedad && `· ${fincaSeleccionada.variedad}`} {fincaSeleccionada?.superficie_total_ha && `· ${fincaSeleccionada.superficie_total_ha} ha`} {fincaSeleccionada?.termino_municipal && `· ${fincaSeleccionada.termino_municipal}`}
                </div>
              </div>
              {fincaSeleccionada?.poligono && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Pol. {fincaSeleccionada.poligono} / Parc. {fincaSeleccionada.parcela}</div>}
            </div>
          </div>

          {/* Tarjetas resumen */}
          <div className="summary-grid">
            <div className="summary-card">
              <div className="summary-value">{stats.numLabores}</div>
              <div className="summary-label">Labores</div>
            </div>
            <div className="summary-card accent">
              <div className="summary-value">{stats.totalHoras.toFixed(0)} h</div>
              <div className="summary-label">Horas totales</div>
            </div>
            <div className="summary-card">
              <div className="summary-value">{stats.numAplicaciones}</div>
              <div className="summary-label">Aplicaciones</div>
            </div>
            <div className="summary-card success">
              <div className="summary-value">{stats.totalProduccion.toFixed(0)} kg</div>
              <div className="summary-label">Producción</div>
            </div>
            {(stats.totalKilogrados > 0 || stats.totalAceite > 0) && (
              <div className="summary-card accent">
                <div className="summary-value">{(stats.totalKilogrados || stats.totalAceite).toFixed(0)}</div>
                <div className="summary-label">{stats.totalKilogrados > 0 ? 'Kilogrados (kg°)' : 'Aceite potencial (kg)'}</div>
              </div>
            )}
          </div>

          {/* Costes y gastos */}
          <div className="summary-grid">
            <div className="summary-card danger">
              <div className="summary-value">{stats.totalCoste.toFixed(0)} €</div>
              <div className="summary-label">Coste labores</div>
            </div>
            <div className="summary-card danger">
              <div className="summary-value">{stats.totalGastos.toFixed(0)} €</div>
              <div className="summary-label">Gastos asociados</div>
            </div>
            <div className="summary-card accent">
              <div className="summary-value">{(stats.totalCoste + stats.totalGastos).toFixed(0)} €</div>
              <div className="summary-label">Total inversión</div>
            </div>
            <div className="summary-card">
              <div className="summary-value">{stats.numCosechas}</div>
              <div className="summary-label">Cosechas</div>
            </div>
          </div>

          {/* Sección: Labores */}
          <div className="card">
            <div className="card-title">📝 Labores ({stats.numLabores})</div>
            {labores.length > 0 ? (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr><th>Fecha</th><th>Trabajo</th><th>Horas</th><th>Coste</th></tr>
                  </thead>
                  <tbody>
                    {labores.slice(0, 20).map(l => (
                      <tr key={l.id_labor}>
                        <td>{l.fecha ? format(new Date(l.fecha), 'dd/MM/yy') : '—'}</td>
                        <td>{l.tipo_trabajo || '—'}</td>
                        <td>{(l.hh_persona || 0 + (l.h_maquinaria || 0)).toFixed(1)} h</td>
                        <td>{(l.coste_total || 0).toFixed(0)} €</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state"><div className="empty-state-icon">📝</div><div className="empty-state-text">Sin labores</div></div>
            )}
          </div>

          {/* Sección: Aplicaciones fitosanitarias */}
          <div className="card">
            <div className="card-title">🧪 Aplicaciones Fitosanitarias ({stats.numAplicaciones})</div>
            {aplicaciones.length > 0 ? (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr><th>Producto</th><th>Materia activa</th><th>Dosis</th><th>Carencia</th></tr>
                  </thead>
                  <tbody>
                    {aplicaciones.slice(0, 20).map(a => (
                      <tr key={a.id_aplicacion}>
                        <td>{a.producto || '—'}</td>
                        <td>{a.materia_activa || '—'}</td>
                        <td>{a.dosis ? `${a.dosis}` : '—'}</td>
                        <td>{a.carencia_dias ? `${a.carencia_dias} días` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state"><div className="empty-state-icon">🧪</div><div className="empty-state-text">Sin aplicaciones registradas</div></div>
            )}
          </div>

          {/* Sección: Cosechas */}
          <div className="card">
            <div className="card-title">🍇 Cosechas ({stats.numCosechas})</div>
            {cosechas.length > 0 ? (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr><th>Fecha</th><th>Cultivo</th><th>Variedad</th><th>kg</th><th>Kilogrados</th><th>Cajones</th><th>Destino</th></tr>
                  </thead>
                  <tbody>
                    {cosechas.slice(0, 20).map(c => (
                      <tr key={c.id_cosecha}>
                        <td>{c.fecha ? format(new Date(c.fecha), 'dd/MM/yy') : '—'}</td>
                        <td>{c.cultivo || '—'}</td>
                        <td>{c.variedad || '—'}</td>
                        <td><strong>{(c.kg || 0).toFixed(0)}</strong></td>
                        <td>{cosechaKilogrados(c) != null ? `${cosechaKilogrados(c).toFixed(0)} kg°` : (cosechaAceite(c) != null ? `${cosechaAceite(c).toFixed(0)} kg ace.` : '—')}</td>
                        <td>{c.n_cajones || '—'}</td>
                        <td>{c.destino || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state"><div className="empty-state-icon">🍇</div><div className="empty-state-text">Sin cosechas</div></div>
            )}
          </div>

          {/* Sección: Gastos asociados */}
          <div className="card">
            <div className="card-title">💰 Gastos asociados ({gastos.length})</div>
            {gastos.length > 0 ? (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Importe</th></tr>
                  </thead>
                  <tbody>
                    {gastos.slice(0, 20).map(g => (
                      <tr key={g.id_gasto}>
                        <td>{g.fecha ? format(new Date(g.fecha), 'dd/MM/yy') : '—'}</td>
                        <td>{g.concepto || '—'}</td>
                        <td>{g.categoria || '—'}</td>
                        <td>{(g.importe || 0).toFixed(2)} €</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state"><div className="empty-state-icon">💰</div><div className="empty-state-text">Sin gastos asociados a esta finca</div></div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default FincaDetailPage