// Barra superior única (escritorio y móvil). En escritorio lleva los 5 apartados;
// en el móvil los apartados van abajo (BottomNav) y aquí solo el nombre, la conexión y Ajustes.
import { SECCIONES, seccionDePagina } from '../data/nav'
import { getIcon } from '../utils/lucideIcons'
import { useColaPendiente } from '../utils/offline'

// Última página visitada de cada apartado, para volver a ella
const ultimaPorSeccion = {}
export function irASeccion(sec, currentPage, setCurrentPage) {
  const actual = seccionDePagina(currentPage)
  setCurrentPage(actual?.id === sec.id ? sec.pages[0] : (ultimaPorSeccion[sec.id] || sec.pages[0]))
}
export function recordarPagina(currentPage) {
  const actual = seccionDePagina(currentPage)
  if (actual) ultimaPorSeccion[actual.id] = currentPage
}

export function Marca({ tamano = 34 }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 40 40" aria-hidden="true" className="marca-logo">
      <rect width="40" height="40" rx="11" fill="var(--verde-campo)" />
      <path d="M11 31.5h18" stroke="#f6f1e4" strokeWidth="2.2" strokeLinecap="round" opacity=".45" />
      <path d="M20 29.5V18" stroke="var(--trigo)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M20 19c0-5 3.5-8.5 9-8.5 0 5.5-3.5 9-9 8.5Z" fill="var(--trigo)" />
      <path d="M20 23c0-4-3-7-8-7 0 4.5 3 7.5 8 7Z" fill="#f6f1e4" />
    </svg>
  )
}

function EstadoConexion() {
  const { pendientes, enLinea } = useColaPendiente()
  if (enLinea && pendientes === 0) return null
  return (
    <span className={`estado-pill ${enLinea ? 'enviando' : 'sin-red'}`} role="status"
      title={enLinea ? 'Enviando lo apuntado sin cobertura' : 'Sin cobertura: lo que apuntes se enviará al recuperar la señal'}>
      {getIcon('CloudOff', { size: 16 })}
      <span>{enLinea ? `Enviando ${pendientes}` : (pendientes ? `Sin cobertura · ${pendientes}` : 'Sin cobertura')}</span>
    </span>
  )
}

function TopBar({ currentPage, setCurrentPage, darkMode, toggleDarkMode }) {
  recordarPagina(currentPage)
  const actual = seccionDePagina(currentPage)

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button type="button" className="marca" onClick={() => setCurrentPage('dashboard')} aria-label="AGROtrack, ir a Inicio">
          <Marca />
          <span className="marca-nombre">AGRO<b>track</b></span>
        </button>

        <nav className="topbar-nav" aria-label="Apartados">
          {SECCIONES.map(sec => {
            const activa = actual?.id === sec.id
            return (
              <button
                key={sec.id}
                type="button"
                className={`topbar-item ${activa ? 'active' : ''}`}
                aria-current={activa ? 'page' : undefined}
                onClick={() => irASeccion(sec, currentPage, setCurrentPage)}
              >
                {getIcon(sec.icon, { size: 18, strokeWidth: 2 })}
                {sec.label}
              </button>
            )
          })}
        </nav>

        <div className="topbar-acciones">
          <EstadoConexion />
          <button type="button" className="icono-btn solo-escritorio" onClick={toggleDarkMode} aria-label={darkMode ? 'Modo claro' : 'Modo oscuro'} title={darkMode ? 'Modo claro' : 'Modo oscuro'}>
            {getIcon(darkMode ? 'Sun' : 'Moon', { size: 20 })}
          </button>
          <button
            type="button"
            className={`icono-btn ${currentPage === 'configuracion' ? 'active' : ''}`}
            onClick={() => setCurrentPage('configuracion')}
            aria-label="Ajustes"
            title="Ajustes"
          >
            {getIcon('Settings', { size: 20 })}
          </button>
        </div>
      </div>
    </header>
  )
}

export default TopBar
