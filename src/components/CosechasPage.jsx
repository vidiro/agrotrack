import { useState, useEffect } from 'react'
import { supabase } from '../data/supabaseClient'
import { format } from 'date-fns'

function CosechasPage({ fincas }) {
  const [cosechas, setCosechas] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    fecha: format(new Date(), 'yyyy-MM-dd'),
    id_parcela: '',
    id_bloque: '',
    cultivo: 'Viña',
    variedad: '',
    kg: '',
    n_cajones: '',
    destino: '',
    brix_baume_viina: '',
    rendimiento_graso_olivar: '',
    muestras_calidad: '',
    lote_destino: '',
    observaciones: ''
  })

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data } = await supabase.from('cosechas').select('*').order('fecha', { ascending: false })
      setCosechas(data || [])
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
      fecha: form.fecha || format(new Date(), 'yyyy-MM-dd'),
      id_parcela: form.id_parcela || null,
      id_bloque: form.id_bloque || null,
      cultivo: form.cultivo || null,
      variedad: form.variedad || null,
      kg: form.kg ? parseFloat(form.kg) : null,
      n_cajones: form.n_cajones ? parseInt(form.n_cajones) : null,
      destino: form.destino || null,
      brix_baume_viina: form.brix_baume_viina ? parseFloat(form.brix_baume_viina) : null,
      rendimiento_graso_olivar: form.rendimiento_graso_olivar ? parseFloat(form.rendimiento_graso_olivar) : null,
      muestras_calidad: form.muestras_calidad || null,
      lote_destino: form.lote_destino || null,
      observaciones: form.observaciones || null
    }

    try {
      if (editingId) {
        const { error } = await supabase.from('cosechas').update(datos).eq('id_cosecha', editingId)
        if (error) throw new Error(error.message)
        setSuccess('Cosecha actualizada')
      } else {
        const { error } = await supabase.from('cosechas').insert([datos])
        if (error) throw new Error(error.message)
        setSuccess('Cosecha registrada')
      }
      
      const { data } = await supabase.from('cosechas').select('*').order('fecha', { ascending: false })
      setCosechas(data || [])
      setForm({
        fecha: format(new Date(), 'yyyy-MM-dd'),
        id_parcela: '', id_bloque: '', cultivo: 'Viña', variedad: '',
        kg: '', n_cajones: '', destino: '', brix_baume_viina: '',
        rendimiento_graso_olivar: '', muestras_calidad: '', lote_destino: '', observaciones: ''
      })
      setEditingId(null)
      setShowForm(false)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
      setTimeout(() => setError(''), 5000)
    }
  }

  const handleEdit = (c) => {
    setForm({
      fecha: c.fecha ? format(new Date(c.fecha), 'yyyy-MM-dd') : '',
      id_parcela: c.id_parcela || '',
      id_bloque: c.id_bloque || '',
      cultivo: c.cultivo || 'Viña',
      variedad: c.variedad || '',
      kg: c.kg || '',
      n_cajones: c.n_cajones || '',
      destino: c.destino || '',
      brix_baume_viina: c.brix_baume_viina || '',
      rendimiento_graso_olivar: c.rendimiento_graso_olivar || '',
      muestras_calidad: c.muestras_calidad || '',
      lote_destino: c.lote_destino || '',
      observaciones: c.observaciones || ''
    })
    setEditingId(c.id_cosecha)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta cosecha?')) return
    const { error } = await supabase.from('cosechas').delete().eq('id_cosecha', id)
    if (!error) {
      const { data } = await supabase.from('cosechas').select('*').order('fecha', { ascending: false })
      setCosechas(data || [])
    }
  }

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner"></div>
        <p className="mt-16">Cargando cosechas...</p>
      </div>
    )
  }

  return (
    <div>
      {success && <div className="alert alert-success">✅ {success}</div>}
      {error && <div className="alert alert-error">⚠️ {error}</div>}

      <div className="flex gap-16 mb-16">
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingId(null) }}>
          {showForm ? '✕ Cancelar' : '+ Nueva Cosecha'}
        </button>
      </div>

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
                <label className="form-label">Bloque</label>
                <input type="text" name="id_bloque" className="form-input" value={form.id_bloque} onChange={handleChange} placeholder="Número de bloque" />
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
              <div className="form-group">
                <label className="form-label">Nº cajones</label>
                <input type="number" name="n_cajones" className="form-input" value={form.n_cajones} onChange={handleChange} min="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Lote destino</label>
                <input type="text" name="lote_destino" className="form-input" value={form.lote_destino} onChange={handleChange} />
              </div>
            </div>
            {form.cultivo === 'Viña' && (
              <div className="form-group">
                <label className="form-label">Brix / Baume (viña)</label>
                <input type="number" name="brix_baume_viina" className="form-input" value={form.brix_baume_viina} onChange={handleChange} step="0.01" placeholder="Grados Brix o Baumé" />
              </div>
            )}
            {form.cultivo === 'Olivar' && (
              <div className="form-group">
                <label className="form-label">Rendimiento graso (%)</label>
                <input type="number" name="rendimiento_graso_olivar" className="form-input" value={form.rendimiento_graso_olivar} onChange={handleChange} step="0.01" placeholder="Porcentaje de rendimiento" />
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
            <button type="submit" className="btn btn-primary btn-full">
              {editingId ? '💾 Guardar cambios' : '✅ Registrar cosecha'}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-title">📋 Cosechas registradas ({cosechas.length})</div>
        {cosechas.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Parcela</th>
                  <th>Cultivo</th>
                  <th>Variedad</th>
                  <th>Kg</th>
                  <th>Cajones</th>
                  <th>Destino</th>
                  <th>Brix/Baume</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cosechas.map(c => (
                  <tr key={c.id_cosecha}>
                    <td>{c.fecha ? format(new Date(c.fecha), 'dd/MM/yyyy') : '-'}</td>
                    <td>{fincas.find(f => f.id_finca === c.id_parcela)?.nombre || '-'}</td>
                    <td>{c.cultivo || '-'}</td>
                    <td>{c.variedad || '-'}</td>
                    <td><strong>{c.kg ? c.kg.toFixed(0) : '-'}</strong></td>
                    <td>{c.n_cajones || '-'}</td>
                    <td>{c.destino || '-'}</td>
                    <td>{c.brix_baume_viina ? `${c.brix_baume_viina}°` : '-'}</td>
                    <td>
                      <button className="btn btn-small btn-accent" onClick={() => handleEdit(c)}>✏️</button>
                      <button className="btn btn-small btn-danger" onClick={() => handleDelete(c.id_cosecha)}>🗑️</button>
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
