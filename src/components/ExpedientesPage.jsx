import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Download, Paperclip, Pencil, Plus, Trash2, Upload, X } from 'lucide-react'
import { supabase } from '../data/supabaseClient'
import { fetchAll, isMissingTable } from '../utils/fetchAll'
import { esFactura } from '../utils/facturas'
import { eur, fechaES } from '../utils/formato'
import { diasHasta } from '../utils/pendientes'
import { subirAdjunto, abrirAdjunto } from '../utils/adjuntos'
import { generarExpedienteZip, descargarBlob } from '../utils/expedienteZip'
import { Avisos, Cargando, Vacio, FaltaMigracion, Cabecera, Campo } from './ui'

const ESTADOS = ['Preparando', 'Presentada', 'Subsanación', 'Concedida', 'Cobrada', 'Denegada', 'Cerrada']

// Lista de partida habitual; cada convocatoria tiene la suya: revísala y ajústala
const REQUISITOS_BASE = [
  'Solicitud firmada',
  'DNI/NIF del titular',
  'Facturas de la inversión',
  'Justificantes de pago (transferencias o recibos bancarios)',
  'Certificado de estar al corriente con Hacienda (AEAT)',
  'Certificado de estar al corriente con la Seguridad Social',
  'Certificado de estar al corriente con la Junta (Hacienda autonómica)',
  'Memoria o proyecto de la inversión',
  'Presupuestos u ofertas de proveedores',
  'Datos bancarios (certificado de titularidad de la cuenta)',
]

const vacio = () => ({ nombre: '', organismo: 'Junta de Extremadura', convocatoria: '', fecha_limite: '', estado: 'Preparando', importe_solicitado: '', id_finca: '', notas: '' })

