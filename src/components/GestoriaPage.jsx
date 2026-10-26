import { useEffect, useMemo, useState } from 'react'
import { Briefcase, Download } from 'lucide-react'
import { fetchAll } from '../utils/fetchAll'
import { esGastoInversion } from '../utils/gastos'
import { esFactura } from '../utils/facturas'
import { eur, fechaES, nombreArchivo } from '../utils/formato'
import { descargarAdjunto, extensionDe } from '../utils/adjuntos'
import { descargarBlob } from '../utils/expedienteZip'
import { useExplotacion, lineaTitular } from '../utils/explotacion'
import { Avisos, Cargando, Cabecera } from './ui'

const TRIMESTRES = [
  { id: '1', label: '1er trimestre (ene–mar)', meses: ['01', '02', '03'] },
  { id: '2', label: '2º trimestre (abr–jun)', meses: ['04', '05', '06'] },
  { id: '3', label: '3er trimestre (jul–sep)', meses: ['07', '08', '09'] },
  { id: '4', label: '4º trimestre (oct–dic)', meses: ['10', '11', '12'] },
  { id: 'A', label: 'Año completo', meses: null },
]

const csv = (filas) => '﻿' + filas.map(f => f.map(v => {
  const s = String(v ?? '')
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}).join(';')).join('\n')
const num = (v) => (parseFloat(v) || 0).toFixed(2).replace('.', ',')

