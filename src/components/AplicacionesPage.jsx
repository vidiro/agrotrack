import { useState, useEffect } from 'react'
import { Inbox, Pencil, Search, Trash2, X } from 'lucide-react'
import { supabase } from '../data/supabaseClient'
import { fetchAll } from '../utils/fetchAll'
import { format } from 'date-fns'
import { laborFincaIds } from '../utils/labores'
import { esFertilizante, aportes, leerNPK, textoNPK, TIPOS_FERTILIZANTE, METODOS_APLICACION, UNIDADES_DOSIS } from '../utils/fertilizacion'

// Tratamientos fitosanitarios y abonados (los dos van al cuaderno de explotación)
const CAMPOS_CUADERNO = ['fecha_aplicacion', 'num_registro', 'cultivo', 'superficie_ha', 'aplicador', 'carnet_aplicador', 'id_equipo']
const CAMPOS_ABONO = ['tipo_fertilizante', 'riqueza_n', 'riqueza_p', 'riqueza_k', 'unidad_dosis', 'cantidad_total', 'metodo_aplicacion']

const formVacio = (tipo = 'fitosanitario') => ({
  tipo,
  id_labor: '', producto: '', materia_activa: '', dosis: '', volumen_caldo: '', carencia_dias: '', justificacion: '', observaciones: '',
  fecha_aplicacion: '', num_registro: '', cultivo: '', superficie_ha: '', aplicador: '', carnet_aplicador: '', id_equipo: '',
  tipo_fertilizante: 'Mineral', riqueza_n: '', riqueza_p: '', riqueza_k: '', unidad_dosis: 'kg/ha', cantidad_total: '', metodo_aplicacion: '',
})

