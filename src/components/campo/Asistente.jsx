// Piezas comunes de los asistentes del campo: pantalla completa, botones grandes, un paso cada vez.
import { useEffect, useMemo, useState } from 'react'
import { getIcon } from '../../utils/lucideIcons'
import { leerRecientes } from '../../utils/copiaLocal'

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const hoy = () => iso(new Date())
export const ayer = () => { const d = new Date(); d.setDate(d.getDate() - 1); return iso(d) }
export const dentroDe = (dias) => { const d = new Date(); d.setDate(d.getDate() + dias); return iso(d) }
export const fechaLarga = (f) => {
  if (!f) return ''
  const d = new Date(`${f}T00:00:00`)
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}

/**
 * Pantalla completa con cabecera, barra de pasos, cuerpo y pie con botones grandes.
 */
export function Asistente({ titulo, total = 1, paso = 0, onCerrar, onAtras, children, pie }) {
  useEffect(() => {
    document.body.classList.add('asistente-abierto')
    return () => document.body.classList.remove('asistente-abierto')
  }, [])
  useEffect(() => {
    const el = document.querySelector('.asistente-cuerpo')
    if (el) el.scrollTop = 0
  }, [paso])

  return (
    <div className="asistente" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="asistente-cabecera">
        {onAtras && paso > 0 ? (
          <button type="button" className="asistente-icono-btn" onClick={onAtras} aria-label="Paso anterior">
            {getIcon('ChevronLeft', { size: 26 })}
          </button>
        ) : <span style={{ width: 48 }} />}
        <h2>{titulo}</h2>
        <button type="button" className="asistente-icono-btn" onClick={onCerrar} aria-label="Cerrar">
          {getIcon('X', { size: 26 })}
        </button>
      </div>
      {total > 1 && (
        <div className="asistente-pasos" aria-label={`Paso ${paso + 1} de ${total}`}>
          {Array.from({ length: total }, (_, i) => <span key={i} className={i <= paso ? 'hecho' : ''} />)}
        </div>
      )}
      <div className="asistente-cuerpo">{children}</div>
      {pie && <div className="asistente-pie">{pie}</div>}
    </div>
  )
}

/** Botones de opción grandes. multiple → valor es un array */
export function Chips({ opciones, valor, onChange, multiple = false, lista = false, etiqueta }) {
  const sel = (v) => (multiple ? (valor || []).map(String).includes(String(v)) : String(valor ?? '') === String(v))
  const tocar = (v) => {
    if (!multiple) { onChange(v); return }
    const actual = (valor || []).map(String)
    onChange(actual.includes(String(v)) ? actual.filter(x => x !== String(v)) : [...actual, String(v)])
  }
  return (
    <div className={lista ? 'lista-opciones' : 'chips'} role={multiple ? 'group' : 'radiogroup'} aria-label={etiqueta}>
      {opciones.map(o => (
        <button
          key={o.valor}
          type="button"
          className={`chip${sel(o.valor) ? ' sel' : ''}`}
          role={multiple ? 'checkbox' : 'radio'}
          aria-checked={sel(o.valor)}
          onClick={() => tocar(o.valor)}
        >
          <span>
            {o.texto}
            {o.sub && <small>{o.sub}</small>}
          </span>
          {lista && sel(o.valor) && getIcon('CheckCircle2', { size: 22 })}
        </button>
      ))}
    </div>
  )
}

/** − 8 + para horas, sin tener que escribir */
export function Stepper({ valor, onChange, paso = 0.5, min = 0, max = 24, etiqueta = 'Horas' }) {
  const n = parseFloat(valor) || 0
  const fijar = (v) => onChange(Math.max(min, Math.min(max, Math.round(v * 100) / 100)))
  return (
    <div className="stepper">
      <button type="button" onClick={() => fijar(n - paso)} aria-label={`Menos ${etiqueta.toLowerCase()}`}>−</button>
      <input
        type="text"
        inputMode="decimal"
        aria-label={etiqueta}
        value={valor}
        onChange={e => onChange(e.target.value.replace(',', '.'))}
        onBlur={e => fijar(parseFloat(e.target.value) || 0)}
      />
      <button type="button" onClick={() => fijar(n + paso)} aria-label={`Más ${etiqueta.toLowerCase()}`}>+</button>
    </div>
  )
}

