// Tarjeta de Inicio con los próximos recordatorios del campo (se marcan con un toque)
import { useEffect, useState } from 'react'
import { supabase } from '../data/supabaseClient'
import { fetchAll, isMissingTable } from '../utils/fetchAll'
import { elementosEnCola } from '../utils/offline'
import { diasHasta, fechaCorta } from '../utils/pendientes'
import { abrirAdjunto } from '../utils/adjuntos'
import { getIcon } from '../utils/lucideIcons'

export function etiquetaCuando(fecha) {
  const q = diasHasta(fecha)
  if (q == null) return null
  if (q < 0) return { texto: `Era el ${fechaCorta(fecha)}`, tono: 'rojo' }
  if (q === 0) return { texto: 'Hoy', tono: 'rojo' }
  if (q === 1) return { texto: 'Mañana', tono: 'ambar' }
  return { texto: fechaCorta(fecha), tono: q <= 7 ? 'ambar' : 'neutro' }
}

function RecordatoriosCard({ fincas, onNavigate, max = 4 }) {
  const [notas, setNotas] = useState([])
  const [estado, setEstado] = useState('cargando') // cargando | ok | falta | error
  const [, forzar] = useState(0)

  const cargar = async () => {
    const { data, error } = await fetchAll('notas_campo', q => q.eq('hecho', false))
    if (error) { setEstado(isMissingTable(error) ? 'falta' : 'error'); return }
    setNotas((data || []).filter(n => !n.hecho))
    setEstado('ok')
  }

  useEffect(() => {
    cargar()
    const recargar = () => { forzar(x => x + 1); cargar() }
    window.addEventListener('agrotrack-apuntado', recargar)
    window.addEventListener('agrotrack-cola-enviada', recargar)
    return () => {
      window.removeEventListener('agrotrack-apuntado', recargar)
      window.removeEventListener('agrotrack-cola-enviada', recargar)
    }
  }, [])

  const hecho = async (n) => {
    setNotas(prev => prev.filter(x => x.id !== n.id))
    const { error } = await supabase.from('notas_campo').update({ hecho: true }).eq('id', n.id)
    if (error) cargar()
  }

  const nombreFinca = (id) => fincas.find(f => String(f.id_finca) === String(id))?.nombre || ''
  const enCola = elementosEnCola().filter(e => e.tabla === 'notas_campo').map(e => ({ ...e.datos, id: e.id, enCola: true }))
  const lista = [...enCola, ...notas].sort((a, b) => (a.fecha_limite || '9999').localeCompare(b.fecha_limite || '9999'))
  const total = lista.length

  return (
    <section className="panel" aria-labelledby="titulo-recordatorios">
      <div className="panel-cabecera">
        <h2 id="titulo-recordatorios">{getIcon('StickyNote', { size: 20 })} Recordatorios</h2>
        {total > 0 && <button type="button" className="enlace" onClick={() => onNavigate?.('notas')}>Ver {total > max ? `los ${total}` : 'todos'}</button>}
      </div>

      {estado === 'falta' && (
        <p className="panel-vacio">
          Para usar los recordatorios falta crear su tabla: ejecuta una vez <code>docs/SQL_migracion_v1.9_notas.sql</code> en Supabase.
        </p>
      )}
      {estado === 'cargando' && <p className="panel-vacio">Cargando…</p>}
      {estado !== 'falta' && estado !== 'cargando' && total === 0 && (
        <p className="panel-vacio">Nada pendiente. Cuando veas algo en el campo, apúntalo con <strong>Recordatorio</strong> y te avisamos aquí.</p>
      )}

      {total > 0 && (
        <ul className="lista-recordatorios">
          {lista.slice(0, max).map(n => {
            const cuando = etiquetaCuando(n.fecha_limite)
            return (
              <li key={n.id}>
                {n.enCola ? (
                  <span className="check-recordatorio" title="Guardado en el móvil, se enviará con cobertura">{getIcon('CloudOff', { size: 20 })}</span>
                ) : (
                  <button type="button" className="check-recordatorio" onClick={() => hecho(n)} aria-label={`Marcar como hecho: ${n.texto}`}>
                    {getIcon('Circle', { size: 24 })}
                  </button>
                )}
                <div className="recordatorio-texto">
                  <span>{n.texto}</span>
                  <span className="recordatorio-meta">
                    {cuando && <span className={`etiqueta etiqueta-${cuando.tono}`}>{cuando.texto}</span>}
                    {n.id_finca && <span>{nombreFinca(n.id_finca)}</span>}
                    {n.foto_path && (
                      <button type="button" className="enlace" onClick={() => abrirAdjunto(n.foto_path).catch(() => {})}>
                        {getIcon('Camera', { size: 14 })} Foto
                      </button>
                    )}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default RecordatoriosCard
