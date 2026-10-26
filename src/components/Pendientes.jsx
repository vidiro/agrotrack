import { useEffect, useState } from 'react'
import { fetchAll } from '../utils/fetchAll'
import { calcPendientes } from '../utils/pendientes'
import { getIcon } from '../utils/lucideIcons'
import { useColaPendiente } from '../utils/offline'

// Tablas nuevas: si aún no existen, simplemente no aportan avisos
async function cargarOpcional(tabla) {
  const { data, error } = await fetchAll(tabla)
  return error ? [] : (data || [])
}

/**
 * Avisos: plazos de seguridad, vencimientos, ayudas, facturas incompletas…
 * @param {boolean} sinNotas - no repetir los recordatorios (en Inicio ya tienen su tarjeta)
 */
function Pendientes({ fincas, labores, cosechas, gastos, ingresos, onNavigate, max = 4, sinNotas = false }) {
  const [extra, setExtra] = useState({ aplicaciones: [], vencimientos: [], expedientes: [], requisitos: [], notas: [] })
  const [verTodos, setVerTodos] = useState(false)
  const { pendientes: enCola } = useColaPendiente()

  useEffect(() => {
    let vivo = true
    Promise.all(['aplicaciones', 'vencimientos', 'expedientes', 'expediente_requisitos', 'notas_campo'].map(cargarOpcional))
      .then(([aplicaciones, vencimientos, expedientes, requisitos, notas]) => {
        if (vivo) setExtra({ aplicaciones, vencimientos, expedientes, requisitos, notas: sinNotas ? [] : notas })
      })
    return () => { vivo = false }
  }, [sinNotas])

  const lista = calcPendientes({ fincas, labores, cosechas, gastos, ingresos, ...extra })
  if (enCola > 0) {
    lista.unshift({ id: 'cola', nivel: 'aviso', icono: 'CloudOff', texto: `${enCola} ${enCola === 1 ? 'apunte guardado' : 'apuntes guardados'} sin cobertura`, detalle: 'Se enviarán solos al recuperar la señal' })
  }
  const visibles = verTodos ? lista : lista.slice(0, max)

  return (
    <section className="panel" aria-labelledby="titulo-pendientes">
      <div className="panel-cabecera">
        <h2 id="titulo-pendientes">
          {getIcon('AlertTriangle', { size: 20 })} Avisos
          {lista.length > 0 && <span className="contador">{lista.length}</span>}
        </h2>
        {lista.length > max && (
          <button type="button" className="enlace" onClick={() => setVerTodos(v => !v)}>
            {verTodos ? 'Ver menos' : `Ver los ${lista.length}`}
          </button>
        )}
      </div>
      {lista.length === 0 ? (
        <p className="panel-vacio">Todo al día: no hay plazos, vencimientos ni facturas por completar.</p>
      ) : (
        <ul className="pendientes">
          {visibles.map(p => (
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
                {p.page && <span aria-hidden="true" className="pendiente-flecha">{getIcon('ChevronRight', { size: 18 })}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default Pendientes
