// Recordatorios apuntados en el campo (con foto, finca y fecha)
import { useEffect, useState } from 'react'
import { supabase } from '../data/supabaseClient'
import { fetchAll, isMissingTable } from '../utils/fetchAll'
import { abrirAdjunto, borrarAdjunto } from '../utils/adjuntos'
import { elementosEnCola, useColaPendiente } from '../utils/offline'
import { diasHasta, fechaCorta } from '../utils/pendientes'
import { getIcon } from '../utils/lucideIcons'
import { Avisos, Cargando, Vacio, FaltaMigracion, Cabecera } from './ui'

function NotasPage({ fincas, onNavigate }) {
  const [notas, setNotas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [falta, setFalta] = useState(false)
  const [error, setError] = useState('')
  const [verHechas, setVerHechas] = useState(false)
  const [finca, setFinca] = useState('')
  const { pendientes } = useColaPendiente()

  const cargar = async () => {
    setCargando(true)
    setError('')
    const { data, error: err } = await fetchAll('notas_campo', q => q.order('created_at', { ascending: false }))
    if (err) {
      if (isMissingTable(err)) setFalta(true)
      else setError(err.message)
    } else {
      setFalta(false)
      setNotas(data || [])
    }
    setCargando(false)
  }
  useEffect(() => { cargar() }, [pendientes])

  const nombreFinca = (id) => fincas.find(f => String(f.id_finca) === String(id))?.nombre || ''

  const marcar = async (n) => {
    setNotas(prev => prev.map(x => (x.id === n.id ? { ...x, hecho: !n.hecho } : x)))
    const { error: err } = await supabase.from('notas_campo').update({ hecho: !n.hecho }).eq('id', n.id)
    if (err) { setError(err.message); cargar() }
  }

  const borrar = async (n) => {
    if (!window.confirm('¿Borrar este recordatorio?')) return
    const { error: err } = await supabase.from('notas_campo').delete().eq('id', n.id)
    if (err) { setError(err.message); return }
    if (n.foto_path) borrarAdjunto(n.foto_path).catch(() => {})
    setNotas(prev => prev.filter(x => x.id !== n.id))
  }

  const enCola = elementosEnCola().filter(e => e.tabla === 'notas_campo')
  const visibles = notas
    .filter(n => (verHechas ? n.hecho : !n.hecho))
    .filter(n => !finca || String(n.id_finca) === finca)
    .sort((a, b) => (a.fecha_limite || '9999').localeCompare(b.fecha_limite || '9999'))

  const etiquetaFecha = (f) => {
    const q = diasHasta(f)
    if (q == null) return null
    if (q < 0) return { texto: `Pasado (${fechaCorta(f)})`, clase: 'badge-red' }
    if (q === 0) return { texto: 'Hoy', clase: 'badge-red' }
    if (q === 1) return { texto: 'Mañana', clase: 'badge-yellow' }
    return { texto: fechaCorta(f), clase: q <= 7 ? 'badge-yellow' : 'badge-blue' }
  }

  return (
    <div>
      <Cabecera titulo="Recordatorios" descripcion="Cosas por hacer apuntadas en el campo.">
        <button type="button" className="btn btn-primary" onClick={() => onNavigate?.('apuntar')}>{getIcon('Camera', { size: 18 })} Nuevo</button>
      </Cabecera>
      {falta && <FaltaMigracion archivo="docs/SQL_migracion_v1.9_notas.sql" />}
      <Avisos error={error} onReintentar={cargar} />

      <div className="chips" style={{ marginBottom: 12 }}>
        <button type="button" className={`chip${!verHechas ? ' sel' : ''}`} onClick={() => setVerHechas(false)}>Por hacer</button>
        <button type="button" className={`chip${verHechas ? ' sel' : ''}`} onClick={() => setVerHechas(true)}>Hechas</button>
        <select className="form-select" style={{ minHeight: 48, width: 'auto' }} value={finca} onChange={e => setFinca(e.target.value)} aria-label="Filtrar por finca">
          <option value="">Todas las fincas</option>
          {fincas.map(f => <option key={f.id_finca} value={f.id_finca}>{f.nombre}</option>)}
        </select>
      </div>

      {enCola.length > 0 && !verHechas && (
        <div className="card" style={{ marginBottom: 12, borderLeft: '4px solid var(--color-warning, #d97706)' }}>
          {enCola.map(e => (
            <div key={e.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0' }}>
              {getIcon('CloudOff', { size: 18 })}
              <span style={{ flex: 1 }}>{e.datos.texto}{e.datos.id_finca && <small className="text-muted"> · {nombreFinca(e.datos.id_finca)}</small>}</span>
              <small className="text-muted">Se enviará con cobertura</small>
            </div>
          ))}
        </div>
      )}

      {cargando ? <Cargando /> : visibles.length === 0 ? (
        !falta && <Vacio texto={verHechas ? 'No hay recordatorios hechos.' : 'Nada pendiente. Apunta desde el campo con «Apuntar → Recordatorio».'} />
      ) : (
        <div className="lista-opciones">
          {visibles.map(n => {
            const et = etiquetaFecha(n.fecha_limite)
            return (
              <div key={n.id} className="card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 14, marginBottom: 0 }}>
                <button
                  type="button"
                  className="asistente-icono-btn"
                  style={{ flexShrink: 0, color: n.hecho ? 'var(--exito)' : 'var(--texto-suave)' }}
                  onClick={() => marcar(n)}
                  aria-label={n.hecho ? 'Marcar como pendiente' : 'Marcar como hecho'}
                  aria-pressed={!!n.hecho}
                >
                  {getIcon(n.hecho ? 'CheckCircle2' : 'Circle', { size: 28 })}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '1.02rem', textDecoration: n.hecho ? 'line-through' : 'none', wordBreak: 'break-word' }}>{n.texto}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
                    {n.id_finca && <span className="badge badge-green">{nombreFinca(n.id_finca) || 'Finca'}</span>}
                    {et && <span className={`badge ${et.clase}`}>{et.texto}</span>}
                    {n.foto_path && (
                      <button type="button" className="btn btn-small" onClick={() => abrirAdjunto(n.foto_path).catch(e => setError(e.message))}>
                        {getIcon('Camera', { size: 14 })} Ver foto
                      </button>
                    )}
                  </div>
                </div>
                <button type="button" className="btn btn-small btn-danger" onClick={() => borrar(n)} aria-label={`Borrar: ${n.texto}`}>{getIcon('Trash2', { size: 16 })}</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default NotasPage
