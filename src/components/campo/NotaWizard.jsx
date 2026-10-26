// Recordatorio con foto: «hay que arreglar este poste», «mirar esta cepa»… con su finca y para cuándo
import { useState } from 'react'
import { Asistente, Chips, BotonFoto, PantallaHecho, hoy, dentroDe, fechaLarga } from './Asistente'
import { leerRecientes, recordarUso } from '../../utils/copiaLocal'
import { guardarConCola } from '../../utils/offline'

const PASOS = ['que', 'donde']
const finDeSemana = () => { const d = new Date(); return dentroDe(((7 - d.getDay()) % 7) || 7) } // próximo domingo

const estadoInicial = () => ({ foto: null, texto: '', id_finca: '', cuando: '', fecha: '' })

function NotaWizard({ fincas, onCerrar, onGuardado }) {
  const [paso, setPaso] = useState(0)
  const [d, setD] = useState(estadoInicial)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [hecho, setHecho] = useState(null)
  const set = (c) => setD(prev => ({ ...prev, ...c }))

  const fechaLimite = { hoy: hoy(), manana: dentroDe(1), semana: finDeSemana(), otra: d.fecha }[d.cuando] || null
  const puedeSeguir = paso === 0 ? !!(d.texto.trim() || d.foto) : (d.cuando !== 'otra' || !!d.fecha)

  const guardar = async () => {
    setGuardando(true)
    setError('')
    try {
      const datos = {
        texto: d.texto.trim() || 'Ver foto',
        id_finca: d.id_finca || null,
        fecha_limite: fechaLimite,
        hecho: false,
      }
      const fotos = d.foto ? [{ campo: 'foto_path', file: d.foto, carpeta: 'notas' }] : []
      const { error: err, encolado } = await guardarConCola({ tabla: 'notas_campo', datos, fotos })
      if (err) throw err
      if (d.id_finca) recordarUso('fincas', d.id_finca)
      setHecho({ encolado })
      onGuardado?.()
    } catch (err) {
      setError(/notas_campo/.test(err.message || '') ? 'Falta crear la tabla de notas en Supabase (script docs/SQL_migracion_v1.9_notas.sql).' : (err.message || 'No se pudo guardar'))
    } finally {
      setGuardando(false)
    }
  }

  if (hecho) {
    return (
      <Asistente titulo="Recordatorio" onCerrar={onCerrar}>
        <PantallaHecho
          encolado={hecho.encolado}
          texto={fechaLimite ? `Te lo recordaré en Inicio: ${fechaLarga(fechaLimite)}.` : 'Lo tienes en Notas.'}
          onOtra={() => { setD(estadoInicial()); setPaso(0); setHecho(null) }}
          onCerrar={onCerrar}
        />
      </Asistente>
    )
  }

  const rec = leerRecientes().fincas || []
  const fincasOrden = [...fincas].sort((a, b) => {
    const pa = rec.indexOf(String(a.id_finca)); const pb = rec.indexOf(String(b.id_finca))
    return (pa === -1 ? 999 : pa) - (pb === -1 ? 999 : pb) || String(a.nombre).localeCompare(String(b.nombre), 'es')
  })

  return (
    <Asistente
      titulo="Recordatorio"
      total={PASOS.length}
      paso={paso}
      onCerrar={onCerrar}
      onAtras={() => setPaso(paso - 1)}
      pie={(
        <button type="button" className="btn btn-primary" disabled={!puedeSeguir || guardando} onClick={() => (paso === 1 ? guardar() : setPaso(1))}>
          {paso === 1 ? (guardando ? 'Guardando…' : 'Guardar') : 'Siguiente'}
        </button>
      )}
    >
      {paso === 0 && (
        <>
          <h3 className="asistente-pregunta">¿Qué hay que hacer?</h3>
          <BotonFoto foto={d.foto} onFoto={f => set({ foto: f })} texto="Hacer foto (opcional)" />
          <div className="asistente-sub">Escríbelo o díctalo</div>
          <textarea
            className="form-input"
            rows={3}
            style={{ fontSize: '1.05rem' }}
            placeholder="Ej.: Poste caído en la fila 12. Toca el micrófono del teclado para dictar."
            value={d.texto}
            onChange={e => set({ texto: e.target.value })}
            aria-label="Qué hay que hacer"
          />
        </>
      )}

      {paso === 1 && (
        <>
          <h3 className="asistente-pregunta">¿Dónde?</h3>
          <Chips
            etiqueta="Finca"
            opciones={[{ valor: '', texto: 'Sin finca' }, ...fincasOrden.map(f => ({ valor: String(f.id_finca), texto: f.nombre }))]}
            valor={d.id_finca}
            onChange={v => set({ id_finca: v })}
          />
          <div className="asistente-sub">¿Para cuándo?</div>
          <Chips
            etiqueta="Para cuándo"
            opciones={[
              { valor: '', texto: 'Sin fecha' },
              { valor: 'hoy', texto: 'Hoy' },
              { valor: 'manana', texto: 'Mañana' },
              { valor: 'semana', texto: 'Esta semana' },
              { valor: 'otra', texto: 'Otro día' },
            ]}
            valor={d.cuando}
            onChange={v => set({ cuando: v })}
          />
          {d.cuando === 'otra' && (
            <input type="date" className="form-input" style={{ minHeight: 52, marginTop: 10, fontSize: '1rem' }} min={hoy()} value={d.fecha} onChange={e => set({ fecha: e.target.value })} aria-label="Fecha" />
          )}
          {error && <div className="alert alert-error" role="alert" style={{ marginTop: 12 }}>{error}</div>}
        </>
      )}
    </Asistente>
  )
}

export default NotaWizard
