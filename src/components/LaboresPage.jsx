import { useState, useEffect, useMemo } from 'react'
import { Inbox, Pencil, Search, Trash2, X } from 'lucide-react'
import { supabase } from '../data/supabaseClient'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { downloadCSV } from '../utils/csvExport'
import { getParamValue } from '../utils/params'
import { fetchAll } from '../utils/fetchAll'
import { insertarConCola } from '../utils/offline'
import { parseSecciones, laborIncluyeFinca } from '../utils/labores'

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

  const TIPOS_TRABAJO = ['Poda', 'Descogollo', 'Despiojo', 'Limpia', 'Chupones', 'Trabajos con tractor', 'Tratamiento fitosanitario', 'Abonado', 'Vendimia', 'Cogida de aceitunas', 'Otros']

  // Formulario: una jornada con múltiples secciones
  // secciones: [{ tipo_trabajo, fincas: [{ id_finca, peones: [{ id_operario, horas }] }], maquinaria: [{ id_equipo, horas }], include_gasoil }]
  const emptyForm = () => ({
    fecha: format(new Date(), 'yyyy-MM-dd'),
    secciones: [{ tipo_trabajo: '', fincas: [], maquinaria: [], include_gasoil: true }],
    notas: ''
  })
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    loadLabores()
  }, [])

  const loadLabores = async () => {
    setLoading(true)
    setError('')
    try {
      // Se cargan todas: el filtro por finca se hace en cliente porque una jornada puede tener varias fincas
      const { data, error: err } = await fetchAll('labores', q => q.order('fecha', { ascending: false }))
      if (err) throw err
      setLabores(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Helper para comparar IDs (texto o número)
  const idEq = (a, b) => String(a) === String(b)

  // === CÁLCULO DE COSTES POR SECCIÓN ===
  const calcularCostesSeccion = (seccion) => {
    let costePeones = 0
    let costeMaquinaria = 0
    let costeGasoil = 0
    let totalHorasPeones = 0
    let totalHorasMaq = 0

    if (seccion.fincas) {
      for (const fincaAsign of seccion.fincas) {
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

    if (seccion.maquinaria) {
      for (const maqAsign of seccion.maquinaria) {
        const horas = parseFloat(maqAsign.horas) || 0
        const equipo = maquinaria.find(m => idEq(m.id_equipo, maqAsign.id_equipo))
        if (equipo) {
          const costeHora = equipo.coste_h || 0
          costeMaquinaria += horas * costeHora
          totalHorasMaq += horas
          if (seccion.include_gasoil && equipo.consumo_l_h && precioGasoilL) {
            costeGasoil += horas * equipo.consumo_l_h * precioGasoilL
          }
        }
      }
    }

    return { costePeones, costeMaquinaria, costeGasoil, totalHorasPeones, totalHorasMaq, total: costePeones + costeMaquinaria + costeGasoil }
  }

  // Costes totales de todas las secciones
  const costes = useMemo(() => {
    let total = 0, totalPeones = 0, totalMaq = 0, totalGasoil = 0, totalHorasPeones = 0, totalHorasMaq = 0
    for (const sec of form.secciones) {
      const c = calcularCostesSeccion(sec)
      total += c.total
      totalPeones += c.costePeones
      totalMaq += c.costeMaquinaria
      totalGasoil += c.costeGasoil
      totalHorasPeones += c.totalHorasPeones
      totalHorasMaq += c.totalHorasMaq
    }
    return { costePeones: totalPeones, costeMaquinaria: totalMaq, costeGasoil: totalGasoil, totalHorasPeones, totalHorasMaq, total }
  }, [form.secciones, personal, maquinaria, precioGasoilL])

  // === GESTIÓN DE SECCIONES ===
  const addSection = () => {
    setForm(prev => ({
      ...prev,
      secciones: [...prev.secciones, { tipo_trabajo: '', fincas: [], maquinaria: [], include_gasoil: true }]
    }))
  }

  const removeSection = (idx) => {
    setForm(prev => ({
      ...prev,
      secciones: prev.secciones.filter((_, i) => i !== idx)
    }))
  }

  const updateSection = (idx, field, value) => {
    setForm(prev => ({
      ...prev,
      secciones: prev.secciones.map((s, i) => i === idx ? { ...s, [field]: value } : s)
    }))
  }

  // === GESTIÓN DE FINCAS DENTRO DE SECCIÓN ===
  const addFincaToSection = (secIdx, fincaId) => {
    const id = String(fincaId)
    const sec = form.secciones[secIdx]
    if (sec.fincas.some(f => idEq(f.id_finca, id))) return
    setForm(prev => ({
      ...prev,
      secciones: prev.secciones.map((s, i) =>
        i === secIdx ? { ...s, fincas: [...s.fincas, { id_finca: id, peones: [] }] } : s
      )
    }))
  }

  const removeFincaFromSection = (secIdx, fincaId) => {
    setForm(prev => ({
      ...prev,
      secciones: prev.secciones.map((s, i) =>
        i === secIdx ? { ...s, fincas: s.fincas.filter(f => !idEq(f.id_finca, fincaId)) } : s
      )
    }))
  }

  const addPeonToFincaInSection = (secIdx, fincaId) => {
    setForm(prev => ({
      ...prev,
      secciones: prev.secciones.map((s, i) =>
        i === secIdx ? {
          ...s,
          fincas: s.fincas.map(f =>
            idEq(f.id_finca, fincaId) ? { ...f, peones: [...f.peones, { id_operario: '', horas: '' }] } : f
          )
        } : s
      )
    }))
  }

  const removePeonFromFincaInSection = (secIdx, fincaId, peonIdx) => {
    setForm(prev => ({
      ...prev,
      secciones: prev.secciones.map((s, i) =>
        i === secIdx ? {
          ...s,
          fincas: s.fincas.map(f =>
            idEq(f.id_finca, fincaId) ? { ...f, peones: f.peones.filter((_, idx) => idx !== peonIdx) } : f
          )
        } : s
      )
    }))
  }

  const updatePeonInFincaInSection = (secIdx, fincaId, peonIdx, field, value) => {
    setForm(prev => ({
      ...prev,
      secciones: prev.secciones.map((s, i) =>
        i === secIdx ? {
          ...s,
          fincas: s.fincas.map(f =>
            idEq(f.id_finca, fincaId) ? {
              ...f,
              peones: f.peones.map((p, pi) => pi === peonIdx ? { ...p, [field]: value } : p)
            } : f
          )
        } : s
      )
    }))
  }

  // === GESTIÓN DE MAQUINARIA DENTRO DE SECCIÓN ===
  const addMaquinaToSection = (secIdx, equipoId) => {
    const id = String(equipoId)
    const sec = form.secciones[secIdx]
    if (sec.maquinaria.some(m => idEq(m.id_equipo, id))) return
    setForm(prev => ({
      ...prev,
      secciones: prev.secciones.map((s, i) =>
        i === secIdx ? { ...s, maquinaria: [...s.maquinaria, { id_equipo: id, horas: '' }] } : s
      )
    }))
  }

  const removeMaquinaFromSection = (secIdx, equipoId) => {
    setForm(prev => ({
      ...prev,
      secciones: prev.secciones.map((s, i) =>
        i === secIdx ? { ...s, maquinaria: s.maquinaria.filter(m => !idEq(m.id_equipo, equipoId)) } : s
      )
    }))
  }

  const updateMaquinaHorasInSection = (secIdx, equipoId, horas) => {
    setForm(prev => ({
      ...prev,
      secciones: prev.secciones.map((s, i) =>
        i === secIdx ? {
          ...s,
          maquinaria: s.maquinaria.map(m => idEq(m.id_equipo, equipoId) ? { ...m, horas } : m)
        } : s
      )
    }))
  }

  // === GUARDAR ===
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (form.secciones.length === 0) {
      setError('Añade al menos una sección de trabajo')
      return
    }

    // Validar: cada sección con al menos un peón o una máquina con horas
    const hasContent = form.secciones.every(sec => {
      const hasPeones = sec.fincas?.some(f => f.peones?.some(p => p.id_operario && parseFloat(p.horas) > 0)) ?? false
      const hasMaq = sec.maquinaria?.some(m => parseFloat(m.horas) > 0) ?? false
      return hasPeones || hasMaq
    })

    if (!hasContent) {
      setError('Cada sección debe tener al menos un peón con horas o una máquina con horas')
      return
    }

    // Validar: cada sección debe tener tipo de trabajo
    const missingType = form.secciones.some(s => !s.tipo_trabajo)
    if (missingType) {
      setError('Cada sección debe tener un tipo de trabajo seleccionado')
      return
    }

    setSaving(true)

    // Preparar datos para guardar
    // asignaciones_fincas → array de secciones (nuevo formato)
    // asignaciones_maquinaria → maquinaria combinada de todas las secciones (para compatibilidad)
    const allMaquinaria = form.secciones.flatMap(s => s.maquinaria || [])
    const allFincas = form.secciones.flatMap(s => s.fincas || [])

    const datos = {
      fecha: form.fecha,
      tipo_trabajo: form.secciones.map(s => s.tipo_trabajo).join(', '), // Para búsqueda y display legacy
      id_finca: allFincas.length > 0 ? allFincas[0].id_finca : null,
      asignaciones_fincas: JSON.stringify(form.secciones), // Las secciones completas
      asignaciones_maquinaria: JSON.stringify(allMaquinaria),
      coste_total: costes.total,
      coste_peones: costes.costePeones,
      coste_maquinaria: costes.costeMaquinaria,
      coste_gasoil: costes.costeGasoil,
      include_gasoil: true,
      notas: form.notas || null
    }

    try {
      if (editingId) {
        const { error: err } = await supabase.from('labores').update(datos).eq('id_labor', editingId)
        if (err) throw new Error(err.message)
        setSuccess('Labor actualizada correctamente')
      } else {
        const { error: err, encolado } = await insertarConCola('labores', datos)
        if (err) throw new Error(err.message)
        setSuccess(encolado ? 'Sin cobertura: la jornada se enviará al recuperar la señal' : 'Labor registrada correctamente')
      }

      await loadLabores()
      onDataChange?.()
      resetForm()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setForm(emptyForm())
    setEditingId(null)
    setShowForm(false)
  }

  // === EDITAR ===
  const handleEdit = (labor) => {
    const secciones = parseSecciones(labor)

    setForm({
      fecha: labor.fecha ? labor.fecha.substring(0, 10) : format(new Date(), 'yyyy-MM-dd'),
      secciones,
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

  // Para display: obtener info de secciones de una labor
  const getSeccionesInfo = (labor) => {
    const secciones = parseSecciones(labor)
    return secciones
  }

  const getFincaInfo = (labor) => {
    const secciones = getSeccionesInfo(labor)
    const allFincas = secciones.flatMap(s => s.fincas || [])
    if (allFincas.length === 0) return labor.id_finca ? fincaNombre(labor.id_finca) : '-'
    return [...new Set(allFincas.map(f => fincaNombre(f.id_finca)))].join(', ')
  }

  const getPeonesInfo = (labor) => {
    const secciones = getSeccionesInfo(labor)
    const allPeones = []
    for (const sec of secciones) {
      for (const fa of (sec.fincas || [])) {
        for (const p of (fa.peones || [])) {
          if (p.id_operario) allPeones.push(`${operarioNombre(p.id_operario)} (${p.horas}h)`)
        }
      }
    }
    return allPeones.length > 0 ? allPeones.join(', ') : '-'
  }

  const getMaqInfo = (labor) => {
    const secciones = getSeccionesInfo(labor)
    const allMaq = secciones.flatMap(s => s.maquinaria || [])
    if (allMaq.length === 0) return '-'
    return allMaq.map(m => `${equipoNombre(m.id_equipo)} (${m.horas}h)`).join(', ')
  }

  const getTipoInfo = (labor) => {
    return labor.tipo_trabajo || '-'
  }

  const filteredLabores = useMemo(() => {
    let result = labores
    if (filterFinca) {
      result = result.filter(l => laborIncluyeFinca(l, filterFinca))
    }
    if (filterMonth) result = result.filter(l => l.fecha && l.fecha.startsWith(filterMonth))
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      result = result.filter(l => {
        return getTipoInfo(l).toLowerCase().includes(term) ||
               getFincaInfo(l).toLowerCase().includes(term) ||
               getPeonesInfo(l).toLowerCase().includes(term) ||
               getMaqInfo(l).toLowerCase().includes(term) ||
               (l.notas || '').toLowerCase().includes(term)
      })
    }
    return result
  }, [labores, filterFinca, filterMonth, searchTerm])

  // Meses con labores registradas (más el actual), del más reciente al más antiguo
  const mesesDisponibles = useMemo(() => {
    const set = new Set([format(new Date(), 'yyyy-MM')])
    for (const l of labores) if (l.fecha) set.add(l.fecha.substring(0, 7))
    return [...set].sort().reverse()
  }, [labores])

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
      {success && <div className="alert alert-success" role="alert"> {success}</div>}
      {error && (
        <div className="alert alert-error" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span> {error}</span>
          <button className="btn btn-small btn-primary" onClick={loadLabores} aria-label="Reintentar"> Reintentar</button>
        </div>
      )}

      {/* Filtros y Exportar */}
      <div className="fincas-toolbar mb-16" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="search-box" style={{ flex: 1, minWidth: 200 }}>
          <span className="search-icon" aria-hidden="true"><Search size={18} /></span>
          <input type="text" className="search-input" placeholder="Buscar por finca, peón, máquina..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} aria-label="Buscar labores" />
          {searchTerm && <button className="clear-search" onClick={() => setSearchTerm('')} aria-label="Limpiar búsqueda"><X size={18} aria-hidden="true" /></button>}
        </div>
        <button className="btn btn-small btn-accent" onClick={() => {
          const headers = ['fecha', 'tipo_trabajo', 'fincas', 'peones', 'maquinaria', 'coste_total', 'notas']
          const rows = filteredLabores.map(l => ({
            fecha: l.fecha ? format(new Date(l.fecha), 'dd/MM/yyyy') : '',
            tipo_trabajo: getTipoInfo(l),
            fincas: getFincaInfo(l), peones: getPeonesInfo(l), maquinaria: getMaqInfo(l),
            coste_total: l.coste_total ?? 0, notas: l.notas || ''
          }))
          downloadCSV('labores_agrotrack', headers, rows)
        }} aria-label="Exportar labores como CSV"> Exportar CSV</button>
      </div>

      <div className="flex gap-16 mb-16 flex-wrap">
        <select className="form-select" style={{ width: 'auto' }} value={filterFinca} onChange={e => setFilterFinca(e.target.value)} aria-label="Filtrar por finca">
          <option value="">Todas las fincas</option>
          {fincas.map(f => <option key={f.id_finca} value={f.id_finca}>{f.nombre}</option>)}
        </select>
        <select className="form-select" style={{ width: 'auto' }} value={filterMonth} onChange={e => setFilterMonth(e.target.value)} aria-label="Filtrar por mes">
          <option value="">Todos los meses</option>
          {mesesDisponibles.map(m => <option key={m} value={m}>{format(new Date(m + '-01T00:00:00'), 'MMMM yyyy', { locale: es })}</option>)}
        </select>
        <button className="btn btn-primary" onClick={() => { if (showForm) { resetForm() } else { setForm(emptyForm()); setEditingId(null); setShowForm(true) } }}>
          {showForm ? ' Cancelar' : '+ Nueva Labor'}
        </button>
      </div>

      {/* FORMULARIO */}
      {showForm && (
        <div className="card">
          <div className="card-title"> {editingId ? 'Editar Labor' : 'Nueva Labor'}</div>
          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Fecha *</label>
              <input type="date" className="form-input" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} required />
            </div>

            {/* SECCIONES */}
            {form.secciones.map((sec, secIdx) => {
              const secCostes = calcularCostesSeccion(sec)
              return (
                <div key={secIdx} style={{ background: 'var(--color-bg)', borderRadius: 16, padding: 16, marginBottom: 16, border: '2px solid var(--color-border)' }}>
                  {/* Header de sección */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ background: 'var(--color-primary)', color: 'white', borderRadius: 8, padding: '2px 10px', fontSize: 13, fontWeight: 600 }}>
                        Sección {secIdx + 1}
                      </span>
                      <div style={{ flex: 1 }}>
                        <select className="form-select" value={sec.tipo_trabajo} onChange={e => updateSection(secIdx, 'tipo_trabajo', e.target.value)} style={{ minWidth: 160 }}>
                          <option value="">Tipo de trabajo...</option>
                          {TIPOS_TRABAJO.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    {form.secciones.length > 1 && (
                      <button type="button" className="btn btn-small btn-danger" onClick={() => removeSection(secIdx)} aria-label={`Eliminar sección ${secIdx + 1}`}> Quitar</button>
                    )}
                  </div>

                  {/* FINCAS Y PEONES */}
                  <div style={{ marginBottom: 12, paddingLeft: 8, borderLeft: '3px solid var(--color-primary)' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--color-text-secondary)' }}> Fincas y Peones</div>
                    <div className="form-row" style={{ marginBottom: 8 }}>
                      <select className="form-select" value="" onChange={e => { if (e.target.value) addFincaToSection(secIdx, e.target.value) }}>
                        <option value="">+ Seleccionar finca...</option>
                        {fincas.filter(f => !sec.fincas.some(ff => idEq(ff.id_finca, f.id_finca))).map(f => (
                          <option key={f.id_finca} value={f.id_finca}>{f.nombre} ({f.termino_municipal})</option>
                        ))}
                      </select>
                    </div>

                    {sec.fincas.map(fincaAsign => {
                      const finca = fincas.find(f => idEq(f.id_finca, fincaAsign.id_finca))
                      return (
                        <div key={fincaAsign.id_finca} style={{ background: 'var(--color-card-bg)', borderRadius: 12, padding: 12, marginBottom: 8, border: '1px solid var(--color-border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <strong style={{ color: 'var(--color-primary)', fontSize: 14 }}> {finca?.nombre || 'Finca'}</strong>
                            <button type="button" className="btn btn-small btn-danger" onClick={() => removeFincaFromSection(secIdx, fincaAsign.id_finca)} aria-label="Quitar finca"><X size={16} aria-hidden="true" /></button>
                          </div>

                          {fincaAsign.peones.map((peon, pIdx) => (
                            <div key={pIdx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                              <select className="form-select" style={{ flex: 2 }} value={peon.id_operario} onChange={e => updatePeonInFincaInSection(secIdx, fincaAsign.id_finca, pIdx, 'id_operario', e.target.value)}>
                                <option value="">Peón...</option>
                                {personal.map(p => <option key={p.id_operario} value={p.id_operario}>{p.nombre} ({p.coste_h}€/h)</option>)}
                              </select>
                              <input type="number" className="form-input" style={{ flex: 1, maxWidth: 90 }} value={peon.horas} onChange={e => updatePeonInFincaInSection(secIdx, fincaAsign.id_finca, pIdx, 'horas', e.target.value)} step="0.5" min="0" placeholder="Horas" />
                              <button type="button" className="btn btn-small btn-danger" onClick={() => removePeonFromFincaInSection(secIdx, fincaAsign.id_finca, pIdx)} aria-label="Quitar peón"><X size={16} aria-hidden="true" /></button>
                            </div>
                          ))}

                          <button type="button" className="btn btn-small btn-accent" onClick={() => addPeonToFincaInSection(secIdx, fincaAsign.id_finca)}>+ Peón</button>
                        </div>
                      )
                    })}

                    {sec.fincas.length === 0 && <p style={{ fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Selecciona fincas arriba.</p>}
                  </div>

                  {/* MAQUINARIA */}
                  <div style={{ marginBottom: 12, paddingLeft: 8, borderLeft: '3px solid var(--color-accent)' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--color-text-secondary)' }}> Maquinaria</div>
                    <div className="form-row" style={{ marginBottom: 8 }}>
                      <select className="form-select" value="" onChange={e => { if (e.target.value) addMaquinaToSection(secIdx, e.target.value) }}>
                        <option value="">+ Seleccionar máquina...</option>
                        {maquinaria.filter(m => !sec.maquinaria.some(mm => idEq(mm.id_equipo, m.id_equipo))).map(m => (
                          <option key={m.id_equipo} value={m.id_equipo}>{m.tipo} - {m.marca_modelo || 'Sin marca'} ({m.coste_h}€/h)</option>
                        ))}
                      </select>
                    </div>

                    {sec.maquinaria.map(maqAsign => {
                      const equipo = maquinaria.find(m => idEq(m.id_equipo, maqAsign.id_equipo))
                      return (
                        <div key={maqAsign.id_equipo} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, background: 'var(--color-card-bg)', borderRadius: 12, padding: 10, border: '1px solid var(--color-border)' }}>
                          <span style={{ flex: 2, fontWeight: 500, fontSize: 13 }}>
                            {equipo ? `${equipo.tipo} (${equipo.marca_modelo || 'Sin marca'})` : 'Equipo'}
                          </span>
                          <input type="number" className="form-input" style={{ flex: 1, maxWidth: 90 }} value={maqAsign.horas} onChange={e => updateMaquinaHorasInSection(secIdx, maqAsign.id_equipo, e.target.value)} step="0.5" min="0" placeholder="Horas" />
                          <button type="button" className="btn btn-small btn-danger" onClick={() => removeMaquinaFromSection(secIdx, maqAsign.id_equipo)} aria-label="Quitar máquina"><X size={16} aria-hidden="true" /></button>
                        </div>
                      )
                    })}

                    {sec.maquinaria.length === 0 && <p style={{ fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Sin maquinaria.</p>}

                    {sec.maquinaria.length > 0 && precioGasoilL > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                          <input type="checkbox" checked={sec.include_gasoil} onChange={e => updateSection(secIdx, 'include_gasoil', e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--color-primary)' }} />
                          <strong> Incluir gasoil</strong>
                          <span style={{ color: 'var(--color-text-secondary)' }}>({precioGasoilL.toFixed(2)}€/L)</span>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Coste de esta sección */}
                  <div style={{ background: 'var(--color-card-bg)', borderRadius: 8, padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Subtotal sección:</span>
                    <strong style={{ color: 'var(--color-primary)' }}>{secCostes.total.toFixed(2)} €</strong>
                  </div>
                </div>
              )
            })}

            {/* Botón añadir sección */}
            <button type="button" className="btn btn-accent btn-full" onClick={addSection} style={{ marginBottom: 16, borderStyle: 'dashed', borderWidth: 2 }}>
              + Añadir otra sección de trabajo
            </button>

            {/* DESGLOSE TOTAL */}
            <div style={{ background: 'var(--color-bg)', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid var(--color-border)' }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--color-primary)' }}> Total de la jornada</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}><span> Peones ({costes.totalHorasPeones}h):</span><strong>{costes.costePeones.toFixed(2)} €</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}><span> Maquinaria ({costes.totalHorasMaq}h):</span><strong>{costes.costeMaquinaria.toFixed(2)} €</strong></div>
              {costes.costeGasoil > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}><span> Gasoil:</span><strong>{costes.costeGasoil.toFixed(2)} €</strong></div>}
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
              {saving ? 'Guardando...' : editingId ? ' Guardar cambios' : ' Registrar labor'}
            </button>
          </form>
        </div>
      )}

      {/* TABLA DE LABORES */}
      <div className="card">
        <div className="card-title"> Labores registradas ({filteredLabores.length})</div>
        {filteredLabores.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Fecha</th><th>Tipos</th><th>Fincas</th><th>Coste Total</th><th>Acciones</th></tr></thead>
              <tbody>
                {filteredLabores.map(l => {
                  const secciones = getSeccionesInfo(l)
                  return (
                    <tr key={l.id_labor}>
                      <td>{l.fecha ? format(new Date(l.fecha), 'dd/MM/yyyy') : '-'}</td>
                      <td>
                        {secciones.map((s, i) => (
                          <div key={i} style={{ fontSize: 13 }}>{s.tipo_trabajo || '-'}</div>
                        ))}
                      </td>
                      <td style={{ fontSize: 13 }}>{getFincaInfo(l)}</td>
                      <td><strong>{(l.coste_total || 0).toFixed(2)} €</strong></td>
                      <td>
                        <button className="btn btn-small btn-accent" onClick={() => handleEdit(l)} aria-label={`Editar labor`}><Pencil size={16} aria-hidden="true" /></button>
                        <button className="btn btn-small btn-danger" onClick={() => handleDelete(l.id_labor)} aria-label={`Eliminar labor`}><Trash2 size={16} aria-hidden="true" /></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><div className="empty-state-icon" aria-hidden="true"><Inbox size={40} strokeWidth={1.5} /></div><div className="empty-state-text">No hay labores para este filtro</div></div>
        )}
      </div>
    </div>
  )
}

export default LaboresPage
