import { useState } from 'react'
import { getIcon } from '../utils/lucideIcons'

const CLAVE = 'agrotrack-aviso-instalar-cerrado'

// En iPhone, la app solo funciona sin cobertura si se instala en la pantalla de inicio.
// Este aviso sale en Safari (no instalada) y se puede cerrar para siempre.
function esIOS() {
  const ua = navigator.userAgent || ''
  return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}
function instalada() {
  return window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches
}

function AvisoInstalar() {
  const [visible, setVisible] = useState(() => {
    try {
      if (localStorage.getItem(CLAVE) === '1') return false
    } catch { /* sin almacenamiento */ }
    return esIOS() && !instalada()
  })
  if (!visible) return null

  const cerrar = () => {
    try { localStorage.setItem(CLAVE, '1') } catch { /* sin almacenamiento */ }
    setVisible(false)
  }

  return (
    <div className="alert alert-info" role="status" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ flex: 1 }}>
        <strong>Instala AGROtrack en el iPhone</strong>
        <div style={{ marginTop: 4 }}>
          Toca <strong>Compartir</strong> (el cuadrado con la flecha hacia arriba) y luego <strong>«Añadir a pantalla de inicio»</strong>.
          Así se abre como una app y puedes apuntar en el campo aunque no haya cobertura.
        </div>
      </div>
      <button type="button" className="asistente-icono-btn" onClick={cerrar} aria-label="Cerrar aviso" style={{ width: 40, height: 40, flexShrink: 0 }}>
        {getIcon('X', { size: 20 })}
      </button>
    </div>
  )
}

export default AvisoInstalar
