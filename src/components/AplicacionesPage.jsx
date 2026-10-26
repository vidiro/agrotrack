import { useState, useEffect } from 'react'
import { Inbox, Pencil, Search, Trash2, X } from 'lucide-react'
import { supabase } from '../data/supabaseClient'
import { fetchAll } from '../utils/fetchAll'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { laborFincaIds } from '../utils/labores'

const CAMPOS_CUADERNO = ['fecha_aplicacion', 'num_registro', 'cultivo', 'superficie_ha', 'aplicador', 'carnet_aplicador', 'id_equipo']

function AplicacionesPage({ fincas, personal = [], maquinaria = [], onDataChange }) {
  const [aplicaciones, setAplicaciones] = useState([])
  const [labores, setLabores] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const [form, setForm] = useState({
    id_labor: '',
    producto: '',
    materia_activa: '',
    dosis: '',
    volumen_caldo: '',
    carencia_dias: '',
    justificacion: '',
    observaciones: '',
    fecha_aplicacion: '', num_registro: '', cultivo: '', superficie_ha: '', aplicador: '', carnet_aplicador: '', id_equipo: ''
  })

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [appRes, labRes] = await Promise.all([
        fetchAll('aplicaciones', q => q.order('id_aplicacion', { ascending: false })),
        fetchAll('labores', q => q.order('fecha', { ascending: false }))
      ])
      if (appRes.error) throw appRes.error
      if (labRes.error) throw labRes.error
      setAplicaciones(appRes.data || [])
      setLabores(labRes.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const nombresFincas = (l) => [...new Set(laborFincaIds(l))].map(id => fincas.find(f => String(f.id_finca) === id)?.nombre).filter(Boolean).join(', ') || 'Sin finca'

  // Aplicadores ya usados (para autocompletar el nº de carné)
  const aplicadores = [...new Map(aplicaciones.filter(a => a.aplicador).map(a => [a.aplicador.toLowerCase(), a])).values()]

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name === 'aplicador') {
      const previo = aplicadores.find(a => a.aplicador.toLowerCase() === value.trim().toLowerCase())
      setForm({ ...form, aplicador: value, carnet_aplicador: form.carnet_aplicador || previo?.carnet_aplicador || '' })
      return
    }
    if (name === 'id_labor') {
      // Al elegir la labor, se propone su fecha como fecha de aplicación
      const l = labores.find(x => String(x.id_labor) === String(value))
      setForm({ ...form, id_labor: value, fecha_aplicacion: form.fecha_aplicacion || (l?.fecha || '').substring(0, 10) })
      return
    }
    setForm({ ...form, [name]: value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    const datos = {
      ...form,
      id_labor: form.id_labor || null,
      dosis: form.dosis ? parseFloat(form.dosis) : null,
      volumen_caldo: form.volumen_caldo ? parseFloat(form.volumen_caldo) : null,
      carencia_dias: form.carencia_dias ? parseInt(form.carencia_dias) : null,
      justificacion: form.justificacion || null,
      observaciones: form.observaciones || null
    }
    // Datos del cuaderno de campo (migración v1.8): solo se envían si hay alguno
    for (const c of CAMPOS_CUADERNO) delete datos[c]
    const original = editingId ? aplicaciones.find(a => a.id_aplicacion === editingId) : null
    if (CAMPOS_CUADERNO.some(c => String(form[c] || '').trim() || original?.[c])) {
      datos.fecha_aplicacion = form.fecha_aplicacion || null
      datos.num_registro = form.num_registro.trim() || null
      datos.cultivo = form.cultivo.trim() || null
      datos.superficie_ha = form.superficie_ha ? parseFloat(form.superficie_ha) : null
      datos.aplicador = form.aplicador.trim() || null
      datos.carnet_aplicador = form.carnet_aplicador.trim() || null
      datos.id_equipo = form.id_equipo || null
    }

    try {
      if (editingId) {
        const { error: err } = await supabase.from('aplicaciones').update(datos).eq('id_aplicacion', editingId)
        if (err) throw new Error(err.message)
        setSuccess('Aplicación actualizada')
      } else {
        const { error: err } = await supabase.from('aplicaciones').insert([datos])
        if (err) throw new Error(err.message)
        setSuccess('Aplicación registrada')
      }

      await loadData()
      onDataChange?.()
      setForm({
        id_labor: '', producto: '', materia_activa: '', dosis: '',
        volumen_caldo: '', carencia_dias: '', justificacion: '', observaciones: '',
        fecha_aplicacion: '', num_registro: '', cultivo: '', superficie_ha: '', aplicador: '', carnet_aplicador: '', id_equipo: ''
      })
      setEditingId(null)
      setShowForm(false)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(/fecha_aplicacion|num_registro|aplicador|superficie_ha|id_equipo|cultivo/.test(err.message || '')
        ? 'Para guardar los datos del cuaderno de campo hay que aplicar la migración docs/SQL_migracion_v1.8_papeleo.sql en Supabase.'
        : err.message)
      // NO cerramos el formulario si falla
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (app) => {
    setForm({
      id_labor: app.id_labor || '',
      producto: app.producto || '',
      materia_activa: app.materia_activa || '',
      dosis: app.dosis || '',
      volumen_caldo: app.volumen_caldo || '',
      carencia_dias: app.carencia_dias || '',
      justificacion: app.justificacion || '',
      observaciones: app.observaciones || '',
      fecha_aplicacion: app.fecha_aplicacion || '',
      num_registro: app.num_registro || '',
      cultivo: app.cultivo || '',
      superficie_ha: app.superficie_ha ?? '',
      aplicador: app.aplicador || '',
      carnet_aplicador: app.carnet_aplicador || '',
      id_equipo: app.id_equipo || ''
    })
    setEditingId(app.id_aplicacion)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta aplicación?')) return
    try {
      const { error: err } = await supabase.from('aplicaciones').delete().eq('id_aplicacion', id)
      if (err) throw err
      await loadData()
      onDataChange?.()
    } catch (err) {
      setError(err.message)
    }
  }

  const laborInfo = (id) => {
    const l = labores.find(l => String(l.id_labor) === String(id))
    if (!l) return '-'
    return `${l.fecha ? format(new Date(l.fecha + 'T00:00:00'), 'dd/MM') : '-'} ${nombresFincas(l)}`
  }

  // Filtrar por búsqueda
  const filteredAplicaciones = aplicaciones.filter(a => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    return (a.producto || '').toLowerCase().includes(term) ||
           (a.materia_activa || '').toLowerCase().includes(term) ||
           (a.justificacion || '').toLowerCase().includes(term)
  })

  if (loading) {
    return (
      <div className="empty-state" aria-busy="true">
        <div className="spinner"></div>
        <p className="mt-16">Cargando aplicaciones...</p>
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

      {/* Barra de búsqueda */}
      <div className="fincas-toolbar mb-16">
        <div className="search-box">
          <span className="search-icon" aria-hidden="true"><Search size={18} /></span>
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por producto, materia activa..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            aria-label="Buscar aplicaciones"
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')} aria-label="Limpiar búsqueda"><X size={18} aria-hidden="true" /></button>
          )}
        </div>
        <button
          className="btn btn-primary"
          onClick={() => { setShowForm(!showForm); setEditingId(null) }}
        >
          {showForm ? ' Cancelar' : '+ Nueva Aplicación'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-title">{editingId ? 'Editar tratamiento' : 'Nuevo tratamiento fitosanitario'}</div>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Labor asociada</label>
                <select name="id_labor" className="form-select" value={form.id_labor} onChange={handleChange}>
                  <option value="">Seleccionar labor...</option>
                  {labores.filter(l => laborFincaIds(l).length > 0).map(l => (
                    <option key={l.id_labor} value={l.id_labor}>
                      {l.fecha ? format(new Date(l.fecha + 'T00:00:00'), 'dd/MM/yyyy') : '-'} - {nombresFincas(l)}{l.tipo_trabajo ? ` · ${l.tipo_trabajo}` : ''}
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
                <label className="form-label">Carencia (días)</label>
                <input type="number" name="carencia_dias" className="form-input" value={form.carencia_dias} onChange={handleChange} min="0" />
              </div>
            </div>
            <fieldset style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <legend style={{ fontSize: 13, fontWeight: 600, padding: '0 6px' }}>Para el cuaderno de campo</legend>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="ap-fecha">Fecha de aplicación</label>
                  <input id="ap-fecha" type="date" name="fecha_aplicacion" className="form-input" value={form.fecha_aplicacion} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="ap-registro">Nº de registro del producto</label>
                  <input id="ap-registro" type="text" name="num_registro" className="form-input" value={form.num_registro} onChange={handleChange} placeholder="Ej: ES-00123" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="ap-cultivo">Cultivo</label>
                  <input id="ap-cultivo" type="text" name="cultivo" className="form-input" list="ap-cultivos" value={form.cultivo} onChange={handleChange} placeholder="Viña, olivar…" />
                  <datalist id="ap-cultivos"><option value="Viña" /><option value="Olivar" /></datalist>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="ap-sup">Superficie tratada (ha)</label>
                  <input id="ap-sup" type="number" name="superficie_ha" className="form-input" value={form.superficie_ha} onChange={handleChange} step="0.01" min="0" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="ap-aplicador">Aplicador</label>
                  <input id="ap-aplicador" type="text" name="aplicador" className="form-input" list="ap-aplicadores" value={form.aplicador} onChange={handleChange} placeholder="Nombre de quien trata" />
                  <datalist id="ap-aplicadores">
                    {[...new Set([...personal.map(p => p.nombre), ...aplicadores.map(a => a.aplicador)].filter(Boolean))].map(n => <option key={n} value={n} />)}
                  </datalist>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="ap-carnet">Nº carné de aplicador</label>
                  <input id="ap-carnet" type="text" name="carnet_aplicador" className="form-input" value={form.carnet_aplicador} onChange={handleChange} />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="ap-equipo">Equipo de aplicación</label>
                <select id="ap-equipo" name="id_equipo" className="form-select" value={form.id_equipo} onChange={handleChange}>
                  <option value="">—</option>
                  {maquinaria.map(m => <option key={m.id_equipo} value={m.id_equipo}>{m.tipo} {m.marca_modelo ? `· ${m.marca_modelo}` : ''}</option>)}
                </select>
              </div>
            </fieldset>
            <div className="form-group">
              <label className="form-label">Justificación (plaga o enfermedad)</label>
              <textarea name="justificacion" className="form-textarea" value={form.justificacion} onChange={handleChange} placeholder="Motivo de la aplicación..." />
            </div>
            <div className="form-group">
              <label className="form-label">Observaciones</label>
              <textarea name="observaciones" className="form-textarea" value={form.observaciones} onChange={handleChange} />
            </div>
            <button type="submit" className={`btn btn-primary btn-full ${saving ? 'btn-loading' : ''}`} disabled={saving}>
              {saving ? 'Guardando...' : editingId ? ' Guardar cambios' : ' Registrar aplicación'}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-title"> Aplicaciones registradas ({filteredAplicaciones.length})</div>
        {filteredAplicaciones.length > 0 ? (
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
                {filteredAplicaciones.map(a => (
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
                      <button className="btn btn-small btn-accent" onClick={() => handleEdit(a)} aria-label={`Editar aplicación ${a.producto}`}><Pencil size={16} aria-hidden="true" /></button>
                      <button className="btn btn-small btn-danger" onClick={() => handleDelete(a.id_aplicacion)} aria-label={`Eliminar aplicación ${a.producto}`}><Trash2 size={16} aria-hidden="true" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon" aria-hidden="true"><Inbox size={40} strokeWidth={1.5} /></div>
            <div className="empty-state-text">No hay aplicaciones registradas</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AplicacionesPage
