import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from './data/supabaseClient'
import LoginPage from './components/LoginPage'
import Sidebar from './components/Sidebar'
import MobileHeader from './components/MobileHeader'
import BottomNav from './components/BottomNav'
import MoreSheet from './components/MoreSheet'
import Dashboard from './components/Dashboard'
import LaboresPage from './components/LaboresPage'
import AplicacionesPage from './components/AplicacionesPage'
import CosechasPage from './components/CosechasPage'
import GastosPage from './components/GastosPage'
import IngresosPage from './components/IngresosPage'
import FinanzasPage from './components/FinanzasPage'
import FincasPage from './components/FincasPage'
import FincaDetailPage from './components/FincaDetailPage'
import PersonalPage from './components/PersonalPage'
import MaquinariaPage from './components/MaquinariaPage'
import InventarioPage from './components/InventarioPage'
import ConfiguracionPage from './components/ConfiguracionPage'

function App() {
  const [session, setSession] = useState(undefined)
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [selectedFincaForDetail, setSelectedFincaForDetail] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [fincas, setFincas] = useState([])
  const [personal, setPersonal] = useState([])
  const [maquinaria, setMaquinaria] = useState([])
  const [params, setParams] = useState([])
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

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [fincasRes, personalRes, maquinariaRes, paramsRes] = await Promise.all([
        supabase.from('fincas').select('*').order('nombre'),
        supabase.from('personal').select('*').order('nombre'),
        supabase.from('maquinaria').select('*').order('id_equipo'),
        supabase.from('params').select('*')
      ])

      if (fincasRes.error) throw new Error(fincasRes.error.message)
      if (personalRes.error) throw new Error(personalRes.error.message)
      if (maquinariaRes.error) throw new Error(maquinariaRes.error.message)
      if (paramsRes.error) throw new Error(paramsRes.error.message)

      setFincas(fincasRes.data || [])
      setPersonal(personalRes.data || [])
      setMaquinaria(maquinariaRes.data || [])
      setParams(paramsRes.data || [])
    } catch (err) {
      console.error('Error cargando datos:', err)
      setError('No se pudieron cargar los datos. Comprueba la conexión y que hayas ejecutado la migración SQL v1.3.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session) loadData()
  }, [session])

  const handleLogout = async () => {
    setMobileMenuOpen(false)
    setMoreOpen(false)
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
      onDataChange,
      darkMode,
      toggleDarkMode,
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
      case 'configuracion':
        return <ConfiguracionPage {...pageProps} />
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
        userEmail={session.user?.email}
        onLogout={handleLogout}
      />

      <MobileHeader
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
      />

      <main className="main-content">
        {!isSupabaseConfigured && (
          <div className="alert alert-error">
            Faltan variables de entorno de Supabase. Usa <code>.env</code> en local o configúralas en Vercel.
          </div>
        )}
        {error && (
          <div className="alert alert-error">
            ⚠️ {error}
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
          renderPage()
        )}
      </main>

      <MoreSheet
        open={moreOpen}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        onClose={() => setMoreOpen(false)}
      />

      <BottomNav
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        moreOpen={moreOpen}
        setMoreOpen={setMoreOpen}
      />
    </div>
  )
}

export default App
