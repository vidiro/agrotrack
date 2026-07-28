function BottomNav({ currentPage, setCurrentPage }) {
  const items = [
    { id: 'dashboard', icon: '🏠', label: 'Inicio' },
    { id: 'labores', icon: '📝', label: 'Labores' },
    { id: 'fincas', icon: '🌍', label: 'Fincas' },
    { id: 'personal', icon: '👥', label: 'Personal' },
    { id: 'maquinaria', icon: '🚜', label: 'Máq.' },
    { id: 'cosechas', icon: '🍇', label: 'Cosecha' },
    { id: 'gastos', icon: '💰', label: 'Gastos' },
    { id: 'configuracion', icon: '⚙️', label: 'Ajustes' },
  ]

  return (
    <nav className="bottom-nav" role="navigation" aria-label="Navegación principal">
      <ul className="bottom-nav-items">
        {items.map(item => (
          <li
            key={item.id}
            className={`bottom-nav-item ${currentPage === item.id ? 'active' : ''}`}
            onClick={() => setCurrentPage(item.id)}
            role="button"
            tabIndex={0}
            aria-label={item.label}
            aria-current={currentPage === item.id ? 'page' : undefined}
          >
            <span className="bottom-nav-icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default BottomNav
