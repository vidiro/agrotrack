import { PAGES, seccionDePagina } from '../data/nav'
import { getIcon } from '../utils/lucideIcons'

// Pestañas del bloque actual (Campo, Dinero, Fincas, Papeles) encima de cada página
function SectionTabs({ currentPage, setCurrentPage }) {
  const sec = seccionDePagina(currentPage)
  if (!sec || sec.pages.length < 2) return null

  return (
    <nav className="section-tabs" aria-label={`Apartados de ${sec.label}`}>
      <h1 className="section-tabs-titulo">{sec.label}</h1>
      <div className="section-tabs-lista" role="tablist">
        {sec.pages.filter(id => id !== 'finca_detalle' || currentPage === id).map(id => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={currentPage === id}
            className={`section-tab ${currentPage === id ? 'active' : ''}`}
            onClick={() => setCurrentPage(id)}
          >
            <span aria-hidden="true">{getIcon(PAGES[id].icon, { size: 16, strokeWidth: 2 })}</span>
            {PAGES[id].label}
          </button>
        ))}
      </div>
    </nav>
  )
}

export default SectionTabs
