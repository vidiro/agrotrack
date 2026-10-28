// Apuntar la jornada en 5 toques: día → finca(s) → trabajo → quién y cuántas horas → máquina
import { useState } from 'react'
import { Asistente, Chips, Stepper, SelectorFecha, SelectorFincas, PantallaHecho, Resumen, hoy, fechaLarga, nombreFinca } from './Asistente'
import { leerRecientes, recordar, recordarUso } from '../../utils/copiaLocal'
import { laborDesdeSecciones, costesSecciones } from '../../utils/costesLabor'
import { guardarConCola } from '../../utils/offline'
import { getParamValue } from '../../utils/params'
import { eur } from '../../utils/formato'

export const TIPOS_TRABAJO = ['Poda', 'Descogollo', 'Despiojo', 'Limpia', 'Chupones', 'Trabajos con tractor', 'Tratamiento fitosanitario', 'Abonado', 'Vendimia', 'Cogida de aceitunas', 'Otros']
const PASOS = ['fecha', 'fincas', 'trabajo', 'peones', 'maquina', 'resumen']

export const nombreEquipo = (m) => [m.tipo, m.marca_modelo].filter(Boolean).join(' · ') || String(m.id_equipo)

function estadoInicial() {
  const rec = leerRecientes()
  const horas = rec.horasJornada || 8
  return {
    fecha: hoy(),
    fincas: [],
    tipo: rec.ultimoTrabajo || '',
    otroTipo: '',
    peones: Object.fromEntries((rec.ultimoEquipo || []).map(id => [id, horas])), // el mismo equipo que la última vez
    horasPorDefecto: horas,
    maquina: '',
    horasMaquina: horas,
    gasoil: true,
    notas: '',
  }
}

