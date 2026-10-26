import { useState, useEffect } from 'react'
import { Inbox } from 'lucide-react'
import { supabase } from '../data/supabaseClient'
import AjustesExtra from './AjustesExtra'
import CampanasAnio from './CampanasAnio'

function ConfiguracionPage({ params: paramsOrig, onDataChange, userEmail, onLogout, modoCampo, toggleModoCampo, darkMode, toggleDarkMode }) {
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
      {success && <div className="alert alert-success" role="alert"> {success}</div>}
      {error && (
        <div className="alert alert-error" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span> {error}</span>
          <button className="btn btn-small btn-primary" onClick={loadParams} aria-label="Reintentar"> Reintentar</button>
        </div>
      )}

      <div className="card">
        <div className="card-title">Sesión</div>
        <p className="text-muted text-sm mb-16">
          Conectado como <strong>{userEmail || 'usuario'}</strong>
        </p>
        <button type="button" className="btn btn-danger" onClick={onLogout}>
          Cerrar sesión
        </button>
      </div>

      <AjustesExtra modoCampo={modoCampo} toggleModoCampo={toggleModoCampo} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />

      <div className="card">
        <div className="card-title"> Parámetros de configuración</div>
        <p className="text-muted text-sm mb-16">
          Estos son los valores que se utilizan en los cálculos de la aplicación. Puedes modificarlos según necesites.
        </p>
        
        {/* Helper para etiqueta legible */}
        {(() => {
          const etiquetas = {
            'precio_gasoil_l': ' Precio gasoil (€/L)',
            'precio_uva_kilogrado': ' Precio uva (€/kilogrado)',
            'precio_manzanilla_kg': 'Precio Manzanilla (€/kg)',
            'precio_carrasquena_kg': 'Precio Carrasqueña (€/kg)',
            'precio_basta_kg': 'Precio aceituna basta (€/kg)',
            'precio_perdigon_kg': 'Precio pérdigon (€/kg)',
            'campana_mes_inicio': ' Mes inicio campaña',
            'campana_dia_inicio': ' Día inicio campaña'
          }
          // Excluir params de campaña de la tabla de precios (se configuran abajo)
          const precioParams = params.filter(p => p.clave.startsWith('precio_'))
          const otrosParams = params.filter(p => !p.clave.startsWith('precio_') && !p.clave.startsWith('campana_'))

          return (
            <>
              {otrosParams.length > 0 && (
                <div className="table-container" style={{ marginBottom: 8 }}>
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
                      {otrosParams.map(p => (
                        <tr key={p.clave}>
                          <td><strong>{p.clave.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</strong></td>
                          <td><code>{p.valor}</code></td>
                          <td>
                            {editingParam === p.clave ? (
                              <input type="number" className="form-input" style={{ width: '120px' }} value={newParamValue} onChange={e => setNewParamValue(e.target.value)} step="0.01" min="0" autoFocus />
                            ) : (<span className="text-muted">—</span>)}
                          </td>
                          <td>
                            {editingParam === p.clave ? (
                              <button className={`btn btn-small btn-primary ${saving ? 'btn-loading' : ''}`} onClick={() => handleUpdateParam(p)} disabled={saving}>{saving ? 'Guardando...' : ' Guardar'}</button>
                            ) : (
                              <button className="btn btn-small btn-accent" onClick={() => { setEditingParam(p.clave); setNewParamValue(p.valor.toString()) }} aria-label={`Editar parámetro ${p.clave}`}> Editar</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {precioParams.length > 0 && (
                <>
                  <div className="card" style={{ borderLeft: '4px solid var(--color-success)', marginBottom: 16 }}>
                    <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                       Precios de cosecha
                    </div>
                    <p className="text-muted text-sm mb-16">Precios por kg que se usarán para calcular el ingreso previsto de la cosecha. Actualízalos cada campaña.</p>
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Producto</th>
                            <th>Precio actual</th>
                            <th>Nuevo precio</th>
                            <th>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {precioParams.map(p => (
                            <tr key={p.clave}>
                              <td><strong>{etiquetas[p.clave] || p.clave.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</strong></td>
                              <td><code>{parseFloat(p.valor).toFixed(2)} €</code></td>
                              <td>
                                {editingParam === p.clave ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <input type="number" className="form-input" style={{ width: '100px' }} value={newParamValue} onChange={e => setNewParamValue(e.target.value)} step="0.01" min="0" autoFocus />
                                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>€/kg</span>
                                  </div>
                                ) : (<span className="text-muted">—</span>)}
                              </td>
                              <td>
                                {editingParam === p.clave ? (
                                  <button className={`btn btn-small btn-primary ${saving ? 'btn-loading' : ''}`} onClick={() => handleUpdateParam(p)} disabled={saving}>{saving ? 'Guardando...' : ' Guardar'}</button>
                                ) : (
                                  <button className="btn btn-small btn-accent" onClick={() => { setEditingParam(p.clave); setNewParamValue(p.valor.toString()) }} aria-label={`Editar ${etiquetas[p.clave] || p.clave}`}> Editar</button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* Configuración de campaña */}
              <div className="card" style={{ borderLeft: '4px solid var(--color-primary)', marginBottom: 16 }}>
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                   Período de Campaña
                </div>
                <p className="text-muted text-sm mb-16">Día y mes en que suele empezar la campaña. La campaña del año X empieza el año anterior. Si un año empieza otro día, ponlo abajo en «Inicio de cada campaña».</p>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Mes de inicio de campaña</label>
                    <select className="form-select" value={(() => {
                      const val = params.find(p => p.clave === 'campana_mes_inicio')
                      return val ? parseInt(val.valor) : 9
                    })()} onChange={async (e) => {
                      const newVal = e.target.value
                      const existing = params.find(p => p.clave === 'campana_mes_inicio')
                      setSaving(true)
                      try {
                        if (existing) {
                          const { error: err } = await supabase.from('params').update({ valor: parseFloat(newVal) }).eq('clave', 'campana_mes_inicio')
                          if (err) throw new Error(err.message)
                        } else {
                          const { error: err } = await supabase.from('params').insert([{ clave: 'campana_mes_inicio', valor: parseFloat(newVal) }])
                          if (err) throw new Error(err.message)
                        }
                        setSuccess('Mes de campaña actualizado')
                        await loadParams()
                        onDataChange?.()
                        setTimeout(() => setSuccess(''), 3000)
                      } catch (err) {
                        setError(err.message)
                      } finally {
                        setSaving(false)
                      }
                    }}>
                      <option value={1}>Enero</option><option value={2}>Febrero</option>
                      <option value={3}>Marzo</option><option value={4}>Abril</option>
                      <option value={5}>Mayo</option><option value={6}>Junio</option>
                      <option value={7}>Julio</option><option value={8}>Agosto</option>
                      <option value={9}>Septiembre</option><option value={10}>Octubre</option>
                      <option value={11}>Noviembre</option><option value={12}>Diciembre</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Día de inicio</label>
                    <select className="form-select" value={(() => {
                      const val = params.find(p => p.clave === 'campana_dia_inicio')
                      return val ? parseInt(val.valor) : 15
                    })()} onChange={async (e) => {
                      const newVal = e.target.value
                      const existing = params.find(p => p.clave === 'campana_dia_inicio')
                      setSaving(true)
                      try {
                        if (existing) {
                          const { error: err } = await supabase.from('params').update({ valor: parseFloat(newVal) }).eq('clave', 'campana_dia_inicio')
                          if (err) throw new Error(err.message)
                        } else {
                          const { error: err } = await supabase.from('params').insert([{ clave: 'campana_dia_inicio', valor: parseFloat(newVal) }])
                          if (err) throw new Error(err.message)
                        }
                        setSuccess('Día de campaña actualizado')
                        await loadParams()
                        onDataChange?.()
                        setTimeout(() => setSuccess(''), 3000)
                      } catch (err) {
                        setError(err.message)
                      } finally {
                        setSaving(false)
                      }
                    }}>
                      {Array.from({length: 31}, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ marginTop: 8, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                   Ejemplo: 15 sept → la campaña 2025 va del 15 sept 2024 al 14 sept 2025
                </div>
              </div>

              <CampanasAnio params={params} onGuardado={async () => { await loadParams(); onDataChange?.(); setSuccess('Fecha de campaña guardada'); setTimeout(() => setSuccess(''), 3000) }} />

              {params.length === 0 && (
                <div className="empty-state">
                  <div className="empty-state-icon" aria-hidden="true"><Inbox size={40} strokeWidth={1.5} /></div>
                  <div className="empty-state-text">No hay parámetros configurados</div>
                </div>
              )}
            </>
          )
        })()}
      </div>

      <div className="card mt-24">
        <div className="card-title"> Información de la aplicación</div>
        <div className="table-container">
          <table className="data-table">
            <tbody>
              <tr><td><strong>Nombre</strong></td><td>AGROtrack</td></tr>
              <tr><td><strong>Versión</strong></td><td>1.8.0</td></tr>
              <tr><td><strong>Tecnología</strong></td><td>React + Vite + Supabase</td></tr>
              <tr><td><strong>Soporte</strong></td><td>iPhone (Safari), iPad, Ordenador</td></tr>
              <tr><td><strong>Base de datos</strong></td><td>Supabase (PostgreSQL)</td></tr>
              <tr><td><strong>Hosting</strong></td><td>Vercel (Plan gratuito)</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mt-24">
        <div className="card-title"> Seguridad</div>
        <div className="alert alert-info">
          <strong>Acceso:</strong> la app exige inicio de sesión. Crea usuarios en Supabase → Authentication → Users (no hay registro público).
          Ejecuta <code>docs/SQL_migracion_v1.3.sql</code> para bloquear lecturas anónimas.
          Las claves van en <code>.env</code> o en las variables de Vercel, nunca en el código.
        </div>
      </div>

      <div className="card mt-24">
        <div className="card-title"> Cómo usar la app en tu iPhone</div>
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