/** Hoy / Ayer / otro día */
export function SelectorFecha({ valor, onChange, onRapido }) {
  const esOtra = valor && valor !== hoy() && valor !== ayer()
  return (
    <>
      <Chips
        etiqueta="Fecha"
        opciones={[{ valor: hoy(), texto: 'Hoy' }, { valor: ayer(), texto: 'Ayer' }]}
        valor={valor}
        onChange={v => { onChange(v); onRapido?.() }}
      />
      <div className="asistente-sub">Otro día</div>
      <input type="date" className={`form-input${esOtra ? ' chip sel' : ''}`} style={{ minHeight: 52, fontSize: '1rem' }} value={valor || ''} max={hoy()} onChange={e => onChange(e.target.value)} aria-label="Otro día" />
      {valor && <p className="text-muted" style={{ marginTop: 10 }}>{fechaLarga(valor)}</p>}
    </>
  )
}

/** Fincas: las últimas usadas primero, con buscador si hay muchas */
export function SelectorFincas({ fincas, valor, onChange, multiple = true, claveRecientes = 'fincas' }) {
  const [q, setQ] = useState('')
  const ordenadas = useMemo(() => {
    const rec = leerRecientes()[claveRecientes] || []
    const pos = (f) => { const i = rec.indexOf(String(f.id_finca)); return i === -1 ? 999 : i }
    return [...fincas].sort((a, b) => pos(a) - pos(b) || String(a.nombre).localeCompare(String(b.nombre), 'es'))
  }, [fincas, claveRecientes])
  const filtradas = q.trim()
    ? ordenadas.filter(f => String(f.nombre || '').toLowerCase().includes(q.trim().toLowerCase()))
    : ordenadas
  const opciones = filtradas.map(f => ({
    valor: String(f.id_finca),
    texto: f.nombre,
    sub: [f.cultivo, f.superficie_total_ha && `${f.superficie_total_ha} ha`].filter(Boolean).join(' · '),
  }))
  return (
    <>
      {fincas.length > 6 && (
        <input type="search" className="form-input" style={{ minHeight: 48, marginBottom: 10, fontSize: '1rem' }} placeholder="Buscar finca…" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar finca" />
      )}
      {fincas.length === 0 && <p className="text-muted">No hay fincas guardadas en el móvil. Abre la app una vez con cobertura.</p>}
      <Chips lista multiple={multiple} etiqueta="Fincas" opciones={opciones} valor={valor} onChange={onChange} />
    </>
  )
}

/** Botón de cámara: abre directamente la cámara trasera del iPhone */
export function BotonFoto({ foto, onFoto, texto = 'Hacer foto' }) {
  const [vista, setVista] = useState(null)
  useEffect(() => {
    if (!foto) { setVista(null); return undefined }
    const url = URL.createObjectURL(foto)
    setVista(url)
    return () => URL.revokeObjectURL(url)
  }, [foto])
  return (
    <label className="boton-foto">
      {vista ? <img src={vista} alt="Foto tomada" /> : getIcon('Camera', { size: 44 })}
      <span>{vista ? 'Repetir foto' : texto}</span>
      <input type="file" accept="image/*" capture="environment" onChange={e => { const f = e.target.files?.[0]; if (f) onFoto(f); e.target.value = '' }} aria-label={texto} />
    </label>
  )
}

/** Pantalla final */
export function PantallaHecho({ encolado, texto, onOtra, onCerrar }) {
  return (
    <div className="hecho-pantalla">
      <div className="circulo">{getIcon(encolado ? 'CloudOff' : 'CheckCircle2', { size: 52 })}</div>
      <h3 className="asistente-pregunta" style={{ margin: 0 }}>{encolado ? 'Guardado en el móvil' : '¡Apuntado!'}</h3>
      <p className="text-muted" style={{ maxWidth: 320 }}>
        {encolado
          ? 'No hay cobertura. Se enviará solo cuando vuelvas a abrir la app con señal.'
          : texto}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 320, marginTop: 12 }}>
        <button type="button" className="btn btn-primary" style={{ minHeight: 56, fontSize: '1.05rem' }} onClick={onOtra}>Apuntar otra</button>
        <button type="button" className="btn" style={{ minHeight: 56, fontSize: '1.05rem' }} onClick={onCerrar}>Terminar</button>
      </div>
    </div>
  )
}

/** Resumen final: [[etiqueta, valor], …] */
export function Resumen({ filas }) {
  return (
    <ul className="resumen-lista">
      {filas.filter(f => f && f[1] !== undefined && f[1] !== null && f[1] !== '').map(([k, v]) => (
        <li key={k}><span>{k}</span><span>{v}</span></li>
      ))}
    </ul>
  )
}

export const nombreFinca = (fincas, id) => fincas.find(f => String(f.id_finca) === String(id))?.nombre || ''
