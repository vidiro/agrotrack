import { useState, useEffect } from 'react'
import { Inbox, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../data/supabaseClient'
import { isMissingTable, fetchAll } from '../utils/fetchAll'
import { gastosInversion } from '../utils/gastos'
import { CATEGORIAS_INVERSION as CATEGORIAS, esAmortizable, cuotaMensual } from '../utils/inversion'
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
  const [gastosInv, setGastosInv] = useState([]) // gastos de categoría «Inversión», para vincular

  const [form, setForm] = useState({
    fecha_compra: format(new Date(), 'yyyy-MM-dd'),
    id_finca: '',
    descripcion: '',
    categoria: 'Maquinaria',
    importe_compra: '',
    meses_amortizacion: 36,
    valor_residual: '',
    id_gasto: '',
    notas: ''
  })

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
        if (isMissingTable(err)) {
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
    fetchAll('gastos_manual', q => q.order('fecha', { ascending: false }))
      .then(({ data }) => setGastosInv(gastosInversion(data || [])))
  }, [])

  // Al vincular un gasto, se rellenan sus datos
  const vincularGasto = (idGasto) => {
    const g = gastosInv.find(x => String(x.id_gasto) === String(idGasto))
    if (!g) { setForm({ ...form, id_gasto: '' }); return }
    setForm({
      ...form,
      id_gasto: String(g.id_gasto),
      fecha_compra: g.fecha ? g.fecha.substring(0, 10) : form.fecha_compra,
      id_finca: g.id_finca || form.id_finca,
      descripcion: form.descripcion || g.concepto || '',
      importe_compra: g.importe ?? form.importe_compra,
    })
  }
  const gastosYaVinculados = new Set(amortizaciones.filter(a => a.id_gasto && a.id !== editingId).map(a => String(a.id_gasto)))

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
      meses_amortizacion: esAmortizable(form) ? (parseInt(form.meses_amortizacion) || 12) : 0,
      valor_residual: esAmortizable(form) ? (parseFloat(form.valor_residual) || 0) : 0,
      notas: form.notas || null
    }
    // Solo se envía si hay vínculo: así la app funciona aunque no se haya aplicado la migración v1.5
    if (form.id_gasto) datos.id_gasto = form.id_gasto
    else if (editingId && amortizaciones.find(a => a.id === editingId)?.id_gasto) datos.id_gasto = null

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
      setError(err.message?.includes('id_gasto')
        ? 'Para vincular gastos hay que aplicar la migración docs/SQL_migracion_v1.5_inversiones.sql en Supabase.'
        : err.message)
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
      id_gasto: '',
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
      meses_amortizacion: item.meses_amortizacion || 36,
      valor_residual: item.valor_residual || '',
      id_gasto: item.id_gasto ? String(item.id_gasto) : '',
      notas: item.notas || ''
    })
    setEditingId(item.id)
    setShowForm(true)
  }

  const getFincaNombre = (id) => {
    const f = fincas.find(f => String(f.id_finca) === String(id))
    return f ? f.nombre : 'General'
  }

  const calcAmortMensual = (item) => cuotaMensual(item)

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
        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Inversiones y amortizaciones</h2>
        <button className="btn btn-primary" onClick={() => { if (showForm) { resetForm() } else { setEditingId(null); setShowForm(true) } }}>
          {showForm ? ' Cancelar' : '+ Nueva'}
        </button>
      </div>

      {/* FORM */}
      {showForm && (
        <div className="card">
          <div className="card-title"> {editingId ? 'Editar inversión' : 'Nueva inversión'}</div>
          <form onSubmit={handleSubmit}>
            {gastosInv.length > 0 && (
              <div className="form-group">
                <label className="form-label">¿Ya está en Gastos? Vincúlalo (opcional)</label>
                <select className="form-select" value={form.id_gasto} onChange={e => vincularGasto(e.target.value)}>
                  <option value="">No vincular</option>
                  {gastosInv.filter(g => !gastosYaVinculados.has(String(g.id_gasto))).map(g => (
                    <option key={g.id_gasto} value={g.id_gasto}>
                      {g.fecha ? g.fecha.substring(0, 10) : '—'} · {g.concepto || 'Sin concepto'} · {(parseFloat(g.importe) || 0).toFixed(2)} €
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                  Si vinculas el gasto, la compra se cuenta una sola vez en la recuperación de la inversión.
                </div>
              </div>
            )}

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
              <input type="text" className="form-input" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Ej: Parcela 12 del polígono 7 / Tractor John Deere 5075E" required />
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
                {form.categoria === 'Terreno' && (
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                    Incluye notaría, registro e impuesto de transmisiones. Si la parcela venía plantada, registra la plantación aparte como «Plantación».
                  </div>
                )}
              </div>
            </div>

            {!esAmortizable(form) && (
              <div className="alert alert-info" style={{ marginBottom: 16 }}>
                El terreno no se amortiza: queda como inversión de la finca (cuenta para su recuperación), pero no es un coste de ninguna campaña.
              </div>
            )}

            {esAmortizable(form) && (
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
                  <option value={180}>180 meses (15 años)</option>
                  <option value={240}>240 meses (20 años)</option>
                  <option value={300}>300 meses (25 años)</option>
                  <option value={360}>360 meses (30 años)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Valor residual (€)</label>
                <input type="number" className="form-input" value={form.valor_residual} onChange={e => setForm({ ...form, valor_residual: e.target.value })} step="0.01" min="0" placeholder="0.00" />
              </div>
            </div>

            )}

            {form.importe_compra && esAmortizable(form) && (
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
        <div className="card-title">Inversiones y activos ({amortizaciones.length})</div>
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
                      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{item.categoria} · {esAmortizable(item) ? `${item.meses_amortizacion} meses` : 'no se amortiza'}{item.id_gasto ? ' · vinculado a Gastos' : ''}</div>
                    </td>
                    <td>{getFincaNombre(item.id_finca)}</td>
                    <td style={{ textAlign: 'right' }}>{(item.importe_compra || 0).toFixed(2)} €</td>
                    <td style={{ textAlign: 'right' }}>{esAmortizable(item) ? `${calcAmortMensual(item).toFixed(2)} €` : '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{esAmortizable(item) ? `${calcAmortAnual(item).toFixed(2)} €` : '—'}</td>
                    <td>
                      <button className="btn btn-small btn-accent" onClick={() => handleEdit(item)} aria-label={`Editar ${item.descripcion}`}><Pencil size={16} aria-hidden="true" /></button>
                      <button className="btn btn-small btn-danger" onClick={() => handleDelete(item.id)} aria-label={`Eliminar ${item.descripcion}`}><Trash2 size={16} aria-hidden="true" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon" aria-hidden="true"><Inbox size={40} strokeWidth={1.5} /></div>
            <div className="empty-state-text">No hay inversiones registradas</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8 }}>
              Registra compras de tierra, plantaciones, riego, tractores o construcciones
            </div>
          </div>
        )}
      </div>

      {/* NOTE */}
      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
          <strong>¿Cómo funciona?</strong><br />
          Cuando compras algo caro que dura años (tractor, riego, plantación…), su coste se reparte entre los años que lo vas a usar.
          Por ejemplo: un tractor de 30.000 € con vida útil de 10 años = 3.000 €/año de amortización. La cuota aparece en el informe PDF.<br />
          <strong>El terreno no se amortiza</strong>: se registra con categoría «Terreno» y cuenta como inversión de la finca.<br />
          Las compras apuntadas en <strong>Gastos</strong> con categoría «Inversión» ya cuentan como inversión de su finca (y siguen apareciendo en Gastos para justificar ayudas).
          Regístralas también aquí solo si quieres amortizarlas o marcarlas como terreno, y vincúlalas para no contarlas dos veces.
          En el detalle de cada finca verás cuánto llevas recuperado de todo lo invertido en ella.<br />
          Los años y porcentajes fiscales exactos dependen de tu régimen: confírmalos con tu gestoría.
        </div>
      </div>
    </div>
  )
}

export default AmortizacionesPage
