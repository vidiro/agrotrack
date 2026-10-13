import { useState, useEffect } from 'react'
import { supabase } from '../data/supabaseClient'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { downloadCSV } from '../utils/csvExport'

function IngresosPage({ fincas, params, onDataChange }) {
  const [ingresos, setIngresos] = useState([])
  const [cosechas, setCosechas] = useState([])
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
    origen: 'Otro',
    id_cosecha: '',
    concepto: '',
    cantidad: '',
    observaciones: ''
  })

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [ingRes, cosechRes] = await Promise.all([
        supabase.from('ingresos').select('*').order('fecha', { ascending: false }),
        supabase.from('cosechas').select('*').order('fecha', { ascending: false })
      ])
      if (ingRes.error) throw ingRes.error
      if (cosechRes.error) throw cosechRes.error
      setIngresos(ingRes.data || [])
      setCosechas(cosechRes.data || [])
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
    const newForm = { ...form, [name]: value }

    if (name === 'origen' && value !== 'Cosecha') {
      newForm.id_cosecha = ''
    }

    setForm(newForm)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    const datos = {
      fecha: form.fecha || format(new Date(), 'yyyy-MM-dd'),
      origen: form.origen || null,
      id_cosecha: form.origen === 'Cosecha' && form.id_cosecha ? form.id_cosecha : null,
      concepto: form.concepto || null,
      cantidad: form.cantidad ? parseFloat(form.cantidad) : null,
      observaciones: form.observaciones || null
    }

    try {
      if (editingId) {
        const { error: err } = await supabase.from('ingresos').update(datos).eq('id_ingreso', editingId)
        if (err) throw new Error(err.message)
        setSuccess('Ingreso actualizado')
      } else {
        const { error: err } = await supabase.from('ingresos').insert([datos])
        if (err) throw new Error(err.message)
        setSuccess('Ingreso registrado')
      }

      await loadData()
      onDataChange?.()
      setForm({
        fecha: format(new Date(), 'yyyy-MM-dd'),
        origen: 'Otro', id_cosecha: '', concepto: '',
        cantidad: '', observaciones: ''
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

  const handleEdit = (ing) => {
    setForm({
      fecha: ing.fecha ? format(new Date(ing.fecha), 'yyyy-MM-dd') : '',
      origen: ing.origen || 'Otro',
      id_cosecha: ing.id_cosecha || '',
      concepto: ing.concepto || '',
      cantidad: ing.cantidad || '',
      observaciones: ing.observaciones || ''
    })
    setEditingId(ing.id_ingreso)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este ingreso?')) return
    try {
      const { error: err } = await supabase.from('ingresos').delete().eq('id_ingreso', id)
      if (err) throw err
      await loadData()
      onDataChange?.()
    } catch (err) {
      setError(err.message)
    }
  }

  const totalMes = ingresos
    .filter(i => i.fecha && i.fecha.startsWith(filterMonth))
    .reduce((sum, i) => sum + (i.cantidad || 0), 0)

  // Filtrar por búsqueda
  const filteredIngresos = ingresos.filter(i => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    return (i.concepto || '').toLowerCase().includes(term) ||
           (i.origen || '').toLowerCase().includes(term)
  })

  const getCosechaInfo = (id) => {
    const c = cosechas.find(c => c.id_cosecha === id)
    if (!c) return '-'
    const finca = fincas.find(f => f.id_finca === c.id_parcela)
    return `${c.fecha ? format(new Date(c.fecha), 'dd/MM/yyyy') : '-'} - ${finca?.nombre || 'Sin finca'} - ${c.kg ? c.kg.toFixed(0) + ' kg' : ''} ${c.variedad || ''}`
  }

  if (loading) {
    return (
      <div className="empty-state" aria-busy="true">
        <div className="spinner"></div>
        <p className="mt-16">Cargando ingresos...</p>
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
          <div className="summary-value">{ingresos.filter(i => i.fecha && i.fecha.startsWith(filterMonth)).length}</div>
          <div className="summary-label">Ingresos este mes</div>
        </div>
        <div className="summary-card success">
          <div className="summary-value">{totalMes.toFixed(2)} €</div>
          <div className="summary-label">Total este mes</div>
        </div>
      </div>

      {/* Barra de búsqueda y exportar */}
      <div className="fincas-toolbar mb-16" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="search-box" style={{ flex: 1, minWidth: 200 }}>
          <span className="search-icon"></span>
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por concepto, origen..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            aria-label="Buscar ingresos"
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')} aria-label="Limpiar búsqueda"></button>
          )}
        </div>
        <button className="btn btn-small btn-accent" onClick={() => {
          const headers = ['fecha', 'origen', 'concepto', 'cantidad', 'observaciones']
          const rows = filteredIngresos.map(i => ({
            fecha: i.fecha ? format(new Date(i.fecha), 'dd/MM/yyyy') : '',
            origen: i.origen || '',
            concepto: i.concepto || '',
            cantidad: i.cantidad ?? 0,
            observaciones: i.observaciones || ''
          }))
          downloadCSV('ingresos_agrotrack', headers, rows)
        }} aria-label="Exportar ingresos como CSV">
           Exportar CSV
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
          {showForm ? ' Cancelar' : '+ Nuevo Ingreso'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-title"> {editingId ? 'Editar Ingreso' : 'Nuevo Ingreso'}</div>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Fecha *</label>
                <input type="date" name="fecha" className="form-input" value={form.fecha} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">Origen *</label>
                <select name="origen" className="form-select" value={form.origen} onChange={handleChange} required>
                  <option value="Cosecha"> Cosecha</option>
                  <option value="Ayuda"> Ayuda / Subvención</option>
                  <option value="Venta"> Venta</option>
                  <option value="Otro"> Otro</option>
                </select>
              </div>
            </div>

            {form.origen === 'Cosecha' && (
              <div className="form-group">
                <label className="form-label">Producción asociada *</label>
                <select name="id_cosecha" className="form-select" value={form.id_cosecha} onChange={handleChange} required>
                  <option value="">Seleccionar cosecha...</option>
                  {cosechas.filter(c => c.kg).map(c => {
                    const finca = fincas.find(f => f.id_finca === c.id_parcela)
                    return (
                      <option key={c.id_cosecha} value={c.id_cosecha}>
                        {c.fecha ? format(new Date(c.fecha), 'dd/MM/yyyy') : '-'} - {finca?.nombre || 'Sin finca'} - {c.kg.toFixed(0)} kg {c.variedad || ''}
                      </option>
                    )
                  })}
                </select>
                {cosechas.filter(c => c.kg).length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--color-warning)', marginTop: 4 }}>
                    No hay cosechas registradas con producción
                  </div>
                )}
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Concepto</label>
                <input type="text" name="concepto" className="form-input" value={form.concepto} onChange={handleChange} placeholder="Descripción del ingreso" />
              </div>
              <div className="form-group">
                <label className="form-label">Cantidad (€) *</label>
                <input type="number" name="cantidad" className="form-input" value={form.cantidad} onChange={handleChange} step="0.01" min="0" required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Observaciones</label>
              <textarea name="observaciones" className="form-textarea" value={form.observaciones} onChange={handleChange} />
            </div>

            <button type="submit" className={`btn btn-primary btn-full ${saving ? 'btn-loading' : ''}`} disabled={saving}>
              {saving ? 'Guardando...' : editingId ? ' Guardar cambios' : ' Registrar ingreso'}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-title"> Ingresos registrados ({filteredIngresos.length})</div>
        {filteredIngresos.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Origen</th>
                  <th>Concepto</th>
                  <th>Producción</th>
                  <th>Cantidad</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredIngresos.map(i => (
                  <tr key={i.id_ingreso}>
                    <td>{i.fecha ? format(new Date(i.fecha), 'dd/MM/yyyy') : '-'}</td>
                    <td>
                      <span className={`badge badge-${i.origen === 'Ayuda' ? 'blue' : i.origen === 'Cosecha' ? 'green' : 'yellow'}`}>
                        {i.origen === 'Cosecha' ? '' : i.origen === 'Ayuda' ? '' : i.origen === 'Venta' ? '' : ''} {i.origen || '-'}
                      </span>
                    </td>
                    <td>{i.concepto || '-'}</td>
                    <td>{i.origen === 'Cosecha' && i.id_cosecha ? getCosechaInfo(i.id_cosecha) : '-'}</td>
                    <td><strong style={{ color: 'var(--color-success)' }}>{i.cantidad ? `${i.cantidad.toFixed(2)} €` : '-'}</strong></td>
                    <td>
                      <button className="btn btn-small btn-accent" onClick={() => handleEdit(i)} aria-label={`Editar ingreso ${i.concepto || i.origen}`}></button>
                      <button className="btn btn-small btn-danger" onClick={() => handleDelete(i.id_ingreso)} aria-label={`Eliminar ingreso ${i.concepto || i.origen}`}></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon"></div>
            <div className="empty-state-text">No hay ingresos registrados</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default IngresosPage
