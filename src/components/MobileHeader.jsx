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
    configuracion: '⚙️ Configuración',
  }[currentPage] || 'AGROtrack'

  return (
    <header className="mobile-header">
      <div className="flex items-center justify-between">
        <h1>{pageTitle}</h1>
        <button
          className="btn btn-small btn-accent"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? '✕ Cerrar' : '☰ Menú'}
        </button>
      </div>
    </header>
  )
}

export default MobileHeader