function ExpedientesPage({ fincas = [] }) {
  const [expedientes, setExpedientes] = useState([])
  const [requisitos, setRequisitos] = useState([])
  const [vinculos, setVinculos] = useState([])
  const [gastos, setGastos] = useState([])
  const [loading, setLoading] = useState(true)
  const [faltaTabla, setFaltaTabla] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [abierto, setAbierto] = useState(null) // id del expediente abierto
  const [form, setForm] = useState(vacio)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [nuevoRequisito, setNuevoRequisito] = useState('')
  const [buscarFra, setBuscarFra] = useState('')
  const [generando, setGenerando] = useState('')

  const cargar = async () => {
    setLoading(true)
    setError('')
    const [e, r, v, g] = await Promise.all([
      fetchAll('expedientes', q => q.order('created_at', { ascending: false })),
      fetchAll('expediente_requisitos', q => q.order('orden', { ascending: true })),
      fetchAll('expediente_gastos'),
      fetchAll('gastos_manual', q => q.order('fecha', { ascending: false })),
    ])
    if (e.error) {
      if (isMissingTable(e.error)) setFaltaTabla(true)
      else setError(e.error.message)
    } else {
      setFaltaTabla(false)
      setExpedientes(e.data || [])
      setRequisitos(r.data || [])
      setVinculos(v.data || [])
    }
    setGastos(g.data || [])
    setLoading(false)
  }
  useEffect(() => { cargar() }, [])

  const ok = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
  const fallo = (err) => setError(err?.message || String(err))
  const nombreFinca = (id) => fincas.find(f => String(f.id_finca) === String(id))?.nombre || 'General'

  const exp = expedientes.find(x => x.id === abierto) || null
  const reqsDe = (id) => requisitos.filter(r => r.id_expediente === id)
  const facturasDe = (id) => {
    const ids = new Set(vinculos.filter(v => v.id_expediente === id).map(v => String(v.id_gasto)))
    return gastos.filter(g => ids.has(String(g.id_gasto)))
  }

  // === Alta / edición del expediente ===
  const guardarExpediente = async (e) => {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('Pon un nombre a la ayuda'); return }
    const datos = {
      nombre: form.nombre.trim(), organismo: form.organismo || null, convocatoria: form.convocatoria || null,
      fecha_limite: form.fecha_limite || null, estado: form.estado, importe_solicitado: form.importe_solicitado ? parseFloat(form.importe_solicitado) : null,
      id_finca: form.id_finca || null, notas: form.notas || null,
    }
    try {
      if (editingId) {
        const { error: err } = await supabase.from('expedientes').update(datos).eq('id', editingId)
        if (err) throw err
      } else {
        const { data, error: err } = await supabase.from('expedientes').insert([datos]).select().single()
        if (err) throw err
        const { error: err2 } = await supabase.from('expediente_requisitos').insert(REQUISITOS_BASE.map((texto, orden) => ({ id_expediente: data.id, texto, orden, hecho: false })))
        if (err2) throw err2
        setAbierto(data.id)
      }
      ok(editingId ? 'Ayuda actualizada' : 'Ayuda creada con una lista de documentos de partida')
      setShowForm(false); setEditingId(null); setForm(vacio())
      await cargar()
    } catch (err) { fallo(err) }
  }

  const editarExpediente = (x) => {
    setForm({ nombre: x.nombre || '', organismo: x.organismo || '', convocatoria: x.convocatoria || '', fecha_limite: x.fecha_limite || '', estado: x.estado || 'Preparando', importe_solicitado: x.importe_solicitado ?? '', id_finca: x.id_finca || '', notas: x.notas || '' })
    setEditingId(x.id)
    setShowForm(true)
  }

  const borrarExpediente = async (x) => {
    if (!confirm(`¿Borrar la ayuda «${x.nombre}»? Las facturas no se borran.`)) return
    const { error: err } = await supabase.from('expedientes').delete().eq('id', x.id)
    if (err) return fallo(err)
    setAbierto(null)
    cargar()
  }

  // === Requisitos (checklist) ===
  const marcar = async (r) => {
    setRequisitos(prev => prev.map(x => x.id === r.id ? { ...x, hecho: !x.hecho } : x))
    const { error: err } = await supabase.from('expediente_requisitos').update({ hecho: !r.hecho }).eq('id', r.id)
    if (err) { fallo(err); cargar() }
  }
  const anadirRequisito = async (e) => {
    e.preventDefault()
    if (!nuevoRequisito.trim()) return
    const { error: err } = await supabase.from('expediente_requisitos').insert([{ id_expediente: abierto, texto: nuevoRequisito.trim(), orden: reqsDe(abierto).length, hecho: false }])
    if (err) return fallo(err)
    setNuevoRequisito('')
    cargar()
  }
  const quitarRequisito = async (r) => {
    const { error: err } = await supabase.from('expediente_requisitos').delete().eq('id', r.id)
    if (err) return fallo(err)
    cargar()
  }
  const adjuntarARequisito = async (r, file) => {
    if (!file) return
    try {
      const ruta = await subirAdjunto(file, `ayudas/${abierto}`)
      const { error: err } = await supabase.from('expediente_requisitos').update({ adjunto_path: ruta, hecho: true }).eq('id', r.id)
      if (err) throw err
      ok('Documento guardado')
      cargar()
    } catch (err) { fallo(err) }
  }

  // === Facturas vinculadas ===
  const vincular = async (g) => {
    const { error: err } = await supabase.from('expediente_gastos').insert([{ id_expediente: abierto, id_gasto: String(g.id_gasto) }])
    if (err) return fallo(err)
    cargar()
  }
  const desvincular = async (g) => {
    const { error: err } = await supabase.from('expediente_gastos').delete().eq('id_expediente', abierto).eq('id_gasto', String(g.id_gasto))
    if (err) return fallo(err)
    cargar()
  }
  const subirPago = async (g, file) => {
    if (!file) return
    try {
      const ruta = await subirAdjunto(file, `pagos/${(g.fecha || '').substring(0, 4) || 'sin-fecha'}`)
      const fecha = window.prompt('Fecha del pago (AAAA-MM-DD), si la sabes:', g.fecha_pago || '') || null
      const datos = { justificante_pago_path: ruta }
      if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) datos.fecha_pago = fecha
      const { error: err } = await supabase.from('gastos_manual').update(datos).eq('id_gasto', g.id_gasto)
      if (err) throw err
      ok('Justificante de pago guardado')
      cargar()
    } catch (err) { fallo(err) }
  }
  const subirFotoFactura = async (g, file) => {
    if (!file) return
    try {
      const ruta = await subirAdjunto(file, `facturas/${(g.fecha || '').substring(0, 4) || 'sin-fecha'}`)
      const { error: err } = await supabase.from('gastos_manual').update({ adjunto_path: ruta }).eq('id_gasto', g.id_gasto)
      if (err) throw err
      ok('Factura guardada')
      cargar()
    } catch (err) { fallo(err) }
  }

  const descargar = async () => {
    setError('')
    try {
      const { blob, nombre, faltan } = await generarExpedienteZip({
        expediente: exp, requisitos: reqsDe(exp.id), facturas: facturasDe(exp.id), nombreFinca,
        onProgreso: setGenerando,
      })
      descargarBlob(blob, nombre)
      ok(faltan.length ? `Expediente descargado. Hay ${faltan.length} cosas por revisar (están al final del índice).` : 'Expediente descargado y completo')
    } catch (err) { fallo(err) } finally { setGenerando('') }
  }

  const disponibles = useMemo(() => {
    if (!exp) return []
    const ya = new Set(facturasDe(exp.id).map(g => String(g.id_gasto)))
    const t = buscarFra.trim().toLowerCase()
    return gastos
      .filter(g => !ya.has(String(g.id_gasto)))
      .filter(g => !exp.id_finca || !g.id_finca || String(g.id_finca) === String(exp.id_finca))
      .filter(g => !t || [g.num_factura, g.proveedor, g.concepto, g.nif_proveedor].join(' ').toLowerCase().includes(t))
      .sort((a, b) => Number(esFactura(b)) - Number(esFactura(a)) || String(b.fecha).localeCompare(String(a.fecha)))
      .slice(0, 30)
  }, [exp, gastos, vinculos, buscarFra])

  if (loading) return <Cargando texto="Cargando ayudas…" />

  // ================= DETALLE =================
  if (exp) {
    const reqs = reqsDe(exp.id)
    const fras = facturasDe(exp.id)
    const total = fras.reduce((s, g) => s + (parseFloat(g.importe) || 0), 0)
    const hechos = reqs.filter(r => r.hecho).length
    const quedan = diasHasta(exp.fecha_limite)

    return (
      <div>
        <Avisos error={error} success={success} />
        <button type="button" className="btn btn-small mb-12" onClick={() => setAbierto(null)} style={{ background: 'none', border: '1px solid var(--color-border)' }}>
          <ArrowLeft size={16} aria-hidden="true" /> Todas las ayudas
        </button>

        <Cabecera titulo={exp.nombre} descripcion={[exp.organismo, exp.convocatoria, exp.id_finca ? nombreFinca(exp.id_finca) : null].filter(Boolean).join(' · ')}>
          <button type="button" className="btn btn-accent" onClick={() => { editarExpediente(exp); setAbierto(null) }}><Pencil size={16} aria-hidden="true" /> Editar</button>
          <button type="button" className="btn btn-primary" onClick={descargar} disabled={!!generando}>
            <Download size={16} aria-hidden="true" /> {generando || 'Descargar expediente (ZIP)'}
          </button>
        </Cabecera>

        <div className="summary-grid" style={{ marginBottom: 16 }}>
          <div className="summary-card"><div className="summary-value" style={{ fontSize: '1.2rem' }}>{exp.estado}</div><div className="summary-label">Estado</div></div>
          <div className="summary-card"><div className="summary-value" style={{ fontSize: '1.2rem', color: quedan != null && quedan <= 7 ? 'var(--color-danger)' : undefined }}>{exp.fecha_limite ? fechaES(exp.fecha_limite) : '—'}</div><div className="summary-label">{quedan != null && quedan >= 0 ? `Fecha límite · quedan ${quedan} días` : 'Fecha límite'}</div></div>
          <div className="summary-card"><div className="summary-value" style={{ fontSize: '1.2rem' }}>{hechos}/{reqs.length}</div><div className="summary-label">Documentos listos</div></div>
          <div className="summary-card"><div className="summary-value" style={{ fontSize: '1.2rem' }}>{eur(total)}</div><div className="summary-label">{fras.length} {fras.length === 1 ? 'factura vinculada' : 'facturas vinculadas'}</div></div>
        </div>

        {/* CHECKLIST */}
        <div className="card">
          <div className="card-title">Documentación</div>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '-4px 0 8px' }}>
            Lista de partida orientativa: compárala con las bases de la convocatoria y añade o quita lo que haga falta.
          </p>
          <ul className="checklist">
            {reqs.map(r => (
              <li key={r.id}>
                <label>
                  <input type="checkbox" checked={!!r.hecho} onChange={() => marcar(r)} />
                  <span style={{ textDecoration: r.hecho ? 'line-through' : 'none', color: r.hecho ? 'var(--color-text-secondary)' : undefined }}>{r.texto}</span>
                </label>
                {r.adjunto_path && <button type="button" className="btn btn-small" onClick={() => abrirAdjunto(r.adjunto_path).catch(fallo)} aria-label={`Ver documento: ${r.texto}`}><Paperclip size={16} aria-hidden="true" /></button>}
                <label className="btn btn-small btn-accent" style={{ position: 'relative', cursor: 'pointer' }} title="Adjuntar documento">
                  <Upload size={16} aria-hidden="true" /><span className="sr-only">Adjuntar documento a {r.texto}</span>
                  <input type="file" accept="image/*,application/pdf" onChange={e => adjuntarARequisito(r, e.target.files?.[0])} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
                </label>
                <button type="button" className="btn btn-small btn-danger" onClick={() => quitarRequisito(r)} aria-label={`Quitar ${r.texto}`}><X size={16} aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
          <form onSubmit={anadirRequisito} className="flex gap-12 flex-wrap" style={{ marginTop: 12 }}>
            <input type="text" className="form-input" style={{ flex: 1, minWidth: 200 }} placeholder="Añadir documento que pida la convocatoria" aria-label="Nuevo documento" value={nuevoRequisito} onChange={e => setNuevoRequisito(e.target.value)} />
            <button type="submit" className="btn btn-primary"><Plus size={16} aria-hidden="true" /> Añadir</button>
          </form>
        </div>

        {/* FACTURAS VINCULADAS */}
        <div className="card">
          <div className="card-title">Facturas de la ayuda</div>
          {fras.length === 0 ? (
            <Vacio texto="Aún no hay facturas vinculadas. Añádelas desde la lista de abajo." />
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead><tr><th>Fecha</th><th>Factura</th><th>Empresa</th><th style={{ textAlign: 'right' }}>Importe</th><th>Factura (foto)</th><th>Justificante de pago</th><th></th></tr></thead>
                <tbody>
                  {fras.map(g => (
                    <tr key={g.id_gasto}>
                      <td style={{ whiteSpace: 'nowrap' }}>{fechaES(g.fecha)}</td>
                      <td>{g.num_factura || <span style={{ color: 'var(--color-danger)' }}>Sin nº</span>}<div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{g.concepto}</div></td>
                      <td>{g.proveedor || '—'}<div style={{ fontSize: 11, color: g.nif_proveedor ? 'var(--color-text-secondary)' : 'var(--color-danger)' }}>{g.nif_proveedor || 'Sin CIF'}</div></td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><strong>{eur(g.importe)}</strong></td>
                      <td>
                        {g.adjunto_path
                          ? <button type="button" className="btn btn-small" onClick={() => abrirAdjunto(g.adjunto_path).catch(fallo)}><Paperclip size={14} aria-hidden="true" /> Ver</button>
                          : <label className="btn btn-small btn-accent" style={{ position: 'relative', cursor: 'pointer' }}><Upload size={14} aria-hidden="true" /> Subir<input type="file" accept="image/*,application/pdf" onChange={e => subirFotoFactura(g, e.target.files?.[0])} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} /></label>}
                      </td>
                      <td>
                        {g.justificante_pago_path
                          ? <button type="button" className="btn btn-small" onClick={() => abrirAdjunto(g.justificante_pago_path).catch(fallo)}><Paperclip size={14} aria-hidden="true" /> {g.fecha_pago ? fechaES(g.fecha_pago) : 'Ver'}</button>
                          : <label className="btn btn-small btn-accent" style={{ position: 'relative', cursor: 'pointer' }}><Upload size={14} aria-hidden="true" /> Subir<input type="file" accept="image/*,application/pdf" onChange={e => subirPago(g, e.target.files?.[0])} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} /></label>}
                      </td>
                      <td><button type="button" className="btn btn-small btn-danger" onClick={() => desvincular(g)} aria-label={`Quitar la factura ${g.num_factura || ''} de la ayuda`}><X size={16} aria-hidden="true" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <label className="form-label" htmlFor="buscar-fra">Añadir facturas</label>
            <input id="buscar-fra" type="text" className="form-input" placeholder="Buscar por nº, empresa o concepto" value={buscarFra} onChange={e => setBuscarFra(e.target.value)} />
            <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
              {disponibles.map(g => (
                <li key={g.id_gasto} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14 }}>
                    {fechaES(g.fecha)} · {g.num_factura ? `Fra. ${g.num_factura} · ` : ''}{g.proveedor || g.concepto || 'Gasto'}
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--color-text-secondary)' }}>{g.concepto} · {nombreFinca(g.id_finca)}</span>
                  </span>
                  <strong style={{ whiteSpace: 'nowrap' }}>{eur(g.importe)}</strong>
                  <button type="button" className="btn btn-small btn-primary" onClick={() => vincular(g)} aria-label={`Añadir ${g.num_factura || g.concepto || 'gasto'} a la ayuda`}><Plus size={16} aria-hidden="true" /></button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {exp.notas && <div className="card"><div className="card-title">Notas</div><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{exp.notas}</p></div>}
      </div>
    )
  }

  // ================= LISTA =================
  return (
    <div>
      <Avisos error={error} success={success} onReintentar={cargar} />
      {faltaTabla && <FaltaMigracion />}

      <Cabecera titulo="Ayudas y subvenciones" descripcion="Una carpeta por ayuda: documentos, facturas y justificantes de pago, listos para presentar en un ZIP.">
        <button type="button" className="btn btn-primary" disabled={faltaTabla} onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(vacio()) }}>
          {showForm ? 'Cancelar' : '+ Nueva ayuda'}
        </button>
      </Cabecera>

      {showForm && (
        <div className="card">
          <div className="card-title">{editingId ? 'Editar ayuda' : 'Nueva ayuda'}</div>
          <form onSubmit={guardarExpediente}>
            <Campo id="e-nombre" label="Nombre *">
              <input id="e-nombre" className="form-input" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Modernización de regadío 2026" required />
            </Campo>
            <div className="form-row">
              <Campo id="e-org" label="Organismo">
                <input id="e-org" className="form-input" value={form.organismo} onChange={e => setForm({ ...form, organismo: e.target.value })} />
              </Campo>
              <Campo id="e-conv" label="Convocatoria / nº de expediente">
                <input id="e-conv" className="form-input" value={form.convocatoria} onChange={e => setForm({ ...form, convocatoria: e.target.value })} placeholder="Ej: DOE nº 123, orden de…" />
              </Campo>
            </div>
            <div className="form-row">
              <Campo id="e-fecha" label="Fecha límite">
                <input id="e-fecha" type="date" className="form-input" value={form.fecha_limite} onChange={e => setForm({ ...form, fecha_limite: e.target.value })} />
              </Campo>
              <Campo id="e-estado" label="Estado">
                <select id="e-estado" className="form-select" value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}>
                  {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Campo>
            </div>
            <div className="form-row">
              <Campo id="e-imp" label="Importe solicitado (€)">
                <input id="e-imp" type="number" step="0.01" min="0" className="form-input" value={form.importe_solicitado} onChange={e => setForm({ ...form, importe_solicitado: e.target.value })} />
              </Campo>
              <Campo id="e-finca" label="Finca">
                <select id="e-finca" className="form-select" value={form.id_finca} onChange={e => setForm({ ...form, id_finca: e.target.value })}>
                  <option value="">General</option>
                  {fincas.map(f => <option key={f.id_finca} value={f.id_finca}>{f.nombre}</option>)}
                </select>
              </Campo>
            </div>
            <Campo id="e-notas" label="Notas">
              <textarea id="e-notas" className="form-textarea" value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} />
            </Campo>
            <button type="submit" className="btn btn-primary btn-full">{editingId ? 'Guardar cambios' : 'Crear ayuda'}</button>
          </form>
        </div>
      )}

      {expedientes.length === 0 ? (
        !faltaTabla && <Vacio texto="Aún no hay ayudas. Crea una para ir reuniendo sus papeles." />
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
          {expedientes.map(x => {
            const reqs = reqsDe(x.id)
            const hechos = reqs.filter(r => r.hecho).length
            const fras = facturasDe(x.id)
            const quedan = diasHasta(x.fecha_limite)
            return (
              <li key={x.id} className="card" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <button type="button" onClick={() => setAbierto(x.id)} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', flex: 1, minWidth: 200, font: 'inherit', color: 'inherit' }}>
                    <div style={{ fontFamily: 'var(--fuente-titulo)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-primary)' }}>{x.nombre}</div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{[x.organismo, x.estado, x.fecha_limite ? `límite ${fechaES(x.fecha_limite)}${quedan != null && quedan >= 0 ? ` (${quedan} días)` : ''}` : null].filter(Boolean).join(' · ')}</div>
                    <div style={{ fontSize: 13, marginTop: 6 }}>{hechos}/{reqs.length} documentos · {fras.length} facturas · {eur(fras.reduce((s, g) => s + (parseFloat(g.importe) || 0), 0))}</div>
                    <div aria-hidden="true" style={{ height: 6, borderRadius: 3, background: 'var(--color-bg)', marginTop: 8, overflow: 'hidden' }}>
                      <div style={{ width: `${reqs.length ? (hechos / reqs.length) * 100 : 0}%`, height: '100%', background: 'var(--color-primary)' }} />
                    </div>
                  </button>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="btn btn-small btn-accent" onClick={() => editarExpediente(x)} aria-label={`Editar ${x.nombre}`}><Pencil size={16} aria-hidden="true" /></button>
                    <button type="button" className="btn btn-small btn-danger" onClick={() => borrarExpediente(x)} aria-label={`Borrar ${x.nombre}`}><Trash2 size={16} aria-hidden="true" /></button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default ExpedientesPage
