import { ALL_NAV } from '../data/nav'
import { getIcon } from '../utils/lucideIcons'

function Sidebar({ currentPage, setCurrentPage, mobileMenuOpen, setMobileMenuOpen, darkMode, toggleDarkMode, userEmail, onLogout }) {
  return (
    <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <h1>{getIcon('Tractor', { size: 24 })} AGROtrack</h1>
        <p>Gestión Agrícola</p>
      </div>
      <ul className="nav-menu">
        {ALL_NAV.map(item => (
          <li key={item.id}>
            <button
              type="button"
              className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => {
                setCurrentPage(item.id)
                setMobileMenuOpen(false)
              }}
              aria-label={item.label}
            >
              <span className="nav-icon">{getIcon(item.icon, { size: 20, strokeWidth: 2 })}</span>
              <span>{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="sidebar-footer">
        <button type="button" className="nav-item" onClick={toggleDarkMode} aria-label={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}>
          <span className="nav-icon">{getIcon(darkMode ? 'Sun' : 'Moon', { size: 20, strokeWidth: 2 })}</span>
          <span>{darkMode ? 'Modo claro' : 'Modo oscuro'}</span>
        </button>
        {userEmail && (
          <p className="sidebar-user" title={userEmail}>{userEmail}</p>
        )}
        <button type="button" className="nav-item" onClick={onLogout} aria-label="Cerrar sesión">
          <span className="nav-icon">{getIcon('LogOut', { size: 20, strokeWidth: 2 })}</span>
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
