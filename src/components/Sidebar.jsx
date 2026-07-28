function Sidebar({ currentPage, setCurrentPage, mobileMenuOpen, setMobileMenuOpen }) {
  const navItems = [
    { id: 'dashboard', icon: '🏠', label: 'Inicio' },
    { id: 'labores', icon: '📝', label: 'Labores' },
    { id: 'aplicaciones', icon: '🧪', label: 'Aplicaciones' },
    { id: 'cosechas', icon: '🍇', label: 'Cosechas' },
    { id: 'gastos', icon: '💰', label: 'Gastos' },
    { id: 'finanzas', icon: '📊', label: 'Finanzas' },
    { id: 'fincas', icon: '🌍', label: 'Fincas' },
    { id: 'personal', icon: '👥', label: 'Personal' },
    { id: 'maquinaria', icon: '🚜', label: 'Maquinaria' },
    { id: 'inventario', icon: '📦', label: 'Inventario' },
    { id: 'configuracion', icon: '⚙️', label: 'Configuración' },
  ]

  return (
    <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <h1>🚜 AGROtrack</h1>
        <p>Gestión Agrícola</p>
      </div>
      <ul className="nav-menu">
        {navItems.map(item => (
          <li
            key={item.id}
            className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
            onClick={() => {
              setCurrentPage(item.id)
              setMobileMenuOpen(false)
            }}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </aside>
  )
}

export default Sidebar
