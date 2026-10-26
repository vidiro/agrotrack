import { SECCIONES, PAGES } from '../data/nav'
import { getIcon } from '../utils/lucideIcons'

function Sidebar({ currentPage, setCurrentPage, mobileMenuOpen, setMobileMenuOpen, darkMode, toggleDarkMode, modoCampo, toggleModoCampo, userEmail, onLogout }) {
  const ir = (id) => {
    setCurrentPage(id)
    setMobileMenuOpen(false)
  }

  const boton = (id) => (
    <li key={id}>
      <button
        type="button"
        className={`nav-item ${currentPage === id ? 'active' : ''}`}
        onClick={() => ir(id)}
        aria-current={currentPage === id ? 'page' : undefined}
      >
        <span className="nav-icon" aria-hidden="true">{getIcon(PAGES[id].icon, { size: 20, strokeWidth: 2 })}</span>
        <span>{PAGES[id].label}</span>
      </button>
    </li>
  )

  return (
    <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`} aria-label="Menú">
      <div className="sidebar-header">
        <h1>{getIcon('Tractor', { size: 24 })} AGROtrack</h1>
        <p>El papeleo del campo, hecho</p>
      </div>
      <nav className="nav-menu">
        {SECCIONES.map(sec => (
          <div key={sec.id} className="nav-grupo">
            {sec.id !== 'inicio' && <div className="nav-grupo-titulo">{sec.label}</div>}
            <ul>{sec.pages.map(boton)}</ul>
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <ul>{boton('configuracion')}</ul>
        <button type="button" className="nav-item" onClick={toggleModoCampo} aria-pressed={modoCampo}>
          <span className="nav-icon" aria-hidden="true">{getIcon('Contrast', { size: 20, strokeWidth: 2 })}</span>
          <span>{modoCampo ? 'Modo campo: activado' : 'Modo campo (al sol)'}</span>
        </button>
        <button type="button" className="nav-item" onClick={toggleDarkMode}>
          <span className="nav-icon" aria-hidden="true">{getIcon(darkMode ? 'Sun' : 'Moon', { size: 20, strokeWidth: 2 })}</span>
          <span>{darkMode ? 'Modo claro' : 'Modo oscuro'}</span>
        </button>
        {userEmail && <p className="sidebar-user" title={userEmail}>{userEmail}</p>}
        <button type="button" className="nav-item" onClick={onLogout}>
          <span className="nav-icon" aria-hidden="true">{getIcon('LogOut', { size: 20, strokeWidth: 2 })}</span>
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
