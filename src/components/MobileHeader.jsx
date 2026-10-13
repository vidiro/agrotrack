import { ALL_NAV } from '../data/nav'
import { getIcon } from '../utils/lucideIcons'

function MobileHeader({ currentPage, setCurrentPage, mobileMenuOpen, setMobileMenuOpen, darkMode, toggleDarkMode }) {
  const currentPageData = ALL_NAV.find(item => item.id === currentPage)
  const pageTitle = currentPageData?.label || 'AGROtrack'

  return (
    <header className="mobile-header">
      <div className="flex items-center justify-between">
        <h1>
          {getIcon(currentPageData?.icon || 'Tractor', { size: 20, strokeWidth: 2 })}
          {pageTitle}
        </h1>
        <div className="mobile-header-actions">
          <button
            className="mobile-header-btn"
            onClick={toggleDarkMode}
            aria-label={darkMode ? 'Modo claro' : 'Modo oscuro'}
          >
            {getIcon(darkMode ? 'Sun' : 'Moon', { size: 20, strokeWidth: 2 })}
          </button>
          <button
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
