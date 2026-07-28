import { useState, useEffect } from 'react'
import { supabase } from './data/supabaseClient'
import Sidebar from './components/Sidebar'
import MobileHeader from './components/MobileHeader'
import BottomNav from './components/BottomNav'
import Dashboard from './components/Dashboard'
import LaboresPage from './components/LaboresPage'
import AplicacionesPage from './components/AplicacionesPage'
import CosechasPage from './components/CosechasPage'
import GastosPage from './components/GastosPage'
import FinanzasPage from './components/FinanzasPage'
import FincasPage from './components/FincasPage'
import PersonalPage from './components/PersonalPage'
import MaquinariaPage from './components/MaquinariaPage'
import InventarioPage from './components/InventarioPage'
import ConfiguracionPage from './components/ConfiguracionPage'

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [fincas, setFincas] = useState([])
  const [personal, setPersonal] = useState([])
  const [maquinaria, setMaquinaria] = useState([])
  const [params, setParams] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Cargar datos iniciales
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
      setError('No se pudieron cargar los datos. Verifica tu conexión a internet.')
    } finally {
      setLoading(false)
    }
  }

  // Cargar datos al iniciar (una sola vez, tras el montaje)
  useEffect(() => {
    loadData()
  }, [])

  const renderPage = () => {
    const pageProps = {
      fincas,
      personal,
      maquinaria,
      params
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
      case 'finanzas':
        return <FinanzasPage {...pageProps} />
      case 'fincas':
        return <FincasPage {...pageProps} />
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
      {/* Sidebar (escritorio) */}
      <Sidebar
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      {/* Cabecera móvil */}
      <MobileHeader
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      {/* Contenido principal */}
      <main className="main-content">
        {error && (
          <div className="alert alert-error">
            ⚠️ {error}
          </div>
        )}
        {renderPage()}
      </main>

      {/* Navegación inferior (móvil) */}
      <BottomNav
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
      />
    </div>
  )
}

export default App
