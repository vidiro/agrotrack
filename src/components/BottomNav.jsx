import { SECCIONES, seccionDePagina } from '../data/nav'
import { getIcon } from '../utils/lucideIcons'

// Recuerda la última página visitada de cada bloque para volver a ella
const ultimaPorSeccion = {}

function BottomNav({ currentPage, setCurrentPage }) {
  const actual = seccionDePagina(currentPage)
  if (actual) ultimaPorSeccion[actual.id] = currentPage

  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      <div className="bottom-nav-items">
        {SECCIONES.map(sec => {
          const activa = actual?.id === sec.id
          return (
            <button
              key={sec.id}
              type="button"
              className={`bottom-nav-item ${activa ? 'active' : ''}`}
              onClick={() => setCurrentPage(activa ? sec.pages[0] : (ultimaPorSeccion[sec.id] || sec.pages[0]))}
              aria-current={activa ? 'page' : undefined}
            >
              <span className="bottom-nav-icon" aria-hidden="true">{getIcon(sec.icon, { size: 22, strokeWidth: 2 })}</span>
              <span>{sec.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomNav
