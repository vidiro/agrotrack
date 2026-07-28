import { useState, useEffect } from 'react'
import { supabase } from '../data/supabaseClient'

function ConfiguracionPage({ params: paramsOrig }) {
  const [params, setParams] = useState(paramsOrig)
  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [editingParam, setEditingParam] = useState(null)
  const [newParamValue, setNewParamValue] = useState('')

  useEffect(() => {
    loadParams()
  }, [])

  const loadParams = async () => {
    setLoading(true)
    const { data } = await supabase.from('params').select('*')
    setParams(data || [])
    setLoading(false)
  }

  const handleUpdateParam = async (param) => {
    setError('')
    setSuccess('')

    try {
      const { error } = await supabase.from('params').update({ valor: parseFloat(newParamValue) }).eq('clave', param.clave)
      if (error) throw new Error(error.message)
      setSuccess(`Parámetro "${param.clave}" actualizado a ${newParamValue}`)
      await loadParams()
      setEditingParam(null)
      setNewParamValue('')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
      setTimeout(() => setError(''), 5000)
    }
  }

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner"></div>
        <p className="mt-16">Cargando configuración...</p>
      </div>
    )
  }

  return (
    <div>
      {success && <div className="alert alert-success">✅ {success}</div>}
      {error && <div className="alert alert-error">⚠️ {error}</div>}

      <div className="card">
        <div className="card-title">⚙️ Parámetros de configuración</div>
        <p className="text-muted text-sm mb-16">
          Estos son los valores que se utilizan en los cálculos de la aplicación. Puedes modificarlos según necesites.
        </p>
        
        {params.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Parámetro</th>
                  <th>Valor actual</th>
                  <th>Nuevo valor</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {params.map(p => (
                  <tr key={p.clave}>
                    <td><strong>{p.clave.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</strong></td>
                    <td><code>{p.valor}</code></td>
                    <td>
                      {editingParam === p.clave ? (
                        <input
                          type="number"
                          className="form-input"
                          style={{ width: '120px' }}
                          value={newParamValue}
                          onChange={e => setNewParamValue(e.target.value)}
                          step="0.01"
                          min="0"
                          autoFocus
                        />
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      {editingParam === p.clave ? (
                        <button className="btn btn-small btn-primary" onClick={() => handleUpdateParam(p)}>💾 Guardar</button>
                      ) : (
                        <button className="btn btn-small btn-accent" onClick={() => { setEditingParam(p.clave); setNewParamValue(p.valor.toString()) }}>✏️ Editar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">⚙️</div>
            <div className="empty-state-text">No hay parámetros configurados</div>
          </div>
        )}
      </div>

      <div className="card mt-24">
        <div className="card-title">ℹ️ Información de la aplicación</div>
        <div className="table-container">
          <table className="data-table">
            <tbody>
              <tr><td><strong>Nombre</strong></td><td>AGROtrack</td></tr>
              <tr><td><strong>Versión</strong></td><td>1.0.0</td></tr>
              <tr><td><strong>Tecnología</strong></td><td>React + Vite + Supabase</td></tr>
              <tr><td><strong>Soporte</strong></td><td>iPhone (Safari), iPad, Ordenador</td></tr>
              <tr><td><strong>Base de datos</strong></td><td>Supabase (PostgreSQL)</td></tr>
              <tr><td><strong>Hosting</strong></td><td>Vercel (Plan gratuito)</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mt-24">
        <div className="card-title">🔐 Seguridad</div>
        <div className="alert alert-info">
          <strong>Importante:</strong> No compartas nunca tus credenciales de Supabase (URL y clave anon) con nadie. 
          Si crees que han sido comprometidas, ve a Supabase → Settings → API y genera nuevas credenciales.
        </div>
      </div>

      <div className="card mt-24">
        <div className="card-title">📱 Cómo usar la app en tu iPhone</div>
        <ol style={{ paddingLeft: 20, lineHeight: 2 }}>
          <li>Abre la app en Safari (no Chrome ni Firefox)</li>
          <li>Toca el botón <strong>Compartir</strong> (cuadrado con flecha ↑)</li>
          <li>Selecciona <strong>"Añadir a la pantalla de inicio"</strong></li>
          <li>Ponle nombre <strong>"AGROtrack"</strong></li>
          <li>Toca <strong>"Añadir"</strong></li>
          <li>¡Ahora tienes un icono en tu pantalla como una app normal!</li>
        </ol>
        <p className="text-muted text-sm mt-8">
          La app funciona sin conexión a internet para la interfaz, pero necesita internet para guardar los datos en la base de datos.
        </p>
      </div>
    </div>
  )
}

export default ConfiguracionPage
