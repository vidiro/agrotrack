// Apuntar un tratamiento en el campo: queda en Labores y en el Cuaderno de tratamientos
import { useState } from 'react'
import { Asistente, Chips, Stepper, SelectorFecha, SelectorFincas, PantallaHecho, Resumen, hoy, fechaLarga, nombreFinca } from './Asistente'
import { nombreEquipo } from './JornadaWizard'
import { leerRecientes, recordar, recordarUso } from '../../utils/copiaLocal'
import { laborDesdeSecciones } from '../../utils/costesLabor'
import { guardarConCola } from '../../utils/offline'
import { getParamValue } from '../../utils/params'
import { getIcon } from '../../utils/lucideIcons'

const PASOS = ['tipo', 'fecha', 'fincas', 'producto', 'dosis', 'aplicador', 'resumen']
const num = (v) => parseFloat(String(v).replace(',', '.')) || 0

function estadoInicial() {
  const rec = leerRecientes()
  return {
    fecha: hoy(), fincas: [],
    producto: '', materia_activa: '', num_registro: '', dosis: '', volumen_caldo: '', carencia_dias: '', justificacion: '',
    aplicador: rec.aplicador || '', carnet_aplicador: rec.carnet || '', id_operario: rec.aplicadorId || '',
    id_equipo: rec.equipoTratamiento || '', horas: rec.horasTratamiento || 4, superficie_ha: '',
  }
}

const campoGrande = { minHeight: 52, fontSize: '1rem' }

