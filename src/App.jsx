import { useState, useEffect, lazy, Suspense } from 'react'
import { getIcon } from './utils/lucideIcons'
import { supabase, isSupabaseConfigured } from './data/supabaseClient'
import { isMissingTable } from './utils/fetchAll'
import LoginPage from './components/LoginPage'
import Sidebar from './components/Sidebar'
import MobileHeader from './components/MobileHeader'
import BottomNav from './components/BottomNav'
import SectionTabs from './components/SectionTabs'
import { iniciarColaAutomatica, esErrorDeRed } from './utils/offline'
import { guardarCopiaLocal, leerCopiaLocal } from './utils/copiaLocal'
import AvisoInstalar from './components/AvisoInstalar'

// Páginas cargadas bajo demanda: la primera carga es más ligera
const Dashboard = lazy(() => import('./components/Dashboard'))
const LaboresPage = lazy(() => import('./components/LaboresPage'))
const AplicacionesPage = lazy(() => import('./components/AplicacionesPage'))
const CosechasPage = lazy(() => import('./components/CosechasPage'))
const GastosPage = lazy(() => import('./components/GastosPage'))
const FacturasPage = lazy(() => import('./components/FacturasPage'))
const IngresosPage = lazy(() => import('./components/IngresosPage'))
const FinanzasPage = lazy(() => import('./components/FinanzasPage'))
const FincasPage = lazy(() => import('./components/FincasPage'))
const FincaDetailPage = lazy(() => import('./components/FincaDetailPage'))
const PersonalPage = lazy(() => import('./components/PersonalPage'))
const MaquinariaPage = lazy(() => import('./components/MaquinariaPage'))
const InventarioPage = lazy(() => import('./components/InventarioPage'))
const ConfiguracionPage = lazy(() => import('./components/ConfiguracionPage'))
const DestinosPage = lazy(() => import('./components/DestinosPage'))
const InformesPage = lazy(() => import('./components/InformesPage'))
const AmortizacionesPage = lazy(() => import('./components/AmortizacionesPage'))
const ExpedientesPage = lazy(() => import('./components/ExpedientesPage'))
const VencimientosPage = lazy(() => import('./components/VencimientosPage'))
const CuadernoPage = lazy(() => import('./components/CuadernoPage'))
const JornadasPage = lazy(() => import('./components/JornadasPage'))
const GestoriaPage = lazy(() => import('./components/GestoriaPage'))
const ApuntarPage = lazy(() => import('./components/ApuntarPage'))
const NotasPage = lazy(() => import('./components/NotasPage'))

function App() {
  const [session, setSession] = useState(undefined)
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [selectedFincaForDetail, setSelectedFincaForDetail] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [fincas, setFincas] = useState([])
  const [personal, setPersonal] = useState([])
  const [maquinaria, setMaquinaria] = useState([])
  const [params, setParams] = useState([])
  const [destinos, setDestinos] = useState([])
  const [preciosDestino, setPreciosDestino] = useState([])
  const [amortizaciones, setAmortizaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('agrotrack-dark-mode')
    if (saved !== null) return saved === 'true'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('agrotrack-dark-mode', String(darkMode))
  }, [darkMode])

  const toggleDarkMode = () => setDarkMode(prev => !prev)

  // Modo campo: alto contraste y botones más grandes para usar al sol
  const [modoCampo, setModoCampo] = useState(() => {
    try { return localStorage.getItem('agrotrack-modo-campo') === 'true' } catch { return false }
  })
  useEffect(() => {
    document.documentElement.classList.toggle('modo-campo', modoCampo)
    try { localStorage.setItem('agrotrack-modo-campo', String(modoCampo)) } catch { /* sin almacenamiento */ }
  }, [modoCampo])
  const toggleModoCampo = () => setModoCampo(prev => !prev)

  // Envíos guardados sin cobertura: se mandan al recuperar la señal
  useEffect(() => { iniciarColaAutomatica() }, [])
  useEffect(() => {
    const alEnviar = () => { if (session) loadData() }
    window.addEventListener('agrotrack-cola-enviada', alEnviar)
    return () => window.removeEventListener('agrotrack-cola-enviada', alEnviar)
  }, [session])

  // Al cambiar de página, volver arriba
  useEffect(() => { window.scrollTo({ top: 0 }) }, [currentPage])

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data: { session: next } }) => {
      if (mounted) setSession(next ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next ?? null)
    })
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const [sinConexion, setSinConexion] = useState(null) // fecha de la copia local en uso
  const aplicarBase = (b) => {
    setFincas(b.fincas || [])
    setPersonal(b.personal || [])
    setMaquinaria(b.maquinaria || [])
    setParams(b.params || [])
    setDestinos(b.destinos || [])
    setPreciosDestino(b.preciosDestino || [])
    setAmortizaciones(b.amortizaciones || [])
  }

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [fincasRes, personalRes, maquinariaRes, paramsRes, destinosRes, preciosRes, amortRes] = await Promise.all([
        supabase.from('fincas').select('*').order('nombre'),
        supabase.from('personal').select('*').order('nombre'),
        supabase.from('maquinaria').select('*').order('id_equipo'),
        supabase.from('params').select('*'),
        supabase.from('destinos').select('*').order('nombre'),
        supabase.from('precios_destino').select('*'),
        supabase.from('amortizaciones').select('*')
      ])

      if (fincasRes.error) throw new Error(fincasRes.error.message)
      if (personalRes.error) throw new Error(personalRes.error.message)
      if (maquinariaRes.error) throw new Error(maquinariaRes.error.message)
      if (paramsRes.error) throw new Error(paramsRes.error.message)
      // Tolerar si las tablas de destinos no existen aún
      if (destinosRes.error && !isMissingTable(destinosRes.error)) throw new Error(destinosRes.error.message)
      if (preciosRes.error && !isMissingTable(preciosRes.error)) throw new Error(preciosRes.error.message)
      // Tolerar si la tabla de amortizaciones no existe aún
      if (amortRes.error && !isMissingTable(amortRes.error)) throw new Error(amortRes.error.message)

      const base = {
        fincas: fincasRes.data || [], personal: personalRes.data || [], maquinaria: maquinariaRes.data || [],
        params: paramsRes.data || [], destinos: destinosRes.data || [], preciosDestino: preciosRes.data || [],
        amortizaciones: amortRes.data || [],
      }
      aplicarBase(base)
      setSinConexion(null)
      guardarCopiaLocal(base) // para poder apuntar en el campo sin cobertura
    } catch (err) {
      // Sin cobertura: se usa la última copia guardada en el móvil
      const copia = leerCopiaLocal()
      if (copia && (esErrorDeRed(err) || !navigator.onLine)) {
        aplicarBase(copia.datos)
        setSinConexion(copia.fecha)
      } else {
        console.error('Error cargando datos:', err)
        setError('No se pudieron cargar los datos. Comprueba la conexión y que estén aplicadas las migraciones SQL (carpeta docs).')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session) loadData()
  }, [session])

  const handleLogout = async () => {
    setMobileMenuOpen(false)
    // Borra los datos guardados para usar sin cobertura (por si el móvil es compartido)
    try { if ('caches' in window) await caches.delete('supabase-api') } catch { /* nada */ }
    await supabase.auth.signOut()
  }

  const onDataChange = () => {
    loadData()
  }

  if (session === undefined) {
    return (
      <div className="boot-screen" aria-busy="true">
        <div className="spinner"></div>
        <p>Cargando AGROtrack...</p>
      </div>
    )
  }

  if (!session) {
    return <LoginPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
  }

  const renderPage = () => {
    const pageProps = {
      fincas,
      personal,
      maquinaria,
      params,
      destinos,
      preciosDestino,
      amortizaciones,
      onDataChange,
      darkMode,
      toggleDarkMode,
      modoCampo,
      toggleModoCampo,
      userEmail: session.user?.email,
      onLogout: handleLogout,
      onNavigate: (page, fincaId) => {
        if (fincaId) setSelectedFincaForDetail(fincaId)
        setCurrentPage(page)
      },
      selectedFincaForDetail,
    }

    switch (currentPage) {
      case 'dashboard':
        return <Dashboard {...pageProps} />
      case 'labores':
        return <LaboresPage {...pageProps} />
      case 'aplicaciones':
        return <AplicacionesPage {...pageProps} />
      case 'cosechas':
        return <CosechasPage {...pageProps} />
      case 'gastos':
        return <GastosPage {...pageProps} />
      case 'facturas':
        return <FacturasPage {...pageProps} />
      case 'ingresos':
        return <IngresosPage {...pageProps} />
      case 'finanzas':
        return <FinanzasPage {...pageProps} />
      case 'fincas':
        return <FincasPage {...pageProps} />
      case 'finca_detalle':
        return <FincaDetailPage {...pageProps} />
      case 'personal':
        return <PersonalPage {...pageProps} />
      case 'maquinaria':
        return <MaquinariaPage {...pageProps} />
      case 'inventario':
        return <InventarioPage {...pageProps} />
      case 'destinos':
        return <DestinosPage {...pageProps} />
      case 'configuracion':
        return <ConfiguracionPage {...pageProps} />
      case 'informes':
        return <InformesPage {...pageProps} />
      case 'amortizaciones':
        return <AmortizacionesPage {...pageProps} />
      case 'expedientes':
        return <ExpedientesPage {...pageProps} />
      case 'vencimientos':
        return <VencimientosPage {...pageProps} />
      case 'cuaderno':
        return <CuadernoPage {...pageProps} />
      case 'jornadas':
        return <JornadasPage {...pageProps} />
      case 'apuntar':
        return <ApuntarPage {...pageProps} />
      case 'notas':
        return <NotasPage {...pageProps} />
      case 'gestoria':
        return <GestoriaPage {...pageProps} />
      default:
        return <Dashboard {...pageProps} />
    }
  }

  return (
    <div className="app-container">
      {mobileMenuOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Cerrar menú"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <Sidebar
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        modoCampo={modoCampo}
        toggleModoCampo={toggleModoCampo}
        userEmail={session.user?.email}
        onLogout={handleLogout}
      />

      <MobileHeader
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      <main className="main-content">
        <SectionTabs currentPage={currentPage} setCurrentPage={setCurrentPage} />
        {sinConexion && (
          <div className="alert alert-info" role="status">
            Sin cobertura: usando los datos guardados en el móvil ({new Date(sinConexion).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}). Puedes seguir apuntando; se enviará al volver la señal.
          </div>
        )}
        <AvisoInstalar />
        {!isSupabaseConfigured && (
          <div className="alert alert-error">
            Faltan variables de entorno de Supabase. Usa <code>.env</code> en local o configúralas en Vercel.
          </div>
        )}
        {error && (
          <div className="alert alert-error">
            {error}
            <button type="button" className="btn btn-small btn-primary" style={{ marginLeft: 12 }} onClick={loadData}>
              Reintentar
            </button>
          </div>
        )}
        {loading && fincas.length === 0 && !error ? (
          <div className="empty-state" aria-busy="true">
            <div className="spinner"></div>
            <p className="mt-16">Cargando datos...</p>
          </div>
        ) : (
          <Suspense fallback={<div className="empty-state" aria-busy="true"><div className="spinner"></div></div>}>
            {renderPage()}
          </Suspense>
        )}
      </main>

      {currentPage !== 'apuntar' && (
        <button type="button" className="fab-apuntar" onClick={() => setCurrentPage('apuntar')} aria-label="Apuntar jornada, tratamiento, gasto o recordatorio">
          {getIcon('Plus', { size: 30, strokeWidth: 2.5 })}
        </button>
      )}

      <BottomNav currentPage={currentPage} setCurrentPage={setCurrentPage} />
    </div>
  )
}

export default App
