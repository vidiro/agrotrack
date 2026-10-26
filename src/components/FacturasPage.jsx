import { useState, useEffect, useMemo } from 'react'
import { AlertTriangle, Camera, Inbox, Paperclip, Pencil, Search, Trash2, X } from 'lucide-react'
import { format } from 'date-fns'
import { supabase } from '../data/supabaseClient'
import { fetchAll } from '../utils/fetchAll'
import { downloadCSV } from '../utils/csvExport'
import { esGastoInversion } from '../utils/gastos'
import { esFactura, nifValido, normalizarNIF, limpiarNIF, claveFactura, mensajeErrorFactura } from '../utils/facturas'
import { useProveedores, autocompletarEmpresa } from '../utils/proveedores'
import { subirAdjunto, abrirAdjunto } from '../utils/adjuntos'
import { leerFactura } from '../utils/ocrFactura'
import { guardarConCola } from '../utils/offline'
import { useExplotacion } from '../utils/explotacion'

const CATEGORIAS = ['Material', 'Salario', 'Inversión', 'Mantenimiento', 'Combustible', 'Otro']
const FORMAS_PAGO = ['Transferencia', 'Efectivo', 'Tarjeta', 'Domiciliación', 'Cheque', 'Pagaré']

const formVacio = () => ({
  fecha: format(new Date(), 'yyyy-MM-dd'),
  proveedor: '',
  nif_proveedor: '',
  num_factura: '',
  concepto: '',
  categoria: 'Material',
  id_finca: '',
  importe: '',
  forma_pago: 'Transferencia',
  observaciones: '',
})

// 1.234,56 € (toLocaleString('es-ES') no agrupa cifras de 4 dígitos)
const eur = (v) => {
  const [ent, dec] = Math.abs(parseFloat(v) || 0).toFixed(2).split('.')
  return `${(parseFloat(v) || 0) < 0 ? '−' : ''}${ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec} €`
}
const fechaES = (f) => (f ? `${f.substring(8, 10)}/${f.substring(5, 7)}/${f.substring(0, 4)}` : '-')