function TratamientoWizard({ fincas, personal, maquinaria, params, catalogos, onCerrar, onGuardado, onAbono }) {
  const [paso, setPaso] = useState(0)
  const [d, setD] = useState(estadoInicial)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [hecho, setHecho] = useState(null)
  const set = (c) => setD(prev => ({ ...prev, ...c }))
  const productos = catalogos?.productos || []
  const plagas = catalogos?.plagas || []
  const aplicadores = catalogos?.aplicadores || []

  const haFincas = d.fincas.reduce((s, id) => s + num(fincas.find(f => String(f.id_finca) === id)?.superficie_total_ha), 0)
  const cultivo = [...new Set(d.fincas.map(id => fincas.find(f => String(f.id_finca) === id)?.cultivo).filter(Boolean))].join(', ')

  const elegirProducto = (nombre) => {
    const p = productos.find(x => x.producto === nombre)
    set(p ? {
      producto: p.producto, materia_activa: p.materia_activa || '', num_registro: p.num_registro || '',
      dosis: p.dosis ?? '', volumen_caldo: p.volumen_caldo ?? '', carencia_dias: p.carencia_dias ?? '',
    } : { producto: nombre })
  }

  const elegirAplicador = (id) => {
    const p = personal.find(x => String(x.id_operario) === String(id))
    if (!p) { set({ id_operario: '' }); return }
    const previo = aplicadores.find(a => String(a.aplicador || '').toLowerCase() === String(p.nombre).toLowerCase())
    set({ id_operario: String(id), aplicador: p.nombre, carnet_aplicador: previo?.carnet_aplicador || (d.aplicador === p.nombre ? d.carnet_aplicador : '') })
  }

  const puedeSeguir = {
    tipo: true, fecha: !!d.fecha, fincas: d.fincas.length > 0, producto: !!d.producto.trim(), dosis: true, aplicador: true, resumen: true,
  }[PASOS[paso]]

  const guardar = async () => {
    setGuardando(true)
    setError('')
    try {
      const n = d.fincas.length || 1
      const horas = num(d.horas)
      const secciones = [{
        tipo_trabajo: 'Tratamiento fitosanitario',
        fincas: d.fincas.map(id => ({
          id_finca: id,
          peones: d.id_operario ? [{ id_operario: d.id_operario, horas: Math.round((horas / n) * 100) / 100 }] : [],
        })),
        maquinaria: d.id_equipo ? [{ id_equipo: d.id_equipo, horas }] : [],
        include_gasoil: true,
      }]
      const precioGasoil = getParamValue(params, ['precio_gasoil_l', 'coste_gasoleo'], 0)
      const labor = laborDesdeSecciones({ fecha: d.fecha, secciones, notas: `Tratamiento: ${d.producto.trim()}` }, { personal, maquinaria, precioGasoil })
      const aplicacion = {
        producto: d.producto.trim(),
        materia_activa: d.materia_activa.trim() || null,
        dosis: d.dosis !== '' ? num(d.dosis) : null,
        volumen_caldo: d.volumen_caldo !== '' ? num(d.volumen_caldo) : null,
        carencia_dias: d.carencia_dias !== '' ? parseInt(d.carencia_dias, 10) || 0 : null,
        justificacion: d.justificacion.trim() || null,
        fecha_aplicacion: d.fecha,
        num_registro: d.num_registro.trim() || null,
        cultivo: cultivo || null,
        superficie_ha: d.superficie_ha !== '' ? num(d.superficie_ha) : (haFincas || null),
        aplicador: d.aplicador.trim() || null,
        carnet_aplicador: d.carnet_aplicador.trim() || null,
        id_equipo: d.id_equipo || null,
      }
      const { error: err, encolado } = await guardarConCola({ tabla: '__tratamiento', datos: { labor, aplicacion } })
      if (err) throw err
      d.fincas.forEach(id => recordarUso('fincas', id))
      recordarUso('productos', d.producto.trim())
      recordar('aplicador', d.aplicador)
      recordar('carnet', d.carnet_aplicador)
      recordar('aplicadorId', d.id_operario)
      recordar('equipoTratamiento', d.id_equipo)
      recordar('horasTratamiento', d.horas)
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
      <Asistente titulo="Tratamiento" onCerrar={onCerrar}>
        <PantallaHecho
          encolado={hecho.encolado}
          texto="Guardado en Labores y en el Cuaderno de tratamientos."
          onOtra={() => { setD(estadoInicial()); setPaso(0); setHecho(null) }}
          onCerrar={onCerrar}
        />
      </Asistente>
    )
  }

  // Productos: los últimos usados primero
  const recProd = leerRecientes().productos || []
  const opcionesProducto = [...productos].sort((a, b) => {
    const pa = recProd.indexOf(a.producto); const pb = recProd.indexOf(b.producto)
    return (pa === -1 ? 999 : pa) - (pb === -1 ? 999 : pb)
  }).slice(0, 12)

  return (
    <Asistente
      titulo="Tratamiento"
      total={PASOS.length}
      paso={paso}
      onCerrar={onCerrar}
      onAtras={() => setPaso(paso - 1)}
      pie={PASOS[paso] === 'tipo' ? null : (
        <button type="button" className="btn btn-primary" disabled={!puedeSeguir || guardando} onClick={() => (paso === PASOS.length - 1 ? guardar() : setPaso(paso + 1))}>
          {paso === PASOS.length - 1 ? (guardando ? 'Guardando…' : 'Guardar tratamiento') : 'Siguiente'}
        </button>
      )}
    >
      {PASOS[paso] === 'tipo' && (
        <>
          <h3 className="asistente-pregunta">¿Qué has echado?</h3>
          <div className="acciones-grid" style={{ gridTemplateColumns: '1fr' }}>
            <button type="button" className="accion accion-vina" style={{ minHeight: 0, flexDirection: 'row', alignItems: 'center' }} onClick={() => setPaso(1)}>
              <span className="accion-icono">{getIcon('SprayCan', { size: 28 })}</span>
              <span className="accion-texto"><strong>Fitosanitario</strong><span>Contra plagas o enfermedades (lleva plazo de seguridad)</span></span>
            </button>
            <button type="button" className="accion accion-verde" style={{ minHeight: 0, flexDirection: 'row', alignItems: 'center' }} onClick={() => onAbono?.()}>
              <span className="accion-icono">{getIcon('Sprout', { size: 28 })}</span>
              <span className="accion-texto"><strong>Abono</strong><span>Fertilizante, estiércol, foliar…</span></span>
            </button>
          </div>
        </>
      )}

      {PASOS[paso] === 'fecha' && (
        <>
          <h3 className="asistente-pregunta">¿Qué día se trató?</h3>
          <SelectorFecha valor={d.fecha} onChange={v => set({ fecha: v })} onRapido={() => setTimeout(() => setPaso(2), 150)} />
        </>
      )}

      {PASOS[paso] === 'fincas' && (
        <>
          <h3 className="asistente-pregunta">¿Qué fincas?</h3>
          <SelectorFincas fincas={fincas} valor={d.fincas} onChange={v => set({ fincas: v })} />
        </>
      )}

      {PASOS[paso] === 'producto' && (
        <>
          <h3 className="asistente-pregunta">¿Qué producto?</h3>
          {opcionesProducto.length > 0 && (
            <Chips
              lista
              etiqueta="Producto"
              opciones={opcionesProducto.map(p => ({ valor: p.producto, texto: p.producto, sub: [p.materia_activa, p.dosis && `${p.dosis} dosis`].filter(Boolean).join(' · ') }))}
              valor={d.producto}
              onChange={elegirProducto}
            />
          )}
          <div className="asistente-sub">{opcionesProducto.length ? 'O escribe otro' : 'Nombre del producto'}</div>
          <input className="form-input" style={campoGrande} value={d.producto} onChange={e => elegirProducto(e.target.value)} placeholder="Ej.: Azufre mojable" aria-label="Producto" list="productos-campo" />
          <datalist id="productos-campo">{productos.map(p => <option key={p.producto} value={p.producto} />)}</datalist>
          <div className="asistente-sub">Materia activa</div>
          <input className="form-input" style={campoGrande} value={d.materia_activa} onChange={e => set({ materia_activa: e.target.value })} aria-label="Materia activa" />
          <div className="asistente-sub">Nº de registro</div>
          <input className="form-input" style={campoGrande} value={d.num_registro} onChange={e => set({ num_registro: e.target.value })} aria-label="Número de registro" />
        </>
      )}

      {PASOS[paso] === 'dosis' && (
        <>
          <h3 className="asistente-pregunta">Dosis y motivo</h3>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="t-dosis">Dosis</label>
              <input id="t-dosis" className="form-input" style={campoGrande} inputMode="decimal" value={d.dosis} onChange={e => set({ dosis: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="t-caldo">Caldo (l/ha)</label>
              <input id="t-caldo" className="form-input" style={campoGrande} inputMode="decimal" value={d.volumen_caldo} onChange={e => set({ volumen_caldo: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="t-carencia">Plazo de seguridad (días)</label>
            <input id="t-carencia" className="form-input" style={campoGrande} inputMode="numeric" value={d.carencia_dias} onChange={e => set({ carencia_dias: e.target.value })} />
          </div>
          <div className="asistente-sub">¿Contra qué? (plaga o enfermedad)</div>
          {plagas.length > 0 && (
            <Chips etiqueta="Plaga" opciones={plagas.slice(0, 10).map(p => ({ valor: p, texto: p }))} valor={d.justificacion} onChange={v => set({ justificacion: v })} />
          )}
          <input className="form-input" style={{ ...campoGrande, marginTop: 10 }} value={d.justificacion} onChange={e => set({ justificacion: e.target.value })} placeholder="Ej.: Oídio, mildiu, polilla…" aria-label="Plaga o enfermedad" />
        </>
      )}

      {PASOS[paso] === 'aplicador' && (
        <>
          <h3 className="asistente-pregunta">¿Quién lo aplicó?</h3>
          <Chips
            etiqueta="Aplicador"
            opciones={personal.map(p => ({ valor: String(p.id_operario), texto: p.nombre }))}
            valor={d.id_operario}
            onChange={elegirAplicador}
          />
          <div className="asistente-sub">Nombre del aplicador</div>
          <input className="form-input" style={campoGrande} value={d.aplicador} onChange={e => set({ aplicador: e.target.value, id_operario: '' })} aria-label="Nombre del aplicador" />
          <div className="asistente-sub">Nº de carné de aplicador</div>
          <input className="form-input" style={campoGrande} value={d.carnet_aplicador} onChange={e => set({ carnet_aplicador: e.target.value })} aria-label="Carné de aplicador" />
          <div className="asistente-sub">Equipo</div>
          <Chips
            etiqueta="Equipo"
            opciones={[{ valor: '', texto: 'Ninguno' }, ...maquinaria.map(m => ({ valor: String(m.id_equipo), texto: nombreEquipo(m) }))]}
            valor={d.id_equipo}
            onChange={v => set({ id_equipo: v })}
          />
          <div className="asistente-sub">Horas</div>
          <Stepper valor={d.horas} onChange={v => set({ horas: v })} />
          <div className="asistente-sub">Superficie tratada (ha)</div>
          <input className="form-input" style={campoGrande} inputMode="decimal" value={d.superficie_ha} placeholder={haFincas ? `${Math.round(haFincas * 100) / 100} (toda la finca)` : ''} onChange={e => set({ superficie_ha: e.target.value })} aria-label="Superficie tratada" />
        </>
      )}

      {PASOS[paso] === 'resumen' && (
        <>
          <h3 className="asistente-pregunta">¿Está bien?</h3>
          <Resumen filas={[
            ['Día', fechaLarga(d.fecha)],
            ['Finca', d.fincas.map(id => nombreFinca(fincas, id)).join(', ')],
            ['Producto', d.producto],
            ['Materia activa', d.materia_activa],
            ['Dosis', d.dosis],
            ['Caldo', d.volumen_caldo && `${d.volumen_caldo} l/ha`],
            ['Plazo de seguridad', d.carencia_dias !== '' && `${d.carencia_dias} días`],
            ['Contra', d.justificacion],
            ['Aplicador', [d.aplicador, d.carnet_aplicador && `carné ${d.carnet_aplicador}`].filter(Boolean).join(' · ')],
            ['Superficie', `${d.superficie_ha || Math.round(haFincas * 100) / 100} ha`],
          ]} />
          {error && <div className="alert alert-error" role="alert" style={{ marginTop: 12 }}>{error}</div>}
        </>
      )}
    </Asistente>
  )
}

export default TratamientoWizard
