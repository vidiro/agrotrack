import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../data/supabaseClient'

function FincasPage({ fincas: fincasOrig, onDataChange, onNavigate }) {
  const [fincas, setFincas] = useState(fincasOrig)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('nombre')
  const [sortDir, setSortDir] = useState('asc')

  const [form, setForm] = useState({
    id_finca: '',
    nombre: '',
    termino_municipal: '',
    superficie_total_ha: '',
    tipo_suelo: '',
    cultivo: 'Viña',
    variedad: '',
    ano_plantacion: '',
    poligono: '',
    parcela: '',
    notas: ''
  })

  const loadFincas = async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: err } = await supabase.from('fincas').select('*').order('nombre')
      if (err) throw err
      setFincas(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFincas()
  }, [])

  // Sincronizar con los datos del padre si cambian
  useEffect(() => {
    setFincas(fincasOrig)
  }, [fincasOrig])

  // Filtrar y ordenar fincas
  const filteredFincas = useMemo(() => {
    let result = [...fincas]

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      result = result.filter(f =>
        f.nombre?.toLowerCase().includes(term) ||
        f.termino_municipal?.toLowerCase().includes(term) ||
        String(f.id_finca).toLowerCase().includes(term) ||
        f.poligono?.toLowerCase().includes(term) ||
        f.parcela?.toLowerCase().includes(term)
      )
    }

    result.sort((a, b) => {
      let valA, valB
      switch (sortBy) {
        case 'nombre': valA = a.nombre || ''; valB = b.nombre || ''; break
        case 'superficie': valA = a.superficie_total_ha || 0; valB = b.superficie_total_ha || 0; break
        case 'cultivo': valA = a.cultivo || ''; valB = b.cultivo || ''; break
        case 'año': valA = a.ano_plantacion || 0; valB = b.ano_plantacion || 0; break
        default: valA = a.nombre || ''; valB = b.nombre || '';
      }
      if (typeof valA === 'string') return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      return sortDir === 'asc' ? valA - valB : valB - valA
    })

    return result
  }, [fincas, searchTerm, sortBy, sortDir])

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir('asc')
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    const datos = {
      ...form,
      superficie_total_ha: form.superficie_total_ha ? parseFloat(form.superficie_total_ha) : null,
      ano_plantacion: form.ano_plantacion ? parseInt(form.ano_plantacion) : null,
      termino_municipal: form.termino_municipal || null,
      tipo_suelo: form.tipo_suelo || null,
      variedad: form.variedad || null,
      poligono: form.poligono || null,
      parcela: form.parcela || null,
      notas: form.notas || null
    }

    try {
      if (editingId) {
        const { error: err } = await supabase.from('fincas').update(datos).eq('id_finca', editingId)
        if (err) throw new Error(err.message)
        setSuccess('Finca actualizada correctamente')
      } else {
        const { error: err } = await supabase.from('fincas').insert([datos])
        if (err) throw new Error(err.message)
        setSuccess('Finca registrada correctamente')
      }

      await loadFincas()
      onDataChange?.()
      setForm({
        id_finca: '', nombre: '', termino_municipal: '', superficie_total_ha: '',
        tipo_suelo: '', cultivo: 'Viña', variedad: '', ano_plantacion: '',
        poligono: '', parcela: '', notas: ''
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

  const handleEdit = (f) => {
    setForm({
      id_finca: f.id_finca,
      nombre: f.nombre,
      termino_municipal: f.termino_municipal || '',
      superficie_total_ha: f.superficie_total_ha || '',
      tipo_suelo: f.tipo_suelo || '',
      cultivo: f.cultivo || 'Viña',
      variedad: f.variedad || '',
      ano_plantacion: f.ano_plantacion || '',
      poligono: f.poligono || '',
      parcela: f.parcela || '',
      notas: f.notas || ''
    })
    setEditingId(f.id_finca)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta finca? Esta acción no se puede deshacer.')) return
    try {
      const { error: err } = await supabase.from('fincas').delete().eq('id_finca', id)
      if (err) throw err
      await loadFincas()
      onDataChange?.()
    } catch (err) {
      setError(err.message)
    }
  }

  const totalHa = fincas.reduce((sum, f) => sum + (f.superficie_total_ha || 0), 0)
  const fincasVina = fincas.filter(f => f.cultivo && f.cultivo.includes('Viña')).length
  const fincasOlivar = fincas.filter(f => f.cultivo && f.cultivo.includes('Olivar') && !f.cultivo.includes('Viña')).length

  const getCultivoBadge = (cultivo) => {
    if (!cultivo) return ''
    if (cultivo.includes('Viña') && !cultivo.includes('Olivar')) return 'blue'
    if (cultivo.includes('Olivar') && !cultivo.includes('Viña')) return 'green'
    return 'yellow'
  }

  if (loading) {
    return (
      <div className="empty-state" aria-busy="true">
        <div className="spinner"></div>
        <p className="mt-16">Cargando fincas...</p>
      </div>
    )
  }

  return (
    <div>
      {success && <div className="alert alert-success" role="alert"> {success}</div>}
      {error && (
        <div className="alert alert-error" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span> {error}</span>
          <button className="btn btn-small btn-primary" onClick={loadFincas} aria-label="Reintentar"> Reintentar</button>
        </div>
      )}

      {/* Tarjetas resumen */}
      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-value">{fincas.length}</div>
          <div className="summary-label">Total fincas</div>
        </div>
        <div className="summary-card accent">
          <div className="summary-value">{totalHa.toFixed(2)}</div>
          <div className="summary-label">Hectáreas totales</div>
        </div>
        <div className="summary-card success">
          <div className="summary-value">{fincasVina}</div>
          <div className="summary-label">Fincas de viña</div>
        </div>
        <div className="summary-card">
          <div className="summary-value">{fincasOlivar}</div>
          <div className="summary-label">Fincas de olivar</div>
        </div>
      </div>

      {/* Barra de búsqueda y filtros */}
      <div className="fincas-toolbar">
        <div className="search-box">
          <span className="search-icon"></span>
          <input
            type="text"
            className="search-input"
            placeholder="Buscar finca, municipio, polígono..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            aria-label="Buscar fincas"
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')} aria-label="Limpiar búsqueda"></button>
          )}
        </div>
        <div className="sort-buttons">
          {['nombre', 'superficie', 'cultivo', 'año'].map(field => (
            <button
              key={field}
              className={`sort-btn ${sortBy === field ? 'active' : ''}`}
              onClick={() => toggleSort(field)}
              aria-label={`Ordenar por ${field}`}
            >
              {field === 'nombre' ? ' Nombre' : field === 'superficie' ? '📏 Superficie' : field === 'cultivo' ? '🌱 Cultivo' : '📅 Año'}
              {sortBy === field ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
            </button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingId(null) }}>
          {showForm ? ' Cancelar' : '+ Nueva Finca'}
        </button>
      </div>

      {/* Formulario de nueva/editar finca */}
      {showForm && (
        <div className="card">
          <div className="card-title"> {editingId ? 'Editar Finca' : 'Nueva Finca'}</div>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">ID Finca *</label>
                <input type="text" name="id_finca" className="form-input" value={form.id_finca} onChange={handleChange} required placeholder="ej: fin_27" />
              </div>
              <div className="form-group">
                <label className="form-label">Nombre *</label>
                <input type="text" name="nombre" className="form-input" value={form.nombre} onChange={handleChange} required placeholder="Nombre de la finca" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Término municipal</label>
                <input type="text" name="termino_municipal" className="form-input" value={form.termino_municipal} onChange={handleChange} placeholder="Solana de los Barros, Almendralejo..." />
              </div>
              <div className="form-group">
                <label className="form-label">Superficie (ha)</label>
                <input type="number" name="superficie_total_ha" className="form-input" value={form.superficie_total_ha} onChange={handleChange} step="0.0001" min="0" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Tipo de suelo</label>
                <input type="text" name="tipo_suelo" className="form-input" value={form.tipo_suelo} onChange={handleChange} placeholder="Franco, Corneta, Maleta..." />
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
                <label className="form-label">Variedad</label>
                <input type="text" name="variedad" className="form-input" value={form.variedad} onChange={handleChange} placeholder="Macabeo, etc." />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Año plantación</label>
                <input type="number" name="ano_plantacion" className="form-input" value={form.ano_plantacion} onChange={handleChange} min="1900" max="2100" />
              </div>
              <div className="form-group">
                <label className="form-label">Polígono</label>
                <input type="text" name="poligono" className="form-input" value={form.poligono} onChange={handleChange} placeholder="Polígono X" />
              </div>
              <div className="form-group">
                <label className="form-label">Parcela</label>
                <input type="text" name="parcela" className="form-input" value={form.parcela} onChange={handleChange} placeholder="Parcela X" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notas</label>
              <textarea name="notas" className="form-textarea" value={form.notas} onChange={handleChange} />
            </div>
            <button type="submit" className={`btn btn-primary btn-full ${saving ? 'btn-loading' : ''}`} disabled={saving}>
              {saving ? 'Guardando...' : editingId ? ' Guardar cambios' : ' Registrar finca'}
            </button>
          </form>
        </div>
      )}

      {/* Grid de tarjetas de fincas */}
      <div className="fincas-grid">
        {filteredFincas.length > 0 ? (
          filteredFincas.map(f => (
            <div key={f.id_finca} className="finca-card">
              <div className="finca-card-header">
                <span className="finca-card-id">{f.id_finca}</span>
                <span className={`badge badge-${getCultivoBadge(f.cultivo)}`}>
                  {f.cultivo || 'Sin cultivo'}
                </span>
              </div>
              <h3 className="finca-card-name">{f.nombre}</h3>
              <div className="finca-card-info">
                {f.termino_municipal && <div className="info-row"> {f.termino_municipal}</div>}
                {f.superficie_total_ha && <div className="info-row">📏 {f.superficie_total_ha} ha</div>}
                {f.tipo_suelo && <div className="info-row"> {f.tipo_suelo}</div>}
                {f.variedad && <div className="info-row"> {f.variedad}</div>}
                {f.ano_plantacion && <div className="info-row">📅 {f.ano_plantacion}</div>}
                {f.poligono && <div className="info-row">📐 {f.poligono} {f.parcela}</div>}
              </div>
              {f.notas && <p className="finca-card-notes">{f.notas}</p>}
              <div className="finca-card-actions">
                <button className="btn btn-small" onClick={() => onNavigate?.('finca_detalle', f.id_finca)} style={{ background: 'var(--color-primary-light)', borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }} aria-label={`Ver detalle ${f.nombre}`}> Detalle</button>
                <button className="btn btn-small btn-accent" onClick={() => handleEdit(f)} aria-label={`Editar finca ${f.nombre}`}> Editar</button>
                <button className="btn btn-small btn-danger" onClick={() => handleDelete(f.id_finca)} aria-label={`Eliminar finca ${f.nombre}`}></button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon"></div>
            <div className="empty-state-text">
              {searchTerm ? 'No se encontraron fincas con esa búsqueda' : 'No hay fincas registradas'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default FincasPage