function FacturasPage({ fincas, onDataChange, onNavigate }) {
  const [gastos, setGastos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(formVacio)
  const { explotacion } = useExplotacion()
  // Foto o PDF de la factura
  const [archivo, setArchivo] = useState(null)
  const [vistaPrevia, setVistaPrevia] = useState('')
  const [adjuntoActual, setAdjuntoActual] = useState('')
  const [lectura, setLectura] = useState({ estado: '', progreso: 0, mensaje: '' })

  const [filtroAnio, setFiltroAnio] = useState(String(new Date().getFullYear()))
  const [filtroEmpresa, setFiltroEmpresa] = useState('')
  const [filtroFinca, setFiltroFinca] = useState('')
  const [busqueda, setBusqueda] = useState('')

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

  useEffect(() => { loadData() }, [])

  // Si ningún gasto trae las columnas de factura, falta la migración v1.6
  const faltaMigracion = gastos.length > 0 && !gastos.some(g => 'num_factura' in g)

  const facturas = useMemo(() => gastos.filter(esFactura), [gastos])
  const { empresas, buscar, guardar, borrar, disponible: proveedoresDisponible } = useProveedores(gastos)
  const [nuevaEmpresa, setNuevaEmpresa] = useState({ nombre: '', nif: '' })
  const anios = useMemo(() => [...new Set(facturas.map(f => (f.fecha || '').substring(0, 4)).filter(Boolean))].sort().reverse(), [facturas])

  // Facturas repetidas: mismo emisor + mismo número
  const repetidas = useMemo(() => {
    const cuenta = new Map()
    for (const f of facturas) {
      const k = claveFactura(f)
      if (k) cuenta.set(k, (cuenta.get(k) || 0) + 1)
    }
    return new Set([...cuenta].filter(([, n]) => n > 1).map(([k]) => k))
  }, [facturas])

  const avisos = (f) => {
    const lista = []
    if (!f.num_factura) lista.push('Falta el nº de factura')
    if (!f.proveedor) lista.push('Falta la empresa')
    if (!f.nif_proveedor) lista.push('Falta el NIF/CIF')
    else if (!nifValido(f.nif_proveedor)) lista.push('NIF/CIF con formato o letra incorrectos')
    if (repetidas.has(claveFactura(f))) lista.push('Factura repetida (mismo nº y empresa)')
    return lista
  }

  const filtradas = facturas.filter(f => {
    if (filtroAnio && !(f.fecha || '').startsWith(filtroAnio)) return false
    if (filtroEmpresa && (f.proveedor || '').trim().toLowerCase() !== filtroEmpresa) return false
    if (filtroFinca && String(f.id_finca || '') !== filtroFinca) return false
    if (busqueda.trim()) {
      const t = busqueda.trim().toLowerCase()
      const texto = [f.num_factura, f.proveedor, f.nif_proveedor, f.concepto, f.categoria].join(' ').toLowerCase()
      if (!texto.includes(t)) return false
    }
    return true
  })

  const total = filtradas.reduce((s, f) => s + (parseFloat(f.importe) || 0), 0)
  const conAvisos = filtradas.filter(f => avisos(f).length > 0).length

  const sinFacturaPeriodo = gastos.filter(g => !esFactura(g) && (!filtroAnio || (g.fecha || '').startsWith(filtroAnio))).length

  const porEmpresa = useMemo(() => {
    const m = new Map()
    for (const f of filtradas) {
      const k = (f.proveedor || 'Sin empresa').trim()
      const r = m.get(k.toLowerCase()) || { proveedor: k, nif: f.nif_proveedor || '', n: 0, total: 0 }
      r.n += 1
      r.total += parseFloat(f.importe) || 0
      if (!r.nif && f.nif_proveedor) r.nif = f.nif_proveedor
      m.set(k.toLowerCase(), r)
    }
    return [...m.values()].sort((a, b) => b.total - a.total)
  }, [filtradas])

  const fincaNombre = (id) => fincas.find(f => String(f.id_finca) === String(id))?.nombre || 'General'

  // === FORMULARIO ===
  const limpiarArchivo = () => {
    if (vistaPrevia) URL.revokeObjectURL(vistaPrevia)
    setArchivo(null); setVistaPrevia(''); setAdjuntoActual(''); setLectura({ estado: '', progreso: 0, mensaje: '' })
  }
  const abrirNueva = () => { limpiarArchivo(); setForm(formVacio()); setEditingId(null); setShowForm(true) }
  const cerrar = () => { limpiarArchivo(); setForm(formVacio()); setEditingId(null); setShowForm(false) }

  // NIF del propio agricultor (Ajustes → Datos del titular), para no confundirlo con el de la empresa
  const nifTitular = explotacion.nif_titular || ''

  // Al elegir la foto: se lee y se rellenan los datos que estén vacíos
  const elegirArchivo = async (file) => {
    if (!file) return
    if (vistaPrevia) URL.revokeObjectURL(vistaPrevia)
    setArchivo(file)
    setVistaPrevia(file.type.startsWith('image/') ? URL.createObjectURL(file) : '')
    if (!file.type.startsWith('image/')) {
      setLectura({ estado: 'hecho', progreso: 1, mensaje: 'PDF adjuntado. La lectura automática solo funciona con fotos.' })
      return
    }
    setLectura({ estado: 'leyendo', progreso: 0, mensaje: 'Leyendo la factura…' })
    try {
      const datos = await leerFactura(file, {
        nifsPropios: nifTitular ? [nifTitular] : [],
        onProgreso: (p) => setLectura(l => ({ ...l, progreso: p })),
      })
      const encontrados = []
      setForm(prev => {
        const nuevo = { ...prev }
        if (datos.nif_proveedor && !prev.nif_proveedor) { nuevo.nif_proveedor = datos.nif_proveedor; encontrados.push('CIF') }
        if (datos.nif_proveedor && !prev.proveedor) {
          const e = buscar(datos.nif_proveedor)
          if (e) { nuevo.proveedor = e.proveedor; encontrados.push('empresa') }
        }
        if (datos.num_factura && !prev.num_factura) { nuevo.num_factura = datos.num_factura; encontrados.push('nº de factura') }
        if (datos.fecha) { nuevo.fecha = datos.fecha; encontrados.push('fecha') }
        if (datos.importe && !prev.importe) { nuevo.importe = String(datos.importe); encontrados.push('importe') }
        return nuevo
      })
      setLectura({
        estado: 'hecho', progreso: 1,
        mensaje: encontrados.length ? `Rellenado: ${encontrados.join(', ')}. Revísalo antes de guardar.` : 'No se han podido leer los datos. Rellénalos a mano.',
      })
    } catch {
      setLectura({ estado: 'hecho', progreso: 1, mensaje: 'No se ha podido leer la foto (¿sin cobertura la primera vez?). Rellena los datos a mano; la foto se guardará igual.' })
    }
  }

  const handleEdit = (f) => {
    setForm({
      fecha: f.fecha ? f.fecha.substring(0, 10) : format(new Date(), 'yyyy-MM-dd'),
      proveedor: f.proveedor || '',
      nif_proveedor: f.nif_proveedor || '',
      num_factura: f.num_factura || '',
      concepto: f.concepto || '',
      categoria: f.categoria || 'Material',
      id_finca: f.id_finca || '',
      importe: f.importe ?? '',
      forma_pago: f.forma_pago || 'Transferencia',
      observaciones: f.observaciones || '',
    })
    limpiarArchivo()
    setAdjuntoActual(f.adjunto_path || '')
    setEditingId(f.id_gasto)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Empresa conocida → rellena su NIF/CIF; NIF conocido → rellena la empresa
  const cambiarEmpresa = (valor) => setForm(prev => autocompletarEmpresa(prev, 'proveedor', valor, buscar))
  const cambiarNIF = (valor) => setForm(prev => autocompletarEmpresa(prev, 'nif_proveedor', valor, buscar))

  // ¿Ya existe otra factura con el mismo nº y empresa?
  // (coincide el número y, además, el NIF o el nombre de la empresa)
  const duplicadaEnForm = (() => {
    const num = form.num_factura.trim().toUpperCase()
    if (!num) return false
    const nif = normalizarNIF(form.nif_proveedor)
    const nombre = form.proveedor.trim().toLowerCase()
    return facturas.some(f => f.id_gasto !== editingId &&
      String(f.num_factura || '').trim().toUpperCase() === num &&
      ((nif && normalizarNIF(f.nif_proveedor) === nif) || (nombre && String(f.proveedor || '').trim().toLowerCase() === nombre)))
  })()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!form.proveedor.trim() || !form.num_factura.trim() || !form.importe) {
      setError('Empresa, nº de factura e importe son obligatorios')
      return
    }
    setSaving(true)
    const datos = {
      fecha: form.fecha,
      proveedor: form.proveedor.trim(),
      nif_proveedor: limpiarNIF(form.nif_proveedor) || null,
      num_factura: form.num_factura.trim(),
      concepto: form.concepto.trim() || `Factura ${form.num_factura.trim()} · ${form.proveedor.trim()}`,
      categoria: form.categoria || null,
      id_finca: form.id_finca || null,
      importe: parseFloat(form.importe),
      forma_pago: form.forma_pago || null,
      observaciones: form.observaciones || null,
    }
    try {
      const carpeta = `facturas/${(form.fecha || '').substring(0, 4) || 'sin-fecha'}`
      let encolado = false
      if (editingId) {
        if (archivo) {
          if (!navigator.onLine) throw new Error('Sin cobertura no se puede cambiar la foto de una factura ya guardada. Espera a tener señal.')
          datos.adjunto_path = await subirAdjunto(archivo, carpeta)
        }
        const { error: err } = await supabase.from('gastos_manual').update(datos).eq('id_gasto', editingId)
        if (err) throw err
      } else {
        // Sin cobertura, la foto se queda en el móvil y se sube con la factura al volver la señal
        const r = await guardarConCola({ tabla: 'gastos_manual', datos, fotos: archivo ? [{ campo: 'adjunto_path', file: archivo, carpeta }] : [] })
        if (r.error) throw r.error
        encolado = r.encolado
      }
      // La empresa queda guardada; si su CIF ha cambiado, se corrige también en sus otras facturas
      const corregidas = encolado ? 0 : await guardar(datos.proveedor, datos.nif_proveedor)
      setSuccess(encolado ? 'Sin cobertura: la factura se enviará al recuperar la señal'
        : `${editingId ? 'Factura actualizada' : 'Factura registrada'}${corregidas ? `. CIF corregido también en ${corregidas} ${corregidas === 1 ? 'factura' : 'facturas'} más de ${datos.proveedor}` : ''}`)
      await loadData()
      onDataChange?.()
      cerrar()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(mensajeErrorFactura(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (f) => {
    if (!confirm(`¿Eliminar la factura ${f.num_factura || ''} de ${f.proveedor || 'esta empresa'}? También se borra el gasto.`)) return
    try {
      const { error: err } = await supabase.from('gastos_manual').delete().eq('id_gasto', f.id_gasto)
      if (err) throw err
      await loadData()
      onDataChange?.()
    } catch (err) {
      setError(err.message)
    }
  }

  const exportarCSV = () => {
    const headers = ['fecha', 'num_factura', 'empresa', 'nif_cif', 'concepto', 'categoria', 'finca', 'importe', 'forma_pago', 'observaciones']
    const rows = filtradas.map(f => ({
      fecha: fechaES(f.fecha),
      num_factura: f.num_factura || '',
      empresa: f.proveedor || '',
      nif_cif: f.nif_proveedor || '',
      concepto: f.concepto || '',
      categoria: f.categoria || '',
      finca: fincaNombre(f.id_finca),
      importe: (parseFloat(f.importe) || 0).toFixed(2),
      forma_pago: f.forma_pago || '',
      observaciones: f.observaciones || '',
    }))
    downloadCSV(`facturas_agrotrack${filtroAnio ? '_' + filtroAnio : ''}`, headers, rows)
  }

  if (loading) {
    return (
      <div className="empty-state" aria-busy="true">
        <div className="spinner"></div>
        <p className="mt-16">Cargando facturas...</p>
      </div>
    )
  }

  return (
    <div>
      {success && <div className="alert alert-success" role="status">{success}</div>}
      {error && (
        <div className="alert alert-error" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span>{error}</span>
          <button type="button" className="btn btn-small btn-primary" onClick={loadData}>Reintentar</button>
        </div>
      )}
      {faltaMigracion && (
        <div className="alert alert-info">
          Para guardar facturas hay que aplicar una vez la migración <code>docs/SQL_migracion_v1.6_facturas.sql</code> en Supabase (SQL Editor).
        </div>
      )}

      {/* RESUMEN */}
      <div className="summary-grid" style={{ marginBottom: 16 }}>
        <div className="summary-card">
          <div className="summary-value">{filtradas.length}</div>
          <div className="summary-label">Facturas</div>
        </div>
        <div className="summary-card danger">
          <div className="summary-value">{eur(total)}</div>
          <div className="summary-label">Importe total</div>
        </div>
        <div className="summary-card accent">
          <div className="summary-value">{porEmpresa.length}</div>
          <div className="summary-label">Empresas</div>
        </div>
        {conAvisos > 0 && (
          <div className="summary-card">
            <div className="summary-value" style={{ color: 'var(--color-warning)' }}>{conAvisos}</div>
            <div className="summary-label">Con datos que revisar</div>
          </div>
        )}
      </div>

      {sinFacturaPeriodo > 0 && (
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '0 0 12px' }}>
          Hay {sinFacturaPeriodo} {sinFacturaPeriodo === 1 ? 'gasto' : 'gastos'}{filtroAnio ? ` de ${filtroAnio}` : ''} sin datos de factura.
          Puedes completarlos desde{' '}
          <button type="button" onClick={() => onNavigate?.('gastos')} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-primary)', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}>Gastos</button>.
        </p>
      )}

      {/* FILTROS */}
      <div className="flex gap-12 mb-16 flex-wrap">
        <div className="search-box" style={{ flex: 1, minWidth: 200 }}>
          <span className="search-icon" aria-hidden="true"><Search size={18} /></span>
          <input type="text" className="search-input" placeholder="Buscar nº factura, empresa, NIF, concepto..." value={busqueda} onChange={e => setBusqueda(e.target.value)} aria-label="Buscar facturas" />
          {busqueda && <button type="button" className="clear-search" onClick={() => setBusqueda('')} aria-label="Limpiar búsqueda"><X size={18} aria-hidden="true" /></button>}
        </div>
        <select className="form-select" style={{ width: 'auto' }} value={filtroAnio} onChange={e => setFiltroAnio(e.target.value)} aria-label="Filtrar por año">
          <option value="">Todos los años</option>
          {[...new Set([String(new Date().getFullYear()), ...anios])].sort().reverse().map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="form-select" style={{ width: 'auto' }} value={filtroEmpresa} onChange={e => setFiltroEmpresa(e.target.value)} aria-label="Filtrar por empresa">
          <option value="">Todas las empresas</option>
          {empresas.map(x => <option key={x.proveedor} value={x.proveedor.toLowerCase()}>{x.proveedor}</option>)}
        </select>
        <select className="form-select" style={{ width: 'auto' }} value={filtroFinca} onChange={e => setFiltroFinca(e.target.value)} aria-label="Filtrar por finca">
          <option value="">Todas las fincas</option>
          {fincas.map(f => <option key={f.id_finca} value={String(f.id_finca)}>{f.nombre}</option>)}
        </select>
      </div>

      <div className="flex gap-12 mb-16 flex-wrap">
        <button type="button" className="btn btn-primary" onClick={() => (showForm ? cerrar() : abrirNueva())}>
          {showForm ? 'Cancelar' : '+ Nueva factura'}
        </button>
        <button type="button" className="btn btn-accent" onClick={exportarCSV} disabled={filtradas.length === 0}>Exportar CSV</button>
      </div>

      {/* FORMULARIO */}
      {showForm && (
        <div className="card">
          <div className="card-title">{editingId ? 'Editar factura' : 'Nueva factura'}</div>
          <form onSubmit={handleSubmit}>
            {/* FOTO / PDF DE LA FACTURA */}
            <div className="zona-foto">
              {vistaPrevia && <img src={vistaPrevia} alt="Vista previa de la factura" />}
              <div style={{ flex: 1, minWidth: 180 }}>
                <label className="btn btn-primary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                  <Camera size={18} aria-hidden="true" />
                  {archivo ? 'Cambiar foto o PDF' : 'Hacer foto o subir PDF'}
                  <input type="file" accept="image/*,application/pdf" onChange={e => elegirArchivo(e.target.files?.[0])} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
                </label>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 6 }} role="status" aria-live="polite">
                  {lectura.estado === 'leyendo'
                    ? `${lectura.mensaje} ${Math.round(lectura.progreso * 100)} %`
                    : lectura.mensaje || (adjuntoActual && !archivo ? 'Esta factura ya tiene foto guardada.' : 'Con una foto, la app intenta rellenar CIF, nº, fecha e importe.')}
                </div>
                {adjuntoActual && !archivo && (
                  <button type="button" className="btn btn-small btn-accent" style={{ marginTop: 6 }} onClick={() => abrirAdjunto(adjuntoActual).catch(err => setError(err.message))}>
                    <Paperclip size={14} aria-hidden="true" /> Ver la guardada
                  </button>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="f-empresa">Empresa *</label>
                <input id="f-empresa" type="text" className="form-input" list="f-empresas" value={form.proveedor} onChange={e => cambiarEmpresa(e.target.value)} placeholder="Nombre de la empresa" required />
                <datalist id="f-empresas">{empresas.map(x => <option key={x.proveedor} value={x.proveedor} />)}</datalist>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="f-nif">NIF/CIF</label>
                <input id="f-nif" type="text" className="form-input" value={form.nif_proveedor} onChange={e => cambiarNIF(e.target.value)} placeholder="B12345678" autoCapitalize="characters" />
                {form.nif_proveedor && !nifValido(form.nif_proveedor) && (
                  <div style={{ fontSize: 12, color: 'var(--color-warning)', marginTop: 4 }}>Revisa el NIF/CIF: el formato o la letra de control no cuadran.</div>
                )}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="f-num">Nº de factura *</label>
                <input id="f-num" type="text" className="form-input" value={form.num_factura} onChange={e => setForm({ ...form, num_factura: e.target.value })} placeholder="Ej: F-2026/0123" required />
                {duplicadaEnForm && (
                  <div style={{ fontSize: 12, color: 'var(--color-warning)', marginTop: 4 }}>Ya hay una factura con este número de esta empresa.</div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="f-fecha">Fecha *</label>
                <input id="f-fecha" type="date" className="form-input" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="f-concepto">Concepto</label>
              <input id="f-concepto" type="text" className="form-input" value={form.concepto} onChange={e => setForm({ ...form, concepto: e.target.value })} placeholder="Ej: Abono 20 sacos NPK" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="f-importe">Importe total (€) *</label>
                <input id="f-importe" type="number" className="form-input" value={form.importe} onChange={e => setForm({ ...form, importe: e.target.value })} step="0.01" min="0" placeholder="0.00" required />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="f-categoria">Categoría</label>
                <select id="f-categoria" className="form-select" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="f-finca">Finca</label>
                <select id="f-finca" className="form-select" value={form.id_finca} onChange={e => setForm({ ...form, id_finca: e.target.value })}>
                  <option value="">General (sin finca)</option>
                  {fincas.map(f => <option key={f.id_finca} value={f.id_finca}>{f.nombre}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="f-pago">Forma de pago</label>
                <select id="f-pago" className="form-select" value={form.forma_pago} onChange={e => setForm({ ...form, forma_pago: e.target.value })}>
                  {[...new Set([...FORMAS_PAGO, form.forma_pago].filter(Boolean))].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="f-obs">Observaciones</label>
              <textarea id="f-obs" className="form-textarea" value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} />
            </div>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '0 0 12px' }}>
              La factura se guarda también como gasto: cuenta en balances, informes y en la finca elegida.
            </p>
            <button type="submit" className={`btn btn-primary btn-full ${saving ? 'btn-loading' : ''}`} disabled={saving}>
              {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Registrar factura'}
            </button>
          </form>
        </div>
      )}

      {/* LISTADO */}
      <div className="card">
        <div className="card-title">Facturas ({filtradas.length})</div>
        {filtradas.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Nº factura</th>
                  <th>Empresa</th>
                  <th>Concepto</th>
                  <th>Finca</th>
                  <th style={{ textAlign: 'right' }}>Importe</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(f => {
                  const a = avisos(f)
                  return (
                    <tr key={f.id_gasto}>
                      <td style={{ whiteSpace: 'nowrap' }}>{fechaES(f.fecha)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <strong>{f.num_factura || '—'}</strong>
                        {f.adjunto_path && (
                          <button type="button" onClick={() => abrirAdjunto(f.adjunto_path).catch(err => setError(err.message))} aria-label={`Ver foto de la factura ${f.num_factura || ''}`} title="Ver factura"
                            style={{ marginLeft: 6, background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--color-primary)', verticalAlign: 'middle' }}>
                            <Paperclip size={15} aria-hidden="true" />
                          </button>
                        )}
                        {a.length > 0 && (
                          <span title={a.join(' · ')} style={{ marginLeft: 6, color: 'var(--color-warning)', verticalAlign: 'middle' }}>
                            <AlertTriangle size={14} aria-label={a.join('. ')} />
                          </span>
                        )}
                      </td>
                      <td>
                        {f.proveedor || '—'}
                        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{f.nif_proveedor || 'Sin NIF/CIF'}</div>
                      </td>
                      <td>
                        {f.concepto || '—'}
                        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{f.categoria || ''}{esGastoInversion(f) ? ' (no resta en balances)' : ''}</div>
                      </td>
                      <td>{fincaNombre(f.id_finca)}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><strong>{eur(f.importe)}</strong></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button type="button" className="btn btn-small btn-accent" onClick={() => handleEdit(f)} aria-label={`Editar factura ${f.num_factura || ''}`}><Pencil size={16} aria-hidden="true" /></button>
                        <button type="button" className="btn btn-small btn-danger" onClick={() => handleDelete(f)} aria-label={`Eliminar factura ${f.num_factura || ''}`}><Trash2 size={16} aria-hidden="true" /></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon" aria-hidden="true"><Inbox size={40} strokeWidth={1.5} /></div>
            <div className="empty-state-text">{facturas.length === 0 ? 'Aún no hay facturas registradas' : 'No hay facturas con estos filtros'}</div>
          </div>
        )}
      </div>

      {/* POR EMPRESA */}
      {porEmpresa.length > 0 && (
        <div className="card">
          <div className="card-title">Resumen por empresa</div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr><th>Empresa</th><th>NIF/CIF</th><th style={{ textAlign: 'right' }}>Facturas</th><th style={{ textAlign: 'right' }}>Total</th></tr>
              </thead>
              <tbody>
                {porEmpresa.map(r => (
                  <tr key={r.proveedor}>
                    <td>{r.proveedor}</td>
                    <td>{r.nif || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{r.n}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><strong>{eur(r.total)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EMPRESAS GUARDADAS */}
      <div className="card">
        <div className="card-title">Empresas guardadas</div>
        {!proveedoresDisponible ? (
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>
            Para guardar empresas aplica la migración <code>docs/SQL_migracion_v1.7_proveedores.sql</code> en Supabase.
            Mientras tanto, el CIF se autocompleta con las facturas que ya tienes.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '-4px 0 12px' }}>
              Al escribir el nombre de una de estas empresas (o su CIF) en una factura, el otro dato se rellena solo. Cada factura nueva guarda su empresa automáticamente.
            </p>
            <form
              className="flex gap-12 flex-wrap mb-16"
              onSubmit={async (e) => {
                e.preventDefault()
                if (!nuevaEmpresa.nombre.trim()) return
                const corregidas = await guardar(nuevaEmpresa.nombre, nuevaEmpresa.nif)
                setNuevaEmpresa({ nombre: '', nif: '' })
                if (corregidas) await loadData()
                setSuccess(`Empresa guardada${corregidas ? `. CIF corregido en ${corregidas} ${corregidas === 1 ? 'factura' : 'facturas'}` : ''}`)
                setTimeout(() => setSuccess(''), 4000)
              }}
            >
              <input type="text" className="form-input" style={{ flex: 2, minWidth: 180 }} placeholder="Nombre de la empresa" aria-label="Nombre de la empresa"
                value={nuevaEmpresa.nombre} onChange={e => setNuevaEmpresa({ ...nuevaEmpresa, nombre: e.target.value })} />
              <input type="text" className="form-input" style={{ flex: 1, minWidth: 120 }} placeholder="CIF/NIF" aria-label="CIF o NIF" autoCapitalize="characters"
                value={nuevaEmpresa.nif} onChange={e => setNuevaEmpresa({ ...nuevaEmpresa, nif: e.target.value })} />
              <button type="submit" className="btn btn-primary">Guardar empresa</button>
            </form>
            {nuevaEmpresa.nif && !nifValido(nuevaEmpresa.nif) && (
              <div style={{ fontSize: 12, color: 'var(--color-warning)', margin: '-8px 0 12px' }}>Revisa el CIF/NIF: el formato o la letra de control no cuadran.</div>
            )}
            {empresas.filter(e => e.guardada).length > 0 ? (
              <div className="table-container">
                <table className="data-table">
                  <thead><tr><th>Empresa</th><th>CIF/NIF</th><th>Acciones</th></tr></thead>
                  <tbody>
                    {empresas.filter(e => e.guardada).map(e => (
                      <tr key={e.id}>
                        <td>{e.proveedor}</td>
                        <td>
                          {e.nif_proveedor || '—'}
                          {e.nif_proveedor && !nifValido(e.nif_proveedor) && (
                            <span title="Formato o letra de control incorrectos" style={{ marginLeft: 6, color: 'var(--color-warning)' }}><AlertTriangle size={14} aria-label="CIF/NIF incorrecto" /></span>
                          )}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button type="button" className="btn btn-small btn-accent" onClick={() => setNuevaEmpresa({ nombre: e.proveedor, nif: e.nif_proveedor || '' })} aria-label={`Editar CIF de ${e.proveedor}`}><Pencil size={16} aria-hidden="true" /></button>
                          <button type="button" className="btn btn-small btn-danger" onClick={() => { if (confirm(`¿Quitar ${e.proveedor} de las empresas guardadas? Sus facturas no se borran.`)) borrar(e.id) }} aria-label={`Quitar ${e.proveedor}`}><Trash2 size={16} aria-hidden="true" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>Aún no hay empresas guardadas.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default FacturasPage
