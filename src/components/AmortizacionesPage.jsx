import { useState, useEffect } from 'react'
import { supabase } from '../data/supabaseClient'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

function AmortizacionesPage({ fincas, onDataChange }) {
  const [amortizaciones, setAmortizaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    fecha_compra: format(new Date(), 'yyyy-MM-dd'),
    id_finca: '',
    descripcion: '',
    categoria: 'Maquinaria',
    importe_compra: '',
    meses_amortizacion: 36,
    valor_residual: '',
    notas: ''
  })

  const CATEGORIAS = ['Maquinaria', 'Equipo', 'Vehículo', 'Construcción', 'Herramienta', 'Otro']

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: err } = await supabase
        .from('amortizaciones')
        .select('*')
        .order('fecha_compra', { ascending: false })
      if (err) {
        // Table might not exist yet
        if (err.message?.includes('Could not find the table')) {
          setAmortizaciones([])
          setError('')
        } else {
          throw err
        }
      } else {
        setAmortizaciones(data || [])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!form.descripcion || !form.importe_compra) {
      setError('Descripción e importe son obligatorios')
      return
    }

    setSaving(true)

    const datos = {
      fecha_compra: form.fecha_compra,
      id_finca: form.id_finca || null,
      descripcion: form.descripcion,
      categoria: form.categoria,
      importe_compra: parseFloat(form.importe_compra),
      meses_amortizacion: parseInt(form.meses_amortizacion) || 12,
      valor_residual: parseFloat(form.valor_residual) || 0,
      notas: form.notas || null
    }

    try {
      if (editingId) {
        const { error: err } = await supabase.from('amortizaciones').update(datos).eq('id', editingId)
        if (err) throw new Error(err.message)
        setSuccess('Amortización actualizada')
      } else {
        const { error: err } = await supabase.from('amortizaciones').insert([datos])
        if (err) throw new Error(err.message)
        setSuccess('Amortización registrada')
      }
      await loadData()
      onDataChange?.()
      resetForm()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta amortización?')) return
    try {
      const { error: err } = await supabase.from('amortizaciones').delete().eq('id', id)
      if (err) throw err
      await loadData()
      onDataChange?.()
    } catch (err) {
      setError(err.message)
    }
  }

  const resetForm = () => {
    setForm({
      fecha_compra: format(new Date(), 'yyyy-MM-dd'),
      id_finca: '',
      descripcion: '',
      categoria: 'Maquinaria',
      importe_compra: '',
      meses_amortizacion: 36,
      valor_residual: '',
      notas: ''
    })
    setEditingId(null)
    setShowForm(false)
  }

  const handleEdit = (item) => {
    setForm({
      fecha_compra: item.fecha_compra || format(new Date(), 'yyyy-MM-dd'),
      id_finca: item.id_finca || '',
      descripcion: item.descripcion || '',
      categoria: item.categoria || 'Otro',
      importe_compra: item.importe_compra || '',
      meses_amortizacion: item.meses_amortizacion || 12,
      valor_residual: item.valor_residual || '',
      notas: item.notas || ''
    })
    setEditingId(item.id)
    setShowForm(true)
  }

  const getFincaNombre = (id) => {
    const f = fincas.find(f => String(f.id_finca) === String(id))
    return f ? f.nombre : 'General'
  }

  const calcAmortMensual = (item) => {
    const importe = parseFloat(item.importe_compra) || 0
    const residual = parseFloat(item.valor_residual) || 0
    const meses = parseInt(item.meses_amortizacion) || 12
    return (importe - residual) / meses
  }

  const calcAmortAnual = (item) => calcAmortMensual(item) * 12

  if (loading) {
    return (
      <div className="empty-state" aria-busy="true">
        <div className="spinner"></div>
        <p className="mt-16">Cargando amortizaciones...</p>
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem' }}> Amortizaciones</h2>
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingId(null) }}>
          {showForm ? ' Cancelar' : '+ Nueva'}
        </button>
      </div>

      {/* FORM */}
      {showForm && (
        <div className="card">
          <div className="card-title"> {editingId ? 'Editar amortización' : 'Nueva amortización'}</div>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Fecha de compra *</label>
                <input type="date" className="form-input" value={form.fecha_compra} onChange={e => setForm({ ...form, fecha_compra: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Finca</label>
                <select className="form-select" value={form.id_finca} onChange={e => setForm({ ...form, id_finca: e.target.value })}>
                  <option value="">General</option>
                  {fincas.map(f => <option key={f.id_finca} value={f.id_finca}>{f.nombre}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Descripción *</label>
              <input type="text" className="form-input" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Ej: Tractor John Deere 5075E" required />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Categoría</label>
                <select className="form-select" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Importe de compra (€) *</label>
                <input type="number" className="form-input" value={form.importe_compra} onChange={e => setForm({ ...form, importe_compra: e.target.value })} step="0.01" min="0" placeholder="0.00" required />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Meses de amortización</label>
                <select className="form-select" value={form.meses_amortizacion} onChange={e => setForm({ ...form, meses_amortizacion: e.target.value })}>
                  <option value={12}>12 meses (1 año)</option>
                  <option value={24}>24 meses (2 años)</option>
                  <option value={36}>36 meses (3 años)</option>
                  <option value={60}>60 meses (5 años)</option>
                  <option value={72}>72 meses (6 años)</option>
                  <option value={120}>120 meses (10 años)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Valor residual (€)</label>
                <input type="number" className="form-input" value={form.valor_residual} onChange={e => setForm({ ...form, valor_residual: e.target.value })} step="0.01" min="0" placeholder="0.00" />
              </div>
            </div>

            {form.importe_compra && (
              <div style={{ background: 'var(--color-bg)', borderRadius: 12, padding: 12, marginBottom: 16, border: '1px solid var(--color-border)' }}>
                <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--color-primary)', fontSize: 13 }}> Amortización calculada</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>Mensual:</span>
                  <strong>{calcAmortMensual(form).toFixed(2)} €</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>Anual:</span>
                  <strong>{calcAmortAnual(form).toFixed(2)} €</strong>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Notas</label>
              <textarea className="form-textarea" value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} placeholder="Observaciones..." />
            </div>

            <button type="submit" className={`btn btn-primary btn-full ${saving ? 'btn-loading' : ''}`} disabled={saving}>
              {saving ? 'Guardando...' : editingId ? ' Guardar cambios' : ' Registrar'}
            </button>
          </form>
        </div>
      )}

      {/* LIST */}
      <div className="card">
        <div className="card-title"> Activos ({amortizaciones.length})</div>
        {amortizaciones.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th>Finca</th>
                  <th>Compra</th>
                  <th>Amort. mensual</th>
                  <th>Amort. anual</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {amortizaciones.map(item => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{item.descripcion}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{item.categoria} · {item.meses_amortizacion} meses</div>
                    </td>
                    <td>{getFincaNombre(item.id_finca)}</td>
                    <td style={{ textAlign: 'right' }}>{(item.importe_compra || 0).toFixed(2)} €</td>
                    <td style={{ textAlign: 'right' }}>{calcAmortMensual(item).toFixed(2)} €</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{calcAmortAnual(item).toFixed(2)} €</td>
                    <td>
                      <button className="btn btn-small btn-accent" onClick={() => handleEdit(item)} aria-label={`Editar ${item.descripcion}`}></button>
                      <button className="btn btn-small btn-danger" onClick={() => handleDelete(item.id)} aria-label={`Eliminar ${item.descripcion}`}></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon"></div>
            <div className="empty-state-text">No hay amortizaciones registradas</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8 }}>
              Registra compras importantes (tractores, equipos, construcciones) para calcular su coste real por año
            </div>
          </div>
        )}
      </div>

      {/* NOTE */}
      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
          <strong> ¿Cómo funciona la amortización?</strong><br />
          Cuando compras algo caro (tractor, equipo...), su coste se distribuye a lo largo de los años que vas a usarlo.
          Por ejemplo: un tractor de 30.000€ con vida útil de 10 años = 2.500€/año de amortización.
          Este coste se incluye automáticamente en los informes económicos.
        </div>
      </div>
    </div>
  )
}

export default AmortizacionesPage
