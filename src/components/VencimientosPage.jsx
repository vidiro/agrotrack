import { useEffect, useState } from 'react'
import { CheckCircle2, Paperclip, Pencil, RefreshCw, Trash2 } from 'lucide-react'
import { supabase } from '../data/supabaseClient'
import { fetchAll, isMissingTable } from '../utils/fetchAll'
import { diasHasta } from '../utils/pendientes'
import { fechaES, hoyISO, sumarAnios } from '../utils/formato'
import { subirAdjunto, abrirAdjunto } from '../utils/adjuntos'
import { Avisos, Cargando, Vacio, FaltaMigracion, Cabecera, Campo } from './ui'

const TIPOS = [
  'ITV', 'Inspección equipo de tratamientos (ITEAF)', 'Seguro tractor/vehículo', 'Seguro agrario',
  'Carné de aplicador', 'Carné / permiso', 'Solicitud PAC', 'Ayuda (plazo)', 'Revisión maquinaria', 'Impuestos', 'Otro',
]

const vacio = () => ({ tipo: 'ITV', descripcion: '', fecha: '', aviso_dias: 30, id_equipo: '', id_operario: '', notas: '' })

function estadoDe(v) {
  if (v.hecho) return { texto: 'Renovado', color: 'var(--color-success)' }
  const d = diasHasta(v.fecha)
  if (d == null) return { texto: 'Sin fecha', color: 'var(--color-text-secondary)' }
  if (d < 0) return { texto: `Vencido hace ${-d} días`, color: 'var(--color-danger)' }
  if (d === 0) return { texto: 'Vence hoy', color: 'var(--color-danger)' }
  if (d <= (parseInt(v.aviso_dias, 10) || 30)) return { texto: `Vence en ${d} días`, color: '#8a6200' }
  return { texto: `En ${d} días`, color: 'var(--color-text-secondary)' }
}

