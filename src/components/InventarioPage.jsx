import { useState, useEffect } from 'react'
import { supabase } from '../data/supabaseClient'

function InventarioPage({ onDataChange }) {
  const [articulos, setArticulos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

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

  const loadInventario = async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: err } = await supabase.from('inventario').select('*').order('nombre_articulo')
      if (err) throw err
      setArticulos(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInventario()
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
        const { error: err } = await supabase.from('inventario').update(datos).eq('id_articulo', editingId)
        if (err) throw new Error(err.message)
        setSuccess('Artículo actualizado')
      } else {
        const { error: err } = await supabase.from('inventario').insert([datos])
        if (err) throw new Error(err.message)
        setSuccess('Artículo registrado')
      }

      await loadInventario()
      onDataChange?.()
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
      // NO cerramos el formulario si falla
    } finally {
      setSaving(false)
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
    try {
      const { error: err } = await supabase.from('inventario').delete().eq('id_articulo', id)
      if (err) throw err
      await loadInventario()
      onDataChange?.()
    } catch (err) {
      setError(err.message)
    }
  }

  const stockActual = (art) => (art.stock_inicial || 0) + (art.entradas || 0) - (art.salidas || 0)

  // Filtrar por búsqueda
  const filteredArticulos = articulos.filter(a => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    return (a.nombre_articulo || '').toLowerCase().includes(term) ||
           (a.familia || '').toLowerCase().includes(term) ||
           (a.proveedor || '').toLowerCase().includes(term)
  })

  if (loading) {
    return (
      <div className="empty-state" aria-busy="true">
        <div className="spinner"></div>
        <p className="mt-16">Cargando inventario...</p>
      </div>
    )
  }

  return (
    <div>
      {success && <div className="alert alert-success" role="alert"> {success}</div>}
      {error && (
        <div className="alert alert-error" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span> {error}</span>
          <button className="btn btn-small btn-primary" onClick={loadInventario} aria-label="Reintentar"> Reintentar</button>
        </div>
      )}

      {/* Barra de búsqueda */}
      <div className="fincas-toolbar mb-16">
        <div className="search-box">
          <span className="search-icon"></span>
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por nombre, familia, proveedor..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            aria-label="Buscar artículos de inventario"
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')} aria-label="Limpiar búsqueda"></button>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingId(null) }}>
          {showForm ? ' Cancelar' : '+ Nuevo Artículo'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-title"> {editingId ? 'Editar Artículo' : 'Nuevo Artículo'}</div>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">ID Artículo *</label>
                <input type="text" name="id_articulo" className="form-input" value={form.id_articulo} onChange={handleChange} required placeholder="ej: art_01" />
              </div>
              <div className="form-group">
                <label className="form-label">Familia</label>
                <select name="familia" className="form-select" value={form.familia} onChange={handleChange}>
                  <option value="">Seleccionar familia...</option>
                  <option value="Fitosanitarios">Fitosanitarios</option>
                  <option value="Fertilizantes">Fertilizantes</option>
                  <option value="Semillas">Semillas</option>
                  <option value="Material consumo">Material consumo</option>
                  <option value="Recambios">Recambios</option>
                  <option value="Otros">Otros</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Nombre del artículo *</label>
              <input type="text" name="nombre_articulo" className="form-input" value={form.nombre_articulo} onChange={handleChange} required placeholder="Nombre del producto" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Stock inicial</label>
                <input type="number" name="stock_inicial" className="form-input" value={form.stock_inicial} onChange={handleChange} min="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Entradas</label>
                <input type="number" name="entradas" className="form-input" value={form.entradas} onChange={handleChange} min="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Salidas</label>
                <input type="number" name="salidas" className="form-input" value={form.salidas} onChange={handleChange} min="0" />
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
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Precio unitario (€)</label>
                <input type="number" name="precio_unitario" className="form-input" value={form.precio_unitario} onChange={handleChange} step="0.01" min="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Proveedor</label>
                <input type="text" name="proveedor" className="form-input" value={form.proveedor} onChange={handleChange} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notas</label>
              <textarea name="notas" className="form-textarea" value={form.notas} onChange={handleChange} />
            </div>
            <button type="submit" className={`btn btn-primary btn-full ${saving ? 'btn-loading' : ''}`} disabled={saving}>
              {saving ? 'Guardando...' : editingId ? ' Guardar cambios' : ' Registrar artículo'}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-title"> Inventario ({filteredArticulos.length})</div>
        {filteredArticulos.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Familia</th>
                  <th>Stock</th>
                  <th>Precio</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredArticulos.map(a => (
                  <tr key={a.id_articulo}>
                    <td><strong>{a.nombre_articulo || '-'}</strong></td>
                    <td>{a.familia || '-'}</td>
                    <td>
                      <span className={`badge ${stockActual(a) <= 0 ? 'badge-red' : 'badge-green'}`}>
                        {stockActual(a)}
                      </span>
                    </td>
                    <td>{a.precio_unitario ? `${a.precio_unitario.toFixed(2)} €` : '-'}</td>
                    <td>
                      <button className="btn btn-small btn-accent" onClick={() => handleEdit(a)} aria-label={`Editar artículo ${a.nombre_articulo}`}></button>
                      <button className="btn btn-small btn-danger" onClick={() => handleDelete(a.id_articulo)} aria-label={`Eliminar artículo ${a.nombre_articulo}`}></button>
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
              {searchTerm ? 'No se encontraron artículos con esa búsqueda' : 'No hay artículos en inventario'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default InventarioPage
