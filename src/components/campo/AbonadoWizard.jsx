// Apuntar un abonado en el campo: queda en Labores y en el cuaderno (apartado de fertilización)
import { useState } from 'react'
import { Asistente, Chips, Stepper, SelectorFecha, SelectorFincas, PantallaHecho, Resumen, hoy, fechaLarga, nombreFinca } from './Asistente'
import { nombreEquipo } from './JornadaWizard'
import { leerRecientes, recordar, recordarUso } from '../../utils/copiaLocal'
import { laborDesdeSecciones } from '../../utils/costesLabor'
import { guardarConCola } from '../../utils/offline'
import { getParamValue } from '../../utils/params'
import { aportes, leerNPK, TIPOS_FERTILIZANTE, METODOS_APLICACION, UNIDADES_DOSIS } from '../../utils/fertilizacion'

const PASOS = ['fecha', 'fincas', 'abono', 'dosis', 'quien', 'resumen']
const num = (v) => parseFloat(String(v).replace(',', '.')) || 0
const campoGrande = { minHeight: 52, fontSize: '1rem' }

function estadoInicial() {
  const rec = leerRecientes()
  return {
    fecha: hoy(), fincas: [],
    producto: '', tipo_fertilizante: 'Mineral', riqueza_n: '', riqueza_p: '', riqueza_k: '',
    dosis: '', unidad_dosis: 'kg/ha', metodo_aplicacion: rec.metodoAbonado || '', justificacion: '',
    id_operario: rec.abonadorId || '', aplicador: rec.abonador || '', id_equipo: rec.equipoAbonado || '', horas: rec.horasAbonado || 4, superficie_ha: '',
  }
}

