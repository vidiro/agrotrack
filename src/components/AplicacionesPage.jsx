import { useState, useEffect } from 'react'
import { supabase } from '../data/supabaseClient'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

function AplicacionesPage({ fincas, onDataChange }) {
  const [aplicaciones, setAplicaciones] = useState([])
  const [labores, setLabores] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const [form, setForm] = useState({
    id_labor: '',
    producto: '',
    materia_activa: '',
    dosis: '',
    volumen_caldo: '',
    carencia_dias: '',
    justificacion: '',
    observaciones: ''
  })

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [appRes, labRes] = await Promise.all([
        supabase.from('aplicaciones').select('*').order('created_en', { ascending: false }),
        supabase.from('labores').select('*').order('fecha', { ascending: false })
      ])
      setAplicaciones(appRes.data || [])
      setLabores(labRes.data || [])
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    const datos = {
      ...form,
      id_labor: form.id_labor || null,
      dosis: form.dosis ? parseFloat(form.dosis) : null,
      volumen_caldo: form.volumen_caldo ? parseFloat(form.volumen_caldo) : null,
      carencia_dias: form.carencia_dias ? parseInt(form.carencia_dias) : null,
      justificacion: form.justificacion || null,
      observaciones: form.observaciones || null
    }

    try {
      if (editingId) {
        const { error: err } = await supabase.from('aplicaciones').update(datos).eq('id_aplicacion', editingId)
        if (err) throw new Error(err.message)
        setSuccess('Aplicación actualizada')
      } else {
        const { error: err } = await supabase.from('aplicaciones').insert([datos])
        if (err) throw new Error(err.message)
        setSuccess('Aplicación registrada')
      }

      await loadData()
      onDataChange?.()
      setForm({
        id_labor: '', producto: '', materia_activa: '', dosis: '',
        volumen_caldo: '', carencia_dias: '', justificacion: '', observaciones: ''
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

  const handleEdit = (app) => {
    setForm({
      id_labor: app.id_labor || '',
      producto: app.producto || '',
      materia_activa: app.materia_activa || '',
      dosis: app.dosis || '',
      volumen_caldo: app.volumen_caldo || '',
      carencia_dias: app.carencia_dias || '',
      justificacion: app.justificacion || '',
      observaciones: app.observaciones || ''
    })
    setEditingId(app.id_aplicacion)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta aplicación?')) return
    try {
      const { error: err } = await supabase.from('aplicaciones').delete().eq('id_aplicacion', id)
      if (err) throw err
      await loadData()
      onDataChange?.()
    } catch (err) {
      setError(err.message)
    }
  }

  const laborInfo = (id) => {
    const l = labores.find(l => l.id_labor === id)
    if (!l) return '-'
    const finca = fincas.find(f => f.id_finca === l.id_finca)
    return `${l.fecha ? format(new Date(l.fecha), 'dd/MM') : '-'} ${finca ? finca.nombre : ''}`
  }

  // Filtrar por búsqueda
  const filteredAplicaciones = aplicaciones.filter(a => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    return (a.producto || '').toLowerCase().includes(term) ||
           (a.materia_activa || '').toLowerCase().includes(term) ||
           (a.justificacion || '').toLowerCase().includes(term)
  })

  if (loading) {
    return (
      <div className="empty-state" aria-busy="true">
        <div className="spinner"></div>
        <p className="mt-16">Cargando aplicaciones...</p>
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
            placeholder="Buscar por producto, materia activa..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            aria-label="Buscar aplicaciones"
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')} aria-label="Limpiar búsqueda">✕</button>
          )}
        </div>
        <button
          className="btn btn-primary"
          onClick={() => { setShowForm(!showForm); setEditingId(null) }}
        >
          {showForm ? '✕ Cancelar' : '+ Nueva Aplicación'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-title">🧪 Nueva Aplicación Fitosanitaria</div>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Labor asociada</label>
                <select name="id_labor" className="form-select" value={form.id_labor} onChange={handleChange}>
                  <option value="">Seleccionar labor...</option>
                  {labores.filter(l => l.id_finca).map(l => (
                    <option key={l.id_labor} value={l.id_labor}>
                      {l.fecha ? format(new Date(l.fecha), 'dd/MM/yyyy') : '-'} - {fincas.find(f => f.id_finca === l.id_finca)?.nombre || 'Sin finca'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Producto *</label>
                <input type="text" name="producto" className="form-input" value={form.producto} onChange={handleChange} required placeholder="Nombre comercial" />
              </div>
              <div className="form-group">
                <label className="form-label">Materia activa</label>
                <input type="text" name="materia_activa" className="form-input" value={form.materia_activa} onChange={handleChange} placeholder="Principio activo" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Dosis</label>
                <input type="number" name="dosis" className="form-input" value={form.dosis} onChange={handleChange} step="0.0001" min="0" placeholder="L/ha o kg/ha" />
              </div>
              <div className="form-group">
                <label className="form-label">Volumen caldo (L/ha)</label>
                <input type="number" name="volumen_caldo" className="form-input" value={form.volumen_caldo} onChange={handleChange} step="0.1" min="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Carencia (días)</label>
                <input type="number" name="carencia_dias" className="form-input" value={form.carencia_dias} onChange={handleChange} min="0" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Justificación</label>
              <textarea name="justificacion" className="form-textarea" value={form.justificacion} onChange={handleChange} placeholder="Motivo de la aplicación..." />
            </div>
            <div className="form-group">
              <label className="form-label">Observaciones</label>
              <textarea name="observaciones" className="form-textarea" value={form.observaciones} onChange={handleChange} />
            </div>
            <button type="submit" className={`btn btn-primary btn-full ${saving ? 'btn-loading' : ''}`} disabled={saving}>
              {saving ? 'Guardando...' : editingId ? '💾 Guardar cambios' : '✅ Registrar aplicación'}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-title">📋 Aplicaciones registradas ({filteredAplicaciones.length})</div>
        {filteredAplicaciones.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Materia activa</th>
                  <th>Dosis</th>
                  <th>Carencia</th>
                  <th>Labor</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredAplicaciones.map(a => (
                  <tr key={a.id_aplicacion}>
                    <td><strong>{a.producto || '-'}</strong></td>
                    <td>{a.materia_activa || '-'}</td>
                    <td>{a.dosis ? `${a.dosis}` : '-'}</td>
                    <td>
                      {a.carencia_dias ? (
                        <span className="badge badge-red">{a.carencia_dias} días</span>
                      ) : '-'}
                    </td>
                    <td>{laborInfo(a.id_labor)}</td>
                    <td>
                      <button className="btn btn-small btn-accent" onClick={() => handleEdit(a)} aria-label={`Editar aplicación ${a.producto}`}>✏️</button>
                      <button className="btn btn-small btn-danger" onClick={() => handleDelete(a.id_aplicacion)} aria-label={`Eliminar aplicación ${a.producto}`}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">🧪</div>
            <div className="empty-state-text">No hay aplicaciones registradas</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AplicacionesPage
