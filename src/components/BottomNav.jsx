import { PRIMARY_NAV, MORE_NAV } from '../data/nav'

function BottomNav({ currentPage, setCurrentPage, moreOpen, setMoreOpen }) {
  const moreActive = MORE_NAV.some(item => item.id === currentPage)

  return (
    <nav className="bottom-nav" role="navigation" aria-label="Navegación principal">
      <div className="bottom-nav-items">
        {PRIMARY_NAV.map(item => (
          <button
            key={item.id}
            type="button"
            className={`bottom-nav-item ${currentPage === item.id ? 'active' : ''}`}
            onClick={() => {
              setMoreOpen(false)
              setCurrentPage(item.id)
            }}
            aria-label={item.label}
            aria-current={currentPage === item.id ? 'page' : undefined}
          >
            <span className="bottom-nav-icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
        <button
          type="button"
          className={`bottom-nav-item ${moreActive || moreOpen ? 'active' : ''}`}
          onClick={() => setMoreOpen(open => !open)}
          aria-label="Más secciones"
          aria-expanded={moreOpen}
        >
          <span className="bottom-nav-icon" aria-hidden="true">☰</span>
          <span>Más</span>
        </button>
      </div>
    </nav>
  )
}

export default BottomNav
