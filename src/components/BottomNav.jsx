import { SECCIONES, seccionDePagina } from '../data/nav'
import { getIcon } from '../utils/lucideIcons'
import { irASeccion } from './TopBar'

// Barra inferior del móvil: los 5 apartados siempre a mano (con el pulgar)
function BottomNav({ currentPage, setCurrentPage }) {
  const actual = seccionDePagina(currentPage)

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
              onClick={() => irASeccion(sec, currentPage, setCurrentPage)}
              aria-current={activa ? 'page' : undefined}
            >
              <span className="bottom-nav-icon" aria-hidden="true">{getIcon(sec.icon, { size: 24, strokeWidth: activa ? 2.4 : 2 })}</span>
              <span>{sec.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomNav
