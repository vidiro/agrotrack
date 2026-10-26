import { useState, useEffect } from 'react'
import { Pencil, Search, Trash2, X } from 'lucide-react'
import { supabase } from '../data/supabaseClient'

function PersonalPage({ personal: personalOrig, onDataChange }) {
  const [personal, setPersonal] = useState(personalOrig)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const [form, setForm] = useState({
    id_operario: '',
    nombre: '',
    categoria: 'Peón',
    coste_h: 10,
    nif: '',
    notas: ''
  })

  const loadPersonal = async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: err } = await supabase.from('personal').select('*').order('nombre')
      if (err) throw err
      setPersonal(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPersonal()
  }, [])

  // Sincronizar con los datos del padre si cambian
  useEffect(() => {
    setPersonal(personalOrig)
  }, [personalOrig])

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
      coste_h: form.coste_h ? parseFloat(form.coste_h) : 10,
      nif: form.nif || null,
      notas: form.notas || null
    }

    try {
      if (editingId) {
        const { error: err } = await supabase.from('personal').update(datos).eq('id_operario', editingId)
        if (err) throw new Error(err.message)
        setSuccess('Operario actualizado correctamente')
      } else {
        const { error: err } = await supabase.from('personal').insert([datos])
        if (err) throw new Error(err.message)
        setSuccess('Operario registrado correctamente')
      }

      await loadPersonal()
      onDataChange?.()
      setForm({
        id_operario: '', nombre: '', categoria: 'Peón', coste_h: 10, nif: '', notas: ''
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

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este operario? Esta acción no se puede deshacer.')) return
    try {
      const { error: err } = await supabase.from('personal').delete().eq('id_operario', id)
      if (err) throw err
      await loadPersonal()
      onDataChange?.()
    } catch (err) {
      setError(err.message)
    }
  }

  // Filtrar por búsqueda
  const filteredPersonal = personal.filter(p => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    return (p.nombre || '').toLowerCase().includes(term) ||
           (p.categoria || '').toLowerCase().includes(term) ||
           (p.nif || '').toLowerCase().includes(term)
  })

  if (loading) {
    return (
      <div className="empty-state" aria-busy="true">
        <div className="spinner"></div>
        <p className="mt-16">Cargando personal...</p>
      </div>
    )
  }

  return (
    <div>
      {success && <div className="alert alert-success" role="alert"> {success}</div>}
      {error && (
        <div className="alert alert-error" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span> {error}</span>
          <button className="btn btn-small btn-primary" onClick={loadPersonal} aria-label="Reintentar"> Reintentar</button>
        </div>
      )}

      <div className="summary-grid" style={{ marginBottom: 16 }}>
        <div className="summary-card">
          <div className="summary-value">{personal.length}</div>
          <div className="summary-label">Operarios registrados</div>
        </div>
      </div>

      {/* Barra de búsqueda */}
      <div className="fincas-toolbar mb-16">
        <div className="search-box">
          <span className="search-icon" aria-hidden="true"><Search size={18} /></span>
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por nombre, categoría, NIF..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            aria-label="Buscar operarios"
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')} aria-label="Limpiar búsqueda"><X size={18} aria-hidden="true" /></button>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingId(null) }}>
          {showForm ? ' Cancelar' : '+ Nuevo Operario'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-title">{editingId ? 'Editar Operario' : 'Nuevo Operario'}</div>
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
                <label className="form-label">Coste/hora (€)</label>
                <input type="number" name="coste_h" className="form-input" value={form.coste_h} onChange={handleChange} step="0.5" min="0" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">NIF</label>
                <input type="text" name="nif" className="form-input" value={form.nif} onChange={handleChange} placeholder="12345678A" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notas</label>
              <textarea name="notas" className="form-textarea" value={form.notas} onChange={handleChange} />
            </div>
            <button type="submit" className={`btn btn-primary btn-full ${saving ? 'btn-loading' : ''}`} disabled={saving}>
              {saving ? 'Guardando...' : editingId ? ' Guardar cambios' : ' Registrar operario'}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-title"> Operarios registrados ({filteredPersonal.length})</div>
        {filteredPersonal.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>Coste/h</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredPersonal.map(p => (
                  <tr key={p.id_operario}>
                    <td><strong>{p.nombre}</strong></td>
                    <td><span className="badge badge-blue">{p.categoria || 'Peón'}</span></td>
                    <td>{p.coste_h ? `${p.coste_h.toFixed(2)} €` : '-'}</td>
                    <td>
                      <button className="btn btn-small btn-accent" onClick={() => handleEdit(p)} aria-label={`Editar operario ${p.nombre}`}><Pencil size={16} aria-hidden="true" /></button>
                      <button className="btn btn-small btn-danger" onClick={() => handleDelete(p.id_operario)} aria-label={`Eliminar operario ${p.nombre}`}><Trash2 size={16} aria-hidden="true" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon"></div>
            <div className="empty-state-text">
              {searchTerm ? 'No se encontraron operarios con esa búsqueda' : 'No hay operarios registrados'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PersonalPage
