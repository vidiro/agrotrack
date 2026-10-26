import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

// Miles con punto también en cifras de 4 dígitos (toLocaleString('es-ES') no agrupa 7500)
export const eur = (v) => {
  const n = Math.round(v || 0)
  return `${n < 0 ? '−' : ''}${String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} €`
}
export const etiquetaCampana = (c) => `${c - 1}/${String(c).slice(2)}`

export function textoEstado(r) {
  switch (r.estado) {
    case 'recuperada': return `Recuperada en la campaña ${etiquetaCampana(r.campanaPago)}`
    case 'en_curso': return `Al ritmo actual se paga hacia la campaña ${etiquetaCampana(r.campanaPago)}`
    case 'no_recupera': return 'Al ritmo actual no se recupera: las últimas campañas no dejan beneficio'
    default: return 'Sin inversión registrada'
  }
}

// Serie para el gráfico: campañas reales + previsión hasta cubrir la inversión (máx. 30 campañas)
function serie(r) {
  const datos = r.campanas.map(c => ({ campana: etiquetaCampana(c.campana), real: Math.round(c.acumulado) }))
  if (r.estado === 'en_curso' && r.media > 0) {
    // La previsión parte de la última campaña cerrada (la actual aún no ha terminado)
    let idxBase = -1
    r.campanas.forEach((c, i) => { if (!c.enCurso) idxBase = i })
    let acum = idxBase >= 0 ? r.campanas[idxBase].acumulado : 0
    if (idxBase >= 0) datos[idxBase].prevision = Math.round(acum)
    const desde = idxBase >= 0 ? r.campanas[idxBase].campana + 1 : r.campanaInicio
    for (let c = desde; c <= Math.min(r.campanaPago, desde + 30); c++) {
      acum += r.media
      const etiqueta = etiquetaCampana(c)
      const existente = datos.find(d => d.campana === etiqueta)
      if (existente) existente.prevision = Math.round(acum)
      else datos.push({ campana: etiqueta, prevision: Math.round(acum) })
    }
  }
  return datos
}

function RecuperacionInversion({ r }) {
  const pct = Math.min(1, r.pct)
  const color = r.estado === 'recuperada' ? 'var(--color-success)' : r.estado === 'no_recupera' ? 'var(--color-danger)' : 'var(--color-primary)'

  return (
    <div className="card">
      <div className="card-title">Recuperación de la inversión</div>

      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, fontSize: 14, marginBottom: 8 }}>
        <span>Recuperado <strong>{eur(Math.max(0, r.recuperado))}</strong> de <strong>{eur(r.inversion)}</strong></span>
        <strong style={{ color }}>{Math.round(r.pct * 100)} %</strong>
      </div>
      <div
        role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)} aria-label="Porcentaje recuperado"
        style={{ height: 12, borderRadius: 6, background: 'var(--color-bg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}
      >
        <div style={{ width: `${pct * 100}%`, height: '100%', background: color }} />
      </div>
      <p style={{ margin: '10px 0 4px', fontWeight: 600, color }}>{textoEstado(r)}</p>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)' }}>
        Desde la campaña {etiquetaCampana(r.campanaInicio)} · media de las últimas campañas: {eur(r.media)}/campaña
        {r.recuperado < 0 && ` · de momento acumula ${eur(r.recuperado)}`}
      </p>

      {/* De qué se compone la inversión */}
      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          De dónde salen los {eur(r.inversion)} de inversión ({r.items.length} {r.items.length === 1 ? 'registro' : 'registros'})
        </summary>
        <div className="table-container" style={{ marginTop: 8 }}>
          <table className="data-table">
            <thead>
              <tr><th>Fecha</th><th>Concepto</th><th>Origen</th><th style={{ textAlign: 'right' }}>Importe</th></tr>
            </thead>
            <tbody>
              {[...r.items].sort((a, b) => String(a.fecha_compra).localeCompare(String(b.fecha_compra))).map((it, i) => (
                <tr key={i}>
                  <td style={{ whiteSpace: 'nowrap' }}>{it.fecha_compra ? String(it.fecha_compra).substring(0, 10) : '—'}</td>
                  <td>{it.descripcion || '—'}</td>
                  <td style={{ fontSize: 12 }}>{it.origen === 'gasto' ? 'Gastos (categoría Inversión)' : `Inversiones · ${it.categoria || 'Otro'}`}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{eur(parseFloat(it.importe_compra) || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '6px 0 0' }}>
          Si una misma compra aparece dos veces (en Gastos y en Inversiones), vincúlala desde Inversiones para que cuente solo una vez.
        </p>
      </details>

      <div style={{ width: '100%', height: 220, marginTop: 16 }}>
        <ResponsiveContainer>
          <ComposedChart data={serie(r)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="campana" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${Math.round(v / 1000)}k`} width={40} />
            <Tooltip formatter={(v, n) => [eur(v), n === 'real' ? 'Acumulado' : 'Previsión']} />
            <ReferenceLine y={r.inversion} stroke="var(--color-accent)" strokeDasharray="6 4" label={{ value: 'Inversión', position: 'insideTopLeft', fontSize: 11 }} />
            <ReferenceLine y={0} stroke="var(--color-text-muted)" />
            <Line type="monotone" dataKey="real" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
            <Line type="monotone" dataKey="prevision" stroke="var(--color-primary)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="table-container" style={{ marginTop: 12 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Campaña</th>
              <th style={{ textAlign: 'right' }}>Ingresos</th>
              <th style={{ textAlign: 'right' }}>Costes</th>
              <th style={{ textAlign: 'right' }}>Deja</th>
              <th style={{ textAlign: 'right' }}>Acumulado</th>
            </tr>
          </thead>
          <tbody>
            {r.campanas.map(c => (
              <tr key={c.campana}>
                <td style={{ whiteSpace: 'nowrap' }}>{etiquetaCampana(c.campana)}{c.enCurso ? '*' : ''}</td>
                <td style={{ textAlign: 'right' }}>
                  {eur(c.ingresos + c.estimado + c.ayudas)}
                  {c.estimado > 0 && <span title="Incluye cosechas aún sin cobrar, valoradas con los precios de Ajustes/Destinos" style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}> (est.)</span>}
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{eur(c.costes + c.gastos)}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap', color: c.neto >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{c.neto > 0 ? '+' : ''}{eur(c.neto)}</td>
                <td style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{eur(c.acumulado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 12, fontSize: 11, color: 'var(--color-text-muted)' }}>
        * Campaña en curso. Inversión: lo registrado en Inversiones para esta finca. Cada campaña: cobros de sus cosechas (o valor estimado si aún no se han cobrado)
        + ayudas repartidas por hectáreas − costes de labores − gastos (los generales, repartidos por hectáreas). No se resta la amortización.
      </p>
    </div>
  )
}

export default RecuperacionInversion
