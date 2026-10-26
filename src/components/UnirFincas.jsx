import { useEffect, useMemo, useState } from 'react'
import { Merge } from 'lucide-react'
import { resumenUnion, unirFincas, fincaUnida } from '../utils/unirFincas'
import { descargarCopiaSeguridad } from '../utils/backup'

// Panel para unir varias fincas (p. ej. parcelas contiguas de la misma finca) en una sola
function UnirFincas({ fincas, onHecho, onCancelar }) {
  const [busqueda, setBusqueda] = useState('')
  const [elegidas, setElegidas] = useState([]) // id_finca
  const [destinoId, setDestinoId] = useState('')
  const [resumen, setResumen] = useState(null)
  const [estado, setEstado] = useState('')
  const [error, setError] = useState('')

  const visibles = useMemo(() => {
    const t = busqueda.trim().toLowerCase()
    return [...fincas]
      .filter(f => !t || [f.nombre, f.id_finca, f.termino_municipal, f.poligono, f.parcela].join(' ').toLowerCase().includes(t))
      .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es') || String(a.parcela).localeCompare(String(b.parcela), 'es', { numeric: true }))
  }, [fincas, busqueda])

  const seleccion = elegidas.map(id => fincas.find(f => String(f.id_finca) === id)).filter(Boolean)
  const destino = seleccion.find(f => String(f.id_finca) === destinoId) || seleccion[0]
  const origenes = seleccion.filter(f => f !== destino)
  const resultado = destino && origenes.length ? fincaUnida(destino, origenes) : null

  useEffect(() => {
    setResumen(null)
    if (!origenes.length) return
    let vivo = true
    resumenUnion(origenes.map(f => f.id_finca)).then(r => { if (vivo) setResumen(r) }).catch(() => {})
    return () => { vivo = false }
  }, [elegidas.join(','), destinoId])

  const alternar = (id) => {
    const k = String(id)
    setElegidas(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])
    if (!destinoId) setDestinoId(k)
  }

  const avisoCultivo = new Set(seleccion.map(f => f.cultivo || '')).size > 1
  const avisoMunicipio = new Set(seleccion.map(f => f.termino_municipal || '')).size > 1

  const ejecutar = async () => {
    if (!destino || !origenes.length) return
    const texto = `Se unirán ${origenes.length + 1} fincas en «${destino.nombre}» (${destino.id_finca}).\n\n` +
      `Se moverán a ella todas las labores, cosechas, gastos, inversiones y ayudas de: ${origenes.map(f => `${f.id_finca}${f.parcela ? ` (parc. ${f.parcela})` : ''}`).join(', ')}, y esas fincas se borrarán.\n\n` +
      'Antes se descargará una copia de seguridad. ¿Continuar?'
    if (!window.confirm(texto)) return
    setError('')
    try {
      setEstado('Descargando copia de seguridad…')
      await descargarCopiaSeguridad(setEstado)
      await unirFincas(destino, origenes, setEstado)
      setEstado('')
      onHecho?.(`Fincas unidas en «${destino.nombre}». Superficie total: ${resultado.superficie_total_ha} ha.`)
    } catch (err) {
      setEstado('')
      setError(`No se pudo terminar la unión: ${err.message}. No se ha borrado ninguna finca; tienes la copia de seguridad descargada.`)
    }
  }

  return (
    <div className="card" style={{ borderColor: 'var(--color-primary)' }}>
      <div className="card-title"><Merge size={18} aria-hidden="true" style={{ verticalAlign: 'middle' }} /> Unir fincas</div>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '-4px 0 12px' }}>
        Marca las fincas que son en realidad una sola (por ejemplo, varias parcelas de PAJARITOS) y elige cuál queda.
        Sus labores, cosechas, gastos, inversiones y ayudas pasan a esa finca y las demás se borran. Las parcelas quedan anotadas en la finca resultante.
      </p>
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <input type="text" className="form-input mb-12" placeholder="Buscar por nombre, parcela o municipio" aria-label="Buscar fincas" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px', maxHeight: 280, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 12 }}>
        {visibles.map(f => {
          const k = String(f.id_finca)
          return (
            <li key={k} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', minHeight: 48, cursor: 'pointer' }}>
                <input type="checkbox" checked={elegidas.includes(k)} onChange={() => alternar(k)} style={{ width: 20, height: 20 }} />
                <span style={{ flex: 1 }}>
                  <strong>{f.nombre}</strong> <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{k}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    {[f.termino_municipal, f.poligono && `pol. ${f.poligono}`, f.parcela && `parc. ${f.parcela}`, f.superficie_total_ha && `${f.superficie_total_ha} ha`, f.cultivo].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      {seleccion.length >= 2 && (
        <>
          <div className="form-group">
            <label className="form-label" htmlFor="u-destino">Finca que queda (se conserva su código y su nombre)</label>
            <select id="u-destino" className="form-select" value={destino?.id_finca || ''} onChange={e => setDestinoId(e.target.value)}>
              {seleccion.map(f => <option key={f.id_finca} value={f.id_finca}>{f.nombre} · {f.id_finca}{f.parcela ? ` · parc. ${f.parcela}` : ''}</option>)}
            </select>
          </div>

          <div style={{ background: 'var(--color-bg)', borderRadius: 12, padding: 12, marginBottom: 12, fontSize: 14 }}>
            <strong>Resultado:</strong> {destino.nombre} · {resultado.superficie_total_ha} ha
            {resultado.poligono && ` · pol. ${resultado.poligono}`}{resultado.parcela && ` · parc. ${resultado.parcela}`}
            <div style={{ marginTop: 6 }}>
              {resumen
                ? `Se moverán ${resumen.labores} labores, ${resumen.cosechas} cosechas y ${resumen.gastos} gastos (además de inversiones y ayudas).`
                : 'Contando labores, cosechas y gastos…'}
            </div>
            {(avisoCultivo || avisoMunicipio) && (
              <div style={{ marginTop: 6, color: '#8a6200' }}>
                Ojo: las fincas marcadas tienen {[avisoCultivo && 'distinto cultivo', avisoMunicipio && 'distinto municipio'].filter(Boolean).join(' y ')}. Asegúrate de que de verdad son la misma finca.
              </div>
            )}
          </div>
        </>
      )}

      <div className="flex gap-12 flex-wrap">
        <button type="button" className="btn btn-primary" onClick={ejecutar} disabled={seleccion.length < 2 || !!estado}>
          {estado || (seleccion.length >= 2 ? `Unir ${seleccion.length} fincas` : 'Marca al menos 2 fincas')}
        </button>
        <button type="button" className="btn" style={{ background: 'none', border: '1px solid var(--color-border)' }} onClick={onCancelar} disabled={!!estado}>Cancelar</button>
      </div>
    </div>
  )
}

export default UnirFincas
