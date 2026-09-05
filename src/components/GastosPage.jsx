import { useState, useEffect } from 'react'
import { supabase } from '../data/supabaseClient'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { downloadCSV } from '../utils/csvExport'

function GastosPage({ fincas, onDataChange }) {
  const [gastos, setGastos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM'))

  const [form, setForm] = useState({
    fecha: format(new Date(), 'yyyy-MM-dd'),
    id_finca: '',
    concepto: '',
    categoria: 'Material',
    importe: '',
    forma_pago: 'Transferencia',
    observaciones: ''
  })

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: err } = await supabase.from('gastos_manual').select('*').order('fecha', { ascending: false })
      if (err) throw err
      setGastos(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [filterMonth])

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
      fecha: form.fecha || format(new Date(), 'yyyy-MM-dd'),
      id_finca: form.id_finca || null,
      concepto: form.concepto || null,
      categoria: form.categoria || null,
      importe: form.importe ? parseFloat(form.importe) : null,
      forma_pago: form.forma_pago || null,
      observaciones: form.observaciones || null
    }

    try {
      if (editingId) {
        const { error: err } = await supabase.from('gastos_manual').update(datos).eq('id_gasto', editingId)
        if (err) throw err
        setSuccess('Gasto actualizado')
      } else {
        const { error: err } = await supabase.from('gastos_manual').insert([datos])
        if (err) throw err
        setSuccess('Gasto registrado')
      }
      
      await loadData()
      onDataChange?.()
      setForm({
        fecha: format(new Date(), 'yyyy-MM-dd'),
        id_finca: '', concepto: '', categoria: 'Material', importe: '',
        forma_pago: 'Transferencia', observaciones: ''
      })
      setEditingId(null)
      setShowForm(false)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
      // NO cerramos el formulario ni limpiamos los datos si falla
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (g) => {
    setForm({
      fecha: g.fecha ? format(new Date(g.fecha), 'yyyy-MM-dd') : '',
      id_finca: g.id_finca || '',
      concepto: g.concepto || '',
      categoria: g.categoria || 'Material',
      importe: g.importe || '',
      forma_pago: g.forma_pago || 'Transferencia',
      observaciones: g.observaciones || ''
    })
    setEditingId(g.id_gasto)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este gasto?')) return
    setError('')
    try {
      const { error: err } = await supabase.from('gastos_manual').delete().eq('id_gasto', id)
      if (err) throw err
      await loadData()
      onDataChange?.()
    } catch (err) {
      setError(err.message)
    }
  }

  const totalMes = gastos
    .filter(g => g.fecha && g.fecha.startsWith(filterMonth))
    .reduce((sum, g) => sum + (g.importe || 0), 0)

  // Filtrar por búsqueda
  const filteredGastos = gastos.filter(g => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    return (g.concepto || '').toLowerCase().includes(term) ||
           (g.categoria || '').toLowerCase().includes(term) ||
           (g.forma_pago || '').toLowerCase().includes(term)
  })

  if (loading) {
    return (
      <div className="empty-state" aria-busy="true">
        <div className="spinner"></div>
        <p className="mt-16">Cargando gastos...</p>
      </div>
    )
  }

  return (
    <div>
      {success && <div className="alert alert-success" role="alert">✅ {success}</div>}
      {error && (
        <div className="alert alert-error" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {error}</span>
          <button className="btn btn-small btn-primary" onClick={loadData} aria-label="Reintentar carga">🔄 Reintentar</button>
        </div>
      )}

      <div className="summary-grid" style={{ marginBottom: 16 }}>
        <div className="summary-card">
          <div className="summary-value">{gastos.filter(g => g.fecha && g.fecha.startsWith(filterMonth)).length}</div>
          <div className="summary-label">Gastos este mes</div>
        </div>
        <div className="summary-card danger">
          <div className="summary-value">{totalMes.toFixed(2)} €</div>
          <div className="summary-label">Total este mes</div>
        </div>
      </div>

      {/* Barra de búsqueda y exportar */}
      <div className="fincas-toolbar mb-16" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="search-box" style={{ flex: 1, minWidth: 200 }}>
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por concepto, categoría..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            aria-label="Buscar gastos"
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')} aria-label="Limpiar búsqueda">✕</button>
          )}
        </div>
        <button className="btn btn-small btn-accent" onClick={() => {
          const headers = ['fecha', 'concepto', 'categoria', 'importe', 'forma_pago', 'observaciones']
          const rows = filteredGastos.map(g => ({
            fecha: g.fecha ? format(new Date(g.fecha), 'dd/MM/yyyy') : '',
            concepto: g.concepto || '',
            categoria: g.categoria || '',
            importe: g.importe ?? 0,
            forma_pago: g.forma_pago || '',
            observaciones: g.observaciones || ''
          }))
          downloadCSV('gastos_agrotrack', headers, rows)
        }} aria-label="Exportar a CSV">
          📥 Exportar CSV
        </button>
      </div>

      <div className="flex gap-16 mb-16 flex-wrap">
        <select className="form-select" style={{ width: 'auto' }} value={filterMonth} onChange={e => setFilterMonth(e.target.value)} aria-label="Filtrar por mes">
          {Array.from({ length: 12 }, (_, i) => {
            const d = new Date()
            d.setMonth(d.getMonth() - i)
            return format(d, 'yyyy-MM')
          }).map(m => (
            <option key={m} value={m}>{format(new Date(m + '-01'), 'MMMM yyyy', { locale: es })}</option>
          ))}
        </select>
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingId(null) }}>
          {showForm ? '✕ Cancelar' : '+ Nuevo Gasto'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-title">💰 {editingId ? 'Editar Gasto' : 'Nuevo Gasto'}</div>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Fecha *</label>
                <input type="date" name="fecha" className="form-input" value={form.fecha} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">Finca (opcional)</label>
                <select name="id_finca" className="form-select" value={form.id_finca} onChange={handleChange}>
                  <option value="">Sin finca</option>
                  {fincas.map(f => (
                    <option key={f.id_finca} value={f.id_finca}>{f.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Concepto</label>
                <input type="text" name="concepto" className="form-input" value={form.concepto} onChange={handleChange} placeholder="Descripción del gasto" />
              </div>
              <div className="form-group">
                <label className="form-label">Categoría</label>
                <select name="categoria" className="form-select" value={form.categoria} onChange={handleChange}>
                  <option value="Material">Material</option>
                  <option value="Salario">Salario</option>
                  <option value="Inversión">Inversión</option>
                  <option value="Mantenimiento">Mantenimiento</option>
                  <option value="Combustible">Combustible</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Importe (€) *</label>
                <input type="number" name="importe" className="form-input" value={form.importe} onChange={handleChange} step="0.01" min="0" required />
              </div>
              <div className="form-group">
                <label className="form-label">Forma de pago</label>
                <select name="forma_pago" className="form-select" value={form.forma_pago} onChange={handleChange}>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Tarjeta">Tarjeta</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Observaciones</label>
              <textarea name="observaciones" className="form-textarea" value={form.observaciones} onChange={handleChange} />
            </div>
            <button type="submit" className={`btn btn-primary btn-full ${saving ? 'btn-loading' : ''}`} disabled={saving}>
              {saving ? 'Guardando...' : editingId ? '💾 Guardar cambios' : '✅ Registrar gasto'}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-title">📋 Gastos registrados ({filteredGastos.length})</div>
        {filteredGastos.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Concepto</th>
                  <th>Categoría</th>
                  <th>Importe</th>
                  <th>Forma pago</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredGastos.map(g => (
                  <tr key={g.id_gasto}>
                    <td>{g.fecha ? format(new Date(g.fecha), 'dd/MM/yyyy') : '-'}</td>
                    <td>{g.concepto || '-'}</td>
                    <td><span className={`badge badge-${g.categoria === 'Inversión' ? 'yellow' : g.categoria === 'Salario' ? 'blue' : 'green'}`}>{g.categoria || '-'}</span></td>
                    <td><strong>{g.importe ? `${g.importe.toFixed(2)} €` : '-'}</strong></td>
                    <td>{g.forma_pago || '-'}</td>
                    <td>
                      <button className="btn btn-small btn-accent" onClick={() => handleEdit(g)} aria-label={`Editar gasto ${g.concepto}`}>✏️</button>
                      <button className="btn btn-small btn-danger" onClick={() => handleDelete(g.id_gasto)} aria-label={`Eliminar gasto ${g.concepto}`}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">💰</div>
            <div className="empty-state-text">No hay gastos registrados</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default GastosPage
