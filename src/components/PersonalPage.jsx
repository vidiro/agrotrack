import { useState } from 'react'

function PersonalPage({ personal }) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    id_operario: '',
    nombre: '',
    categoria: 'Peón',
    coste_h: 10,
    nif: '',
    notas: ''
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
      coste_h: form.coste_h ? parseFloat(form.coste_h) : 10,
      nif: form.nif || null,
      notas: form.notas || null
    }

    try {
      if (editingId) {
        setSuccess('Operario actualizado')
      } else {
        setSuccess('Operario registrado')
      }
      
      setForm({
        id_operario: '', nombre: '', categoria: 'Peón', coste_h: 10, nif: '', notas: ''
      })
      setEditingId(null)
      setShowForm(false)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
      setTimeout(() => setError(''), 5000)
    }
  }

  const handleEdit = (p) => {
    setForm({
      id_operario: p.id_operario,
      nombre: p.nombre,
      categoria: p.categoria || 'Peón',
      coste_h: p.coste_h || 10,
      nif: p.nif || '',
      notas: p.notas || ''
    })
    setEditingId(p.id_operario)
    setShowForm(true)
  }

  return (
    <div>
      {success && <div className="alert alert-success">✅ {success}</div>}
      {error && <div className="alert alert-error">⚠️ {error}</div>}

      <div className="summary-grid" style={{ marginBottom: 16 }}>
        <div className="summary-card">
          <div className="summary-value">{personal.length}</div>
          <div className="summary-label">Operarios registrados</div>
        </div>
      </div>

      <div className="flex gap-16 mb-16">
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingId(null) }}>
          {showForm ? '✕ Cancelar' : '+ Nuevo Operario'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-title">👤 {editingId ? 'Editar Operario' : 'Nuevo Operario'}</div>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">ID Operario *</label>
                <input type="text" name="id_operario" className="form-input" value={form.id_operario} onChange={handleChange} required placeholder="ej: op_01" />
              </div>
              <div className="form-group">
                <label className="form-label">Nombre *</label>
                <input type="text" name="nombre" className="form-input" value={form.nombre} onChange={handleChange} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Categoría</label>
                <select name="categoria" className="form-select" value={form.categoria} onChange={handleChange}>
                  <option value="Peón">Peón</option>
                  <option value="Maquinista">Maquinista</option>
                  <option value="Técnico">Técnico</option>
                  <option value="Encargado">Encargado</option>
                  <option value="Otros">Otros</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Coste hora (€)</label>
                <input type="number" name="coste_h" className="form-input" value={form.coste_h} onChange={handleChange} step="0.01" min="0" />
              </div>
              <div className="form-group">
                <label className="form-label">NIF</label>
                <input type="text" name="nif" className="form-input" value={form.nif} onChange={handleChange} placeholder="NIF/CIF" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notas</label>
              <textarea name="notas" className="form-textarea" value={form.notas} onChange={handleChange} />
            </div>
            <button type="submit" className="btn btn-primary btn-full">
              {editingId ? '💾 Guardar cambios' : '✅ Registrar operario'}
            </button>
          </form>
        </div>
      )}

      {/* Tarjetas de personal */}
      <div className="personal-grid">
        {personal.length > 0 ? (
          personal.map(p => (
            <div key={p.id_operario} className="personal-card">
              <div className="personal-card-header">
                <span className="personal-card-name">{p.nombre}</span>
                <span className={`badge badge-${p.categoria === 'Técnico' ? 'blue' : p.categoria === 'Encargado' ? 'green' : 'yellow'}`}>
                  {p.categoria}
                </span>
              </div>
              <div className="personal-card-info">
                <div className="info-row">🆔 {p.id_operario}</div>
                <div className="info-row">💰 {p.coste_h ? `${p.coste_h}€/h` : '-'}</div>
                {p.nif && <div className="info-row">📄 {p.nif}</div>}
              </div>
              {p.notas && <p className="personal-card-notes">{p.notas}</p>}
              <div className="personal-card-actions">
                <button className="btn btn-small btn-accent" onClick={() => handleEdit(p)}>✏️ Editar</button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <div className="empty-state-text">No hay personal registrado</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PersonalPage