function GestoriaPage({ fincas = [] }) {
  const ahora = new Date()
  const [gastos, setGastos] = useState([])
  const [ingresos, setIngresos] = useState([])
  const [labores, setLabores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [anio, setAnio] = useState(String(ahora.getFullYear()))
  const [trim, setTrim] = useState(String(Math.floor(ahora.getMonth() / 3) + 1))
  const [conFotos, setConFotos] = useState(true)
  const [generando, setGenerando] = useState('')
  const { explotacion } = useExplotacion()

  useEffect(() => {
    (async () => {
      const [g, i, l] = await Promise.all([fetchAll('gastos_manual'), fetchAll('ingresos'), fetchAll('labores')])
      const err = g.error || i.error || l.error
      if (err) setError(err.message)
      setGastos(g.data || []); setIngresos(i.data || []); setLabores(l.data || [])
      setLoading(false)
    })()
  }, [])

  const t = TRIMESTRES.find(x => x.id === trim)
  const enPeriodo = (fecha) => {
    const f = String(fecha || '')
    if (!f.startsWith(anio)) return false
    return !t.meses || t.meses.includes(f.substring(5, 7))
  }

  const datos = useMemo(() => {
    const gs = gastos.filter(g => enPeriodo(g.fecha)).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
    const is = ingresos.filter(i => enPeriodo(i.fecha)).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
    const ls = labores.filter(l => enPeriodo(l.fecha))
    return {
      facturas: gs.filter(esFactura),
      sinFactura: gs.filter(g => !esFactura(g)),
      ingresos: is,
      totalGastos: gs.filter(g => !esGastoInversion(g)).reduce((s, g) => s + (parseFloat(g.importe) || 0), 0),
      totalInversiones: gs.filter(esGastoInversion).reduce((s, g) => s + (parseFloat(g.importe) || 0), 0),
      totalIngresos: is.reduce((s, i) => s + (parseFloat(i.cantidad) || 0), 0),
      costeSalarios: ls.reduce((s, l) => s + (parseFloat(l.coste_peones) || 0), 0),
      todos: gs,
    }
  }, [gastos, ingresos, labores, anio, trim])

  const nombreFinca = (id) => fincas.find(f => String(f.id_finca) === String(id))?.nombre || 'General'
  const periodo = `${t.id === 'A' ? 'Año' : `${t.id}T`} ${anio}`

  const generar = async () => {
    setError('')
    try {
      setGenerando('Preparando…')
      const [{ default: JSZip }, { jsPDF }, { applyPlugin }] = await Promise.all([import('jszip'), import('jspdf'), import('jspdf-autotable')])
      applyPlugin(jsPDF)
      const zip = new JSZip()

      // Libro de facturas recibidas y gastos
      zip.file('gastos_y_facturas_recibidas.csv', csv([
        ['Fecha', 'Nº factura', 'Empresa', 'CIF/NIF', 'Concepto', 'Categoría', 'Finca', 'Importe total', 'Forma de pago', 'Inversión', 'Archivo'],
        ...datos.todos.map((g, k) => [fechaES(g.fecha), g.num_factura || '', g.proveedor || '', g.nif_proveedor || '', g.concepto || '', g.categoria || '', nombreFinca(g.id_finca), num(g.importe), g.forma_pago || '', esGastoInversion(g) ? 'Sí' : 'No', g.adjunto_path ? `facturas/${String(k + 1).padStart(3, '0')}.${extensionDe(g.adjunto_path)}` : '']),
      ]))
      zip.file('ingresos.csv', csv([
        ['Fecha', 'Origen', 'Concepto', 'Importe', 'Observaciones'],
        ...datos.ingresos.map(i => [fechaES(i.fecha), i.origen || '', i.concepto || '', num(i.cantidad), i.observaciones || '']),
      ]))

      // Resumen en PDF
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      doc.setFontSize(15); doc.text(`Resumen para la gestoría · ${periodo}`, 14, 16)
      doc.setFontSize(9); doc.text(lineaTitular(explotacion) || ' ', 14, 22)
      doc.autoTable({
        startY: 28, theme: 'grid', headStyles: { fillColor: [31, 77, 51] }, bodyStyles: { fontSize: 9 },
        head: [['Concepto', 'Importe', 'Registros']],
        body: [
          ['Ingresos', eur(datos.totalIngresos), String(datos.ingresos.length)],
          ['Gastos corrientes', eur(datos.totalGastos), String(datos.todos.filter(g => !esGastoInversion(g)).length)],
          ['Inversiones', eur(datos.totalInversiones), String(datos.todos.filter(esGastoInversion).length)],
          ['Coste de jornales (según labores)', eur(datos.costeSalarios), ''],
          ['Gastos sin datos de factura', '', String(datos.sinFactura.length)],
        ],
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
        margin: { left: 14, right: 14 },
      })
      doc.autoTable({
        startY: doc.lastAutoTable.finalY + 6, theme: 'grid', headStyles: { fillColor: [31, 77, 51], fontSize: 7.5 }, bodyStyles: { fontSize: 7 },
        head: [['Fecha', 'Nº factura', 'Empresa', 'CIF', 'Concepto', 'Importe']],
        body: datos.todos.map(g => [fechaES(g.fecha), g.num_factura || '-', g.proveedor || '-', g.nif_proveedor || '-', (g.concepto || '-') + (esGastoInversion(g) ? ' (inversión)' : ''), eur(g.importe)]),
        columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 24 }, 2: { cellWidth: 38 }, 3: { cellWidth: 22 }, 4: { cellWidth: 56 }, 5: { cellWidth: 24, halign: 'right' } },
        margin: { left: 14, right: 14 },
      })
      zip.file('00_RESUMEN.pdf', doc.output('blob'))

      // Fotos de las facturas
      if (conFotos) {
        let k = 0
        for (const g of datos.todos) {
          k++
          if (!g.adjunto_path) continue
          setGenerando(`Añadiendo factura ${k} de ${datos.todos.length}…`)
          try {
            zip.file(`facturas/${String(k).padStart(3, '0')}_${nombreArchivo(g.num_factura || 'sin-num')}_${nombreArchivo(g.proveedor || g.concepto || '')}.${extensionDe(g.adjunto_path)}`, await descargarAdjunto(g.adjunto_path))
          } catch { /* se sigue con el resto */ }
        }
      }

      setGenerando('Comprimiendo…')
      descargarBlob(await zip.generateAsync({ type: 'blob' }), `Gestoria_${anio}_${t.id === 'A' ? 'anual' : t.id + 'T'}.zip`)
      setSuccess('Paquete descargado. Envíaselo a tu gestoría por correo o WhatsApp.')
      setTimeout(() => setSuccess(''), 5000)
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerando('')
    }
  }

  if (loading) return <Cargando texto="Preparando datos…" />
  const anios = [...new Set([String(ahora.getFullYear()), ...gastos.map(g => String(g.fecha || '').substring(0, 4)).filter(Boolean)])].sort().reverse()

  return (
    <div>
      <Avisos error={error} success={success} />
      <Cabecera titulo="Paquete para la gestoría" descripcion="Todo lo del trimestre en un ZIP: resumen en PDF, libro de gastos y facturas, ingresos y las fotos de las facturas." />

      <div className="card">
        <div className="flex gap-12 flex-wrap mb-16">
          <select className="form-select" style={{ width: 'auto' }} value={trim} onChange={e => setTrim(e.target.value)} aria-label="Periodo">
            {TRIMESTRES.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
          <select className="form-select" style={{ width: 'auto' }} value={anio} onChange={e => setAnio(e.target.value)} aria-label="Año">
            {anios.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div className="summary-grid" style={{ marginBottom: 16 }}>
          <div className="summary-card success"><div className="summary-value">{eur(datos.totalIngresos, 0)}</div><div className="summary-label">Ingresos ({datos.ingresos.length})</div></div>
          <div className="summary-card danger"><div className="summary-value">{eur(datos.totalGastos, 0)}</div><div className="summary-label">Gastos corrientes</div></div>
          <div className="summary-card accent"><div className="summary-value">{eur(datos.totalInversiones, 0)}</div><div className="summary-label">Inversiones</div></div>
          <div className="summary-card"><div className="summary-value">{datos.facturas.length}</div><div className="summary-label">Facturas con datos</div></div>
        </div>

        {datos.sinFactura.length > 0 && (
          <p style={{ fontSize: 13, color: '#8a6200', margin: '0 0 12px' }}>
            {datos.sinFactura.length} {datos.sinFactura.length === 1 ? 'gasto no tiene' : 'gastos no tienen'} nº de factura, empresa o CIF. Van en el paquete igualmente, pero tu gestoría te los pedirá.
          </p>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 14 }}>
          <input type="checkbox" checked={conFotos} onChange={e => setConFotos(e.target.checked)} style={{ width: 20, height: 20 }} />
          Incluir las fotos y PDF de las facturas
        </label>

        <button type="button" className="btn btn-primary btn-full" onClick={generar} disabled={!!generando || (!datos.todos.length && !datos.ingresos.length)}>
          {generando ? generando : <><Download size={18} aria-hidden="true" /> Descargar paquete de {periodo}</>}
        </button>
      </div>

      <div className="card">
        <div className="card-title"><Briefcase size={18} aria-hidden="true" style={{ verticalAlign: 'middle' }} /> Acceso para tu gestor</div>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-secondary)' }}>
          Por ahora la forma más segura es enviarle este paquete cada trimestre. Darle un usuario propio de solo lectura requiere preparar permisos por usuario en la base de datos; está apuntado como siguiente paso.
        </p>
      </div>
    </div>
  )
}

export default GestoriaPage