function VencimientosPage({ maquinaria = [], personal = [] }) {
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  const [faltaTabla, setFaltaTabla] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState(vacio)
  const [archivo, setArchivo] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [verHechos, setVerHechos] = useState(false)
  const [saving, setSaving] = useState(false)

  const cargar = async () => {
    setLoading(true)
    setError('')
    const { data, error: err } = await fetchAll('vencimientos', q => q.order('fecha', { ascending: true }))
    if (err) {
      if (isMissingTable(err)) setFaltaTabla(true)
      else setError(err.message)
    } else {
      setFaltaTabla(false)
      setLista(data || [])
    }
    setLoading(false)
  }
  useEffect(() => { cargar() }, [])

  const ok = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
  const cerrar = () => { setForm(vacio()); setArchivo(null); setEditingId(null); setShowForm(false) }

  const guardarForm = async (e) => {
    e.preventDefault()
    if (!form.fecha) { setError('Pon la fecha de vencimiento'); return }
    setSaving(true)
    setError('')
    try {
      const datos = {
        tipo: form.tipo,
        descripcion: form.descripcion.trim() || form.tipo,
        fecha: form.fecha,
        aviso_dias: parseInt(form.aviso_dias, 10) || 30,
        id_equipo: form.id_equipo || null,
        id_operario: form.id_operario || null,
        notas: form.notas || null,
      }
      if (archivo) datos.adjunto_path = await subirAdjunto(archivo, 'vencimientos')
      const { error: err } = editingId
        ? await supabase.from('vencimientos').update(datos).eq('id', editingId)
        : await supabase.from('vencimientos').insert([{ ...datos, hecho: false }])
      if (err) throw err
      ok(editingId ? 'Vencimiento actualizado' : 'Vencimiento añadido')
      cerrar()
      await cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Renovar: se marca como hecho y se crea el siguiente (dentro de un año)
  const renovar = async (v) => {
    const nuevaFecha = window.prompt('Fecha del próximo vencimiento (AAAA-MM-DD):', sumarAnios(v.fecha, 1))
    if (nuevaFecha === null) return
    try {
      const { error: e1 } = await supabase.from('vencimientos').update({ hecho: true }).eq('id', v.id)
      if (e1) throw e1
      if (/^\d{4}-\d{2}-\d{2}$/.test(nuevaFecha)) {
        const { id: _id, created_at: _c, hecho: _h, adjunto_path: _a, ...resto } = v
        const { error: e2 } = await supabase.from('vencimientos').insert([{ ...resto, fecha: nuevaFecha, hecho: false }])
        if (e2) throw e2
      }
      ok('Renovado')
      await cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  const borrar = async (v) => {
    if (!confirm(`¿Borrar «${v.descripcion}»?`)) return
    const { error: err } = await supabase.from('vencimientos').delete().eq('id', v.id)
    if (err) setError(err.message)
    else cargar()
  }

  const editar = (v) => {
    setForm({ tipo: v.tipo || 'Otro', descripcion: v.descripcion || '', fecha: v.fecha || '', aviso_dias: v.aviso_dias || 30, id_equipo: v.id_equipo || '', id_operario: v.id_operario || '', notas: v.notas || '' })
    setArchivo(null)
    setEditingId(v.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const nombreEquipo = (id) => { const m = maquinaria.find(x => String(x.id_equipo) === String(id)); return m ? `${m.tipo}${m.marca_modelo ? ' · ' + m.marca_modelo : ''}` : '' }
  const nombrePersona = (id) => personal.find(x => String(x.id_operario) === String(id))?.nombre || ''

  if (loading) return <Cargando texto="Cargando vencimientos…" />

  const visibles = lista.filter(v => verHechos || !v.hecho)

  return (
    <div>
      <Avisos error={error} success={success} onReintentar={cargar} />
      {faltaTabla && <FaltaMigracion />}

      <Cabecera titulo="Vencimientos y documentos" descripcion="ITV, inspección de equipos, seguros, carnés, PAC… Te avisa en Inicio antes de que caduquen.">
        <button type="button" className="btn btn-primary" disabled={faltaTabla} onClick={() => (showForm ? cerrar() : (setForm({ ...vacio(), fecha: hoyISO() }), setShowForm(true)))}>
          {showForm ? 'Cancelar' : '+ Añadir'}
        </button>
      </Cabecera>

      {showForm && (
        <div className="card">
          <div className="card-title">{editingId ? 'Editar vencimiento' : 'Nuevo vencimiento'}</div>
          <form onSubmit={guardarForm}>
            <div className="form-row">
              <Campo id="v-tipo" label="Tipo">
                <select id="v-tipo" className="form-select" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Campo>
              <Campo id="v-fecha" label="Fecha de vencimiento *">
                <input id="v-fecha" type="date" className="form-input" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} required />
              </Campo>
            </div>
            <Campo id="v-desc" label="Descripción">
              <input id="v-desc" type="text" className="form-input" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Ej: ITV tractor John Deere" />
            </Campo>
            <div className="form-row">
              <Campo id="v-equipo" label="Máquina (opcional)">
                <select id="v-equipo" className="form-select" value={form.id_equipo} onChange={e => setForm({ ...form, id_equipo: e.target.value })}>
                  <option value="">—</option>
                  {maquinaria.map(m => <option key={m.id_equipo} value={m.id_equipo}>{m.tipo} {m.marca_modelo ? `· ${m.marca_modelo}` : ''}</option>)}
                </select>
              </Campo>
              <Campo id="v-persona" label="Persona (opcional)">
                <select id="v-persona" className="form-select" value={form.id_operario} onChange={e => setForm({ ...form, id_operario: e.target.value })}>
                  <option value="">—</option>
                  {personal.map(p => <option key={p.id_operario} value={p.id_operario}>{p.nombre}</option>)}
                </select>
              </Campo>
            </div>
            <div className="form-row">
              <Campo id="v-aviso" label="Avisar con (días)">
                <input id="v-aviso" type="number" min="1" max="365" className="form-input" value={form.aviso_dias} onChange={e => setForm({ ...form, aviso_dias: e.target.value })} />
              </Campo>
              <Campo id="v-doc" label="Documento (opcional)" ayuda="Foto o PDF del recibo, carné o certificado">
                <input id="v-doc" type="file" accept="image/*,application/pdf" className="form-input" onChange={e => setArchivo(e.target.files?.[0] || null)} />
              </Campo>
            </div>
            <Campo id="v-notas" label="Notas">
              <textarea id="v-notas" className="form-textarea" value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} />
            </Campo>
            <button type="submit" className={`btn btn-primary btn-full ${saving ? 'btn-loading' : ''}`} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span>Próximos ({visibles.length})</span>
          <label style={{ fontSize: 13, fontWeight: 400, display: 'flex', gap: 6, alignItems: 'center', fontFamily: 'var(--fuente-ui)' }}>
            <input type="checkbox" checked={verHechos} onChange={e => setVerHechos(e.target.checked)} /> Ver renovados
          </label>
        </div>
        {visibles.length === 0 ? (
          <Vacio texto={faltaTabla ? 'Aplica la migración para empezar' : 'No hay vencimientos. Añade la ITV, los seguros o los carnés.'} />
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Qué</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
                {visibles.map(v => {
                  const est = estadoDe(v)
                  const extra = [v.tipo !== v.descripcion ? v.tipo : '', nombreEquipo(v.id_equipo), nombrePersona(v.id_operario)].filter(Boolean).join(' · ')
                  return (
                    <tr key={v.id} style={v.hecho ? { opacity: 0.6 } : undefined}>
                      <td>
                        <strong>{v.descripcion}</strong>
                        {extra && <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{extra}</div>}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{fechaES(v.fecha)}</td>
                      <td style={{ color: est.color, fontWeight: 600, whiteSpace: 'nowrap' }}>{est.texto}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {v.adjunto_path && <button type="button" className="btn btn-small" onClick={() => abrirAdjunto(v.adjunto_path).catch(err => setError(err.message))} aria-label="Ver documento"><Paperclip size={16} aria-hidden="true" /></button>}
                        {!v.hecho && <button type="button" className="btn btn-small btn-primary" onClick={() => renovar(v)} aria-label={`Renovar ${v.descripcion}`} title="Renovado: crear el siguiente"><RefreshCw size={16} aria-hidden="true" /></button>}
                        <button type="button" className="btn btn-small btn-accent" onClick={() => editar(v)} aria-label={`Editar ${v.descripcion}`}><Pencil size={16} aria-hidden="true" /></button>
                        <button type="button" className="btn btn-small btn-danger" onClick={() => borrar(v)} aria-label={`Borrar ${v.descripcion}`}><Trash2 size={16} aria-hidden="true" /></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {lista.length === 0 && !faltaTabla && (
        <div className="card">
          <div className="card-title"><CheckCircle2 size={18} aria-hidden="true" style={{ verticalAlign: 'middle' }} /> Sugerencias para empezar</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.8 }}>
            <li>ITV de cada tractor y remolque.</li>
            <li>Inspección del equipo de tratamientos (pulverizador/atomizador).</li>
            <li>Carné de aplicador de fitosanitarios de cada persona que trate.</li>
            <li>Seguros: tractor, seguro agrario de la cosecha.</li>
            <li>Plazo de la solicitud única de la PAC de este año.</li>
          </ul>
        </div>
      )}
    </div>
  )
}

export default VencimientosPage
