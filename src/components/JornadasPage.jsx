import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Download, FileDown } from 'lucide-react'
import { fetchAll } from '../utils/fetchAll'
import { jornadasPorTrabajador } from '../utils/jornadas'
import { eur, fechaES } from '../utils/formato'
import { downloadCSV } from '../utils/csvExport'
import { useExplotacion, lineaTitular } from '../utils/explotacion'
import { Avisos, Cargando, Vacio, Cabecera } from './ui'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function JornadasPage({ personal = [], fincas = [] }) {
  const hoy = new Date()
  const [labores, setLabores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [anio, setAnio] = useState(String(hoy.getFullYear()))
  const [mes, setMes] = useState(String(hoy.getMonth() + 1).padStart(2, '0'))
  const [abierto, setAbierto] = useState(null)
  const { explotacion } = useExplotacion()

  useEffect(() => {
    fetchAll('labores').then(({ data, error: err }) => {
      if (err) setError(err.message)
      setLabores(data || [])
      setLoading(false)
    })
  }, [])

  const prefijo = mes ? `${anio}-${mes}` : anio
  const periodo = mes ? `${MESES[parseInt(mes, 10) - 1]} ${anio}` : `Año ${anio}`
  const filas = useMemo(() => jornadasPorTrabajador(labores, personal, prefijo), [labores, personal, prefijo])
  const anios = [...new Set([String(hoy.getFullYear()), ...labores.map(l => String(l.fecha || '').substring(0, 4)).filter(Boolean)])].sort().reverse()
  const nombreFinca = (id) => fincas.find(f => String(f.id_finca) === String(id))?.nombre || '—'

  const exportarCSV = () => {
    const rows = filas.flatMap(r => r.dias.map(d => ({
      trabajador: r.nombre, fecha: fechaES(d.fecha), horas: d.horas.toFixed(2).replace('.', ','),
      trabajos: [...d.trabajos].join(', '), fincas: [...d.fincas].map(nombreFinca).join(', '),
    })))
    downloadCSV(`jornadas_${prefijo}`, ['trabajador', 'fecha', 'horas', 'trabajos', 'fincas'], rows)
  }

  const exportarPDF = async () => {
    const [{ jsPDF }, { applyPlugin }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
    applyPlugin(jsPDF)
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    doc.setFontSize(14)
    doc.text(`Jornadas por trabajador · ${periodo}`, 14, 14)
    doc.setFontSize(9)
    doc.text(lineaTitular(explotacion) || ' ', 14, 20)
    doc.autoTable({
      startY: 25,
      head: [['Trabajador', 'Días', 'Horas', 'Coste estimado']],
      body: filas.map(r => [r.nombre, String(r.numDias), r.horas.toFixed(1), eur(r.coste)]),
      theme: 'grid', headStyles: { fillColor: [31, 77, 51], fontSize: 8 }, bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    })
    for (const r of filas) {
      doc.autoTable({
        startY: doc.lastAutoTable.finalY + 6,
        head: [[{ content: `${r.nombre} · ${r.numDias} días · ${r.horas.toFixed(1)} h`, colSpan: 4 }], ['Fecha', 'Horas', 'Trabajo', 'Finca(s)']],
        body: r.dias.map(d => [fechaES(d.fecha), d.horas.toFixed(1), [...d.trabajos].join(', '), [...d.fincas].map(nombreFinca).join(', ')]),
        theme: 'grid', headStyles: { fillColor: [31, 77, 51], fontSize: 7.5 }, bodyStyles: { fontSize: 7.5 },
        columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 16 } },
        margin: { left: 14, right: 14 },
      })
    }
    doc.save(`jornadas_${prefijo}.pdf`)
  }

  if (loading) return <Cargando texto="Calculando jornadas…" />

  return (
    <div>
      <Avisos error={error} />
      <Cabecera titulo="Jornadas por trabajador" descripcion="Días y horas de cada persona según las labores apuntadas. Útil para altas, nóminas y la gestoría.">
        <button type="button" className="btn btn-accent" onClick={exportarCSV} disabled={!filas.length}><Download size={16} aria-hidden="true" /> CSV</button>
        <button type="button" className="btn btn-primary" onClick={exportarPDF} disabled={!filas.length}><FileDown size={16} aria-hidden="true" /> PDF</button>
      </Cabecera>

      <div className="flex gap-12 mb-16 flex-wrap">
        <select className="form-select" style={{ width: 'auto' }} value={mes} onChange={e => setMes(e.target.value)} aria-label="Mes">
          <option value="">Todo el año</option>
          {MESES.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
        </select>
        <select className="form-select" style={{ width: 'auto' }} value={anio} onChange={e => setAnio(e.target.value)} aria-label="Año">
          {anios.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="card-title">{periodo}</div>
        {filas.length === 0 ? (
          <Vacio texto="No hay jornadas con peones apuntadas en este periodo." />
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {filas.map(r => (
              <li key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <button type="button" onClick={() => setAbierto(abierto === r.id ? null : r.id)} aria-expanded={abierto === r.id}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', minHeight: 56, background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', color: 'inherit', textAlign: 'left' }}>
                  <span style={{ flex: 1, fontWeight: 600 }}>{r.nombre}</span>
                  <span>{r.numDias} {r.numDias === 1 ? 'día' : 'días'}</span>
                  <span style={{ minWidth: 70, textAlign: 'right' }}>{r.horas.toFixed(1)} h</span>
                  <span style={{ minWidth: 90, textAlign: 'right', color: 'var(--color-text-secondary)' }}>{eur(r.coste, 0)}</span>
                  <ChevronDown size={18} aria-hidden="true" style={{ transform: abierto === r.id ? 'rotate(180deg)' : 'none' }} />
                </button>
                {abierto === r.id && (
                  <div className="table-container" style={{ marginBottom: 12 }}>
                    <table className="data-table">
                      <thead><tr><th>Fecha</th><th>Horas</th><th>Trabajo</th><th>Finca(s)</th></tr></thead>
                      <tbody>
                        {r.dias.map(d => (
                          <tr key={d.fecha}>
                            <td>{fechaES(d.fecha)}</td>
                            <td>{d.horas.toFixed(1)}</td>
                            <td>{[...d.trabajos].join(', ') || '—'}</td>
                            <td>{[...d.fincas].map(nombreFinca).join(', ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Coste estimado con el €/hora de cada persona en Personal.</p>
    </div>
  )
}

export default JornadasPage
