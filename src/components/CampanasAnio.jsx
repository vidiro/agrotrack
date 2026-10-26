import { useState } from 'react'
import { supabase } from '../data/supabaseClient'
import { calendarioCampanas, claveInicio, aNumero, aISO } from '../utils/campanas'

// Fecha real de inicio de cada campaña (cada año empieza un día distinto)
function CampanasAnio({ params = [], onGuardado }) {
  const cal = calendarioCampanas(params)
  const actual = cal.campanaDe(new Date()) || new Date().getFullYear() + 1
  const [guardando, setGuardando] = useState(null)
  const [error, setError] = useState('')

  // Campañas a mostrar: las 5 anteriores, la actual y la siguiente, más cualquiera que ya tenga fecha propia
  const anios = [...new Set([...Array.from({ length: 7 }, (_, i) => actual - 5 + i), ...cal.propias.keys()])].sort((a, b) => b - a)

  const guardar = async (n, valorISO) => {
    setError('')
    setGuardando(n)
    try {
      const clave = claveInicio(n)
      const existe = params.some(p => p.clave === clave)
      if (!valorISO) {
        if (existe) {
          const { error: err } = await supabase.from('params').delete().eq('clave', clave)
          if (err) throw err
        }
      } else {
        const valor = aNumero(valorISO)
        const { error: err } = existe
          ? await supabase.from('params').update({ valor }).eq('clave', clave)
          : await supabase.from('params').insert([{ clave, valor }])
        if (err) throw err
      }
      await onGuardado?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(null)
    }
  }

  const fmt = (d) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="card" style={{ borderLeft: '4px solid var(--color-primary)', marginBottom: 16 }}>
      <div className="card-title">Inicio de cada campaña</div>
      <p className="text-muted text-sm mb-16" style={{ marginTop: -4 }}>
        Si cada año la campaña empieza un día distinto (por ejemplo, cuando arranca la vendimia), pon aquí la fecha real.
        Cada campaña termina el día antes de que empiece la siguiente. Las que dejes en blanco usan el día y mes de arriba.
      </p>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="table-container">
        <table className="data-table">
          <thead><tr><th>Campaña</th><th>Empieza el</th><th>Termina el</th><th></th></tr></thead>
          <tbody>
            {anios.map(n => {
              const propia = cal.propias.get(n)
              const { start, end } = cal.rango(n)
              const fin = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1)
              return (
                <tr key={n} style={n === actual ? { background: 'var(--color-bg)' } : undefined}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <strong>{n}</strong>{n === actual && <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}> · en curso</span>}
                  </td>
                  <td>
                    <input
                      type="date"
                      className="form-input"
                      style={{ maxWidth: 180 }}
                      aria-label={`Fecha de inicio de la campaña ${n}`}
                      defaultValue={propia ? aISO(propia) : ''}
                      key={propia ? aISO(propia) : `vacio-${n}`}
                      min={`${n - 2}-01-01`}
                      max={`${n}-12-31`}
                      onBlur={e => { const v = e.target.value; if (v !== (propia ? aISO(propia) : '')) guardar(n, v) }}
                      disabled={guardando === n}
                    />
                    {!propia && <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>Por defecto: {fmt(start)}</div>}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmt(fin)}</td>
                  <td>
                    {propia && (
                      <button type="button" className="btn btn-small" style={{ background: 'none', border: '1px solid var(--color-border)' }} onClick={() => guardar(n, '')} disabled={guardando === n}>
                        Usar por defecto
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default CampanasAnio
