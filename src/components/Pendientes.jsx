import { useEffect, useState } from 'react'
import { fetchAll } from '../utils/fetchAll'
import { calcPendientes } from '../utils/pendientes'
import { getIcon } from '../utils/lucideIcons'
import { useColaPendiente } from '../utils/offline'

// Tablas nuevas (v1.8): si aún no existen, simplemente no aportan avisos
async function cargarOpcional(tabla) {
  const { data, error } = await fetchAll(tabla)
  return error ? [] : (data || [])
}

function Pendientes({ fincas, labores, cosechas, gastos, ingresos, onNavigate }) {
  const [extra, setExtra] = useState({ aplicaciones: [], vencimientos: [], expedientes: [], requisitos: [], notas: [] })
  const { pendientes: enCola } = useColaPendiente()

  useEffect(() => {
    let vivo = true
    Promise.all(['aplicaciones', 'vencimientos', 'expedientes', 'expediente_requisitos', 'notas_campo'].map(cargarOpcional))
      .then(([aplicaciones, vencimientos, expedientes, requisitos, notas]) => {
        if (vivo) setExtra({ aplicaciones, vencimientos, expedientes, requisitos, notas })
      })
    return () => { vivo = false }
  }, [])

  const lista = calcPendientes({ fincas, labores, cosechas, gastos, ingresos, ...extra })
  if (enCola > 0) {
    lista.unshift({ id: 'cola', nivel: 'aviso', icono: 'CloudOff', texto: `${enCola} ${enCola === 1 ? 'registro guardado' : 'registros guardados'} sin cobertura`, detalle: 'Se enviarán solos al recuperar la señal' })
  }

  return (
    <section className="card" aria-labelledby="titulo-pendientes" style={{ marginBottom: 24 }}>
      <h2 id="titulo-pendientes" className="card-title" style={{ marginBottom: 12 }}>
        {lista.length ? `Tienes ${lista.length} ${lista.length === 1 ? 'cosa pendiente' : 'cosas pendientes'}` : 'Todo al día'}
      </h2>
      {lista.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
          No hay plazos, vencimientos ni facturas por completar. Buen trabajo.
        </p>
      ) : (
        <ul className="pendientes">
          {lista.slice(0, 8).map(p => (
            <li key={p.id}>
              <button
                type="button"
                className={`pendiente ${p.nivel}`}
                onClick={() => p.page && onNavigate?.(p.page)}
                disabled={!p.page}
              >
                <span className="pendiente-icono" aria-hidden="true">{getIcon(p.icono, { size: 18 })}</span>
                <span className="pendiente-texto">
                  {p.texto}
                  {p.detalle && <span className="pendiente-detalle">{p.detalle}</span>}
                </span>
                {p.page && <span aria-hidden="true">{getIcon('ChevronRight', { size: 18 })}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {lista.length > 8 && (
        <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>Y {lista.length - 8} más.</p>
      )}
    </section>
  )
}

export default Pendientes
