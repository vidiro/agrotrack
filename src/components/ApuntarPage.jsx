// Apuntar en el campo: cuatro botones grandes que abren un asistente a pantalla completa.
// Funciona sin cobertura: usa los datos guardados en el móvil y envía lo apuntado al volver la señal.
import { useState } from 'react'
import { getIcon } from '../utils/lucideIcons'
import { useColaPendiente, procesarCola, elementosEnCola } from '../utils/offline'
import AccionesApuntar from './campo/AccionesApuntar'
import RecordatoriosCard from './RecordatoriosCard'

const ETIQUETA_TABLA = { labores: 'Jornada', __tratamiento: 'Tratamiento', gastos_manual: 'Gasto', notas_campo: 'Recordatorio' }

function ApuntarPage(props) {
  const { fincas, onNavigate } = props
  const { pendientes, enLinea } = useColaPendiente()
  const [enviando, setEnviando] = useState(false)

  const enviarAhora = async () => {
    setEnviando(true)
    try { await procesarCola() } finally { setEnviando(false) }
  }

  return (
    <div className="inicio">
      <header className="inicio-saludo">
        <h1>¿Qué quieres apuntar?</h1>
        <p className="inicio-fecha" style={{ textTransform: 'none' }}>
          {enLinea ? 'Elige y sigue los pasos. Se guarda al momento.' : 'Sin cobertura: apunta igual, se enviará al volver la señal.'}
        </p>
      </header>

      {pendientes > 0 && (
        <div className="alert alert-info" role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200 }}>
            {getIcon('CloudOff', { size: 20 })}
            <span>
              <strong>{pendientes} {pendientes === 1 ? 'apunte espera' : 'apuntes esperan'} cobertura</strong>
              <small style={{ display: 'block' }}>
                {elementosEnCola().map(e => ETIQUETA_TABLA[e.tabla] || e.tabla).join(', ')}
              </small>
            </span>
          </span>
          {enLinea && (
            <button type="button" className="btn btn-small btn-primary" onClick={enviarAhora} disabled={enviando}>
              {enviando ? 'Enviando…' : 'Enviar ahora'}
            </button>
          )}
        </div>
      )}

      <div className="inicio-bloque">
        <AccionesApuntar modo="tiles" {...props} />
      </div>

      <RecordatoriosCard fincas={fincas} onNavigate={onNavigate} max={6} />
    </div>
  )
}

export default ApuntarPage
