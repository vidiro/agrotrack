import { useState, useEffect } from 'react'
import { supabase } from '../data/supabaseClient'

function InventarioPage() {
  const [articulos, setArticulos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    id_articulo: '',
    familia: '',
    nombre_articulo: '',
    stock_inicial: '',
    entradas: '0',
    salidas: '0',
    lote: '',
    caducidad: '',
    precio_unitario: '',
    proveedor: '',
    notas: ''
  })

  useEffect(() => {
    loadInventario()
  }, [])

  const loadInventario = async () => {
    setLoading(true)
    const { data } = await supabase.from('inventario').select('*').order('nombre_articulo')
    setArticulos(data || [])
    setLoading(false)
  }

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
      stock_inicial: form.stock_inicial ? parseInt(form.stock_inicial) : null,
      entradas: form.entradas ? parseInt(form.entradas) : 0,
      salidas: form.salidas ? parseInt(form.salidas) : 0,
      caducidad: form.caducidad || null,
      precio_unitario: form.precio_unitario ? parseFloat(form.precio_unitario) : null,
      lote: form.lote || null,
      proveedor: form.proveedor || null,
      notas: form.notas || null
    }

    try {
      if (editingId) {
        const { error } = await supabase.from('inventario').update(datos).eq('id_articulo', editingId)
        if (error) throw new Error(error.message)
        setSuccess('Artículo actualizado')
      } else {
        const { error } = await supabase.from('inventario').insert([datos])
        if (error) throw new Error(error.message)
        setSuccess('Artículo registrado')
      }
      
      await loadInventario()
      setForm({
        id_articulo: '', familia: '', nombre_articulo: '', stock_inicial: '',
        entradas: '0', salidas: '0', lote: '', caducidad: '', precio_unitario: '',
        proveedor: '', notas: ''
      })
      setEditingId(null)
      setShowForm(false)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
      setTimeout(() => setError(''), 5000)
    }
  }

  const handleEdit = (a) => {
    setForm({
      id_articulo: a.id_articulo,
      familia: a.familia || '',
      nombre_articulo: a.nombre_articulo || '',
      stock_inicial: a.stock_inicial || '',
      entradas: a.entradas || '0',
      salidas: a.salidas || '0',
      lote: a.lote || '',
      caducidad: a.caducidad || '',
      precio_unitario: a.precio_unitario || '',
      proveedor: a.proveedor || '',
      notas: a.notas || ''
    })
    setEditingId(a.id_articulo)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este artículo?')) return
    const { error } = await supabase.from('inventario').delete().eq('id_articulo', id)
    if (!error) await loadInventario()
  }

  const stockActual = (art) => (art.stock_inicial || 0) + (art.entradas || 0) - (art.salidas || 0)

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner"></div>
        <p className="mt-16">Cargando inventario...</p>
      </div>
    )
  }

  return (
    <div>
      {success && <div className="alert alert-success">✅ {success}</div>}
      {error && <div className="alert alert-error">⚠️ {error}</div>}

      <div className="flex gap-16 mb-16">
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingId(null) }}>
          {showForm ? '✕ Cancelar' : '+ Nuevo Artículo'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-title">📦 {editingId ? 'Editar Artículo' : 'Nuevo Artículo'}</div>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">ID Artículo *</label>
                <input type="text" name="id_articulo" className="form-input" value={form.id_articulo} onChange={handleChange} required placeholder="ej: id_articulo_20" />
              </div>
              <div className="form-group">
                <label className="form-label">Nombre *</label>
                <input type="text" name="nombre_articulo" className="form-input" value={form.nombre_articulo} onChange={handleChange} required placeholder="Nombre del artículo" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Familia</label>
                <input type="text" name="familia" className="form-input" value={form.familia} onChange={handleChange} placeholder="Herramientas, Productos fito..." />
              </div>
              <div className="form-group">
                <label className="form-label">Stock inicial</label>
                <input type="number" name="stock_inicial" className="form-input" value={form.stock_inicial} onChange={handleChange} min="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Proveedor</label>
                <input type="text" name="proveedor" className="form-input" value={form.proveedor} onChange={handleChange} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Entradas</label>
                <input type="number" name="entradas" className="form-input" value={form.entradas} onChange={handleChange} min="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Salidas</label>
                <input type="number" name="salidas" className="form-input" value={form.salidas} onChange={handleChange} min="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Precio unitario (€)</label>
                <input type="number" name="precio_unitario" className="form-input" value={form.precio_unitario} onChange={handleChange} step="0.01" min="0" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Lote</label>
                <input type="text" name="lote" className="form-input" value={form.lote} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Caducidad</label>
                <input type="date" name="caducidad" className="form-input" value={form.caducidad} onChange={handleChange} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notas</label>
              <textarea name="notas" className="form-textarea" value={form.notas} onChange={handleChange} />
            </div>
            <button type="submit" className="btn btn-primary btn-full">
              {editingId ? '💾 Guardar cambios' : '✅ Registrar artículo'}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-title">📋 Inventario ({articulos.length} artículos)</div>
        {articulos.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Familia</th>
                  <th>Stock</th>
                  <th>Entradas</th>
                  <th>Salidas</th>
                  <th>Precio</th>
                  <th>Caducidad</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {articulos.map(a => {
                  const stock = stockActual(a)
                  return (
                    <tr key={a.id_articulo}>
                      <td><code>{a.id_articulo}</code></td>
                      <td><strong>{a.nombre_articulo || '-'}</strong></td>
                      <td>{a.familia || '-'}</td>
                      <td><span className={`badge badge-${stock <= 0 ? 'red' : stock < 5 ? 'yellow' : 'green'}`}>{stock}</span></td>
                      <td>{a.entradas || 0}</td>
                      <td>{a.salidas || 0}</td>
                      <td>{a.precio_unitario ? `${a.precio_unitario.toFixed(2)} €` : '-'}</td>
                      <td>{a.caducidad ? new Date(a.caducidad).toLocaleDateString('es-ES') : '-'}</td>
                      <td>
                        <button className="btn btn-small btn-accent" onClick={() => handleEdit(a)}>✏️</button>
                        <button className="btn btn-small btn-danger" onClick={() => handleDelete(a.id_articulo)}>🗑️</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <div className="empty-state-text">No hay artículos en el inventario</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default InventarioPage