function AbonadoWizard({ fincas, personal, maquinaria, params, catalogos, onCerrar, onGuardado }) {
  const [paso, setPaso] = useState(0)
  const [d, setD] = useState(estadoInicial)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [hecho, setHecho] = useState(null)
  const set = (c) => setD(prev => ({ ...prev, ...c }))
  const abonos = catalogos?.abonos || []

  const haFincas = d.fincas.reduce((s, id) => s + num(fincas.find(f => String(f.id_finca) === id)?.superficie_total_ha), 0)
  const superficie = d.superficie_ha !== '' ? num(d.superficie_ha) : haFincas
  const cultivo = [...new Set(d.fincas.map(id => fincas.find(f => String(f.id_finca) === id)?.cultivo).filter(Boolean))].join(', ')
  const ap = aportes(d, superficie)

  const elegirAbono = (nombre) => {
    const a = abonos.find(x => x.producto === nombre)
    if (a) {
      set({
        producto: a.producto, tipo_fertilizante: a.tipo_fertilizante || 'Mineral',
        riqueza_n: a.riqueza_n ?? '', riqueza_p: a.riqueza_p ?? '', riqueza_k: a.riqueza_k ?? '',
        unidad_dosis: a.unidad_dosis || 'kg/ha', dosis: a.dosis ?? '', metodo_aplicacion: a.metodo_aplicacion || d.metodo_aplicacion,
      })
      return
    }
    // «NPK 15-15-15» → se rellena la riqueza
    const npk = leerNPK(String(nombre).replace(/^[^\d]*/, ''))
    set(npk && d.riqueza_n === '' && d.riqueza_p === '' && d.riqueza_k === ''
      ? { producto: nombre, riqueza_n: npk.n, riqueza_p: npk.p, riqueza_k: npk.k }
      : { producto: nombre })
  }

  const elegirPersona = (id) => {
    const p = personal.find(x => String(x.id_operario) === String(id))
    set(p ? { id_operario: String(id), aplicador: p.nombre } : { id_operario: '' })
  }

  const puedeSeguir = {
    fecha: !!d.fecha, fincas: d.fincas.length > 0, abono: !!d.producto.trim(), dosis: d.dosis !== '', quien: true, resumen: true,
  }[PASOS[paso]]

  const guardar = async () => {
    setGuardando(true)
    setError('')
    try {
      const n = d.fincas.length || 1
      const horas = num(d.horas)
      const secciones = [{
        tipo_trabajo: 'Abonado',
        fincas: d.fincas.map(id => ({
          id_finca: id,
          peones: d.id_operario ? [{ id_operario: d.id_operario, horas: Math.round((horas / n) * 100) / 100 }] : [],
        })),
        maquinaria: d.id_equipo ? [{ id_equipo: d.id_equipo, horas }] : [],
        include_gasoil: true,
      }]
      const precioGasoil = getParamValue(params, ['precio_gasoil_l', 'coste_gasoleo'], 0)
      const labor = laborDesdeSecciones({ fecha: d.fecha, secciones, notas: `Abonado: ${d.producto.trim()}` }, { personal, maquinaria, precioGasoil })
      const aplicacion = {
        tipo: 'fertilizante',
        producto: d.producto.trim(),
        tipo_fertilizante: d.tipo_fertilizante || null,
        riqueza_n: d.riqueza_n !== '' ? num(d.riqueza_n) : null,
        riqueza_p: d.riqueza_p !== '' ? num(d.riqueza_p) : null,
        riqueza_k: d.riqueza_k !== '' ? num(d.riqueza_k) : null,
        dosis: num(d.dosis),
        unidad_dosis: d.unidad_dosis,
        cantidad_total: ap.kgTotales || null,
        metodo_aplicacion: d.metodo_aplicacion || null,
        justificacion: d.justificacion.trim() || null,
        fecha_aplicacion: d.fecha,
        cultivo: cultivo || null,
        superficie_ha: superficie || null,
        aplicador: d.aplicador.trim() || null,
        id_equipo: d.id_equipo || null,
      }
      const { error: err, encolado } = await guardarConCola({ tabla: '__tratamiento', datos: { labor, aplicacion } })
      if (err) throw err
      d.fincas.forEach(id => recordarUso('fincas', id))
      recordarUso('abonos', d.producto.trim())
      recordar('metodoAbonado', d.metodo_aplicacion)
      recordar('abonadorId', d.id_operario)
      recordar('abonador', d.aplicador)
      recordar('equipoAbonado', d.id_equipo)
      recordar('horasAbonado', d.horas)
      setHecho({ encolado })
      onGuardado?.()
    } catch (err) {
      const m = err.message || ''
      setError(/tipo|riqueza|unidad_dosis|cantidad_total|metodo_aplicacion/.test(m)
        ? 'Falta preparar la base de datos para los abonados: ejecuta una vez docs/SQL_migracion_v2.0_abonados.sql en Supabase.'
        : (m || 'No se pudo guardar'))
    } finally {
      setGuardando(false)
    }
  }

  if (hecho) {
    return (
      <Asistente titulo="Abonado" onCerrar={onCerrar}>
        <PantallaHecho
          encolado={hecho.encolado}
          texto="Guardado en Labores y en el cuaderno (fertilización)."
          onOtra={() => { setD(estadoInicial()); setPaso(0); setHecho(null) }}
          onCerrar={onCerrar}
        />
      </Asistente>
    )
  }

  // Abonos: los últimos usados primero
  const rec = leerRecientes().abonos || []
  const opciones = [...abonos].sort((a, b) => {
    const pa = rec.indexOf(a.producto); const pb = rec.indexOf(b.producto)
    return (pa === -1 ? 999 : pa) - (pb === -1 ? 999 : pb)
  }).slice(0, 10)
  const npkTexto = (a) => [a.riqueza_n, a.riqueza_p, a.riqueza_k].some(v => v != null && v !== '') ? `${num(a.riqueza_n)}-${num(a.riqueza_p)}-${num(a.riqueza_k)}` : ''

  return (
    <Asistente
      titulo="Abonado"
      total={PASOS.length}
      paso={paso}
      onCerrar={onCerrar}
      onAtras={() => setPaso(paso - 1)}
      pie={(
        <button type="button" className="btn btn-primary" disabled={!puedeSeguir || guardando} onClick={() => (paso === PASOS.length - 1 ? guardar() : setPaso(paso + 1))}>
          {paso === PASOS.length - 1 ? (guardando ? 'Guardando…' : 'Guardar abonado') : 'Siguiente'}
        </button>
      )}
    >
      {PASOS[paso] === 'fecha' && (
        <>
          <h3 className="asistente-pregunta">¿Qué día se abonó?</h3>
          <SelectorFecha valor={d.fecha} onChange={v => set({ fecha: v })} onRapido={() => setTimeout(() => setPaso(1), 150)} />
        </>
      )}

      {PASOS[paso] === 'fincas' && (
        <>
          <h3 className="asistente-pregunta">¿Qué fincas?</h3>
          <SelectorFincas fincas={fincas} valor={d.fincas} onChange={v => set({ fincas: v })} />
        </>
      )}

      {PASOS[paso] === 'abono' && (
        <>
          <h3 className="asistente-pregunta">¿Qué abono?</h3>
          {opciones.length > 0 && (
            <Chips
              lista
              etiqueta="Abono"
              opciones={opciones.map(a => ({ valor: a.producto, texto: a.producto, sub: [a.tipo_fertilizante, npkTexto(a)].filter(Boolean).join(' · ') }))}
              valor={d.producto}
              onChange={elegirAbono}
            />
          )}
          <div className="asistente-sub">{opciones.length ? 'O escribe otro' : 'Nombre del abono'}</div>
          <input className="form-input" style={campoGrande} value={d.producto} onChange={e => elegirAbono(e.target.value)} placeholder="Ej.: NPK 15-15-15, urea, estiércol" aria-label="Abono" />
          <div className="asistente-sub">Tipo</div>
          <Chips etiqueta="Tipo de abono" opciones={TIPOS_FERTILIZANTE.map(t => ({ valor: t, texto: t }))} valor={d.tipo_fertilizante} onChange={v => set({ tipo_fertilizante: v })} />
          <div className="asistente-sub">Riqueza (lo pone el saco: N - P₂O₅ - K₂O, en %)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <input className="form-input" style={campoGrande} inputMode="decimal" placeholder="N" value={d.riqueza_n} onChange={e => set({ riqueza_n: e.target.value })} aria-label="Riqueza en nitrógeno (%)" />
            <input className="form-input" style={campoGrande} inputMode="decimal" placeholder="P₂O₅" value={d.riqueza_p} onChange={e => set({ riqueza_p: e.target.value })} aria-label="Riqueza en fósforo P2O5 (%)" />
            <input className="form-input" style={campoGrande} inputMode="decimal" placeholder="K₂O" value={d.riqueza_k} onChange={e => set({ riqueza_k: e.target.value })} aria-label="Riqueza en potasio K2O (%)" />
          </div>
        </>
      )}

      {PASOS[paso] === 'dosis' && (
        <>
          <h3 className="asistente-pregunta">¿Cuánto has echado?</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="importe-grande" style={{ flex: 1 }} inputMode="decimal" placeholder="0" value={d.dosis} onChange={e => set({ dosis: e.target.value })} aria-label="Dosis" />
          </div>
          <div style={{ marginTop: 10 }}>
            <Chips etiqueta="Unidad" opciones={UNIDADES_DOSIS.map(u => ({ valor: u, texto: { 'kg/ha': 'kg por hectárea', 'L/ha': 'litros por hectárea', 't/ha': 'toneladas por hectárea' }[u] || u }))} valor={d.unidad_dosis} onChange={v => set({ unidad_dosis: v })} />
          </div>
          {(ap.n > 0 || ap.p > 0 || ap.k > 0) && (
            <div className="alert alert-success" role="status" style={{ marginTop: 14 }}>
              <span>Aporta <strong>{ap.n} kg de N</strong>, {ap.p} kg de P₂O₅ y {ap.k} kg de K₂O por hectárea.</span>
            </div>
          )}
          <div className="asistente-sub">¿Cómo se echó?</div>
          <Chips etiqueta="Forma de aplicación" opciones={METODOS_APLICACION.map(m => ({ valor: m, texto: m }))} valor={d.metodo_aplicacion} onChange={v => set({ metodo_aplicacion: v })} />
          <div className="asistente-sub">Motivo (opcional)</div>
          <Chips etiqueta="Motivo" opciones={['Abonado de fondo', 'Cobertera', 'Corrector de carencias'].map(m => ({ valor: m, texto: m }))} valor={d.justificacion} onChange={v => set({ justificacion: v })} />
        </>
      )}

      {PASOS[paso] === 'quien' && (
        <>
          <h3 className="asistente-pregunta">¿Quién lo echó?</h3>
          <Chips etiqueta="Persona" opciones={personal.map(p => ({ valor: String(p.id_operario), texto: p.nombre }))} valor={d.id_operario} onChange={elegirPersona} />
          <div className="asistente-sub">Equipo</div>
          <Chips
            etiqueta="Equipo"
            opciones={[{ valor: '', texto: 'Ninguno' }, ...maquinaria.map(m => ({ valor: String(m.id_equipo), texto: nombreEquipo(m) }))]}
            valor={d.id_equipo}
            onChange={v => set({ id_equipo: v })}
          />
          <div className="asistente-sub">Horas</div>
          <Stepper valor={d.horas} onChange={v => set({ horas: v })} />
          <div className="asistente-sub">Superficie abonada (ha)</div>
          <input className="form-input" style={campoGrande} inputMode="decimal" value={d.superficie_ha} placeholder={haFincas ? `${Math.round(haFincas * 100) / 100} (toda la finca)` : ''} onChange={e => set({ superficie_ha: e.target.value })} aria-label="Superficie abonada" />
        </>
      )}

      {PASOS[paso] === 'resumen' && (
        <>
          <h3 className="asistente-pregunta">¿Está bien?</h3>
          <Resumen filas={[
            ['Día', fechaLarga(d.fecha)],
            ['Finca', d.fincas.map(id => nombreFinca(fincas, id)).join(', ')],
            ['Abono', d.producto],
            ['Tipo', d.tipo_fertilizante],
            ['Riqueza N-P-K', npkTexto(d)],
            ['Dosis', `${d.dosis} ${d.unidad_dosis}`],
            ['Total', ap.kgTotales ? `${ap.kgTotales.toLocaleString('es-ES')} kg` : ''],
            ['Nitrógeno', ap.n ? `${ap.n} kg/ha` : ''],
            ['Forma', d.metodo_aplicacion],
            ['Quién', d.aplicador],
            ['Superficie', `${Math.round(superficie * 100) / 100} ha`],
          ]} />
          {error && <div className="alert alert-error" role="alert" style={{ marginTop: 12 }}>{error}</div>}
        </>
      )}
    </Asistente>
  )
}

export default AbonadoWizard
