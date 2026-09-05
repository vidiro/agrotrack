import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../data/supabaseClient'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cosechaKilogrados, cosechaAceite } from '../utils/cosecha'

function CosechasPage({ fincas, onDataChange }) {
  const [cosechas, setCosechas] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const [form, setForm] = useState({
    fecha: format(new Date(), 'yyyy-MM-dd'),
    id_finca: '',
    id_parcela: '',
    cultivo: 'Viña',
    variedad: '',
    kg: '',
    destino: '',
    brix_baume_viina: '',
    rendimiento_graso_olivar: '',
    muestras_calidad: '',
    observaciones: ''
  })

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: err } = await supabase.from('cosechas').select('*').order('fecha', { ascending: false })
      if (err) throw err
      setCosechas(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })
  }

  // Valor en vivo del formulario: kilogrados (viña) o aceite potencial (olivar)
  const formKilogrados = useMemo(() => {
    const esVina = form.cultivo === 'Viña' || form.cultivo === 'Viña y Olivar'
    const esOlivar = form.cultivo === 'Olivar' || form.cultivo === 'Viña y Olivar'
    const kg = parseFloat(form.kg) || 0
    // Viña: kilogrados
    if (esVina) {
      const brix = parseFloat(form.brix_baume_viina) || 0
      if (kg && brix) return { value: kg * brix, label: 'kilogrados' }
    }
    // Olivar: aceite potencial
    if (esOlivar) {
      const pct = parseFloat(form.rendimiento_graso_olivar) || 0
      if (kg && pct) return { value: kg * pct / 100, label: 'kg aceite potencial' }
    }
    return null
  }, [form.kg, form.brix_baume_viina, form.rendimiento_graso_olivar, form.cultivo])

  // Filtrar por búsqueda (necesario antes de calcular el resumen)
  const filteredCosechas = cosechas.filter(c => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    return (c.cultivo || '').toLowerCase().includes(term) ||
           (c.variedad || '').toLowerCase().includes(term) ||
           (c.destino || '').toLowerCase().includes(term)
  })

  // === RESUMEN: total, % por variedad y kilogrados ===
  const resumen = useMemo(() => {
    const totalKg = filteredCosechas.reduce((s, c) => s + (parseFloat(c.kg) || 0), 0)
    const totalKilogrados = filteredCosechas.reduce((s, c) => s + (cosechaKilogrados(c) || 0), 0)

    // Agrupar por variedad
    const porVariedad = {}
    filteredCosechas.forEach(c => {
      const v = c.variedad || c.cultivo || 'Sin clasificar'
      if (!porVariedad[v]) porVariedad[v] = { variedad: v, kg: 0, kilogrados: 0, n: 0 }
      porVariedad[v].kg += parseFloat(c.kg) || 0
      porVariedad[v].kilogrados += cosechaKilogrados(c) || 0
      porVariedad[v].n += 1
    })

    const porVariedadArr = Object.values(porVariedad)
      .map(v => ({
        ...v,
        pctKg: totalKg > 0 ? (v.kg / totalKg) * 100 : 0,
        pctKilogrados: totalKilogrados > 0 ? (v.kilogrados / totalKilogrados) * 100 : 0
      }))
      .sort((a, b) => b.kg - a.kg)

    return { totalKg, totalKilogrados, porVariedad: porVariedadArr, numVariedades: porVariedadArr.length, numCosechas: filteredCosechas.length }
  }, [filteredCosechas])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    const datos = {
      ...form,
      fecha: form.fecha || format(new Date(), 'yyyy-MM-dd'),
      id_finca: form.id_finca || null,
      id_parcela: form.id_parcela || null,
      cultivo: form.cultivo || null,
      variedad: form.variedad || null,
      kg: form.kg ? parseFloat(form.kg) : null,
      destino: form.destino || null,
      brix_baume_viina: form.brix_baume_viina ? parseFloat(form.brix_baume_viina) : null,
      rendimiento_graso_olivar: form.rendimiento_graso_olivar ? parseFloat(form.rendimiento_graso_olivar) : null,
      muestras_calidad: form.muestras_calidad || null,
      observaciones: form.observaciones || null
    }

    try {
      if (editingId) {
        const { error: err } = await supabase.from('cosechas').update(datos).eq('id_cosecha', editingId)
        if (err) throw new Error(err.message)
        setSuccess('Cosecha actualizada')
      } else {
        const { error: err } = await supabase.from('cosechas').insert([datos])
        if (err) throw new Error(err.message)
        setSuccess('Cosecha registrada')
      }

      await loadData()
      onDataChange?.()
      setForm({
        fecha: format(new Date(), 'yyyy-MM-dd'),
        id_finca: '', id_parcela: '', cultivo: 'Viña', variedad: '',
        kg: '', destino: '', brix_baume_viina: '',
        rendimiento_graso_olivar: '', muestras_calidad: '', observaciones: ''
      })
      setEditingId(null)
      setShowForm(false)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
      // NO cerramos el formulario si falla
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (c) => {
    setForm({
      fecha: c.fecha ? format(new Date(c.fecha), 'yyyy-MM-dd') : '',
      id_finca: c.id_finca || '',
      id_parcela: c.id_parcela || '',
      cultivo: c.cultivo || 'Viña',
      variedad: c.variedad || '',
      kg: c.kg || '',
      destino: c.destino || '',
      brix_baume_viina: c.brix_baume_viina || '',
      rendimiento_graso_olivar: c.rendimiento_graso_olivar || '',
      muestras_calidad: c.muestras_calidad || '',
      observaciones: c.observaciones || ''
    })
    setEditingId(c.id_cosecha)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta cosecha?')) return
    try {
      const { error: err } = await supabase.from('cosechas').delete().eq('id_cosecha', id)
      if (err) throw err
      await loadData()
      onDataChange?.()
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <div className="empty-state" aria-busy="true">
        <div className="spinner"></div>
        <p className="mt-16">Cargando cosechas...</p>
      </div>
    )
  }

  return (
    <div>
      {success && <div className="alert alert-success" role="alert">✅ {success}</div>}
      {error && (
        <div className="alert alert-error" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span>⚠️ {error}</span>
          <button className="btn btn-small btn-primary" onClick={loadData} aria-label="Reintentar">🔄 Reintentar</button>
        </div>
      )}

      {/* Barra de búsqueda */}
      <div className="fincas-toolbar mb-16">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por cultivo, variedad, destino..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            aria-label="Buscar cosechas"
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')} aria-label="Limpiar búsqueda">✕</button>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingId(null) }}>
          {showForm ? '✕ Cancelar' : '+ Nueva Cosecha'}
        </button>
      </div>

      {/* Resumen de cosecha */}
      {resumen.numCosechas > 0 && (
        <>
          <div className="summary-grid" style={{ marginBottom: 16 }}>
            <div className="summary-card accent">
              <div className="summary-value">{resumen.totalKg.toFixed(0)} kg</div>
              <div className="summary-label">Total cosechado</div>
            </div>
            <div className="summary-card">
              <div className="summary-value">{resumen.totalKilogrados.toFixed(0)}</div>
              <div className="summary-label">Kilogrados totales</div>
            </div>
            <div className="summary-card success">
              <div className="summary-value">{resumen.numCosechas}</div>
              <div className="summary-label">Cosechas</div>
            </div>
            <div className="summary-card">
              <div className="summary-value">{resumen.numVariedades}</div>
              <div className="summary-label">Variedades</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">📈 Aporte por variedad</div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Variedad</th>
                    <th>Kg</th>
                    <th>% kg</th>
                    <th>Kilogrados</th>
                    <th>% kilogrados</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.porVariedad.map(v => (
                    <tr key={v.variedad}>
                      <td><strong>{v.variedad}</strong></td>
                      <td>{v.kg.toFixed(0)} kg</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, height: 6, background: 'var(--color-border)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${v.pctKg}%`, height: '100%', background: 'var(--color-primary)' }} />
                          </div>
                          <span style={{ fontSize: '0.75rem', minWidth: '3.2em', textAlign: 'right' }}>{v.pctKg.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td>{v.kilogrados > 0 ? v.kilogrados.toFixed(0) : '—'}</td>
                      <td>{v.kilogrados > 0 ? `${v.pctKilogrados.toFixed(1)}%` : '—'}</td>
                    </tr>
                  ))}
                  <tr style={{ background: 'var(--color-primary-light)', fontWeight: 700 }}>
                    <td>Total</td>
                    <td>{resumen.totalKg.toFixed(0)} kg</td>
                    <td>100%</td>
                    <td>{resumen.totalKilogrados > 0 ? resumen.totalKilogrados.toFixed(0) : '—'}</td>
                    <td>{resumen.totalKilogrados > 0 ? '100%' : '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showForm && (
        <div className="card">
          <div className="card-title">🍇 {editingId ? 'Editar Cosecha' : 'Nueva Cosecha'}</div>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Fecha *</label>
                <input type="date" name="fecha" className="form-input" value={form.fecha} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">Finca</label>
                <select name="id_finca" className="form-select" value={form.id_finca} onChange={handleChange}>
                  <option value="">Sin finca</option>
                  {fincas.map(f => (
                    <option key={f.id_finca} value={f.id_finca}>{f.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Cultivo</label>
                <select name="cultivo" className="form-select" value={form.cultivo} onChange={handleChange}>
                  <option value="Viña">Viña</option>
                  <option value="Olivar">Olivar</option>
                  <option value="Viña y Olivar">Viña y Olivar</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Parcela</label>
                <select name="id_parcela" className="form-select" value={form.id_parcela} onChange={handleChange}>
                  <option value="">Seleccionar parcela...</option>
                  {fincas.map(f => (
                    <option key={f.id_finca} value={f.id_finca}>{f.nombre} ({f.termino_municipal})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Variedad</label>
                <input type="text" name="variedad" className="form-input" value={form.variedad} onChange={handleChange} placeholder="Variedad de uva/olivo" />
              </div>
              <div className="form-group">
                <label className="form-label">Destino</label>
                <input type="text" name="destino" className="form-input" value={form.destino} onChange={handleChange} placeholder="Bodega, mercado..." />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Kg producidos</label>
                <input type="number" name="kg" className="form-input" value={form.kg} onChange={handleChange} step="0.01" min="0" />
              </div>
            </div>
            {(form.cultivo === 'Viña' || form.cultivo === 'Viña y Olivar') && (
              <div className="form-group">
                <label className="form-label">Brix / Baume (grados)</label>
                <input type="number" name="brix_baume_viina" className="form-input" value={form.brix_baume_viina} onChange={handleChange} step="0.01" placeholder="Grados Brix o Baumé" />
              </div>
            )}
            {(form.cultivo === 'Olivar' || form.cultivo === 'Viña y Olivar') && (
              <div className="form-group">
                <label className="form-label">Rendimiento graso (%)</label>
                <input type="number" name="rendimiento_graso_olivar" className="form-input" value={form.rendimiento_graso_olivar} onChange={handleChange} step="0.01" placeholder="Porcentaje de rendimiento" />
              </div>
            )}
            {formKilogrados != null && (
              <div className="form-group">
                <label className="form-label">Cálculo automático</label>
                <div style={{ padding: '10px 12px', background: 'var(--color-primary-light)', border: '1px solid var(--color-primary)', borderRadius: 8, fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-primary)' }}>
                  📊 {formKilogrados.value.toFixed(0)} {formKilogrados.label}
                </div>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Muestras calidad</label>
              <input type="text" name="muestras_calidad" className="form-input" value={form.muestras_calidad} onChange={handleChange} placeholder="Resultados de análisis" />
            </div>
            <div className="form-group">
              <label className="form-label">Observaciones</label>
              <textarea name="observaciones" className="form-textarea" value={form.observaciones} onChange={handleChange} />
            </div>
            <button type="submit" className={`btn btn-primary btn-full ${saving ? 'btn-loading' : ''}`} disabled={saving}>
              {saving ? 'Guardando...' : editingId ? '💾 Guardar cambios' : '✅ Registrar cosecha'}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-title">📋 Cosechas registradas ({filteredCosechas.length})</div>
        {filteredCosechas.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Parcela</th>
                  <th>Cultivo</th>
                  <th>Variedad</th>
                  <th>Kg</th>
                  <th>Destino</th>
                  <th>Brix/Baume</th>
                  <th>Kilogrados</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredCosechas.map(c => (
                  <tr key={c.id_cosecha}>
                    <td>{c.fecha ? format(new Date(c.fecha), 'dd/MM/yyyy') : '-'}</td>
                    <td>{fincas.find(f => f.id_finca === (c.id_finca || c.id_parcela))?.nombre || '-'}</td>
                    <td>{c.cultivo || '-'}</td>
                    <td>{c.variedad || '-'}</td>
                    <td><strong>{c.kg ? c.kg.toFixed(0) : '-'}</strong></td>
                    <td>{c.destino || '-'}</td>
                    <td>{c.brix_baume_viina ? `${c.brix_baume_viina}°` : (c.rendimiento_graso_olivar ? `${c.rendimiento_graso_olivar}%` : '-')}</td>
                    <td>{cosechaKilogrados(c) != null ? `${cosechaKilogrados(c).toFixed(0)} kg°` : (cosechaAceite(c) != null ? `${cosechaAceite(c).toFixed(0)} kg ace.` : '-')}</td>
                    <td>
                      <button className="btn btn-small btn-accent" onClick={() => handleEdit(c)} aria-label={`Editar cosecha ${c.variedad || c.cultivo}`}>✏️</button>
                      <button className="btn btn-small btn-danger" onClick={() => handleDelete(c.id_cosecha)} aria-label={`Eliminar cosecha ${c.variedad || c.cultivo}`}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">🍇</div>
            <div className="empty-state-text">No hay cosechas registradas</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CosechasPage
