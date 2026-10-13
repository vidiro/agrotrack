import { MORE_NAV } from '../data/nav'
import { getIcon } from '../utils/lucideIcons'

function MoreSheet({ open, currentPage, setCurrentPage, onClose }) {
  if (!open) return null

  return (
    <div className="more-sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="more-sheet"
        role="dialog"
        aria-label="Más secciones"
        onClick={e => e.stopPropagation()}
      >
        <div className="more-sheet-handle" aria-hidden="true" />
        <h2 className="more-sheet-title">Más</h2>
        <ul className="more-sheet-grid">
          {MORE_NAV.map(item => (
            <li key={item.id}>
              <button
                type="button"
                className={`more-sheet-item ${currentPage === item.id ? 'active' : ''}`}
                onClick={() => {
                  setCurrentPage(item.id)
                  onClose()
                }}
                aria-label={item.label}
              >
                <span className="more-sheet-icon" aria-hidden="true">{getIcon(item.icon, { size: 24, strokeWidth: 2 })}</span>
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default MoreSheet
