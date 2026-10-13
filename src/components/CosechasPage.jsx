import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../data/supabaseClient'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cosechaKilogrados, cosechaAceite } from '../utils/cosecha'

function CosechasPage({ fincas, params, destinos, preciosDestino, onDataChange }) {
  const [cosechas, setCosechas] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const [form, setForm] = useState({
    fecha: format(new Date(), 'yyyy-MM-dd'),
    id_finca: '',
    id_parcela: '',
    cultivo: 'Viña',
    variedad: '',
    kg: '',
    kg_perdigon: '',
    destino: '',
    brix_baume_viina: '',
    rendimiento_graso_olivar: '',
    muestras_calidad: '',
    observaciones: ''
  })

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: err } = await supabase.from('cosechas').select('*').order('fecha', { ascending: false })
      if (err) throw err
      setCosechas(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })
  }

  // Helper: obtener precio desde params
  const getParam = (clave) => {
    if (!params || !Array.isArray(params)) return 0
    const p = params.find(pr => pr.clave === clave)
    return p ? (parseFloat(p.valor) || 0) : 0
  }

  // Helper: obtener precio desde precios_destino
  const getPrecioDestino = (nombreDestino, tipoProducto) => {
    if (!destinos || !Array.isArray(destinos) || !nombreDestino) return 0
    // Find destino by name
    const dest = destinos.find(d => d.nombre === nombreDestino)
    if (!dest) return 0
    // Find price for this destino and product type
    const precio = (preciosDestino || []).find(p => String(p.id_destino) === String(dest.id_destino) && p.tipo_producto === tipoProducto)
    return precio ? (parseFloat(precio.precio) || 0) : 0
  }

  // Helper: calcular ingreso previsto para una cosecha
  const calcIngreso = (c) => {
    try {
      const kg = parseFloat(c.kg) || 0
      const kgPerdigon = parseFloat(c.kg_perdigon) || 0
      const kilogrados = cosechaKilogrados(c) || 0
      const cult = (c.cultivo || '').toLowerCase()
      const variedad = (c.variedad || '').toLowerCase()
      const nombreDestino = c.destino // stored as nombre text
      let total = 0

      // Intentar precio por destino primero
      if (nombreDestino) {
        if (cult === 'viña' || cult === 'viña y olivar') {
          const p = getPrecioDestino(nombreDestino, 'uva')
          if (p > 0 && kilogrados > 0) total += kilogrados * p
        }
        if (cult === 'olivar' || cult === 'viña y olivar') {
          if (kgPerdigon > 0) {
            total += kgPerdigon * getPrecioDestino(nombreDestino, 'perdigon')
          }
          if (kg > 0) {
            let tipo = 'aceituna' // fallback
            if (variedad.includes('manzanilla')) tipo = 'manzanilla'
            else if (variedad.includes('carrasquena') || variedad.includes('carrasqueña')) tipo = 'carrasquena'
            total += kg * getPrecioDestino(nombreDestino, tipo)
          }
        }
      }

      // Si no hay precio por destino, usar precios base de params
      if (total === 0) {
        if (cult === 'viña' || cult === 'viña y olivar') {
          const precio = getParam('precio_uva_kilogrado')
          if (precio > 0 && kilogrados > 0) total += kilogrados * precio
        }
        if (cult === 'olivar' || cult === 'viña y olivar') {
          if (kgPerdigon > 0) total += kgPerdigon * getParam('precio_perdigon_kg')
          if (kg > 0) {
            let precio = 0
            if (variedad.includes('manzanilla')) precio = getParam('precio_manzanilla_kg')
            else if (variedad.includes('carrasquena') || variedad.includes('carrasqueña')) precio = getParam('precio_carrasquena_kg')
            else precio = getParam('precio_basta_kg')
            if (precio > 0) total += kg * precio
          }
        }
      }

      return total
    } catch {
      return 0
    }
  }

  // Valor en vivo del formulario: kilogrados (viña) o aceite potencial (olivar)
  const formKilogrados = useMemo(() => {
    const esVina = form.cultivo === 'Viña' || form.cultivo === 'Viña y Olivar'
    const esOlivar = form.cultivo === 'Olivar' || form.cultivo === 'Viña y Olivar'
    const kg = parseFloat(form.kg) || 0
    if (esVina) {
      const brix = parseFloat(form.brix_baume_viina) || 0
      if (kg && brix) return { value: kg * brix, label: 'kilogrados' }
    }
    if (esOlivar) {
      const pct = parseFloat(form.rendimiento_graso_olivar) || 0
      if (kg && pct) return { value: kg * pct / 100, label: 'kg aceite potencial' }
    }
    return null
  }, [form.kg, form.brix_baume_viina, form.rendimiento_graso_olivar, form.cultivo])

  // Filtrar por búsqueda
  const filteredCosechas = cosechas.filter(c => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    return (c.cultivo || '').toLowerCase().includes(term) ||
           (c.variedad || '').toLowerCase().includes(term) ||
           (c.destino || '').toLowerCase().includes(term)
  })

  // === RESUMEN separado por tipo de cultivo ===
  const resumen = useMemo(() => {
    const cosechasVina = filteredCosechas.filter(c => {
      const cult = (c.cultivo || '')
      return cult === 'Viña' || cult === 'Viña y Olivar'
    })
    const cosechasOlivar = filteredCosechas.filter(c => {
      const cult = (c.cultivo || '')
      return cult === 'Olivar' || cult === 'Viña y Olivar'
    })

    const totalKg = filteredCosechas.reduce((s, c) => s + (parseFloat(c.kg) || 0), 0)

    // --- Viña ---
    const vinaKg = cosechasVina.reduce((s, c) => s + (parseFloat(c.kg) || 0), 0)
    const vinaKilogrados = cosechasVina.reduce((s, c) => s + (cosechaKilogrados(c) || 0), 0)

    const vinaPorVariedad = {}
    cosechasVina.forEach(c => {
      const v = c.variedad || 'Sin variedad'
      if (!vinaPorVariedad[v]) vinaPorVariedad[v] = { variedad: v, kg: 0, kilogrados: 0, n: 0 }
      vinaPorVariedad[v].kg += parseFloat(c.kg) || 0
      vinaPorVariedad[v].kilogrados += cosechaKilogrados(c) || 0
      vinaPorVariedad[v].n += 1
    })
    const vinaVariedades = Object.values(vinaPorVariedad)
      .map(v => ({
        ...v,
        pctKg: vinaKg > 0 ? (v.kg / vinaKg) * 100 : 0,
        pctKilogrados: vinaKilogrados > 0 ? (v.kilogrados / vinaKilogrados) * 100 : 0,
        ingreso: cosechasVina
          .filter(c => (c.variedad || 'Sin variedad') === v.variedad)
          .reduce((s, c) => s + calcIngreso(c), 0)
      }))
      .sort((a, b) => b.kg - a.kg)

    // --- Olivar ---
    const olivarKg = cosechasOlivar.reduce((s, c) => s + (parseFloat(c.kg) || 0), 0)
    const olivarPerdigon = cosechasOlivar.reduce((s, c) => s + (parseFloat(c.kg_perdigon) || 0), 0)
    const olivarAceite = cosechasOlivar.reduce((s, c) => s + (cosechaAceite(c) || 0), 0)

    const olivarPorVariedad = {}
    cosechasOlivar.forEach(c => {
      const v = c.variedad || 'Sin variedad'
      if (!olivarPorVariedad[v]) olivarPorVariedad[v] = { variedad: v, kg: 0, kg_perdigon: 0, aceite: 0, n: 0 }
      olivarPorVariedad[v].kg += parseFloat(c.kg) || 0
      olivarPorVariedad[v].kg_perdigon += parseFloat(c.kg_perdigon) || 0
      olivarPorVariedad[v].aceite += cosechaAceite(c) || 0
      olivarPorVariedad[v].n += 1
    })
    const olivarIngresoPorVariedad = {}
    cosechasOlivar.forEach(c => {
      const v = c.variedad || 'Sin variedad'
      if (!olivarIngresoPorVariedad[v]) olivarIngresoPorVariedad[v] = 0
      olivarIngresoPorVariedad[v] += calcIngreso(c)
    })
    const olivarVariedades = Object.values(olivarPorVariedad)
      .map(v => ({
        ...v,
        pctKg: olivarKg > 0 ? (v.kg / olivarKg) * 100 : 0,
        pctAceite: olivarAceite > 0 ? (v.aceite / olivarAceite) * 100 : 0,
        ingreso: olivarIngresoPorVariedad[v.variedad] || 0
      }))
      .sort((a, b) => b.kg - a.kg)

    const vinaIngreso = cosechasVina.reduce((s, c) => s + calcIngreso(c), 0)
    const olivarIngreso = cosechasOlivar.reduce((s, c) => s + calcIngreso(c), 0)

    return {
      totalKg,
      numCosechas: filteredCosechas.length,
      vinaKg, vinaKilogrados, vinaNumCosechas: cosechasVina.length, vinaVariedades, vinaIngreso,
      olivarKg, olivarPerdigon, olivarAceite, olivarNumCosechas: cosechasOlivar.length, olivarVariedades, olivarIngreso,
      totalIngreso: vinaIngreso + olivarIngreso
    }
  }, [filteredCosechas, params, destinos, preciosDestino])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    const datos = {
      ...form,
      fecha: form.fecha || format(new Date(), 'yyyy-MM-dd'),
      id_finca: form.id_finca || null,
      id_parcela: form.id_parcela || null,
      cultivo: form.cultivo || null,
      variedad: form.variedad || null,
      kg: form.kg ? parseFloat(form.kg) : null,
      kg_perdigon: form.kg_perdigon ? parseFloat(form.kg_perdigon) : null,
      destino: form.destino || null,
      brix_baume_viina: form.brix_baume_viina ? parseFloat(form.brix_baume_viina) : null,
      rendimiento_graso_olivar: form.rendimiento_graso_olivar ? parseFloat(form.rendimiento_graso_olivar) : null,
      muestras_calidad: form.muestras_calidad || null,
      observaciones: form.observaciones || null
    }

    try {
      if (editingId) {
        const { error: err } = await supabase.from('cosechas').update(datos).eq('id_cosecha', editingId)
        if (err) throw new Error(err.message)
        setSuccess('Cosecha actualizada')
      } else {
        const { error: err } = await supabase.from('cosechas').insert([datos])
        if (err) throw new Error(err.message)
        setSuccess('Cosecha registrada')
      }

      await loadData()
      onDataChange?.()
      setForm({
        fecha: format(new Date(), 'yyyy-MM-dd'),
        id_finca: '', id_parcela: '', cultivo: 'Viña', variedad: '',
        kg: '', kg_perdigon: '', destino: '', brix_baume_viina: '',
        rendimiento_graso_olivar: '', muestras_calidad: '', observaciones: ''
      })
      setEditingId(null)
      setShowForm(false)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (c) => {
    setForm({
      fecha: c.fecha ? format(new Date(c.fecha), 'yyyy-MM-dd') : '',
      id_finca: c.id_finca || '',
      id_parcela: c.id_parcela || '',
      cultivo: c.cultivo || 'Viña',
      variedad: c.variedad || '',
      kg: c.kg || '',
      kg_perdigon: c.kg_perdigon || '',
      destino: c.destino || '',
      brix_baume_viina: c.brix_baume_viina || '',
      rendimiento_graso_olivar: c.rendimiento_graso_olivar || '',
      muestras_calidad: c.muestras_calidad || '',
      observaciones: c.observaciones || ''
    })
    setEditingId(c.id_cosecha)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta cosecha?')) return
    try {
      const { error: err } = await supabase.from('cosechas').delete().eq('id_cosecha', id)
      if (err) throw err
      await loadData()
      onDataChange?.()
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <div className="empty-state" aria-busy="true">
        <div className="spinner"></div>
        <p className="mt-16">Cargando cosechas...</p>
      </div>
    )
  }

  return (
    <div>
      {success && <div className="alert alert-success" role="alert"> {success}</div>}
      {error && (
        <div className="alert alert-error" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span> {error}</span>
          <button className="btn btn-small btn-primary" onClick={loadData} aria-label="Reintentar"> Reintentar</button>
        </div>
      )}

      {/* Barra de búsqueda */}
      <div className="fincas-toolbar mb-16">
        <div className="search-box">
          <span className="search-icon"></span>
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por cultivo, variedad, destino..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            aria-label="Buscar cosechas"
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')} aria-label="Limpiar búsqueda"></button>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingId(null) }}>
          {showForm ? ' Cancelar' : '+ Nueva Cosecha'}
        </button>
      </div>

      {/* Resumen de cosecha */}
      {resumen.numCosechas > 0 && (
        <>
          {/* Tarjetas generales */}
          <div className="summary-grid" style={{ marginBottom: 16 }}>
            <div className="summary-card accent">
              <div className="summary-value">{resumen.totalKg.toFixed(0)} kg</div>
              <div className="summary-label">Total cosechado</div>
            </div>
            <div className="summary-card success">
              <div className="summary-value">{resumen.numCosechas}</div>
              <div className="summary-label">Cosechas registradas</div>
            </div>
            <div className="summary-card" style={{ background: 'var(--color-success-light)', borderLeft: '4px solid var(--color-success)' }}>
              <div className="summary-value" style={{ color: 'var(--color-success)' }}>{resumen.totalIngreso > 0 ? resumen.totalIngreso.toFixed(2) + ' €' : '—'}</div>
              <div className="summary-label"> Ingreso previsto</div>
            </div>
          </div>

          {/* Aviso si no hay precios configurados */}
          {resumen.totalIngreso === 0 && (
            <div className="alert alert-info" role="alert" style={{ marginBottom: 16, fontSize: '0.875rem' }}>
               Configura los precios de cosecha en <strong>Configuración</strong> para ver los ingresos previstos
            </div>
          )}

          {/* ===== SECCIÓN VIÑA ===== */}
          {resumen.vinaNumCosechas > 0 && (
            <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid var(--vina-accent)' }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1.3rem' }}></span> Viña
              </div>

              {/* Stats de viña */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 120, background: 'var(--vina-bg)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--vina-accent)' }}>{resumen.vinaKg.toFixed(0)} kg</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--vina-accent-light)' }}>Uva cosechada</div>
                </div>
                <div style={{ flex: 1, minWidth: 120, background: 'var(--vina-bg)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--vina-accent)' }}>{resumen.vinaKilogrados > 0 ? resumen.vinaKilogrados.toFixed(0) : '—'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--vina-accent-light)' }}>Kilogrados</div>
                </div>
                <div style={{ flex: 1, minWidth: 120, background: 'var(--vina-bg)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--vina-accent)' }}>{resumen.vinaNumCosechas}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--vina-accent-light)' }}>Entradas</div>
                </div>
                <div style={{ flex: 1, minWidth: 120, background: 'var(--color-success-light)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-success)' }}>{resumen.vinaIngreso > 0 ? resumen.vinaIngreso.toFixed(2) + ' €' : '—'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-success)' }}> Ingreso previsto</div>
                </div>
              </div>

              {/* Tabla por variedad */}
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Variedad</th>
                      <th>Kg</th>
                      <th>% kg</th>
                      <th>Kilogrados</th>
                      <th>% kilogrados</th>
                      <th>Ingreso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumen.vinaVariedades.map(v => (
                      <tr key={v.variedad}>
                        <td><strong>{v.variedad}</strong></td>
                        <td>{v.kg.toFixed(0)} kg</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ flex: 1, height: 6, background: 'var(--color-border)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${v.pctKg}%`, height: '100%', background: 'var(--vina-accent)' }} />
                            </div>
                            <span style={{ fontSize: '0.75rem', minWidth: '3.2em', textAlign: 'right' }}>{v.pctKg.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td>{v.kilogrados > 0 ? v.kilogrados.toFixed(0) : '—'}</td>
                        <td>{v.kilogrados > 0 ? `${v.pctKilogrados.toFixed(1)}%` : '—'}</td>
                        <td style={{ color: 'var(--color-success)', fontWeight: 600 }}>{v.ingreso > 0 ? v.ingreso.toFixed(2) + ' €' : '—'}</td>
                      </tr>
                    ))}
                    <tr style={{ background: 'var(--vina-bg)', fontWeight: 700 }}>
                      <td>Total viña</td>
                      <td>{resumen.vinaKg.toFixed(0)} kg</td>
                      <td>100%</td>
                      <td>{resumen.vinaKilogrados > 0 ? resumen.vinaKilogrados.toFixed(0) : '—'}</td>
                      <td>{resumen.vinaKilogrados > 0 ? '100%' : '—'}</td>
                      <td style={{ color: 'var(--color-success)' }}>{resumen.vinaIngreso > 0 ? resumen.vinaIngreso.toFixed(2) + ' €' : '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===== SECCIÓN OLIVAR ===== */}
          {resumen.olivarNumCosechas > 0 && (
            <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid var(--olivar-accent)' }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1.3rem' }}>🫒</span> Olivar
              </div>

              {/* Stats de olivar */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 100, background: 'var(--olivar-bg)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--olivar-accent)' }}>{resumen.olivarKg.toFixed(0)} kg</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--olivar-accent-light)' }}>Aceituna</div>
                </div>
                <div style={{ flex: 1, minWidth: 100, background: 'var(--olivar-bg)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--olivar-accent)' }}>{resumen.olivarPerdigon > 0 ? resumen.olivarPerdigon.toFixed(0) + ' kg' : '—'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--olivar-accent-light)' }}>Pérdigon</div>
                </div>
                <div style={{ flex: 1, minWidth: 100, background: 'var(--olivar-bg)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--olivar-accent)' }}>{resumen.olivarAceite > 0 ? resumen.olivarAceite.toFixed(0) + ' kg' : '—'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--olivar-accent-light)' }}>Aceite pot.</div>
                </div>
                <div style={{ flex: 1, minWidth: 100, background: 'var(--olivar-bg)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--olivar-accent)' }}>{resumen.olivarNumCosechas}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--olivar-accent-light)' }}>Entradas</div>
                </div>
                <div style={{ flex: 1, minWidth: 100, background: 'var(--color-success-light)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-success)' }}>{resumen.olivarIngreso > 0 ? resumen.olivarIngreso.toFixed(2) + ' €' : '—'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-success)' }}> Ingreso previsto</div>
                </div>
              </div>

              {/* Tabla por variedad */}
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Variedad</th>
                      <th>Kg aceituna</th>
                      <th>% kg</th>
                      <th>Pérdigon</th>
                      <th>Aceite pot.</th>
                      <th>% aceite</th>
                      <th>Ingreso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumen.olivarVariedades.map(v => (
                      <tr key={v.variedad}>
                        <td><strong>{v.variedad}</strong></td>
                        <td>{v.kg.toFixed(0)} kg</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ flex: 1, height: 6, background: 'var(--color-border)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${v.pctKg}%`, height: '100%', background: 'var(--olivar-accent)' }} />
                            </div>
                            <span style={{ fontSize: '0.75rem', minWidth: '3.2em', textAlign: 'right' }}>{v.pctKg.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td>{v.kg_perdigon > 0 ? v.kg_perdigon.toFixed(0) + ' kg' : '—'}</td>
                        <td>{v.aceite > 0 ? v.aceite.toFixed(0) + ' kg' : '—'}</td>
                        <td>{v.aceite > 0 ? `${v.pctAceite.toFixed(1)}%` : '—'}</td>
                        <td style={{ color: 'var(--color-success)', fontWeight: 600 }}>{v.ingreso > 0 ? v.ingreso.toFixed(2) + ' €' : '—'}</td>
                      </tr>
                    ))}
                    <tr style={{ background: 'var(--olivar-bg)', fontWeight: 700 }}>
                      <td>Total olivar</td>
                      <td>{resumen.olivarKg.toFixed(0)} kg</td>
                      <td>100%</td>
                      <td>{resumen.olivarPerdigon > 0 ? resumen.olivarPerdigon.toFixed(0) + ' kg' : '—'}</td>
                      <td>{resumen.olivarAceite > 0 ? resumen.olivarAceite.toFixed(0) + ' kg' : '—'}</td>
                      <td>{resumen.olivarAceite > 0 ? '100%' : '—'}</td>
                      <td style={{ color: 'var(--color-success)' }}>{resumen.olivarIngreso > 0 ? resumen.olivarIngreso.toFixed(2) + ' €' : '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {showForm && (
        <div className="card">
          <div className="card-title"> {editingId ? 'Editar Cosecha' : 'Nueva Cosecha'}</div>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Fecha *</label>
                <input type="date" name="fecha" className="form-input" value={form.fecha} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">Finca</label>
                <select name="id_finca" className="form-select" value={form.id_finca} onChange={handleChange}>
                  <option value="">Sin finca</option>
                  {fincas.map(f => (
                    <option key={f.id_finca} value={f.id_finca}>{f.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Cultivo</label>
                <select name="cultivo" className="form-select" value={form.cultivo} onChange={handleChange}>
                  <option value="Viña">Viña</option>
                  <option value="Olivar">Olivar</option>
                  <option value="Viña y Olivar">Viña y Olivar</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Parcela</label>
                <select name="id_parcela" className="form-select" value={form.id_parcela} onChange={handleChange}>
                  <option value="">Seleccionar parcela...</option>
                  {fincas.map(f => (
                    <option key={f.id_finca} value={f.id_finca}>{f.nombre} ({f.termino_municipal})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Variedad</label>
                <input type="text" name="variedad" className="form-input" value={form.variedad} onChange={handleChange} placeholder="Variedad de uva/olivo" />
              </div>
              <div className="form-group">
                <label className="form-label">Destino</label>
                <select name="destino" className="form-select" value={form.destino} onChange={handleChange}>
                  <option value="">Sin destino</option>
                  {(destinos || []).map(d => (
                    <option key={d.id_destino} value={d.nombre}>{d.nombre} ({d.tipo || 'Otro'})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Kg producidos</label>
                <input type="number" name="kg" className="form-input" value={form.kg} onChange={handleChange} step="0.01" min="0" />
              </div>
              {(form.cultivo === 'Olivar' || form.cultivo === 'Viña y Olivar') && (
                <div className="form-group">
                  <label className="form-label">Kg pérdigon</label>
                  <input type="number" name="kg_perdigon" className="form-input" value={form.kg_perdigon} onChange={handleChange} step="0.01" min="0" placeholder="Aceituna de menor tamaño" />
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>Aceituna separada por la cooperativa (pago diferente)</div>
                </div>
              )}
            </div>
            {(form.cultivo === 'Viña' || form.cultivo === 'Viña y Olivar') && (
              <div className="form-group">
                <label className="form-label">Brix / Baume (grados)</label>
                <input type="number" name="brix_baume_viina" className="form-input" value={form.brix_baume_viina} onChange={handleChange} step="0.01" placeholder="Grados Brix o Baumé" />
              </div>
            )}
            {(form.cultivo === 'Olivar' || form.cultivo === 'Viña y Olivar') && (
              <div className="form-group">
                <label className="form-label">Rendimiento graso (%)</label>
                <input type="number" name="rendimiento_graso_olivar" className="form-input" value={form.rendimiento_graso_olivar} onChange={handleChange} step="0.01" placeholder="Porcentaje de rendimiento" />
              </div>
            )}
            {formKilogrados != null && (
              <div className="form-group">
                <label className="form-label">Cálculo automático</label>
                <div style={{ padding: '10px 12px', background: 'var(--color-primary-light)', border: '1px solid var(--color-primary)', borderRadius: 8, fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-primary)' }}>
                   {formKilogrados.value.toFixed(0)} {formKilogrados.label}
                </div>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Muestras calidad</label>
              <input type="text" name="muestras_calidad" className="form-input" value={form.muestras_calidad} onChange={handleChange} placeholder="Resultados de análisis" />
            </div>
            <div className="form-group">
              <label className="form-label">Observaciones</label>
              <textarea name="observaciones" className="form-textarea" value={form.observaciones} onChange={handleChange} />
            </div>
            <button type="submit" className={`btn btn-primary btn-full ${saving ? 'btn-loading' : ''}`} disabled={saving}>
              {saving ? 'Guardando...' : editingId ? ' Guardar cambios' : ' Registrar cosecha'}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-title"> Cosechas registradas ({filteredCosechas.length})</div>
        {filteredCosechas.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Parcela</th>
                  <th>Cultivo</th>
                  <th>Variedad</th>
                  <th>Kg</th>
                  <th>Pérdigon</th>
                  <th>Destino</th>
                  <th>Brix/Baume</th>
                  <th>Kilogrados</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredCosechas.map(c => (
                  <tr key={c.id_cosecha}>
                    <td>{c.fecha ? format(new Date(c.fecha), 'dd/MM/yyyy') : '-'}</td>
                    <td>{fincas.find(f => f.id_finca === (c.id_finca || c.id_parcela))?.nombre || '-'}</td>
                    <td>{c.cultivo || '-'}</td>
                    <td>{c.variedad || '-'}</td>
                    <td><strong>{c.kg ? c.kg.toFixed(0) : '-'}</strong></td>
                    <td>{c.kg_perdigon ? `${c.kg_perdigon.toFixed(0)} kg` : '-'}</td>
                    <td>{c.destino || '-'}</td>
                    <td>{c.brix_baume_viina ? `${c.brix_baume_viina}°` : (c.rendimiento_graso_olivar ? `${c.rendimiento_graso_olivar}%` : '-')}</td>
                    <td>{cosechaKilogrados(c) != null ? `${cosechaKilogrados(c).toFixed(0)} kg°` : (cosechaAceite(c) != null ? `${cosechaAceite(c).toFixed(0)} kg ace.` : '-')}</td>
                    <td>
                      <button className="btn btn-small btn-accent" onClick={() => handleEdit(c)} aria-label={`Editar cosecha ${c.variedad || c.cultivo}`}></button>
                      <button className="btn btn-small btn-danger" onClick={() => handleDelete(c.id_cosecha)} aria-label={`Eliminar cosecha ${c.variedad || c.cultivo}`}></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon"></div>
            <div className="empty-state-text">No hay cosechas registradas</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CosechasPage
