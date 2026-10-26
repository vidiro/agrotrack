// Foto de una factura o tique: foto → importe y concepto → (finca, empresa) → guardar.
// La foto se lee en el propio móvil para rellenar lo que se pueda; sin cobertura, se guarda en el móvil.
import { useState } from 'react'
import { Asistente, Chips, SelectorFecha, BotonFoto, PantallaHecho, Resumen, hoy, fechaLarga, nombreFinca } from './Asistente'
import { leerRecientes, recordar, recordarUso } from '../../utils/copiaLocal'
import { guardarConCola } from '../../utils/offline'
import { leerFactura, parseImporte } from '../../utils/ocrFactura'
import { limpiarNIF, normalizarNIF } from '../../utils/facturas'
import { eur } from '../../utils/formato'

const PASOS = ['foto', 'importe', 'detalles', 'resumen']
const CATEGORIAS = ['Material', 'Combustible', 'Mantenimiento', 'Salario', 'Inversión', 'Otro']
const CONCEPTOS_BASE = ['Gasoil', 'Abono', 'Fitosanitarios', 'Repuestos', 'Taller', 'Herramientas', 'Alambre / postes']
const campoGrande = { minHeight: 52, fontSize: '1rem' }

function estadoInicial() {
  return {
    foto: null, fecha: hoy(), importe: '', concepto: '', categoria: leerRecientes().categoriaGasto || 'Material',
    id_finca: '', proveedor: '', nif_proveedor: '', num_factura: '', forma_pago: 'Transferencia',
  }
}

