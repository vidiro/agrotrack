import { useState, useEffect } from 'react'
import { supabase } from '../data/supabaseClient'

function ConfiguracionPage({ params: paramsOrig, onDataChange, userEmail, onLogout }) {
  const [params, setParams] = useState(paramsOrig)
  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingParam, setEditingParam] = useState(null)
  const [newParamValue, setNewParamValue] = useState('')

  useEffect(() => {
    loadParams()
  }, [])

  const loadParams = async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: err } = await supabase.from('params').select('*')
      if (err) throw err
      setParams(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateParam = async (param) => {
    setError('')
    setSuccess('')
    setSaving(true)

    try {
      const { error: err } = await supabase.from('params').update({ valor: parseFloat(newParamValue) }).eq('clave', param.clave)
      if (err) throw new Error(err.message)
      setSuccess(`Parámetro "${param.clave}" actualizado a ${newParamValue}`)
      await loadParams()
      onDataChange?.()
      setEditingParam(null)
      setNewParamValue('')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
      // NO cerramos el editor si falla
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="empty-state" aria-busy="true">
        <div className="spinner"></div>
        <p className="mt-16">Cargando configuración...</p>
      </div>
    )
  }

  return (
    <div>
      {success && <div className="alert alert-success" role="alert">✅ {success}</div>}
      {error && (
        <div className="alert alert-error" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span>⚠️ {error}</span>
          <button className="btn btn-small btn-primary" onClick={loadParams} aria-label="Reintentar">🔄 Reintentar</button>
        </div>
      )}

      <div className="card">
        <div className="card-title">👤 Sesión</div>
        <p className="text-muted text-sm mb-16">
          Conectado como <strong>{userEmail || 'usuario'}</strong>
        </p>
        <button type="button" className="btn btn-danger" onClick={onLogout}>
          Cerrar sesión
        </button>
      </div>

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
                        <button className={`btn btn-small btn-primary ${saving ? 'btn-loading' : ''}`} onClick={() => handleUpdateParam(p)} disabled={saving}>
                          {saving ? 'Guardando...' : '💾 Guardar'}
                        </button>
                      ) : (
                        <button className="btn btn-small btn-accent" onClick={() => { setEditingParam(p.clave); setNewParamValue(p.valor.toString()) }} aria-label={`Editar parámetro ${p.clave}`}>✏️ Editar</button>
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
              <tr><td><strong>Versión</strong></td><td>1.3.0</td></tr>
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
          <strong>Acceso:</strong> la app exige inicio de sesión. Crea usuarios en Supabase → Authentication → Users (no hay registro público).
          Ejecuta <code>docs/SQL_migracion_v1.3.sql</code> para bloquear lecturas anónimas.
          Las claves van en <code>.env</code> o en las variables de Vercel, nunca en el código.
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
