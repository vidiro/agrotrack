import { useState, useEffect } from 'react'
import { supabase } from '../data/supabaseClient'
import { format } from 'date-fns'

function LaboresPage({ fincas, personal, maquinaria }) {
  const [labores, setLabores] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [filterFinca, setFilterFinca] = useState('')
  const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM'))

  const [form, setForm] = useState({
    fecha: format(new Date(), 'yyyy-MM-dd'),
    id_finca: '',
    duracion_h: '',
    hh_persona: '',
    h_maquinaria: '',
    id_equipo: '',
    coste_maquinaria: '',
    coste_hora_peon: 10,
    notas: ''
  })

  useEffect(() => {
    loadLabores()
  }, [filterFinca, filterMonth])

  const loadLabores = async () => {
    setLoading(true)
    let query = supabase.from('labores').select('*').order('fecha', { ascending: false })
    
    if (filterFinca) {
      const { data } = await supabase.from('labores').select('*').eq('id_finca', filterFinca).order('fecha', { ascending: false })
      setLabores(data || [])
    } else {
      const { data } = await supabase.from('labores').select('*').order('fecha', { ascending: false })
      setLabores(data || [])
    }
    setLoading(false)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    const newForm = { ...form, [name]: value }
    
    // Calcular costes automáticamente
    if (name === 'duracion_h' || name === 'hh_persona' || name === 'coste_hora_peon') {
      const duracion = parseFloat(newForm.duracion_h) || 0
      const personas = parseFloat(newForm.hh_persona) || 0
      const costePeon = parseFloat(newForm.coste_hora_peon) || 10
      const horasMaq = parseFloat(newForm.h_maquinaria) || 0
      const costeMaq = parseFloat(newForm.coste_maquinaria) || 0
      newForm.coste_total = (duracion * personas * costePeon) + (horasMaq * costeMaq)
    }
    
    setForm(newForm)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const datos = {
      ...form,
      id_finca: form.id_finca || null,
      duracion_h: form.duracion_h ? parseFloat(form.duracion_h) : null,
      hh_persona: form.hh_persona ? parseFloat(form.hh_persona) : null,
      h_maquinaria: form.h_maquinaria ? parseFloat(form.h_maquinaria) : null,
      id_equipo: form.id_equipo ? parseInt(form.id_equipo) : null,
      coste_maquinaria: form.coste_maquinaria ? parseFloat(form.coste_maquinaria) : null,
      coste_hora_peon: form.coste_hora_peon ? parseFloat(form.coste_hora_peon) : 10,
      coste_total: form.coste_total ? parseFloat(form.coste_total) : null,
      notas: form.notas || null
    }

    try {
      if (editingId) {
        const { error } = await supabase.from('labores').update(datos).eq('id_labor', editingId)
        if (error) throw new Error(error.message)
        setSuccess('Labor actualizada correctamente')
      } else {
        const { error } = await supabase.from('labores').insert([datos])
        if (error) throw new Error(error.message)
        setSuccess('Labor registrada correctamente')
      }
      
      await loadLabores()
      setForm({
        fecha: format(new Date(), 'yyyy-MM-dd'),
        id_finca: '',
        duracion_h: '',
        hh_persona: '',
        h_maquinaria: '',
        id_equipo: '',
        coste_maquinaria: '',
        coste_hora_peon: 10,
        notas: ''
      })
      setEditingId(null)
      setShowForm(false)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
      setTimeout(() => setError(''), 5000)
    }
  }

  const handleEdit = (labor) => {
    setForm({
      fecha: labor.fecha ? format(new Date(labor.fecha), 'yyyy-MM-dd') : '',
      id_finca: labor.id_finca || '',
      duracion_h: labor.duracion_h || '',
      hh_persona: labor.hh_persona || '',
      h_maquinaria: labor.h_maquinaria || '',
      id_equipo: labor.id_equipo || '',
      coste_maquinaria: labor.coste_maquinaria || '',
      coste_hora_peon: labor.coste_hora_peon || 10,
      notas: labor.notas || ''
    })
    setEditingId(labor.id_labor)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta labor?')) return
    const { error } = await supabase.from('labores').delete().eq('id_labor', id)
    if (error) {
      setError(error.message)
      setTimeout(() => setError(''), 5000)
    } else {
      await loadLabores()
    }
  }

  const fincaNombre = (id) => {
    const f = fincas.find(f => f.id_finca === id)
    return f ? f.nombre : '-'
  }

  const equipoNombre = (id) => {
    const m = maquinaria.find(m => m.id_equipo === id)
    return m ? `${m.tipo} (${m.marca_modelo || 'Sin marca'})` : '-'
  }

  const filteredLabores = filterFinca
    ? labores.filter(l => l.id_finca === filterFinca)
    : labores

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner"></div>
        <p className="mt-16">Cargando labores...</p>
      </div>
    )
  }

  return (
    <div>
      {success && <div className="alert alert-success">✅ {success}</div>}
      {error && <div className="alert alert-error">⚠️ {error}</div>}

      {/* Filtros */}
      <div className="flex gap-16 mb-16 flex-wrap">
        <select
          className="form-select"
          style={{ width: 'auto' }}
          value={filterFinca}
          onChange={e => setFilterFinca(e.target.value)}
        >
          <option value="">Todas las fincas</option>
          {fincas.map(f => (
            <option key={f.id_finca} value={f.id_finca}>{f.nombre}</option>
          ))}
        </select>
        <select
          className="form-select"
          style={{ width: 'auto' }}
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
        >
          {Array.from({ length: 12 }, (_, i) => {
            const d = new Date()
            d.setMonth(d.getMonth() - i)
            return format(d, 'yyyy-MM')
          }).map(m => (
            <option key={m} value={m}>{format(new Date(m + '-01'), 'MMMM yyyy')}</option>
          ))}
        </select>
        <button
          className="btn btn-primary"
          onClick={() => { setShowForm(!showForm); setEditingId(null) }}
        >
          {showForm ? '✕ Cancelar' : '+ Nueva Labor'}
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="card">
          <div className="card-title">📝 {editingId ? 'Editar Labor' : 'Nueva Labor'}</div>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Fecha *</label>
                <input
                  type="date"
                  name="fecha"
                  className="form-input"
                  value={form.fecha}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Finca</label>
                <select
                  name="id_finca"
                  className="form-select"
                  value={form.id_finca}
                  onChange={handleChange}
                >
                  <option value="">Seleccionar finca...</option>
                  {fincas.map(f => (
                    <option key={f.id_finca} value={f.id_finca}>{f.nombre} ({f.termino_municipal})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Duración (horas)</label>
                <input
                  type="number"
                  name="duracion_h"
                  className="form-input"
                  value={form.duracion_h}
                  onChange={handleChange}
                  step="0.5"
                  min="0"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Personas</label>
                <input
                  type="number"
                  name="hh_persona"
                  className="form-input"
                  value={form.hh_persona}
                  onChange={handleChange}
                  step="0.5"
                  min="0"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Coste hora peón (€)</label>
                <input
                  type="number"
                  name="coste_hora_peon"
                  className="form-input"
                  value={form.coste_hora_peon}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Horas maquinaria</label>
                <input
                  type="number"
                  name="h_maquinaria"
                  className="form-input"
                  value={form.h_maquinaria}
                  onChange={handleChange}
                  step="0.5"
                  min="0"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Maquinaria</label>
                <select
                  name="id_equipo"
                  className="form-select"
                  value={form.id_equipo}
                  onChange={handleChange}
                >
                  <option value="">Sin maquinaria</option>
                  {maquinaria.filter(m => m.coste_h).map(m => (
                    <option key={m.id_equipo} value={m.id_equipo}>
                      {m.tipo} - {m.marca_modelo || 'Sin marca'} ({m.coste_h}€/h)
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Coste maquinaria (€)</label>
                <input
                  type="number"
                  name="coste_maquinaria"
                  className="form-input"
                  value={form.coste_maquinaria}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Coste total calculado: <strong>{(form.coste_total || 0).toFixed(2)} €</strong></label>
            </div>
            <div className="form-group">
              <label className="form-label">Notas</label>
              <textarea
                name="notas"
                className="form-textarea"
                value={form.notas}
                onChange={handleChange}
                placeholder="Observaciones sobre la labor..."
              />
            </div>
            <button type="submit" className="btn btn-primary btn-full">
              {editingId ? '💾 Guardar cambios' : '✅ Registrar labor'}
            </button>
          </form>
        </div>
      )}

      {/* Tabla de labores */}
      <div className="card">
        <div className="card-title">📋 Labores registradas ({filteredLabores.length})</div>
        {filteredLabores.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Finca</th>
                  <th>Horas</th>
                  <th>Personas</th>
                  <th>Maquinaria</th>
                  <th>Coste Total</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredLabores.map(l => (
                  <tr key={l.id_labor}>
                    <td>{l.fecha ? format(new Date(l.fecha), 'dd/MM/yyyy') : '-'}</td>
                    <td>{fincaNombre(l.id_finca)}</td>
                    <td>{l.duracion_h || '-'}</td>
                    <td>{l.hh_persona || '-'}</td>
                    <td>{equipoNombre(l.id_equipo)}</td>
                    <td><strong>{(l.coste_total || 0).toFixed(2)} €</strong></td>
                    <td>
                      <button className="btn btn-small btn-accent" onClick={() => handleEdit(l)}>✏️</button>
                      <button className="btn btn-small btn-danger" onClick={() => handleDelete(l.id_labor)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">📝</div>
            <div className="empty-state-text">No hay labores registradas para este filtro</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default LaboresPage
