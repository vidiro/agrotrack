import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './styles/global.css'
import { iniciarTablasMovil } from './utils/tablasMovil'

// Tras un despliegue nuevo, una pestaña abierta puede pedir trozos de JS que ya no existen:
// en ese caso se recarga la página para coger la versión nueva.
window.addEventListener('vite:preloadError', () => {
  window.location.reload()
})

// App disponible sin cobertura (se actualiza sola al publicar una versión nueva)
registerSW({ immediate: true })

// Tablas como tarjetas en el móvil
iniciarTablasMovil()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
