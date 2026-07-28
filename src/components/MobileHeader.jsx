function MobileHeader({ currentPage, setCurrentPage, mobileMenuOpen, setMobileMenuOpen }) {
  const pageTitle = {
    dashboard: '🏠 Inicio',
    labores: '📝 Labores',
    aplicaciones: '🧪 Aplicaciones',
    cosechas: '🍇 Cosechas',
    gastos: '💰 Gastos',
    finanzas: '📊 Finanzas',
    fincas: '🌍 Fincas',
    personal: '👥 Personal',
    maquinaria: '🚜 Maquinaria',
    inventario: '📦 Inventario',
    configuracion: '⚙️ Ajustes',
  }[currentPage] || 'AGROtrack'

  return (
    <header className="mobile-header">
      <div className="flex items-center justify-between">
        <h1>{pageTitle}</h1>
        <div className="mobile-header-actions">
          <button
            className="mobile-header-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menú"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>
    </header>
  )
}

export default MobileHeader
