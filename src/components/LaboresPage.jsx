import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../data/supabaseClient'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { downloadCSV } from '../utils/csvExport'
import { getParamValue } from '../utils/params'

function LaboresPage({ fincas, personal, maquinaria, params, onDataChange }) {
  const [labores, setLabores] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [filterFinca, setFilterFinca] = useState('')
  const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [searchTerm, setSearchTerm] = useState('')

  // Precio del gasoil desde params
  const precioGasoilL = getParamValue(params, ['precio_gasoil_l', 'coste_gasoleo'], 0)

  // Formulario: un registro por día
  const TIPOS_TRABAJO = ['Poda', 'Descogollo', 'Despiojo', 'Limpia', 'Chupones', 'Trabajos con tractor', 'Otros']

  const [form, setForm] = useState({
    fecha: format(new Date(), 'yyyy-MM-dd'),
    tipo_trabajo: '',
    fincas: [], // [{ id_finca, peones: [{ id_operario, horas }] }]
    maquinaria: [], // [{ id_equipo, horas }]
    include_gasoil: true,
    notas: ''
  })

  useEffect(() => {
    loadLabores()
  }, [filterFinca])

  const loadLabores = async () => {
    setLoading(true)
    setError('')
    try {
      if (filterFinca) {
        const { data, error: err } = await supabase.from('labores').select('*').eq('id_finca', filterFinca).order('fecha', { ascending: false })
        if (err) throw err
        setLabores(data || [])
      } else {
        const { data, error: err } = await supabase.from('labores').select('*').order('fecha', { ascending: false })
        if (err) throw err
        setLabores(data || [])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Helper para comparar IDs (texto o número)
  const idEq = (a, b) => String(a) === String(b)

  // === CÁLCULO DE COSTES ===
  const calcularCostes = (fincasData, maquinariaData, includeGasoil) => {
    let costePeones = 0
    let costeMaquinaria = 0
    let costeGasoil = 0
    let totalHorasPeones = 0
    let totalHorasMaq = 0

    if (fincasData) {
      for (const fincaAsign of fincasData) {
        if (fincaAsign.peones) {
          for (const peon of fincaAsign.peones) {
            const horas = parseFloat(peon.horas) || 0
            const operario = personal.find(p => idEq(p.id_operario, peon.id_operario))
            const costeHora = operario ? (operario.coste_h || 10) : 10
            costePeones += horas * costeHora
            totalHorasPeones += horas
          }
        }
      }
    }

    if (maquinariaData) {
      for (const maqAsign of maquinariaData) {
        const horas = parseFloat(maqAsign.horas) || 0
        const equipo = maquinaria.find(m => idEq(m.id_equipo, maqAsign.id_equipo))
        if (equipo) {
          const costeHora = equipo.coste_h || 0
          costeMaquinaria += horas * costeHora
          totalHorasMaq += horas
          if (includeGasoil && equipo.consumo_l_h && precioGasoilL) {
            costeGasoil += horas * equipo.consumo_l_h * precioGasoilL
          }
        }
      }
    }

    return { costePeones, costeMaquinaria, costeGasoil, totalHorasPeones, totalHorasMaq, total: costePeones + costeMaquinaria + costeGasoil }
  }

  const costes = useMemo(() => calcularCostes(form.fincas, form.maquinaria, form.include_gasoil), [form.fincas, form.maquinaria, form.include_gasoil, personal, maquinaria, precioGasoilL])

  // === GESTIÓN DE FINCAS ===
  const addFincaToForm = (fincaId) => {
    const id = String(fincaId)
    if (form.fincas.some(f => idEq(f.id_finca, id))) return
    setForm(prev => ({
      ...prev,
      fincas: [...prev.fincas, { id_finca: id, peones: [] }]
    }))
  }

  const removeFincaFromForm = (fincaId) => {
    setForm(prev => ({
      ...prev,
      fincas: prev.fincas.filter(f => !idEq(f.id_finca, fincaId))
    }))
  }

  const addPeonToFinca = (fincaId) => {
    setForm(prev => ({
      ...prev,
      fincas: prev.fincas.map(f =>
        idEq(f.id_finca, fincaId)
          ? { ...f, peones: [...f.peones, { id_operario: '', horas: '' }] }
          : f
      )
    }))
  }

  const removePeonFromFinca = (fincaId, index) => {
    setForm(prev => ({
      ...prev,
      fincas: prev.fincas.map(f =>
        idEq(f.id_finca, fincaId)
          ? { ...f, peones: f.peones.filter((_, i) => i !== index) }
          : f
      )
    }))
  }

  const updatePeonInFinca = (fincaId, index, field, value) => {
    setForm(prev => ({
      ...prev,
      fincas: prev.fincas.map(f =>
        idEq(f.id_finca, fincaId)
          ? { ...f, peones: f.peones.map((p, i) => i === index ? { ...p, [field]: value } : p) }
          : f
      )
    }))
  }

  // === GESTIÓN DE MAQUINARIA ===
  const addMaquinaToForm = (equipoId) => {
    const id = String(equipoId)
    if (form.maquinaria.some(m => idEq(m.id_equipo, id))) return
    setForm(prev => ({
      ...prev,
      maquinaria: [...prev.maquinaria, { id_equipo: id, horas: '' }]
    }))
  }

  const removeMaquinaFromForm = (equipoId) => {
    setForm(prev => ({
      ...prev,
      maquinaria: prev.maquinaria.filter(m => !idEq(m.id_equipo, equipoId))
    }))
  }

  const updateMaquinaHoras = (equipoId, horas) => {
    setForm(prev => ({
      ...prev,
      maquinaria: prev.maquinaria.map(m =>
        idEq(m.id_equipo, equipoId) ? { ...m, horas } : m
      )
    }))
  }

  // === GUARDAR ===
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const tienePeones = form.fincas.some(f => f.peones.some(p => p.id_operario && parseFloat(p.horas) > 0))
    const tieneMaquinaria = form.maquinaria.some(m => parseFloat(m.horas) > 0)

    if (!tienePeones && !tieneMaquinaria) {
      setError('Añade al menos un peón con horas o una máquina con horas')
      return
    }

    setSaving(true)

    const datos = {
      fecha: form.fecha,
      tipo_trabajo: form.tipo_trabajo || null,
      id_finca: form.fincas.length > 0 ? form.fincas[0].id_finca : null,
      asignaciones_fincas: JSON.stringify(form.fincas),
      asignaciones_maquinaria: JSON.stringify(form.maquinaria),
      coste_total: costes.total,
      coste_peones: costes.costePeones,
      coste_maquinaria: costes.costeMaquinaria,
      coste_gasoil: costes.costeGasoil,
      include_gasoil: form.include_gasoil,
      notas: form.notas || null
    }

    try {
      if (editingId) {
        const { error: err } = await supabase.from('labores').update(datos).eq('id_labor', editingId)
        if (err) throw new Error(err.message)
        setSuccess('Labor actualizada correctamente')
      } else {
        const { error: err } = await supabase.from('labores').insert([datos])
        if (err) throw new Error(err.message)
        setSuccess('Labor registrada correctamente')
      }

      await loadLabores()
      onDataChange?.()
      resetForm()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
      // NO cerramos el formulario si falla
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setForm({
      fecha: format(new Date(), 'yyyy-MM-dd'),
      tipo_trabajo: '',
      fincas: [],
      maquinaria: [],
      include_gasoil: true,
      notas: ''
    })
    setEditingId(null)
    setShowForm(false)
  }

  // === EDITAR ===
  const handleEdit = (labor) => {
    const fincasData = labor.asignaciones_fincas ? (typeof labor.asignaciones_fincas === 'string' ? JSON.parse(labor.asignaciones_fincas) : labor.asignaciones_fincas) : []
    const maquinariaData = labor.asignaciones_maquinaria ? (typeof labor.asignaciones_maquinaria === 'string' ? JSON.parse(labor.asignaciones_maquinaria) : labor.asignaciones_maquinaria) : []

    setForm({
      fecha: labor.fecha ? format(new Date(labor.fecha), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      tipo_trabajo: labor.tipo_trabajo || '',
      fincas: fincasData || [],
      maquinaria: maquinariaData || [],
      include_gasoil: labor.include_gasoil !== false,
      notas: labor.notas || ''
    })
    setEditingId(labor.id_labor)
    setShowForm(true)
  }

  // === ELIMINAR ===
  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta labor? Esta acción no se puede deshacer.')) return
    try {
      const { error: err } = await supabase.from('labores').delete().eq('id_labor', id)
      if (err) throw err
      await loadLabores()
      onDataChange?.()
    } catch (err) {
      setError(err.message)
    }
  }

  // === HELPERS ===
  const fincaNombre = (id) => {
    const f = fincas.find(f => idEq(f.id_finca, id))
    return f ? f.nombre : '-'
  }

  const operarioNombre = (id) => {
    const p = personal.find(p => idEq(p.id_operario, id))
    return p ? p.nombre : '-'
  }

  const equipoNombre = (id) => {
    const m = maquinaria.find(m => idEq(m.id_equipo, id))
    return m ? `${m.tipo} (${m.marca_modelo || 'Sin marca'})` : '-'
  }

  const getFincaInfo = (labor) => {
    const fincasData = labor.asignaciones_fincas ? (typeof labor.asignaciones_fincas === 'string' ? JSON.parse(labor.asignaciones_fincas) : labor.asignaciones_fincas) : []
    if (!fincasData || fincasData.length === 0) return labor.id_finca ? fincaNombre(labor.id_finca) : '-'
    return fincasData.map(f => fincaNombre(f.id_finca)).join(', ')
  }

  const getPeonesInfo = (labor) => {
    const fincasData = labor.asignaciones_fincas ? (typeof labor.asignaciones_fincas === 'string' ? JSON.parse(labor.asignaciones_fincas) : labor.asignaciones_fincas) : []
    const allPeones = []
    for (const fa of fincasData) {
      if (fa.peones) {
        for (const p of fa.peones) {
          if (p.id_operario) allPeones.push(`${operarioNombre(p.id_operario)} (${p.horas}h)`)
        }
      }
    }
    return allPeones.length > 0 ? allPeones.join(', ') : '-'
  }

  const getMaqInfo = (labor) => {
    const maqData = labor.asignaciones_maquinaria ? (typeof labor.asignaciones_maquinaria === 'string' ? JSON.parse(labor.asignaciones_maquinaria) : labor.asignaciones_maquinaria) : []
    if (!maqData || maqData.length === 0) return '-'
    return maqData.map(m => `${equipoNombre(m.id_equipo)} (${m.horas}h)`).join(', ')
  }

  const filteredLabores = useMemo(() => {
    let result = labores
    if (filterFinca) {
      result = result.filter(l => {
        if (idEq(l.id_finca, filterFinca)) return true
        const fincasData = l.asignaciones_fincas ? (typeof l.asignaciones_fincas === 'string' ? JSON.parse(l.asignaciones_fincas) : l.asignaciones_fincas) : []
        return fincasData?.some(f => idEq(f.id_finca, filterFinca))
      })
    }
    result = result.filter(l => l.fecha && l.fecha.startsWith(filterMonth))
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      result = result.filter(l => {
        return (l.tipo_trabajo || '').toLowerCase().includes(term) ||
               getFincaInfo(l).toLowerCase().includes(term) ||
               getPeonesInfo(l).toLowerCase().includes(term) ||
               getMaqInfo(l).toLowerCase().includes(term) ||
               (l.notas || '').toLowerCase().includes(term)
      })
    }
    return result
  }, [labores, filterFinca, filterMonth, searchTerm])

  if (loading) {
    return (
      <div className="empty-state" aria-busy="true">
        <div className="spinner"></div>
        <p className="mt-16">Cargando labores...</p>
      </div>
    )
  }

  return (
    <div>
      {success && <div className="alert alert-success" role="alert">✅ {success}</div>}
      {error && (
        <div className="alert alert-error" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span>⚠️ {error}</span>
          <button className="btn btn-small btn-primary" onClick={loadLabores} aria-label="Reintentar">🔄 Reintentar</button>
        </div>
      )}

      {/* Filtros y Exportar */}
      <div className="fincas-toolbar mb-16" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="search-box" style={{ flex: 1, minWidth: 200 }}>
          <span className="search-icon">🔍</span>
          <input type="text" className="search-input" placeholder="Buscar por finca, peón, máquina..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} aria-label="Buscar labores" />
          {searchTerm && <button className="clear-search" onClick={() => setSearchTerm('')} aria-label="Limpiar búsqueda">✕</button>}
        </div>
        <button className="btn btn-small btn-accent" onClick={() => {
          const headers = ['fecha', 'tipo_trabajo', 'fincas', 'peones', 'maquinaria', 'coste_total', 'notas']
          const rows = filteredLabores.map(l => ({
            fecha: l.fecha ? format(new Date(l.fecha), 'dd/MM/yyyy') : '',
            tipo_trabajo: l.tipo_trabajo || '',
            fincas: getFincaInfo(l), peones: getPeonesInfo(l), maquinaria: getMaqInfo(l),
            coste_total: l.coste_total ?? 0, notas: l.notas || ''
          }))
          downloadCSV('labores_agrotrack', headers, rows)
        }} aria-label="Exportar labores como CSV">📥 Exportar CSV</button>
      </div>

      <div className="flex gap-16 mb-16 flex-wrap">
        <select className="form-select" style={{ width: 'auto' }} value={filterFinca} onChange={e => setFilterFinca(e.target.value)} aria-label="Filtrar por finca">
          <option value="">Todas las fincas</option>
          {fincas.map(f => <option key={f.id_finca} value={f.id_finca}>{f.nombre}</option>)}
        </select>
        <select className="form-select" style={{ width: 'auto' }} value={filterMonth} onChange={e => setFilterMonth(e.target.value)} aria-label="Filtrar por mes">
          {Array.from({ length: 12 }, (_, i) => {
            const d = new Date(); d.setMonth(d.getMonth() - i)
            return format(d, 'yyyy-MM')
          }).map(m => <option key={m} value={m}>{format(new Date(m + '-01'), 'MMMM yyyy', { locale: es })}</option>)}
        </select>
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingId(null) }}>
          {showForm ? '✕ Cancelar' : '+ Nueva Labor'}
        </button>
      </div>

      {/* FORMULARIO */}
      {showForm && (
        <div className="card">
          <div className="card-title">📝 {editingId ? 'Editar Labor' : 'Nueva Labor'}</div>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Fecha *</label>
                <input type="date" className="form-input" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo de trabajo</label>
                <select className="form-select" value={form.tipo_trabajo} onChange={e => setForm({ ...form, tipo_trabajo: e.target.value })}>
                  <option value="">Seleccionar tipo...</option>
                  {TIPOS_TRABAJO.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* FINCAS Y PEONES */}
            <div style={{ marginBottom: 16 }}>
              <div className="card-title" style={{ fontSize: '1rem' }}>🌍 Fincas y Peones</div>
              <div className="form-row" style={{ marginBottom: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Añadir finca</label>
                  <select className="form-select" value="" onChange={e => { if (e.target.value) addFincaToForm(e.target.value) }}>
                    <option value="">Seleccionar finca...</option>
                    {fincas.filter(f => !form.fincas.some(ff => idEq(ff.id_finca, f.id_finca))).map(f => (
                      <option key={f.id_finca} value={f.id_finca}>{f.nombre} ({f.termino_municipal})</option>
                    ))}
                  </select>
                </div>
              </div>

              {form.fincas.map(fincaAsign => {
                const finca = fincas.find(f => idEq(f.id_finca, fincaAsign.id_finca))
                return (
                  <div key={fincaAsign.id_finca} style={{ background: 'var(--color-bg)', borderRadius: 12, padding: 12, marginBottom: 12, border: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <strong style={{ color: 'var(--color-primary)' }}>📍 {finca?.nombre || 'Finca'}</strong>
                      <button type="button" className="btn btn-small btn-danger" onClick={() => removeFincaFromForm(fincaAsign.id_finca)}>✕ Quitar</button>
                    </div>

                    {fincaAsign.peones.map((peon, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                        <select className="form-select" style={{ flex: 2 }} value={peon.id_operario} onChange={e => updatePeonInFinca(fincaAsign.id_finca, idx, 'id_operario', e.target.value)}>
                          <option value="">Seleccionar peón...</option>
                          {personal.map(p => <option key={p.id_operario} value={p.id_operario}>{p.nombre} ({p.categoria} - {p.coste_h}€/h)</option>)}
                        </select>
                        <input type="number" className="form-input" style={{ flex: 1, maxWidth: 100 }} value={peon.horas} onChange={e => updatePeonInFinca(fincaAsign.id_finca, idx, 'horas', e.target.value)} step="0.5" min="0" placeholder="Horas" />
                        <button type="button" className="btn btn-small btn-danger" onClick={() => removePeonFromFinca(fincaAsign.id_finca, idx)}>✕</button>
                      </div>
                    ))}

                    <button type="button" className="btn btn-small btn-accent" onClick={() => addPeonToFinca(fincaAsign.id_finca)}>+ Añadir peón</button>
                  </div>
                )
              })}

              {form.fincas.length === 0 && <p style={{ fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Selecciona fincas arriba para empezar.</p>}
            </div>

            {/* MAQUINARIA */}
            <div style={{ marginBottom: 16 }}>
              <div className="card-title" style={{ fontSize: '1rem' }}>🚜 Maquinaria</div>
              <div className="form-row" style={{ marginBottom: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Añadir máquina</label>
                  <select className="form-select" value="" onChange={e => { if (e.target.value) addMaquinaToForm(e.target.value) }}>
                    <option value="">Seleccionar máquina...</option>
                    {maquinaria.filter(m => !form.maquinaria.some(mm => idEq(mm.id_equipo, m.id_equipo))).map(m => (
                      <option key={m.id_equipo} value={m.id_equipo}>{m.tipo} - {m.marca_modelo || 'Sin marca'} ({m.coste_h}€/h{m.consumo_l_h ? `, ${m.consumo_l_h}L/h` : ''})</option>
                    ))}
                  </select>
                </div>
              </div>

              {form.maquinaria.map(maqAsign => {
                const equipo = maquinaria.find(m => idEq(m.id_equipo, maqAsign.id_equipo))
                return (
                  <div key={maqAsign.id_equipo} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, background: 'var(--color-bg)', borderRadius: 12, padding: 12, border: '1px solid var(--color-border)' }}>
                    <span style={{ flex: 2, fontWeight: 500 }}>
                      {equipo ? `${equipo.tipo} (${equipo.marca_modelo || 'Sin marca'})` : 'Equipo'}
                      {equipo && <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}> - {equipo.coste_h}€/h</span>}
                    </span>
                    <input type="number" className="form-input" style={{ flex: 1, maxWidth: 100 }} value={maqAsign.horas} onChange={e => updateMaquinaHoras(maqAsign.id_equipo, e.target.value)} step="0.5" min="0" placeholder="Horas" />
                    <button type="button" className="btn btn-small btn-danger" onClick={() => removeMaquinaFromForm(maqAsign.id_equipo)}>✕</button>
                  </div>
                )
              })}

              {form.maquinaria.length === 0 && <p style={{ fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No has añadido maquinaria.</p>}

              {form.maquinaria.length > 0 && precioGasoilL > 0 && (
                <div style={{ marginTop: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.include_gasoil} onChange={e => setForm({ ...form, include_gasoil: e.target.checked })} style={{ width: 18, height: 18, accentColor: 'var(--color-primary)' }} />
                    <strong>⛽ Incluir gasoil automáticamente</strong>
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>({precioGasoilL.toFixed(2)}€/L)</span>
                  </label>
                </div>
              )}
            </div>

            {/* DESGLOSE */}
            <div style={{ background: 'var(--color-bg)', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid var(--color-border)' }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--color-primary)' }}>💰 Desglose de costes</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}><span>👷 Peones ({costes.totalHorasPeones}h):</span><strong>{costes.costePeones.toFixed(2)} €</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}><span>🚜 Maquinaria ({costes.totalHorasMaq}h):</span><strong>{costes.costeMaquinaria.toFixed(2)} €</strong></div>
              {costes.costeGasoil > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}><span>⛽ Gasoil:</span><strong>{costes.costeGasoil.toFixed(2)} €</strong></div>}
              <div style={{ borderTop: '2px solid var(--color-primary)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 16 }}>TOTAL:</span>
                <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--color-primary)' }}>{costes.total.toFixed(2)} €</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notas</label>
              <textarea className="form-textarea" value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} placeholder="Observaciones..." />
            </div>

            <button type="submit" className={`btn btn-primary btn-full ${saving ? 'btn-loading' : ''}`} disabled={saving}>
              {saving ? 'Guardando...' : editingId ? '💾 Guardar cambios' : '✅ Registrar labor'}
            </button>
          </form>
        </div>
      )}

      {/* TABLA */}
      <div className="card">
        <div className="card-title">📋 Labores registradas ({filteredLabores.length})</div>
        {filteredLabores.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Fecha</th><th>Tipo</th><th>Fincas</th><th>Peones</th><th>Maquinaria</th><th>Coste Total</th><th>Acciones</th></tr></thead>
              <tbody>
                {filteredLabores.map(l => (
                  <tr key={l.id_labor}>
                    <td>{l.fecha ? format(new Date(l.fecha), 'dd/MM/yyyy') : '-'}</td>
                    <td>{l.tipo_trabajo || '-'}</td>
                    <td>{getFincaInfo(l)}</td>
                    <td style={{ fontSize: 13 }}>{getPeonesInfo(l)}</td>
                    <td style={{ fontSize: 13 }}>{getMaqInfo(l)}</td>
                    <td><strong>{(l.coste_total || 0).toFixed(2)} €</strong></td>
                    <td>
                      <button className="btn btn-small btn-accent" onClick={() => handleEdit(l)} aria-label={`Editar labor ${l.tipo_trabajo || 'sin tipo'}`}>✏️</button>
                      <button className="btn btn-small btn-danger" onClick={() => handleDelete(l.id_labor)} aria-label={`Eliminar labor ${l.tipo_trabajo || 'sin tipo'}`}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><div className="empty-state-icon">📝</div><div className="empty-state-text">No hay labores para este filtro</div></div>
        )}
      </div>
    </div>
  )
}

export default LaboresPage