function JornadaWizard({ fincas, personal, maquinaria, params, onCerrar, onGuardado }) {
  const [paso, setPaso] = useState(0)
  const [d, setD] = useState(estadoInicial)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [hecho, setHecho] = useState(null)
  const set = (c) => setD(prev => ({ ...prev, ...c }))
  const precioGasoil = getParamValue(params, ['precio_gasoil_l', 'coste_gasoleo'], 0)
  const rec = leerRecientes()

  // Personal: los que vinieron la última vez, primero
  const recPeones = rec.peones || []
  const personas = [...personal].sort((a, b) => {
    const pa = recPeones.indexOf(String(a.id_operario)); const pb = recPeones.indexOf(String(b.id_operario))
    return (pa === -1 ? 999 : pa) - (pb === -1 ? 999 : pb) || String(a.nombre).localeCompare(String(b.nombre), 'es')
  })
  const recMaq = rec.maquinas || []
  const maquinas = [...maquinaria].sort((a, b) => {
    const pa = recMaq.indexOf(String(a.id_equipo)); const pb = recMaq.indexOf(String(b.id_equipo))
    return (pa === -1 ? 999 : pa) - (pb === -1 ? 999 : pb)
  })

  const tipoFinal = d.tipo === 'Otros' && d.otroTipo.trim() ? d.otroTipo.trim() : d.tipo
  const idsPeones = Object.keys(d.peones).filter(id => personal.some(p => String(p.id_operario) === id))

  // Con varias fincas, las horas de cada persona se reparten a partes iguales
  const secciones = () => {
    const n = d.fincas.length || 1
    const r2 = (v) => Math.round(v * 100) / 100
    return [{
      tipo_trabajo: tipoFinal,
      fincas: d.fincas.map(id => ({
        id_finca: id,
        peones: idsPeones.map(op => ({ id_operario: op, horas: r2((parseFloat(d.peones[op]) || 0) / n) })),
      })),
      maquinaria: d.maquina ? [{ id_equipo: d.maquina, horas: parseFloat(d.horasMaquina) || 0 }] : [],
      include_gasoil: d.gasoil,
    }]
  }
  const ctx = { personal, maquinaria, precioGasoil }
  const costes = costesSecciones(secciones(), ctx)

  const puedeSeguir = {
    fecha: !!d.fecha,
    fincas: d.fincas.length > 0,
    trabajo: !!tipoFinal,
    peones: true,
    maquina: true,
    resumen: true,
  }[PASOS[paso]]

  const guardar = async () => {
    setGuardando(true)
    setError('')
    try {
      const datos = laborDesdeSecciones({ fecha: d.fecha, secciones: secciones(), notas: d.notas.trim() || null }, ctx)
      const { error: err, encolado } = await guardarConCola({ tabla: 'labores', datos })
      if (err) throw err
      d.fincas.forEach(id => recordarUso('fincas', id))
      idsPeones.forEach(id => recordarUso('peones', id))
      if (d.maquina) recordarUso('maquinas', d.maquina)
      recordar('ultimoTrabajo', d.tipo)
      recordar('ultimoEquipo', idsPeones)
      recordar('horasJornada', d.horasPorDefecto)
      setHecho({ encolado })
      onGuardado?.()
    } catch (err) {
      setError(err.message || 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  if (hecho) {
    return (
      <Asistente titulo="Jornada" onCerrar={onCerrar}>
        <PantallaHecho
          encolado={hecho.encolado}
          texto={`Jornada del ${fechaLarga(d.fecha)} guardada.`}
          onOtra={() => { setD(estadoInicial()); setPaso(0); setHecho(null) }}
          onCerrar={onCerrar}
        />
      </Asistente>
    )
  }

  const siguiente = () => (paso === PASOS.length - 1 ? guardar() : setPaso(paso + 1))

  return (
    <Asistente
      titulo="Jornada"
      total={PASOS.length}
      paso={paso}
      onCerrar={onCerrar}
      onAtras={() => setPaso(paso - 1)}
      pie={(
        <button type="button" className="btn btn-primary" disabled={!puedeSeguir || guardando} onClick={siguiente}>
          {paso === PASOS.length - 1 ? (guardando ? 'Guardando…' : 'Guardar jornada') : (PASOS[paso] === 'maquina' && !d.maquina ? 'Sin máquina, seguir' : 'Siguiente')}
        </button>
      )}
    >
      {PASOS[paso] === 'fecha' && (
        <>
          <h3 className="asistente-pregunta">¿Qué día?</h3>
          <SelectorFecha valor={d.fecha} onChange={v => set({ fecha: v })} onRapido={() => setTimeout(() => setPaso(1), 150)} />
        </>
      )}

      {PASOS[paso] === 'fincas' && (
        <>
          <h3 className="asistente-pregunta">¿En qué finca?</h3>
          <p className="text-muted" style={{ marginTop: -8 }}>Puedes marcar varias.</p>
          <SelectorFincas fincas={fincas} valor={d.fincas} onChange={v => set({ fincas: v })} />
        </>
      )}

      {PASOS[paso] === 'trabajo' && (
        <>
          <h3 className="asistente-pregunta">¿Qué trabajo?</h3>
          <Chips
            etiqueta="Trabajo"
            opciones={TIPOS_TRABAJO.map(t => ({ valor: t, texto: t }))}
            valor={d.tipo}
            onChange={v => { set({ tipo: v }); if (v !== 'Otros') setTimeout(() => setPaso(paso + 1), 150) }}
          />
          {d.tipo === 'Otros' && (
            <input className="form-input" style={{ marginTop: 12, minHeight: 52, fontSize: '1rem' }} placeholder="¿Cuál?" value={d.otroTipo} onChange={e => set({ otroTipo: e.target.value })} aria-label="Otro trabajo" />
          )}
        </>
      )}

      {PASOS[paso] === 'peones' && (
        <>
          <h3 className="asistente-pregunta">¿Quién ha trabajado?</h3>
          <div className="asistente-sub" style={{ marginTop: 0 }}>Horas por persona</div>
          <Stepper valor={d.horasPorDefecto} onChange={v => {
            // Cambiar las horas por defecto actualiza a todos los que tenían las anteriores
            set({ horasPorDefecto: v, peones: Object.fromEntries(Object.entries(d.peones).map(([k, h]) => [k, String(h) === String(d.horasPorDefecto) ? v : h])) })
          }} />
          <div className="asistente-sub">Toca para marcar</div>
          {personas.length === 0 && <p className="text-muted">No hay personal guardado.</p>}
          {personas.map(p => {
            const id = String(p.id_operario)
            const marcado = id in d.peones
            return (
              <div key={id} className="fila-persona">
                <button
                  type="button"
                  className={`chip${marcado ? ' sel' : ''}`}
                  style={{ flex: 1 }}
                  role="checkbox"
                  aria-checked={marcado}
                  onClick={() => {
                    const n = { ...d.peones }
                    if (marcado) delete n[id]; else n[id] = d.horasPorDefecto
                    set({ peones: n })
                  }}
                >
                  {p.nombre}
                </button>
                {marcado && <Stepper etiqueta={`Horas de ${p.nombre}`} valor={d.peones[id]} onChange={v => set({ peones: { ...d.peones, [id]: v } })} />}
              </div>
            )
          })}
          {d.fincas.length > 1 && idsPeones.length > 0 && (
            <p className="text-muted text-sm" style={{ marginTop: 10 }}>Las horas se reparten a partes iguales entre las {d.fincas.length} fincas.</p>
          )}
        </>
      )}

      {PASOS[paso] === 'maquina' && (
        <>
          <h3 className="asistente-pregunta">¿Con máquina?</h3>
          <Chips
            lista
            etiqueta="Máquina"
            opciones={[{ valor: '', texto: 'Sin máquina' }, ...maquinas.map(m => ({ valor: String(m.id_equipo), texto: nombreEquipo(m) }))]}
            valor={d.maquina}
            onChange={v => set({ maquina: v })}
          />
          {d.maquina && (
            <>
              <div className="asistente-sub">Horas de máquina</div>
              <Stepper valor={d.horasMaquina} onChange={v => set({ horasMaquina: v })} />
              <label className="chip" style={{ marginTop: 14, width: '100%' }}>
                <input type="checkbox" checked={d.gasoil} onChange={e => set({ gasoil: e.target.checked })} style={{ width: 22, height: 22 }} />
                Contar el gasoil
              </label>
            </>
          )}
        </>
      )}

      {PASOS[paso] === 'resumen' && (
        <>
          <h3 className="asistente-pregunta">¿Está bien?</h3>
          <Resumen filas={[
            ['Día', fechaLarga(d.fecha)],
            ['Finca', d.fincas.map(id => nombreFinca(fincas, id)).join(', ')],
            ['Trabajo', tipoFinal],
            ['Personas', idsPeones.length ? idsPeones.map(id => `${personal.find(p => String(p.id_operario) === id)?.nombre || id} (${d.peones[id]} h)`).join(', ') : 'Nadie'],
            ['Máquina', d.maquina ? `${nombreEquipo(maquinaria.find(m => String(m.id_equipo) === d.maquina) || { id_equipo: d.maquina })} (${d.horasMaquina} h)` : 'No'],
            ['Coste', eur(costes.total)],
          ]} />
          <div className="asistente-sub">Nota (opcional)</div>
          <textarea className="form-input" rows={2} style={{ fontSize: '1rem' }} placeholder="Puedes dictar con el micrófono del teclado" value={d.notas} onChange={e => set({ notas: e.target.value })} aria-label="Nota" />
          {error && <div className="alert alert-error" role="alert" style={{ marginTop: 12 }}>{error}</div>}
        </>
      )}
    </Asistente>
  )
}

export default JornadaWizard
