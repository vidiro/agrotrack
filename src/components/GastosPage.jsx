import { useState, useEffect } from 'react'
import { Inbox, Paperclip, Pencil, Search, Trash2, X } from 'lucide-react'
import { supabase } from '../data/supabaseClient'
import { fetchAll } from '../utils/fetchAll'
import { insertarConCola } from '../utils/offline'
import { gastosCorrientes, gastosInversion } from '../utils/gastos'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { downloadCSV } from '../utils/csvExport'
import { CAMPOS_FACTURA, nifValido, limpiarNIF, mensajeErrorFactura } from '../utils/facturas'
import { useProveedores, autocompletarEmpresa } from '../utils/proveedores'

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

  const { empresas, buscar, guardar } = useProveedores(gastos)

  const [form, setForm] = useState({
    fecha: format(new Date(), 'yyyy-MM-dd'),
    id_finca: '',
    concepto: '',
    categoria: 'Material',
    importe: '',
    forma_pago: 'Transferencia',
    observaciones: '',
    num_factura: '',
    proveedor: '',
    nif_proveedor: ''
  })

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: err } = await fetchAll('gastos_manual', q => q.order('fecha', { ascending: false }))
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
    // Datos de factura: solo se envían si hay alguno (o si el gasto ya los tenía),
    // así la página sigue funcionando aunque no se haya aplicado la migración v1.6
    for (const c of CAMPOS_FACTURA) delete datos[c]
    const original = editingId ? gastos.find(g => g.id_gasto === editingId) : null
    if (CAMPOS_FACTURA.some(c => (form[c] || '').trim() || original?.[c])) {
      datos.num_factura = form.num_factura.trim() || null
      datos.proveedor = form.proveedor.trim() || null
      datos.nif_proveedor = limpiarNIF(form.nif_proveedor) || null
    }

    try {
      if (editingId) {
        const { error: err } = await supabase.from('gastos_manual').update(datos).eq('id_gasto', editingId)
        if (err) throw err
        setSuccess('Gasto actualizado')
      } else {
        const { error: err, encolado } = await insertarConCola('gastos_manual', datos)
        if (err) throw err
        setSuccess(encolado ? 'Sin cobertura: el gasto se enviará al recuperar la señal' : 'Gasto registrado')
      }
      
      if (datos.proveedor) await guardar(datos.proveedor, datos.nif_proveedor) // empresa guardada para autocompletar
      await loadData()
      onDataChange?.()
      setForm({
        fecha: format(new Date(), 'yyyy-MM-dd'),
        id_finca: '', concepto: '', categoria: 'Material', importe: '',
        forma_pago: 'Transferencia', observaciones: '',
        num_factura: '', proveedor: '', nif_proveedor: ''
      })
      setEditingId(null)
      setShowForm(false)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(mensajeErrorFactura(err))
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
      observaciones: g.observaciones || '',
      num_factura: g.num_factura || '',
      proveedor: g.proveedor || '',
      nif_proveedor: g.nif_proveedor || ''
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

  const gastosDelMes = gastos.filter(g => g.fecha && g.fecha.startsWith(filterMonth))
  // Las inversiones se listan (justificación de ayudas) pero no suman como gasto corriente
  const totalMes = gastosCorrientes(gastosDelMes).reduce((sum, g) => sum + (g.importe || 0), 0)
  const totalInversionMes = gastosInversion(gastosDelMes).reduce((sum, g) => sum + (g.importe || 0), 0)


  // Filtrar por búsqueda
  const filteredGastos = gastos.filter(g => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    return (g.concepto || '').toLowerCase().includes(term) ||
           (g.categoria || '').toLowerCase().includes(term) ||
           (g.forma_pago || '').toLowerCase().includes(term) ||
           (g.proveedor || '').toLowerCase().includes(term) ||
           (g.num_factura || '').toLowerCase().includes(term) ||
           (g.nif_proveedor || '').toLowerCase().includes(term)
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
      {success && <div className="alert alert-success" role="alert"> {success}</div>}
      {error && (
        <div className="alert alert-error" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span> {error}</span>
          <button className="btn btn-small btn-primary" onClick={loadData} aria-label="Reintentar carga"> Reintentar</button>
        </div>
      )}

      <div className="summary-grid" style={{ marginBottom: 16 }}>
        <div className="summary-card">
          <div className="summary-value">{gastos.filter(g => g.fecha && g.fecha.startsWith(filterMonth)).length}</div>
          <div className="summary-label">Gastos este mes</div>
        </div>
        <div className="summary-card danger">
          <div className="summary-value">{totalMes.toFixed(2)} €</div>
          <div className="summary-label">Total este mes{totalInversionMes > 0 ? ' (sin inversiones)' : ''}</div>
        </div>
        {totalInversionMes > 0 && (
          <div className="summary-card accent">
            <div className="summary-value">{totalInversionMes.toFixed(2)} €</div>
            <div className="summary-label">Inversiones este mes</div>
          </div>
        )}
      </div>

      {/* Barra de búsqueda y exportar */}
      <div className="fincas-toolbar mb-16" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="search-box" style={{ flex: 1, minWidth: 200 }}>
          <span className="search-icon" aria-hidden="true"><Search size={18} /></span>
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por concepto, categoría, empresa, nº factura..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            aria-label="Buscar gastos"
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')} aria-label="Limpiar búsqueda"><X size={18} aria-hidden="true" /></button>
          )}
        </div>
        <button className="btn btn-small btn-accent" onClick={() => {
          const headers = ['fecha', 'concepto', 'categoria', 'importe', 'forma_pago', 'empresa', 'nif_cif', 'num_factura', 'observaciones']
          const rows = filteredGastos.map(g => ({
            fecha: g.fecha ? format(new Date(g.fecha), 'dd/MM/yyyy') : '',
            concepto: g.concepto || '',
            categoria: g.categoria || '',
            importe: g.importe ?? 0,
            forma_pago: g.forma_pago || '',
            empresa: g.proveedor || '',
            nif_cif: g.nif_proveedor || '',
            num_factura: g.num_factura || '',
            observaciones: g.observaciones || ''
          }))
          downloadCSV('gastos_agrotrack', headers, rows)
        }} aria-label="Exportar a CSV">
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
          {showForm ? ' Cancelar' : '+ Nuevo Gasto'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-title"> {editingId ? 'Editar Gasto' : 'Nuevo Gasto'}</div>
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
                {form.categoria === 'Inversión' && (
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                    Compra de tierra, plantación, maquinaria… Se guarda aquí como justificante, pero no resta en los balances: cuenta como inversión de la finca que elijas.
                  </div>
                )}
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
            <fieldset style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <legend style={{ fontSize: 13, fontWeight: 600, padding: '0 6px' }}>Datos de factura (opcional)</legend>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="g-proveedor">Empresa</label>
                  <input id="g-proveedor" type="text" name="proveedor" className="form-input" list="g-empresas" value={form.proveedor}
                    onChange={e => setForm(autocompletarEmpresa(form, 'proveedor', e.target.value, buscar))}
                    placeholder="Nombre de la empresa" />
                  <datalist id="g-empresas">{empresas.map(x => <option key={x.proveedor} value={x.proveedor} />)}</datalist>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="g-nif">NIF/CIF</label>
                  <input id="g-nif" type="text" name="nif_proveedor" className="form-input" value={form.nif_proveedor} onChange={e => setForm(autocompletarEmpresa(form, 'nif_proveedor', e.target.value, buscar))} placeholder="B12345678" autoCapitalize="characters" />
                  {form.nif_proveedor && !nifValido(form.nif_proveedor) && (
                    <div style={{ fontSize: 12, color: 'var(--color-warning)', marginTop: 4 }}>Revisa el NIF/CIF: el formato o la letra de control no cuadran.</div>
                  )}
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="g-numfra">Nº de factura</label>
                <input id="g-numfra" type="text" name="num_factura" className="form-input" value={form.num_factura} onChange={handleChange} placeholder="Ej: F-2026/0123" />
              </div>
            </fieldset>

            <div className="form-group">
              <label className="form-label">Observaciones</label>
              <textarea name="observaciones" className="form-textarea" value={form.observaciones} onChange={handleChange} />
            </div>
            <button type="submit" className={`btn btn-primary btn-full ${saving ? 'btn-loading' : ''}`} disabled={saving}>
              {saving ? 'Guardando...' : editingId ? ' Guardar cambios' : ' Registrar gasto'}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-title"> Gastos registrados ({filteredGastos.length})</div>
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
                    <td>
                      {g.concepto || '-'}
                      {g.adjunto_path && <span title="Tiene foto de la factura" style={{ marginLeft: 6, color: 'var(--color-primary)' }}><Paperclip size={13} aria-label="Con foto" /></span>}
                      {(g.num_factura || g.proveedor) && (
                        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                          {[g.proveedor, g.num_factura && `Fra. ${g.num_factura}`].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td><span className={`badge badge-${g.categoria === 'Inversión' ? 'yellow' : g.categoria === 'Salario' ? 'blue' : 'green'}`}>{g.categoria || '-'}</span></td>
                    <td><strong>{g.importe ? `${g.importe.toFixed(2)} €` : '-'}</strong></td>
                    <td>{g.forma_pago || '-'}</td>
                    <td>
                      <button className="btn btn-small btn-accent" onClick={() => handleEdit(g)} aria-label={`Editar gasto ${g.concepto}`}><Pencil size={16} aria-hidden="true" /></button>
                      <button className="btn btn-small btn-danger" onClick={() => handleDelete(g.id_gasto)} aria-label={`Eliminar gasto ${g.concepto}`}><Trash2 size={16} aria-hidden="true" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon" aria-hidden="true"><Inbox size={40} strokeWidth={1.5} /></div>
            <div className="empty-state-text">No hay gastos registrados</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default GastosPage
