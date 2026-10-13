import { useState, useEffect } from 'react'
import { supabase } from '../data/supabaseClient'

function DestinosPage({ destinos: destinosOrig, preciosDestino: preciosOrig, onDataChange }) {
  const [destinos, setDestinos] = useState(destinosOrig || [])
  const [precios, setPrecios] = useState(preciosOrig || [])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    nombre: '',
    tipo: 'Bodega'
  })

  const [precioForm, setPrecioForm] = useState({
    id_destino: '',
    tipo_producto: 'uva',
    precio: ''
  })
  const [showPrecioForm, setShowPrecioForm] = useState(false)

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [destRes, precRes] = await Promise.all([
        supabase.from('destinos').select('*').order('nombre'),
        supabase.from('precios_destino').select('*')
      ])
      if (destRes.error && !destRes.message?.includes('Could not find the table')) throw destRes.error
      if (precRes.error && !precRes.message?.includes('Could not find the table')) throw precRes.error
      setDestinos(destRes.data || [])
      setPrecios(precRes.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    setDestinos(destinosOrig || [])
  }, [destinosOrig])

  useEffect(() => {
    setPrecios(preciosOrig || [])
  }, [preciosOrig])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })
  }

  const handlePrecioChange = (e) => {
    const { name, value } = e.target
    setPrecioForm({ ...precioForm, [name]: value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    try {
      if (editingId) {
        const { error: err } = await supabase.from('destinos').update(form).eq('id_destino', editingId)
        if (err) throw err
        setSuccess('Destino actualizado')
      } else {
        const { error: err } = await supabase.from('destinos').insert([form])
        if (err) throw err
        setSuccess('Destino registrado')
      }
      await loadData()
      onDataChange?.()
      setForm({ nombre: '', tipo: 'Bodega' })
      setEditingId(null)
      setShowForm(false)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (d) => {
    setForm({ nombre: d.nombre, tipo: d.tipo || 'Bodega' })
    setEditingId(d.id_destino)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este destino?')) return
    try {
      const { error: err } = await supabase.from('destinos').delete().eq('id_destino', id)
      if (err) throw err
      await loadData()
      onDataChange?.()
    } catch (err) {
      setError(err.message)
    }
  }

  const handlePrecioSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    try {
      const datos = {
        id_destino: precioForm.id_destino,
        tipo_producto: precioForm.tipo_producto,
        precio: parseFloat(precioForm.precio) || 0,
        unidad: precioForm.tipo_producto === 'uva' ? 'kilogrado' : 'kg'
      }

      // Check if this combination exists
      const existing = precios.find(p => String(p.id_destino) === String(precioForm.id_destino) && p.tipo_producto === precioForm.tipo_producto)

      if (existing) {
        const { error: err } = await supabase.from('precios_destino').update({ precio: datos.precio, unidad: datos.unidad })
          .eq('id_destino', precioForm.id_destino)
          .eq('tipo_producto', precioForm.tipo_producto)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('precios_destino').insert([datos])
        if (err) throw err
      }

      setSuccess('Precio actualizado')
      await loadData()
      onDataChange?.()
      setPrecioForm({ id_destino: '', tipo_producto: 'uva', precio: '' })
      setShowPrecioForm(false)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const getPrecio = (idDestino, tipo) => {
    const p = precios.find(pr => String(pr.id_destino) === String(idDestino) && pr.tipo_producto === tipo)
    return p ? parseFloat(p.precio) : null
  }

  if (loading) {
    return (
      <div className="empty-state" aria-busy="true">
        <div className="spinner"></div>
        <p className="mt-16">Cargando destinos...</p>
      </div>
    )
  }

  return (
    <div>
      {success && <div className="alert alert-success" role="alert"> {success}</div>}
      {error && (
        <div className="alert alert-error" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span> {error}</span>
          <button className="btn btn-small btn-primary" onClick={loadData} aria-label="Reintentar"> Reintentar</button>
        </div>
      )}

      <div className="summary-grid" style={{ marginBottom: 16 }}>
        <div className="summary-card">
          <div className="summary-value">{destinos.length}</div>
          <div className="summary-label">Destinos registrados</div>
        </div>
      </div>

      <div className="flex gap-16 mb-16">
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingId(null) }}>
          {showForm ? ' Cancelar' : '+ Nuevo Destino'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title"> {editingId ? 'Editar Destino' : 'Nuevo Destino'}</div>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nombre *</label>
                <input type="text" name="nombre" className="form-input" value={form.nombre} onChange={handleChange} required placeholder="Bodega X, Cooperativa Y..." />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select name="tipo" className="form-select" value={form.tipo} onChange={handleChange}>
                  <option value="Bodega">Bodega</option>
                  <option value="Cooperativa">Cooperativa</option>
                  <option value="Mercado">Mercado</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
            </div>
            <button type="submit" className={`btn btn-primary btn-full ${saving ? 'btn-loading' : ''}`} disabled={saving}>
              {saving ? 'Guardando...' : editingId ? ' Guardar' : ' Registrar destino'}
            </button>
          </form>
        </div>
      )}

      {destinos.length > 0 ? (
        destinos.map(d => {
          const preciosDest = precios.filter(p => String(p.id_destino) === String(d.id_destino))
          const precioUva = getPrecio(d.id_destino, 'uva')
          const precioManzanilla = getPrecio(d.id_destino, 'manzanilla')
          const precioCarrasquena = getPrecio(d.id_destino, 'carrasquena')
          const precioBasta = getPrecio(d.id_destino, 'aceituna')
          const precioPerdigon = getPrecio(d.id_destino, 'perdigon')

          return (
            <div key={d.id_destino} className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div className="card-title" style={{ marginBottom: 4 }}>{d.nombre}</div>
                  <span className={`badge badge-${d.tipo === 'Bodega' ? 'blue' : d.tipo === 'Cooperativa' ? 'green' : 'yellow'}`}>
                    {d.tipo || 'Otro'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-small btn-accent" onClick={() => handleEdit(d)} aria-label={`Editar destino ${d.nombre}`}></button>
                  <button className="btn btn-small btn-danger" onClick={() => handleDelete(d.id_destino)} aria-label={`Eliminar destino ${d.nombre}`}></button>
                </div>
              </div>

              {/* Precios de este destino */}
              <div style={{ background: 'var(--color-bg)', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong style={{ fontSize: '0.875rem' }}> Precios configurados</strong>
                  <button
                    className="btn btn-small btn-accent"
                    onClick={() => {
                      setPrecioForm({ id_destino: d.id_destino, tipo_producto: 'uva', precio: '' })
                      setShowPrecioForm(true)
                    }}
                  >
                    + Añadir precio
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                  <div style={{ background: 'var(--vina-bg)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--vina-accent-light)' }}> Uva</div>
                    <div style={{ fontWeight: 700, color: 'var(--vina-accent)' }}>{precioUva != null ? precioUva.toFixed(4) + ' €/kg°' : '—'}</div>
                  </div>
                  <div style={{ background: 'var(--olivar-bg)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--olivar-accent-light)' }}>🫒 Manzanilla</div>
                    <div style={{ fontWeight: 700, color: 'var(--olivar-accent)' }}>{precioManzanilla != null ? precioManzanilla.toFixed(4) + ' €/kg' : '—'}</div>
                  </div>
                  <div style={{ background: 'var(--olivar-bg)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--olivar-accent-light)' }}>🫒 Carrasqueña</div>
                    <div style={{ fontWeight: 700, color: 'var(--olivar-accent)' }}>{precioCarrasquena != null ? precioCarrasquena.toFixed(4) + ' €/kg' : '—'}</div>
                  </div>
                  <div style={{ background: 'var(--olivar-bg)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--olivar-accent-light)' }}>🫒 Basta</div>
                    <div style={{ fontWeight: 700, color: 'var(--olivar-accent)' }}>{precioBasta != null ? precioBasta.toFixed(4) + ' €/kg' : '—'}</div>
                  </div>
                  <div style={{ background: 'var(--olivar-bg)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--olivar-accent-light)' }}>🫒 Pérdigon</div>
                    <div style={{ fontWeight: 700, color: 'var(--olivar-accent)' }}>{precioPerdigon != null ? precioPerdigon.toFixed(4) + ' €/kg' : '—'}</div>
                  </div>
                </div>

                {preciosDest.length === 0 && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 8, textAlign: 'center' }}>
                    Sin precios configurados. Pulsa "+ Añadir precio"
                  </p>
                )}
              </div>

              {/* Formulario de precio */}
              {showPrecioForm && precioForm.id_destino === d.id_destino && (
                <div style={{ marginTop: 12, padding: 12, background: 'var(--color-surface)', borderRadius: 10, border: '1px solid var(--color-border)' }}>
                  <form onSubmit={handlePrecioSubmit}>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Tipo de producto</label>
                        <select name="tipo_producto" className="form-select" value={precioForm.tipo_producto} onChange={handlePrecioChange}>
                          <option value="uva"> Uva (€/kilogrado)</option>
                          <option value="manzanilla">🫒 Manzanilla (€/kg)</option>
                          <option value="carrasquena">🫒 Carrasqueña (€/kg)</option>
                          <option value="aceituna">🫒 Aceituna basta (€/kg)</option>
                          <option value="perdigon">🫒 Pérdigon (€/kg)</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Precio</label>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <input type="number" name="precio" className="form-input" value={precioForm.precio} onChange={handlePrecioChange} step="0.0001" min="0" required placeholder="0.00" />
                          <span className="text-muted" style={{ fontSize: '0.75rem' }}>€</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-8">
                      <button type="submit" className={`btn btn-small btn-primary ${saving ? 'btn-loading' : ''}`} disabled={saving}>
                        {saving ? 'Guardando...' : ' Guardar precio'}
                      </button>
                      <button type="button" className="btn btn-small" onClick={() => setShowPrecioForm(false)}>Cancelar</button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )
        })
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon"></div>
          <div className="empty-state-text">No hay destinos configurados</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 8 }}>
            Añade bodegas, cooperativas o mercados y configura sus precios
          </p>
        </div>
      )}
    </div>
  )
}

export default DestinosPage
