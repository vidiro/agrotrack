import { useState, useEffect } from 'react'
import { supabase } from '../data/supabaseClient'
import { format } from 'date-fns'

function AplicacionesPage({ fincas }) {
  const [aplicaciones, setAplicaciones] = useState([])
  const [labores, setLabores] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    id_labor: '',
    producto: '',
    materia_activa: '',
    dosis: '',
    volumen_caldo: '',
    lote_producto: '',
    justificacion: '',
    carencia_dias: '',
    responsable: '',
    tmax_c: '',
    tmin_c: '',
    lluvia_mm: '',
    condiciones_meteo: '',
    observaciones: ''
  })

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [appRes, labRes] = await Promise.all([
        supabase.from('aplicaciones').select('*').order('created_en', { ascending: false }),
        supabase.from('labores').select('*').order('fecha', { ascending: false })
      ])
      setAplicaciones(appRes.data || [])
      setLabores(labRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

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
      id_labor: form.id_labor || null,
      dosis: form.dosis ? parseFloat(form.dosis) : null,
      volumen_caldo: form.volumen_caldo ? parseFloat(form.volumen_caldo) : null,
      carencia_dias: form.carencia_dias ? parseInt(form.carencia_dias) : null,
      tmax_c: form.tmax_c ? parseFloat(form.tmax_c) : null,
      tmin_c: form.tmin_c ? parseFloat(form.tmin_c) : null,
      lluvia_mm: form.lluvia_mm ? parseFloat(form.lluvia_mm) : null,
      responsable: form.responsable || null,
      justificacion: form.justificacion || null,
      condiciones_meteo: form.condiciones_meteo || null,
      observaciones: form.observaciones || null
    }

    try {
      if (editingId) {
        const { error } = await supabase.from('aplicaciones').update(datos).eq('id_aplicacion', editingId)
        if (error) throw new Error(error.message)
        setSuccess('Aplicación actualizada')
      } else {
        const { error } = await supabase.from('aplicaciones').insert([datos])
        if (error) throw new Error(error.message)
        setSuccess('Aplicación registrada')
      }
      
      const { data } = await supabase.from('aplicaciones').select('*').order('created_en', { ascending: false })
      setAplicaciones(data || [])
      setForm({
        id_labor: '', producto: '', materia_activa: '', dosis: '',
        volumen_caldo: '', lote_producto: '', justificacion: '',
        carencia_dias: '', responsable: '', tmax_c: '', tmin_c: '',
        lluvia_mm: '', condiciones_meteo: '', observaciones: ''
      })
      setEditingId(null)
      setShowForm(false)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
      setTimeout(() => setError(''), 5000)
    }
  }

  const handleEdit = (app) => {
    setForm({
      id_labor: app.id_labor || '',
      producto: app.producto || '',
      materia_activa: app.materia_activa || '',
      dosis: app.dosis || '',
      volumen_caldo: app.volumen_caldo || '',
      lote_producto: app.lote_producto || '',
      justificacion: app.justificacion || '',
      carencia_dias: app.carencia_dias || '',
      responsable: app.responsable || '',
      tmax_c: app.tmax_c || '',
      tmin_c: app.tmin_c || '',
      lluvia_mm: app.lluvia_mm || '',
      condiciones_meteo: app.condiciones_meteo || '',
      observaciones: app.observaciones || ''
    })
    setEditingId(app.id_aplicacion)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta aplicación?')) return
    const { error } = await supabase.from('aplicaciones').delete().eq('id_aplicacion', id)
    if (!error) {
      const { data } = await supabase.from('aplicaciones').select('*').order('created_en', { ascending: false })
      setAplicaciones(data || [])
    }
  }

  const laborInfo = (id) => {
    const l = labores.find(l => l.id_labor === id)
    if (!l) return '-'
    const finca = fincas.find(f => f.id_finca === l.id_finca)
    return `${l.fecha ? format(new Date(l.fecha), 'dd/MM') : '-'} ${finca ? finca.nombre : ''}`
  }

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner"></div>
        <p className="mt-16">Cargando aplicaciones...</p>
      </div>
    )
  }

  return (
    <div>
      {success && <div className="alert alert-success">✅ {success}</div>}
      {error && <div className="alert alert-error">⚠️ {error}</div>}

      <div className="flex gap-16 mb-16">
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
                <label className="form-label">Lote producto</label>
                <input type="text" name="lote_producto" className="form-input" value={form.lote_producto} onChange={handleChange} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Carencia (días)</label>
                <input type="number" name="carencia_dias" className="form-input" value={form.carencia_dias} onChange={handleChange} min="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Responsable</label>
                <input type="text" name="responsable" className="form-input" value={form.responsable} onChange={handleChange} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">T° máxima (°C)</label>
                <input type="number" name="tmax_c" className="form-input" value={form.tmax_c} onChange={handleChange} step="0.1" />
              </div>
              <div className="form-group">
                <label className="form-label">T° mínima (°C)</label>
                <input type="number" name="tmin_c" className="form-input" value={form.tmin_c} onChange={handleChange} step="0.1" />
              </div>
              <div className="form-group">
                <label className="form-label">Lluvia (mm)</label>
                <input type="number" name="lluvia_mm" className="form-input" value={form.lluvia_mm} onChange={handleChange} step="0.1" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Justificación</label>
              <textarea name="justificacion" className="form-textarea" value={form.justificacion} onChange={handleChange} placeholder="Motivo de la aplicación..." />
            </div>
            <div className="form-group">
              <label className="form-label">Condiciones meteo</label>
              <input type="text" name="condiciones_meteo" className="form-input" value={form.condiciones_meteo} onChange={handleChange} placeholder="Viento, humedad, etc." />
            </div>
            <div className="form-group">
              <label className="form-label">Observaciones</label>
              <textarea name="observaciones" className="form-textarea" value={form.observaciones} onChange={handleChange} />
            </div>
            <button type="submit" className="btn btn-primary btn-full">
              {editingId ? '💾 Guardar cambios' : '✅ Registrar aplicación'}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-title">📋 Aplicaciones registradas ({aplicaciones.length})</div>
        {aplicaciones.length > 0 ? (
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
                {aplicaciones.map(a => (
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
                      <button className="btn btn-small btn-accent" onClick={() => handleEdit(a)}>✏️</button>
                      <button className="btn btn-small btn-danger" onClick={() => handleDelete(a.id_aplicacion)}>🗑️</button>
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
