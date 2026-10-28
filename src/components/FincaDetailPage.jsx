import { useState, useEffect, useMemo } from 'react'
import { Inbox } from 'lucide-react'
import { fetchAll } from '../utils/fetchAll'
import { gastosCorrientes, gastosInversion, esGastoInversion } from '../utils/gastos'
import { esFertilizante, textoNPK } from '../utils/fertilizacion'
import { laborIncluyeFinca, repartoLabor } from '../utils/labores'
import { getParamValue } from '../utils/params'
import { format, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { cosechaKilogrados, cosechaAceite } from '../utils/cosecha'
import { useRecuperacion } from '../utils/useRecuperacion'
import RecuperacionInversion from './RecuperacionInversion'

function FincaDetailPage({ fincas, personal, maquinaria, params, destinos, preciosDestino, amortizaciones, selectedFincaForDetail, onNavigate }) {
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

  // Recuperación de la inversión (histórico completo, independiente del filtro de mes)
  const recuperacion = useRecuperacion({ fincas, amortizaciones, params, destinos, preciosDestino, personal, maquinaria })
  const recFinca = recuperacion.resultados.find(r => String(r.id_finca) === String(selectedFinca))

  // Cargar datos al seleccionar finca o mes
  useEffect(() => {
    if (!selectedFinca) return
    loadData()
  }, [selectedFinca, filterMonth])

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      // Rango del mes completo (antes se cortaba en el día 28)
      const monthRange = (q) => {
        if (!filterMonth) return q
        const [y, m] = filterMonth.split('-').map(Number)
        const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
        return q.gte('fecha', `${filterMonth}-01`).lt('fecha', next)
      }

      const [labRes, appRes, cosRes, gasRes] = await Promise.all([
        // Labores: se filtran en cliente porque una jornada puede incluir varias fincas
        fetchAll('labores', q => monthRange(q).order('fecha', { ascending: false })),
        fetchAll('aplicaciones'),
        fetchAll('cosechas', q => monthRange(q.eq('id_finca', selectedFinca)).order('fecha', { ascending: false })),
        fetchAll('gastos_manual', q => monthRange(q.eq('id_finca', selectedFinca)).order('fecha', { ascending: false })),
      ])
      for (const r of [labRes, appRes, cosRes, gasRes]) if (r.error) throw r.error

      const laboresFinca = (labRes.data || []).filter(l => laborIncluyeFinca(l, selectedFinca))
      const idsLabores = new Set(laboresFinca.map(l => String(l.id_labor)))

      setLabores(laboresFinca)
      setAplicaciones((appRes.data || []).filter(a => idsLabores.has(String(a.id_labor))))
      setCosechas(cosRes.data || [])
      setGastos(gasRes.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Horas y coste de una labor imputables a esta finca
  // Solo lo que se hizo en ESTA finca: sus tipos de trabajo, sus horas y su parte del coste
  const ctxReparto = { personal, maquinaria, precioGasoil: getParamValue(params, ['precio_gasoil_l', 'coste_gasoleo'], 0) }
  const laborEnFinca = (l) => {
    const r = repartoLabor(l, ctxReparto).get(String(selectedFinca))
    if (!r) return { horas: 0, coste: 0, tipos: [] }
    return { horas: r.horasPeones + r.horasMaq, coste: r.total, tipos: r.tipos }
  }

  // === CÁLCULOS ===
  const stats = useMemo(() => {
    const porLabor = labores.map(laborEnFinca)
    const totalHoras = porLabor.reduce((s, x) => s + x.horas, 0)
    const totalCoste = porLabor.reduce((s, x) => s + x.coste, 0)
    const totalProduccion = cosechas.reduce((s, c) => s + (parseFloat(c.kg) || 0), 0)
    const totalKilogrados = cosechas.reduce((s, c) => s + (cosechaKilogrados(c) || 0), 0)
    const totalAceite = cosechas.reduce((s, c) => s + (cosechaAceite(c) || 0), 0)
    const totalGastos = gastosCorrientes(gastos).reduce((s, g) => s + (g.importe || 0), 0)
    const totalInversionGastos = gastosInversion(gastos).reduce((s, g) => s + (g.importe || 0), 0)
    const numAplicaciones = aplicaciones.length

    return { totalHoras, totalCoste, totalProduccion, totalKilogrados, totalAceite, totalGastos, totalInversionGastos, numAplicaciones, numLabores: labores.length, numCosechas: cosechas.length }
  }, [labores, aplicaciones, cosechas, gastos, selectedFinca])

  // «10» → «Pol. 10», pero «Polígono 10» se deja como está (no «Pol. Polígono 10»)
  const conPrefijo = (v, prefijo, ya) => (v ? (ya.test(String(v)) ? String(v) : `${prefijo} ${v}`) : '')

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
          <div className="empty-state-icon" aria-hidden="true"><Inbox size={40} strokeWidth={1.5} /></div>
          <div className="empty-state-text">Selecciona una finca para ver su detalle</div>
        </div>
      ) : loading ? (
        <div className="empty-state" aria-busy="true">
          <div className="spinner"></div>
          <p className="mt-16">Cargando datos de {fincaSeleccionada?.nombre}...</p>
        </div>
      ) : (
        <div>
          {error && <div className="alert alert-error"> {error}</div>}

          {/* Cabecera con nombre de finca */}
          <div className="card mb-16" style={{ borderColor: 'var(--color-primary)', borderWidth: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--color-primary)' }}>{fincaSeleccionada?.nombre}</h2>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                  {fincaSeleccionada?.cultivo} {fincaSeleccionada?.variedad && `· ${fincaSeleccionada.variedad}`} {fincaSeleccionada?.superficie_total_ha && `· ${fincaSeleccionada.superficie_total_ha} ha`} {fincaSeleccionada?.termino_municipal && `· ${fincaSeleccionada.termino_municipal}`}
                </div>
              </div>
              {(fincaSeleccionada?.poligono || fincaSeleccionada?.parcela) && (
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                  {[conPrefijo(fincaSeleccionada.poligono, 'Pol.', /pol/i), conPrefijo(fincaSeleccionada.parcela, 'Parc.', /parc/i)].filter(Boolean).join(' · ')}
                </div>
              )}
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
              {stats.totalInversionGastos > 0 && <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>+ {stats.totalInversionGastos.toFixed(0)} € de inversión (no suma)</div>}
            </div>
            <div className="summary-card accent">
              <div className="summary-value">{(stats.totalCoste + stats.totalGastos).toFixed(0)} €</div>
              <div className="summary-label">Total costes</div>
            </div>
            <div className="summary-card">
              <div className="summary-value">{stats.numCosechas}</div>
              <div className="summary-label">Cosechas</div>
            </div>
          </div>

          {/* Recuperación de la inversión */}
          {recFinca ? (
            <RecuperacionInversion r={recFinca} />
          ) : recuperacion.cargando ? (
            <div className="card"><div className="card-title">Recuperación de la inversión</div><p className="mt-16">Calculando…</p></div>
          ) : recuperacion.error ? (
            <div className="alert alert-error">No se pudo calcular la recuperación: {recuperacion.error}</div>
          ) : (
            <div className="card">
              <div className="card-title">Recuperación de la inversión</div>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '0 0 12px' }}>
                Registra lo que pagaste por esta finca (terreno, plantación, riego…) en Inversiones y aquí verás cuánto llevas recuperado y cuándo se paga.
              </p>
              <button type="button" className="btn btn-small btn-primary" onClick={() => onNavigate?.('amortizaciones')}>Ir a Inversiones</button>
            </div>
          )}

          {/* Sección: Labores */}
          <div className="card">
            <div className="card-title"> Labores ({stats.numLabores})</div>
            {labores.length > 0 ? (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr><th>Fecha</th><th>Trabajo</th><th>Horas</th><th>Coste</th></tr>
                  </thead>
                  <tbody>
                    {labores.slice(0, 20).map(l => {
                      const x = laborEnFinca(l)
                      return (
                        <tr key={l.id_labor}>
                          <td>{l.fecha ? format(new Date(l.fecha), 'dd/MM/yy') : '—'}</td>
                          <td>{x.tipos.join(', ') || l.tipo_trabajo || '—'}</td>
                          <td>{x.horas.toFixed(1)} h</td>
                          <td>{x.coste.toFixed(0)} €</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state"><div className="empty-state-icon" aria-hidden="true"><Inbox size={40} strokeWidth={1.5} /></div><div className="empty-state-text">Sin labores</div></div>
            )}
          </div>

          {/* Sección: Aplicaciones fitosanitarias */}
          <div className="card">
            <div className="card-title"> Tratamientos y abonados ({stats.numAplicaciones})</div>
            {aplicaciones.length > 0 ? (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr><th>Producto</th><th>Materia activa / riqueza</th><th>Dosis</th><th>Carencia</th></tr>
                  </thead>
                  <tbody>
                    {aplicaciones.slice(0, 20).map(a => (
                      <tr key={a.id_aplicacion}>
                        <td>{a.producto || '—'}{esFertilizante(a) && <span className="badge badge-green" style={{ marginLeft: 6 }}>Abono</span>}</td>
                        <td>{esFertilizante(a) ? (textoNPK(a) || '—') : (a.materia_activa || '—')}</td>
                        <td>{a.dosis ? `${a.dosis}${esFertilizante(a) ? ` ${a.unidad_dosis || 'kg/ha'}` : ''}` : '—'}</td>
                        <td>{a.carencia_dias ? `${a.carencia_dias} días` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state"><div className="empty-state-icon" aria-hidden="true"><Inbox size={40} strokeWidth={1.5} /></div><div className="empty-state-text">Sin aplicaciones registradas</div></div>
            )}
          </div>

          {/* Sección: Cosechas */}
          <div className="card">
            <div className="card-title"> Cosechas ({stats.numCosechas})</div>
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
              <div className="empty-state"><div className="empty-state-icon" aria-hidden="true"><Inbox size={40} strokeWidth={1.5} /></div><div className="empty-state-text">Sin cosechas</div></div>
            )}
          </div>

          {/* Sección: Gastos asociados */}
          <div className="card">
            <div className="card-title"> Gastos asociados ({gastos.length})</div>
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
                        <td>{g.categoria || '—'}{esGastoInversion(g) ? ' (no suma)' : ''}</td>
                        <td>{(g.importe || 0).toFixed(2)} €</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state"><div className="empty-state-icon" aria-hidden="true"><Inbox size={40} strokeWidth={1.5} /></div><div className="empty-state-text">Sin gastos asociados a esta finca</div></div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default FincaDetailPage