function FotoGastoWizard({ fincas, catalogos, nifTitular, onCerrar, onGuardado }) {
  const [paso, setPaso] = useState(0)
  const [d, setD] = useState(estadoInicial)
  const [lectura, setLectura] = useState(null) // { leyendo, mensaje }
  const [verFactura, setVerFactura] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [hecho, setHecho] = useState(null)
  const set = (c) => setD(prev => ({ ...prev, ...c }))
  const empresas = catalogos?.empresas || []
  const conceptos = [...new Set([...(leerRecientes().conceptos || []), ...(catalogos?.conceptos || []), ...CONCEPTOS_BASE])].slice(0, 10)

  const buscarEmpresa = (nif) => {
    const n = normalizarNIF(nif)
    return n ? empresas.find(e => normalizarNIF(e.nif_proveedor) === n) : null
  }

  const alHacerFoto = async (file) => {
    set({ foto: file })
    setPaso(1)
    setLectura({ leyendo: true, mensaje: 'Leyendo la factura…' })
    try {
      const datos = await leerFactura(file, { nifsPropios: nifTitular ? [nifTitular] : [] })
      const encontrados = []
      setD(prev => {
        const n = { ...prev }
        if (datos.importe && !prev.importe) { n.importe = String(datos.importe).replace('.', ','); encontrados.push('importe') }
        if (datos.fecha && prev.fecha === hoy()) { n.fecha = datos.fecha; encontrados.push('fecha') }
        if (datos.num_factura && !prev.num_factura) { n.num_factura = datos.num_factura; encontrados.push('nº de factura') }
        if (datos.nif_proveedor && !prev.nif_proveedor) {
          n.nif_proveedor = datos.nif_proveedor; encontrados.push('CIF')
          const e = buscarEmpresa(datos.nif_proveedor)
          if (e && !prev.proveedor) { n.proveedor = e.proveedor; encontrados.push('empresa') }
        }
        return n
      })
      if (datos.num_factura || datos.nif_proveedor) setVerFactura(true)
      setLectura({ leyendo: false, ok: encontrados.length > 0, mensaje: encontrados.length ? `Leído de la foto: ${encontrados.join(', ')}. Revísalo.` : 'No se ha podido leer la foto. Escribe el importe.' })
    } catch {
      setLectura({ leyendo: false, mensaje: 'Sin cobertura no se puede leer la foto la primera vez. Escribe el importe; la foto se guarda igual.' })
    }
  }

  const importe = parseImporte(d.importe) || 0
  const puedeSeguir = { foto: true, importe: importe > 0, detalles: true, resumen: importe > 0 }[PASOS[paso]]

  const guardar = async () => {
    setGuardando(true)
    setError('')
    try {
      const datos = {
        fecha: d.fecha || hoy(),
        id_finca: d.id_finca || null,
        concepto: d.concepto.trim() || (d.proveedor.trim() ? `Factura ${d.num_factura.trim()} · ${d.proveedor.trim()}`.replace('Factura  · ', '') : 'Gasto (foto)'),
        categoria: d.categoria || null,
        importe,
        forma_pago: d.forma_pago || null,
        observaciones: 'Apuntado desde el móvil',
      }
      if (d.proveedor.trim() || d.num_factura.trim() || d.nif_proveedor.trim()) {
        datos.proveedor = d.proveedor.trim() || null
        datos.num_factura = d.num_factura.trim() || null
        datos.nif_proveedor = limpiarNIF(d.nif_proveedor) || null
      }
      const fotos = d.foto ? [{ campo: 'adjunto_path', file: d.foto, carpeta: `facturas/${datos.fecha.substring(0, 4)}` }] : []
      const { error: err, encolado } = await guardarConCola({ tabla: 'gastos_manual', datos, fotos })
      if (err) throw err
      if (d.concepto.trim()) recordarUso('conceptos', d.concepto.trim())
      if (d.id_finca) recordarUso('fincas', d.id_finca)
      recordar('categoriaGasto', d.categoria)
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
      <Asistente titulo="Gasto o factura" onCerrar={onCerrar}>
        <PantallaHecho
          encolado={hecho.encolado}
          texto={`${eur(importe)} guardado en Gastos${d.foto ? ' con su foto' : ''}.`}
          onOtra={() => { setD(estadoInicial()); setPaso(0); setHecho(null); setLectura(null); setVerFactura(false) }}
          onCerrar={onCerrar}
        />
      </Asistente>
    )
  }

  const fincasRecientes = (() => {
    const rec = leerRecientes().fincas || []
    return [...fincas].sort((a, b) => {
      const pa = rec.indexOf(String(a.id_finca)); const pb = rec.indexOf(String(b.id_finca))
      return (pa === -1 ? 999 : pa) - (pb === -1 ? 999 : pb)
    }).slice(0, 8)
  })()

  return (
    <Asistente
      titulo="Gasto o factura"
      total={PASOS.length}
      paso={paso}
      onCerrar={onCerrar}
      onAtras={() => setPaso(paso - 1)}
      pie={PASOS[paso] === 'foto'
        ? <button type="button" className="btn" onClick={() => setPaso(1)}>Sin foto, seguir</button>
        : (
          <button type="button" className="btn btn-primary" disabled={!puedeSeguir || guardando} onClick={() => (paso === PASOS.length - 1 ? guardar() : setPaso(paso + 1))}>
            {paso === PASOS.length - 1 ? (guardando ? 'Guardando…' : 'Guardar gasto') : 'Siguiente'}
          </button>
        )}
    >
      {PASOS[paso] === 'foto' && (
        <>
          <h3 className="asistente-pregunta">Haz una foto a la factura o al tique</h3>
          <BotonFoto foto={d.foto} onFoto={alHacerFoto} texto="Abrir la cámara" />
          <p className="text-muted text-sm" style={{ marginTop: 12 }}>Con la factura plana y con luz, se leen solos el importe, la fecha y el CIF.</p>
        </>
      )}

      {PASOS[paso] === 'importe' && (
        <>
          <h3 className="asistente-pregunta">¿Cuánto ha sido?</h3>
          {lectura && (
            <div className={`alert ${lectura.ok ? 'alert-success' : 'alert-info'}`} role="status" aria-busy={lectura.leyendo} style={{ marginBottom: 12 }}>
              {lectura.mensaje}
            </div>
          )}
          <input className="importe-grande" inputMode="decimal" placeholder="0,00 €" value={d.importe} onChange={e => set({ importe: e.target.value })} aria-label="Importe en euros" />
          <div className="asistente-sub">¿De qué?</div>
          <Chips etiqueta="Concepto" opciones={conceptos.map(c => ({ valor: c, texto: c }))} valor={d.concepto} onChange={v => set({ concepto: v })} />
          <input className="form-input" style={{ ...campoGrande, marginTop: 10 }} placeholder="U otro concepto" value={d.concepto} onChange={e => set({ concepto: e.target.value })} aria-label="Concepto" />
          <div className="asistente-sub">Tipo de gasto</div>
          <Chips etiqueta="Categoría" opciones={CATEGORIAS.map(c => ({ valor: c, texto: c }))} valor={d.categoria} onChange={v => set({ categoria: v })} />
          {d.categoria === 'Inversión' && <p className="text-muted text-sm" style={{ marginTop: 8 }}>Se guarda en Gastos como justificante (ayudas) y cuenta como inversión de la finca.</p>}
        </>
      )}

      {PASOS[paso] === 'detalles' && (
        <>
          <h3 className="asistente-pregunta">¿Para qué finca?</h3>
          <Chips
            lista
            etiqueta="Finca"
            opciones={[{ valor: '', texto: 'General (ninguna en concreto)' }, ...fincasRecientes.map(f => ({ valor: String(f.id_finca), texto: f.nombre }))]}
            valor={d.id_finca}
            onChange={v => set({ id_finca: v })}
          />
          {fincas.length > 8 && (
            <select className="form-select" style={{ ...campoGrande, marginTop: 10 }} value={d.id_finca} onChange={e => set({ id_finca: e.target.value })} aria-label="Otra finca">
              <option value="">Otra finca…</option>
              {fincas.map(f => <option key={f.id_finca} value={f.id_finca}>{f.nombre}</option>)}
            </select>
          )}
          <div className="asistente-sub">Fecha</div>
          <SelectorFecha valor={d.fecha} onChange={v => set({ fecha: v })} />
          <button type="button" className="chip" style={{ width: '100%', marginTop: 18, justifyContent: 'space-between' }} aria-expanded={verFactura} onClick={() => setVerFactura(v => !v)}>
            <span>Datos de la factura (empresa, CIF, nº)<small>{d.proveedor || d.num_factura ? [d.proveedor, d.num_factura].filter(Boolean).join(' · ') : 'Opcional'}</small></span>
            <span aria-hidden="true">{verFactura ? '−' : '+'}</span>
          </button>
          {verFactura && (
            <div style={{ marginTop: 10 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="g-empresa">Empresa</label>
                <input id="g-empresa" className="form-input" style={campoGrande} list="empresas-campo" value={d.proveedor} onChange={e => {
                  const v = e.target.value
                  const e2 = empresas.find(x => String(x.proveedor).toLowerCase() === v.trim().toLowerCase())
                  set({ proveedor: v, nif_proveedor: d.nif_proveedor || e2?.nif_proveedor || '' })
                }} />
                <datalist id="empresas-campo">{empresas.map(e => <option key={e.proveedor} value={e.proveedor} />)}</datalist>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="g-nif">CIF</label>
                <input id="g-nif" className="form-input" style={campoGrande} autoCapitalize="characters" value={d.nif_proveedor} onChange={e => set({ nif_proveedor: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="g-num">Nº de factura</label>
                <input id="g-num" className="form-input" style={campoGrande} value={d.num_factura} onChange={e => set({ num_factura: e.target.value })} />
              </div>
            </div>
          )}
        </>
      )}

      {PASOS[paso] === 'resumen' && (
        <>
          <h3 className="asistente-pregunta">¿Está bien?</h3>
          <Resumen filas={[
            ['Importe', eur(importe)],
            ['Concepto', d.concepto || '—'],
            ['Tipo', d.categoria],
            ['Finca', d.id_finca ? nombreFinca(fincas, d.id_finca) : 'General'],
            ['Fecha', fechaLarga(d.fecha)],
            ['Empresa', d.proveedor],
            ['CIF', d.nif_proveedor],
            ['Nº factura', d.num_factura],
            ['Foto', d.foto ? 'Sí' : 'No'],
          ]} />
          {error && <div className="alert alert-error" role="alert" style={{ marginTop: 12 }}>{error}</div>}
        </>
      )}
    </Asistente>
  )
}

export default FotoGastoWizard
