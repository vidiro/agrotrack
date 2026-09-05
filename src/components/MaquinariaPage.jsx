import { useState, useEffect } from 'react'
import { supabase } from '../data/supabaseClient'

function MaquinariaPage({ maquinaria: maquinariaOrig, onDataChange }) {
  const [maquinaria, setMaquinaria] = useState(maquinariaOrig)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const [form, setForm] = useState({
    id_equipo: '',
    tipo: 'Tractor',
    marca_modelo: '',
    coste_h: '',
    consumo_l_h: '',
    mantenimiento_periodicidad: ''
  })

  const loadMaquinaria = async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: err } = await supabase.from('maquinaria').select('*').order('id_equipo')
      if (err) throw err
      setMaquinaria(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMaquinaria()
  }, [])

  // Sincronizar con los datos del padre si cambian
  useEffect(() => {
    setMaquinaria(maquinariaOrig)
  }, [maquinariaOrig])

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
      id_equipo: form.id_equipo ? parseInt(form.id_equipo) : null,
      coste_h: form.coste_h ? parseFloat(form.coste_h) : null,
      consumo_l_h: form.consumo_l_h ? parseFloat(form.consumo_l_h) : null,
      mantenimiento_periodicidad: form.mantenimiento_periodicidad || null
    }

    try {
      if (editingId) {
        const { error: err } = await supabase.from('maquinaria').update(datos).eq('id_equipo', editingId)
        if (err) throw new Error(err.message)
        setSuccess('Maquinaria actualizada correctamente')
      } else {
        const { error: err } = await supabase.from('maquinaria').insert([datos])
        if (err) throw new Error(err.message)
        setSuccess('Maquinaria registrada correctamente')
      }

      await loadMaquinaria()
      onDataChange?.()
      setForm({
        id_equipo: '', tipo: 'Tractor', marca_modelo: '', coste_h: '', consumo_l_h: '', mantenimiento_periodicidad: ''
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

  const handleEdit = (m) => {
    setForm({
      id_equipo: m.id_equipo,
      tipo: m.tipo || 'Tractor',
      marca_modelo: m.marca_modelo || '',
      coste_h: m.coste_h || '',
      consumo_l_h: m.consumo_l_h || '',
      mantenimiento_periodicidad: m.mantenimiento_periodicidad || ''
    })
    setEditingId(m.id_equipo)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta maquinaria? Esta acción no se puede deshacer.')) return
    try {
      const { error: err } = await supabase.from('maquinaria').delete().eq('id_equipo', id)
      if (err) throw err
      await loadMaquinaria()
      onDataChange?.()
    } catch (err) {
      setError(err.message)
    }
  }

  // Filtrar por búsqueda
  const filteredMaquinaria = maquinaria.filter(m => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    return (m.marca_modelo || '').toLowerCase().includes(term) ||
           (m.tipo || '').toLowerCase().includes(term)
  })

  if (loading) {
    return (
      <div className="empty-state" aria-busy="true">
        <div className="spinner"></div>
        <p className="mt-16">Cargando maquinaria...</p>
      </div>
    )
  }

  return (
    <div>
      {success && <div className="alert alert-success" role="alert">✅ {success}</div>}
      {error && (
        <div className="alert alert-error" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span>⚠️ {error}</span>
          <button className="btn btn-small btn-primary" onClick={loadMaquinaria} aria-label="Reintentar">🔄 Reintentar</button>
        </div>
      )}

      <div className="summary-grid" style={{ marginBottom: 16 }}>
        <div className="summary-card">
          <div className="summary-value">{maquinaria.length}</div>
          <div className="summary-label">Equipos registrados</div>
        </div>
      </div>

      {/* Barra de búsqueda */}
      <div className="fincas-toolbar mb-16">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por marca, tipo..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            aria-label="Buscar maquinaria"
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')} aria-label="Limpiar búsqueda">✕</button>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingId(null) }}>
          {showForm ? '✕ Cancelar' : '+ Nueva Maquinaria'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-title">🚜 {editingId ? 'Editar Maquinaria' : 'Nueva Maquinaria'}</div>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">ID Equipo *</label>
                <input type="number" name="id_equipo" className="form-input" value={form.id_equipo} onChange={handleChange} required min="1" />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select name="tipo" className="form-select" value={form.tipo} onChange={handleChange}>
                  <option value="Tractor">Tractor</option>
                  <option value="Atomizador">Atomizador</option>
                  <option value="Herbicida">Herbicida</option>
                  <option value="Pulverizador">Pulverizador</option>
                  <option value="Cultivador">Cultivador</option>
                  <option value="Rotavador">Rotavador</option>
                  <option value="Vierga">Vierga</option>
                  <option value="Ganchos">Ganchos</option>
                  <option value="Remolque">Remolque</option>
                  <option value="Otros">Otros</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Marca / Modelo</label>
                <input type="text" name="marca_modelo" className="form-input" value={form.marca_modelo} onChange={handleChange} placeholder="ej: Massey Ferguson 2705" />
              </div>
              <div className="form-group">
                <label className="form-label">Coste/hora (€)</label>
                <input type="number" name="coste_h" className="form-input" value={form.coste_h} onChange={handleChange} step="0.5" min="0" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Consumo gasoil (L/h)</label>
                <input type="number" name="consumo_l_h" className="form-input" value={form.consumo_l_h} onChange={handleChange} step="0.1" min="0" placeholder="Litros por hora" />
              </div>
              <div className="form-group">
                <label className="form-label">Mantenimiento</label>
                <input type="text" name="mantenimiento_periodicidad" className="form-input" value={form.mantenimiento_periodicidad} onChange={handleChange} placeholder="ej: cada 500h" />
              </div>
            </div>
            <button type="submit" className={`btn btn-primary btn-full ${saving ? 'btn-loading' : ''}`} disabled={saving}>
              {saving ? 'Guardando...' : editingId ? '💾 Guardar cambios' : '✅ Registrar maquinaria'}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-title">📋 Equipos registrados ({filteredMaquinaria.length})</div>
        {filteredMaquinaria.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tipo</th>
                  <th>Marca/Modelo</th>
                  <th>Coste/h</th>
                  <th>Consumo L/h</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredMaquinaria.map(m => (
                  <tr key={m.id_equipo}>
                    <td><strong>{m.id_equipo}</strong></td>
                    <td><span className="badge badge-blue">{m.tipo}</span></td>
                    <td>{m.marca_modelo || '-'}</td>
                    <td>{m.coste_h ? `${m.coste_h.toFixed(2)} €` : '-'}</td>
                    <td>{m.consumo_l_h ? `${m.consumo_l_h} L` : '-'}</td>
                    <td>
                      <button className="btn btn-small btn-accent" onClick={() => handleEdit(m)} aria-label={`Editar maquinaria ${m.marca_modelo || m.tipo}`}>✏️</button>
                      <button className="btn btn-small btn-danger" onClick={() => handleDelete(m.id_equipo)} aria-label={`Eliminar maquinaria ${m.marca_modelo || m.tipo}`}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">🚜</div>
            <div className="empty-state-text">
              {searchTerm ? 'No se encontró maquinaria con esa búsqueda' : 'No hay equipos registrados'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MaquinariaPage
