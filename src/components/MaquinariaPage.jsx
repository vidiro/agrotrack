import { useState } from 'react'

function MaquinariaPage({ maquinaria }) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    id_equipo: '',
    tipo: 'Tractor',
    marca_modelo: '',
    coste_h: '',
    consumo_l_h: '',
    mantenimiento_periodicidad: ''
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const datos = {
      ...form,
      id_equipo: form.id_equipo ? parseInt(form.id_equipo) : null,
      coste_h: form.coste_h ? parseFloat(form.coste_h) : null,
      consumo_l_h: form.consumo_l_h ? parseFloat(form.consumo_l_h) : null,
      mantenimiento_periodicidad: form.mantenimiento_periodicidad || null
    }

    try {
      if (editingId) {
        setSuccess('Maquinaria actualizada')
      } else {
        setSuccess('Maquinaria registrada')
      }
      
      setForm({
        id_equipo: '', tipo: 'Tractor', marca_modelo: '', coste_h: '', consumo_l_h: '', mantenimiento_periodicidad: ''
      })
      setEditingId(null)
      setShowForm(false)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
      setTimeout(() => setError(''), 5000)
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

  return (
    <div>
      {success && <div className="alert alert-success">✅ {success}</div>}
      {error && <div className="alert alert-error">⚠️ {error}</div>}

      <div className="summary-grid" style={{ marginBottom: 16 }}>
        <div className="summary-card">
          <div className="summary-value">{maquinaria.length}</div>
          <div className="summary-label">Equipos registrados</div>
        </div>
      </div>

      <div className="flex gap-16 mb-16">
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
              <div className="form-group">
                <label className="form-label">Marca/Modelo</label>
                <input type="text" name="marca_modelo" className="form-input" value={form.marca_modelo} onChange={handleChange} placeholder="Deutz_DX3.90, John Deere_1750..." />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Coste hora (€)</label>
                <input type="number" name="coste_h" className="form-input" value={form.coste_h} onChange={handleChange} step="0.01" min="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Consumo (L/h)</label>
                <input type="number" name="consumo_l_h" className="form-input" value={form.consumo_l_h} onChange={handleChange} step="0.1" min="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Mantenimiento</label>
                <input type="text" name="mantenimiento_periodicidad" className="form-input" value={form.mantenimiento_periodicidad} onChange={handleChange} placeholder="Cada X horas" />
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-full">
              {editingId ? '💾 Guardar cambios' : '✅ Registrar maquinaria'}
            </button>
          </form>
        </div>
      )}

      {/* Tarjetas de maquinaria */}
      <div className="maquinaria-grid">
        {maquinaria.length > 0 ? (
          maquinaria.map(m => (
            <div key={m.id_equipo} className="maquinaria-card">
              <div className="maquinaria-card-header">
                <span className="maquinaria-card-name">{m.marca_modelo || m.tipo}</span>
                <span className="badge badge-green">{m.tipo}</span>
              </div>
              <div className="maquinaria-card-info">
                <div className="info-row">🆔 {m.id_equipo}</div>
                {m.coste_h && <div className="info-row">💰 {m.coste_h.toFixed(2)} €/h</div>}
                {m.consumo_l_h && <div className="info-row">⛽ {m.consumo_l_h} L/h</div>}
                {m.mantenimiento_periodicidad && <div className="info-row">🔧 {m.mantenimiento_periodicidad}</div>}
              </div>
              <div className="maquinaria-card-actions">
                <button className="btn btn-small btn-accent" onClick={() => handleEdit(m)}>✏️ Editar</button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">🚜</div>
            <div className="empty-state-text">No hay maquinaria registrada</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MaquinariaPage