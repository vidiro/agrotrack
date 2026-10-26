import { PAGES } from '../data/nav'
import { getIcon } from '../utils/lucideIcons'
import { useColaPendiente } from '../utils/offline'

function MobileHeader({ currentPage, setCurrentPage, mobileMenuOpen, setMobileMenuOpen }) {
  const page = PAGES[currentPage]
  const { pendientes, enLinea } = useColaPendiente()

  return (
    <header className="mobile-header">
      <div className="flex items-center justify-between">
        <h1>
          {getIcon(page?.icon || 'Tractor', { size: 20, strokeWidth: 2 })}
          {page?.label || 'AGROtrack'}
        </h1>
        <div className="mobile-header-actions">
          {(!enLinea || pendientes > 0) && (
            <span className="estado-conexion" role="status" title={enLinea ? 'Enviando registros guardados sin cobertura' : 'Sin cobertura: lo que guardes se enviará al recuperar la señal'}>
              {getIcon('CloudOff', { size: 18 })}
              {pendientes > 0 ? pendientes : ''}
            </span>
          )}
          <button
            type="button"
            className="mobile-header-btn"
            onClick={() => setCurrentPage('configuracion')}
            aria-label="Ajustes"
          >
            {getIcon('Settings', { size: 20, strokeWidth: 2 })}
          </button>
          <button
            type="button"
            className="mobile-header-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            {getIcon(mobileMenuOpen ? 'X' : 'Menu', { size: 20, strokeWidth: 2 })}
          </button>
        </div>
      </div>
    </header>
  )
}

export default MobileHeader
