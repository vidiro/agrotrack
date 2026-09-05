import { ALL_NAV } from '../data/nav'

function Sidebar({ currentPage, setCurrentPage, mobileMenuOpen, setMobileMenuOpen, darkMode, toggleDarkMode, userEmail, onLogout }) {
  return (
    <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <h1>🚜 AGROtrack</h1>
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
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="sidebar-footer">
        <button type="button" className="nav-item" onClick={toggleDarkMode}>
          <span className="nav-icon">{darkMode ? '☀️' : '🌙'}</span>
          <span>{darkMode ? 'Modo claro' : 'Modo oscuro'}</span>
        </button>
        {userEmail && (
          <p className="sidebar-user" title={userEmail}>{userEmail}</p>
        )}
        <button type="button" className="nav-item" onClick={onLogout}>
          <span className="nav-icon">🚪</span>
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