const numONull = (v) => (v === '' || v == null ? null : parseFloat(String(v).replace(',', '.')))

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
  const [vista, setVista] = useState('fitosanitario') // fitosanitario | fertilizante
  const [form, setForm] = useState(formVacio())

  const abono = form.tipo === 'fertilizante'

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
  // Abonos ya usados (para autocompletar riqueza y tipo)
  const abonosUsados = [...new Map(aplicaciones.filter(a => esFertilizante(a) && a.producto).map(a => [a.producto.toLowerCase(), a])).values()]

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
    if (name === 'producto' && abono) {
      // Abono ya usado: se rellena su riqueza; o se lee del nombre («NPK 15-15-15»)
      const previo = abonosUsados.find(a => a.producto.toLowerCase() === value.trim().toLowerCase())
      const npk = leerNPK(value.replace(/^[^\d]*/, ''))
      const n = { ...form, producto: value }
      if (previo) Object.assign(n, { tipo_fertilizante: previo.tipo_fertilizante || n.tipo_fertilizante, riqueza_n: previo.riqueza_n ?? '', riqueza_p: previo.riqueza_p ?? '', riqueza_k: previo.riqueza_k ?? '', unidad_dosis: previo.unidad_dosis || n.unidad_dosis, metodo_aplicacion: n.metodo_aplicacion || previo.metodo_aplicacion || '' })
      else if (npk && form.riqueza_n === '' && form.riqueza_p === '' && form.riqueza_k === '') Object.assign(n, { riqueza_n: npk.n, riqueza_p: npk.p, riqueza_k: npk.k })
      setForm(n)
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
      id_labor: form.id_labor || null,
      producto: form.producto.trim(),
      materia_activa: abono ? null : (form.materia_activa || null),
      dosis: numONull(form.dosis),
      volumen_caldo: abono ? null : numONull(form.volumen_caldo),
      carencia_dias: abono ? null : (form.carencia_dias !== '' ? parseInt(form.carencia_dias, 10) : null),
      justificacion: form.justificacion || null,
      observaciones: form.observaciones || null,
    }
    // Datos del cuaderno de campo (migración v1.8): solo se envían si hay alguno
    const original = editingId ? aplicaciones.find(a => a.id_aplicacion === editingId) : null
    if (abono || CAMPOS_CUADERNO.some(c => String(form[c] || '').trim() || original?.[c])) {
      datos.fecha_aplicacion = form.fecha_aplicacion || null
      datos.num_registro = abono ? null : (form.num_registro.trim() || null)
      datos.cultivo = form.cultivo.trim() || null
      datos.superficie_ha = numONull(form.superficie_ha)
      datos.aplicador = form.aplicador.trim() || null
      datos.carnet_aplicador = abono ? null : (form.carnet_aplicador.trim() || null)
      datos.id_equipo = form.id_equipo || null
    }
    // Abonado (migración v2.0)
    if (abono) {
      datos.tipo = 'fertilizante'
      datos.tipo_fertilizante = form.tipo_fertilizante || null
      datos.riqueza_n = numONull(form.riqueza_n)
      datos.riqueza_p = numONull(form.riqueza_p)
      datos.riqueza_k = numONull(form.riqueza_k)
      datos.unidad_dosis = form.unidad_dosis || 'kg/ha'
      datos.cantidad_total = numONull(form.cantidad_total) ?? (aportes(form).kgTotales || null)
      datos.metodo_aplicacion = form.metodo_aplicacion || null
    }

    try {
      if (editingId) {
        const { error: err } = await supabase.from('aplicaciones').update(datos).eq('id_aplicacion', editingId)
        if (err) throw new Error(err.message)
        setSuccess(abono ? 'Abonado actualizado' : 'Tratamiento actualizado')
      } else {
        const { error: err } = await supabase.from('aplicaciones').insert([datos])
        if (err) throw new Error(err.message)
        setSuccess(abono ? 'Abonado registrado' : 'Tratamiento registrado')
      }

      await loadData()
      onDataChange?.()
      setForm(formVacio(vista))
      setEditingId(null)
      setShowForm(false)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      const m = err.message || ''
      setError(new RegExp(CAMPOS_ABONO.join('|') + '|\\btipo\\b').test(m)
        ? 'Para guardar abonados hay que aplicar una vez la migración docs/SQL_migracion_v2.0_abonados.sql en Supabase.'
        : /fecha_aplicacion|num_registro|aplicador|superficie_ha|id_equipo|cultivo/.test(m)
          ? 'Para guardar los datos del cuaderno de campo hay que aplicar la migración docs/SQL_migracion_v1.8_papeleo.sql en Supabase.'
          : m)
      // NO cerramos el formulario si falla
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (app) => {
    const v = (x) => (x ?? '')
    setForm({
      ...formVacio(esFertilizante(app) ? 'fertilizante' : 'fitosanitario'),
      id_labor: v(app.id_labor), producto: v(app.producto), materia_activa: v(app.materia_activa), dosis: v(app.dosis),
      volumen_caldo: v(app.volumen_caldo), carencia_dias: v(app.carencia_dias), justificacion: v(app.justificacion), observaciones: v(app.observaciones),
      fecha_aplicacion: v(app.fecha_aplicacion), num_registro: v(app.num_registro), cultivo: v(app.cultivo), superficie_ha: v(app.superficie_ha),
      aplicador: v(app.aplicador), carnet_aplicador: v(app.carnet_aplicador), id_equipo: v(app.id_equipo),
      tipo_fertilizante: app.tipo_fertilizante || 'Mineral', riqueza_n: v(app.riqueza_n), riqueza_p: v(app.riqueza_p), riqueza_k: v(app.riqueza_k),
      unidad_dosis: app.unidad_dosis || 'kg/ha', cantidad_total: v(app.cantidad_total), metodo_aplicacion: v(app.metodo_aplicacion),
    })
    setEditingId(app.id_aplicacion)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id) => {
    if (!confirm(vista === 'fertilizante' ? '¿Eliminar este abonado?' : '¿Eliminar este tratamiento?')) return
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
  const fechaDe = (a) => {
    const f = a.fecha_aplicacion || labores.find(l => String(l.id_labor) === String(a.id_labor))?.fecha
    return f ? format(new Date(String(f).substring(0, 10) + 'T00:00:00'), 'dd/MM/yyyy') : '-'
  }

  const cambiarVista = (t) => {
    setVista(t)
    if (!editingId) setForm(formVacio(t))
  }

  // Filtrar por tipo y búsqueda
  const delTipo = aplicaciones.filter(a => (vista === 'fertilizante' ? esFertilizante(a) : !esFertilizante(a)))
  const filteredAplicaciones = delTipo.filter(a => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    return (a.producto || '').toLowerCase().includes(term) ||
           (a.materia_activa || '').toLowerCase().includes(term) ||
           (a.tipo_fertilizante || '').toLowerCase().includes(term) ||
           (a.justificacion || '').toLowerCase().includes(term)
  })
  const numAbonos = aplicaciones.filter(esFertilizante).length

  if (loading) {
    return (
      <div className="empty-state" aria-busy="true">
        <div className="spinner"></div>
        <p className="mt-16">Cargando tratamientos...</p>
      </div>
    )
  }

  const ap = aportes(form)

  return (
    <div>
      {success && <div className="alert alert-success" role="alert"> {success}</div>}
      {error && (
        <div className="alert alert-error" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span> {error}</span>
          <button className="btn btn-small btn-primary" onClick={loadData} aria-label="Reintentar"> Reintentar</button>
        </div>
      )}

      <div className="chips" role="tablist" aria-label="Tipo" style={{ marginBottom: 16 }}>
        <button type="button" role="tab" aria-selected={vista === 'fitosanitario'} className={`chip${vista === 'fitosanitario' ? ' sel' : ''}`} onClick={() => cambiarVista('fitosanitario')}>
          Fitosanitarios <small style={{ display: 'inline', marginLeft: 4 }}>({aplicaciones.length - numAbonos})</small>
        </button>
        <button type="button" role="tab" aria-selected={vista === 'fertilizante'} className={`chip${vista === 'fertilizante' ? ' sel' : ''}`} onClick={() => cambiarVista('fertilizante')}>
          Abonados <small style={{ display: 'inline', marginLeft: 4 }}>({numAbonos})</small>
        </button>
      </div>

      {/* Barra de búsqueda */}
      <div className="fincas-toolbar mb-16">
        <div className="search-box">
          <span className="search-icon" aria-hidden="true"><Search size={18} /></span>
          <input
            type="text"
            className="search-input"
            placeholder={vista === 'fertilizante' ? 'Buscar por abono o tipo...' : 'Buscar por producto, materia activa...'}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            aria-label="Buscar"
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')} aria-label="Limpiar búsqueda"><X size={18} aria-hidden="true" /></button>
          )}
        </div>
        <button
          className="btn btn-primary"
          onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(formVacio(vista)) }}
        >
          {showForm ? ' Cancelar' : vista === 'fertilizante' ? '+ Nuevo abonado' : '+ Nuevo tratamiento'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-title">{editingId ? (abono ? 'Editar abonado' : 'Editar tratamiento') : (abono ? 'Nuevo abonado' : 'Nuevo tratamiento fitosanitario')}</div>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="ap-labor">Labor asociada</label>
                <select id="ap-labor" name="id_labor" className="form-select" value={form.id_labor} onChange={handleChange}>
                  <option value="">Seleccionar labor...</option>
                  {labores.filter(l => laborFincaIds(l).length > 0).map(l => (
                    <option key={l.id_labor} value={l.id_labor}>
                      {l.fecha ? format(new Date(l.fecha + 'T00:00:00'), 'dd/MM/yyyy') : '-'} - {nombresFincas(l)}{l.tipo_trabajo ? ` · ${l.tipo_trabajo}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="ap-producto">{abono ? 'Abono *' : 'Producto *'}</label>
                <input id="ap-producto" type="text" name="producto" className="form-input" value={form.producto} onChange={handleChange} required
                  placeholder={abono ? 'Ej.: NPK 15-15-15, urea, estiércol de oveja' : 'Nombre comercial'} list={abono ? 'ap-abonos' : undefined} />
                {abono && <datalist id="ap-abonos">{abonosUsados.map(a => <option key={a.producto} value={a.producto} />)}</datalist>}
              </div>
              {!abono && (
                <div className="form-group">
                  <label className="form-label" htmlFor="ap-materia">Materia activa</label>
                  <input id="ap-materia" type="text" name="materia_activa" className="form-input" value={form.materia_activa} onChange={handleChange} placeholder="Principio activo" />
                </div>
              )}
              {abono && (
                <div className="form-group">
                  <label className="form-label" htmlFor="ap-tipofert">Tipo de abono</label>
                  <select id="ap-tipofert" name="tipo_fertilizante" className="form-select" value={form.tipo_fertilizante} onChange={handleChange}>
                    {TIPOS_FERTILIZANTE.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}
            </div>

            {abono ? (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="ap-n">Riqueza N (%)</label>
                    <input id="ap-n" type="text" inputMode="decimal" name="riqueza_n" className="form-input" value={form.riqueza_n} onChange={handleChange} placeholder="15" />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="ap-p">Riqueza P₂O₅ (%)</label>
                    <input id="ap-p" type="text" inputMode="decimal" name="riqueza_p" className="form-input" value={form.riqueza_p} onChange={handleChange} placeholder="15" />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="ap-k">Riqueza K₂O (%)</label>
                    <input id="ap-k" type="text" inputMode="decimal" name="riqueza_k" className="form-input" value={form.riqueza_k} onChange={handleChange} placeholder="15" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="ap-dosis">Dosis</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input id="ap-dosis" type="text" inputMode="decimal" name="dosis" className="form-input" value={form.dosis} onChange={handleChange} placeholder="300" />
                      <select name="unidad_dosis" className="form-select" style={{ width: 110 }} value={form.unidad_dosis} onChange={handleChange} aria-label="Unidad de la dosis">
                        {UNIDADES_DOSIS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="ap-total">Cantidad total (kg)</label>
                    <input id="ap-total" type="text" inputMode="decimal" name="cantidad_total" className="form-input" value={form.cantidad_total} onChange={handleChange}
                      placeholder={ap.kgTotales ? `${ap.kgTotales} (calculado)` : 'Opcional'} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="ap-metodo">Forma de aplicación</label>
                    <select id="ap-metodo" name="metodo_aplicacion" className="form-select" value={form.metodo_aplicacion} onChange={handleChange}>
                      <option value="">—</option>
                      {METODOS_APLICACION.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                {(ap.n > 0 || ap.p > 0 || ap.k > 0) && (
                  <p className="text-muted" style={{ margin: '-4px 0 14px', fontSize: 14 }}>
                    Aporta <strong>{ap.n} kg N</strong>, <strong>{ap.p} kg P₂O₅</strong> y <strong>{ap.k} kg K₂O</strong> por hectárea
                    {ap.totalN > 0 && <> ({ap.totalN} kg de N en total)</>}.
                  </p>
                )}
              </>
            ) : (
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="ap-dosis">Dosis</label>
                  <input id="ap-dosis" type="number" name="dosis" className="form-input" value={form.dosis} onChange={handleChange} step="0.0001" min="0" placeholder="L/ha o kg/ha" />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="ap-caldo">Volumen caldo (L/ha)</label>
                  <input id="ap-caldo" type="number" name="volumen_caldo" className="form-input" value={form.volumen_caldo} onChange={handleChange} step="0.1" min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="ap-carencia">Carencia (días)</label>
                  <input id="ap-carencia" type="number" name="carencia_dias" className="form-input" value={form.carencia_dias} onChange={handleChange} min="0" />
                </div>
              </div>
            )}

            <fieldset style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <legend style={{ fontSize: 13, fontWeight: 600, padding: '0 6px' }}>Para el cuaderno de campo</legend>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="ap-fecha">{abono ? 'Fecha del abonado' : 'Fecha de aplicación'}</label>
                  <input id="ap-fecha" type="date" name="fecha_aplicacion" className="form-input" value={form.fecha_aplicacion} onChange={handleChange} />
                </div>
                {!abono && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="ap-registro">Nº de registro del producto</label>
                    <input id="ap-registro" type="text" name="num_registro" className="form-input" value={form.num_registro} onChange={handleChange} placeholder="Ej: ES-00123" />
                  </div>
                )}
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="ap-cultivo">Cultivo</label>
                  <input id="ap-cultivo" type="text" name="cultivo" className="form-input" list="ap-cultivos" value={form.cultivo} onChange={handleChange} placeholder="Viña, olivar…" />
                  <datalist id="ap-cultivos"><option value="Viña" /><option value="Olivar" /></datalist>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="ap-sup">{abono ? 'Superficie abonada (ha)' : 'Superficie tratada (ha)'}</label>
                  <input id="ap-sup" type="number" name="superficie_ha" className="form-input" value={form.superficie_ha} onChange={handleChange} step="0.01" min="0" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="ap-aplicador">{abono ? 'Quién lo echó' : 'Aplicador'}</label>
                  <input id="ap-aplicador" type="text" name="aplicador" className="form-input" list="ap-aplicadores" value={form.aplicador} onChange={handleChange} placeholder="Nombre" />
                  <datalist id="ap-aplicadores">
                    {[...new Set([...personal.map(p => p.nombre), ...aplicadores.map(a => a.aplicador)].filter(Boolean))].map(n => <option key={n} value={n} />)}
                  </datalist>
                </div>
                {!abono && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="ap-carnet">Nº carné de aplicador</label>
                    <input id="ap-carnet" type="text" name="carnet_aplicador" className="form-input" value={form.carnet_aplicador} onChange={handleChange} />
                  </div>
                )}
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="ap-equipo">Equipo</label>
                <select id="ap-equipo" name="id_equipo" className="form-select" value={form.id_equipo} onChange={handleChange}>
                  <option value="">—</option>
                  {maquinaria.map(m => <option key={m.id_equipo} value={m.id_equipo}>{m.tipo} {m.marca_modelo ? `· ${m.marca_modelo}` : ''}</option>)}
                </select>
              </div>
            </fieldset>
            <div className="form-group">
              <label className="form-label" htmlFor="ap-just">{abono ? 'Motivo (opcional)' : 'Justificación (plaga o enfermedad)'}</label>
              <textarea id="ap-just" name="justificacion" className="form-textarea" value={form.justificacion} onChange={handleChange} placeholder={abono ? 'Abonado de fondo, de cobertera…' : 'Motivo de la aplicación...'} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="ap-obs">Observaciones</label>
              <textarea id="ap-obs" name="observaciones" className="form-textarea" value={form.observaciones} onChange={handleChange} />
            </div>
            <button type="submit" className={`btn btn-primary btn-full ${saving ? 'btn-loading' : ''}`} disabled={saving}>
              {saving ? 'Guardando...' : editingId ? ' Guardar cambios' : abono ? ' Registrar abonado' : ' Registrar tratamiento'}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-title">{vista === 'fertilizante' ? `Abonados registrados (${filteredAplicaciones.length})` : `Tratamientos registrados (${filteredAplicaciones.length})`}</div>
        {filteredAplicaciones.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              {vista === 'fertilizante' ? (
                <>
                  <thead>
                    <tr><th>Fecha</th><th>Abono</th><th>N-P-K</th><th>Dosis</th><th>N (kg/ha)</th><th>Labor</th><th>Acciones</th></tr>
                  </thead>
                  <tbody>
                    {filteredAplicaciones.map(a => (
                      <tr key={a.id_aplicacion}>
                        <td style={{ whiteSpace: 'nowrap' }}>{fechaDe(a)}</td>
                        <td><strong>{a.producto || '-'}</strong>{a.tipo_fertilizante && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{a.tipo_fertilizante}</div>}</td>
                        <td>{textoNPK(a) || '-'}</td>
                        <td>{a.dosis != null ? `${a.dosis} ${a.unidad_dosis || 'kg/ha'}` : '-'}</td>
                        <td>{aportes(a).n || '-'}</td>
                        <td>{laborInfo(a.id_labor)}</td>
                        <td>
                          <button className="btn btn-small btn-accent" onClick={() => handleEdit(a)} aria-label={`Editar abonado ${a.producto}`}><Pencil size={16} aria-hidden="true" /></button>
                          <button className="btn btn-small btn-danger" onClick={() => handleDelete(a.id_aplicacion)} aria-label={`Eliminar abonado ${a.producto}`}><Trash2 size={16} aria-hidden="true" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              ) : (
                <>
                  <thead>
                    <tr><th>Producto</th><th>Materia activa</th><th>Dosis</th><th>Carencia</th><th>Labor</th><th>Acciones</th></tr>
                  </thead>
                  <tbody>
                    {filteredAplicaciones.map(a => (
                      <tr key={a.id_aplicacion}>
                        <td><strong>{a.producto || '-'}</strong></td>
                        <td>{a.materia_activa || '-'}</td>
                        <td>{a.dosis ? `${a.dosis}` : '-'}</td>
                        <td>{a.carencia_dias ? <span className="badge badge-red">{a.carencia_dias} días</span> : '-'}</td>
                        <td>{laborInfo(a.id_labor)}</td>
                        <td>
                          <button className="btn btn-small btn-accent" onClick={() => handleEdit(a)} aria-label={`Editar tratamiento ${a.producto}`}><Pencil size={16} aria-hidden="true" /></button>
                          <button className="btn btn-small btn-danger" onClick={() => handleDelete(a.id_aplicacion)} aria-label={`Eliminar tratamiento ${a.producto}`}><Trash2 size={16} aria-hidden="true" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon" aria-hidden="true"><Inbox size={40} strokeWidth={1.5} /></div>
            <div className="empty-state-text">{vista === 'fertilizante' ? 'No hay abonados registrados. Desde 2026 hay que anotarlos en el cuaderno de explotación.' : 'No hay tratamientos registrados'}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AplicacionesPage
