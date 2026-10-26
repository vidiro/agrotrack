import { useEffect, useMemo, useState } from 'react'
import { Download, FileDown } from 'lucide-react'
import { fetchAll } from '../utils/fetchAll'
import { laborFincaIds } from '../utils/labores'
import { fechaES } from '../utils/formato'
import { downloadCSV } from '../utils/csvExport'
import { useExplotacion, lineaTitular } from '../utils/explotacion'
import { Avisos, Cargando, Vacio, Cabecera } from './ui'

// Registro de tratamientos fitosanitarios (cuaderno de campo) a partir de Tratamientos + Labores
function CuadernoPage({ fincas = [], maquinaria = [], onNavigate }) {
  const [aplicaciones, setAplicaciones] = useState([])
  const [labores, setLabores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [anio, setAnio] = useState(String(new Date().getFullYear()))
  const [finca, setFinca] = useState('')
  const { explotacion } = useExplotacion()

  useEffect(() => {
    (async () => {
      const [a, l] = await Promise.all([fetchAll('aplicaciones'), fetchAll('labores')])
      if (a.error || l.error) setError((a.error || l.error).message)
      setAplicaciones(a.data || [])
      setLabores(l.data || [])
      setLoading(false)
    })()
  }, [])

  const filas = useMemo(() => {
    const porId = new Map(labores.map(l => [String(l.id_labor), l]))
    return aplicaciones.map(a => {
      const l = porId.get(String(a.id_labor))
      const ids = l ? [...new Set(laborFincaIds(l))] : []
      const fs = ids.map(id => fincas.find(f => String(f.id_finca) === id)).filter(Boolean)
      const equipo = maquinaria.find(m => String(m.id_equipo) === String(a.id_equipo))
      return {
        id: a.id_aplicacion,
        fecha: a.fecha_aplicacion || l?.fecha || '',
        ids,
        parcelas: fs.map(f => `${f.nombre}${f.poligono ? ` (pol. ${f.poligono}${f.parcela ? `, parc. ${f.parcela}` : ''})` : ''}`).join('; ') || '—',
        municipio: [...new Set(fs.map(f => f.termino_municipal).filter(Boolean))].join(', '),
        cultivo: a.cultivo || [...new Set(fs.map(f => f.cultivo).filter(Boolean))].join(', ') || '—',
        superficie: a.superficie_ha ?? (fs.reduce((s, f) => s + (parseFloat(f.superficie_total_ha) || 0), 0) || ''),
        superficieEstimada: a.superficie_ha == null,
        plaga: a.justificacion || '—',
        producto: a.producto || '—',
        materia: a.materia_activa || '',
        registro: a.num_registro || '',
        dosis: a.dosis != null ? String(a.dosis) : '',
        caldo: a.volumen_caldo != null ? String(a.volumen_caldo) : '',
        carencia: a.carencia_dias != null ? `${a.carencia_dias} d` : '',
        aplicador: a.aplicador || '',
        carnet: a.carnet_aplicador || '',
        equipo: equipo ? `${equipo.tipo}${equipo.marca_modelo ? ' ' + equipo.marca_modelo : ''}` : '',
        observaciones: a.observaciones || '',
      }
    })
      .filter(f => !anio || String(f.fecha).startsWith(anio))
      .filter(f => !finca || f.ids.includes(finca))
      .sort((x, y) => String(x.fecha).localeCompare(String(y.fecha)))
  }, [aplicaciones, labores, fincas, maquinaria, anio, finca])

  const anios = [...new Set([String(new Date().getFullYear()), ...aplicaciones.map(a => String(a.fecha_aplicacion || labores.find(l => String(l.id_labor) === String(a.id_labor))?.fecha || '').substring(0, 4)).filter(Boolean)])].sort().reverse()

  const incompletas = filas.filter(f => !f.registro || !f.aplicador || !f.carnet || f.superficieEstimada).length

  const exportarCSV = () => {
    downloadCSV(`cuaderno_tratamientos_${anio || 'todo'}`,
      ['fecha', 'parcelas', 'municipio', 'cultivo', 'superficie_ha', 'plaga_o_justificacion', 'producto', 'materia_activa', 'num_registro', 'dosis', 'volumen_caldo_l_ha', 'plazo_seguridad', 'aplicador', 'carne_aplicador', 'equipo', 'observaciones'],
      filas.map(f => ({
        fecha: fechaES(f.fecha), parcelas: f.parcelas, municipio: f.municipio, cultivo: f.cultivo, superficie_ha: f.superficie,
        plaga_o_justificacion: f.plaga, producto: f.producto, materia_activa: f.materia, num_registro: f.registro, dosis: f.dosis,
        volumen_caldo_l_ha: f.caldo, plazo_seguridad: f.carencia, aplicador: f.aplicador, carne_aplicador: f.carnet, equipo: f.equipo, observaciones: f.observaciones,
      })))
  }

  const exportarPDF = async () => {
    const [{ jsPDF }, { applyPlugin }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
    applyPlugin(jsPDF)
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const W = doc.internal.pageSize.getWidth()
    doc.setFontSize(14)
    doc.text('Registro de tratamientos fitosanitarios', 10, 12)
    doc.setFontSize(9)
    doc.text([lineaTitular(explotacion) || 'Titular: ____________________', `Año ${anio || 'todos'}${finca ? ' · ' + (fincas.find(f => String(f.id_finca) === finca)?.nombre || '') : ''}`].join('   ·   '), 10, 18)
    doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, W - 10, 18, { align: 'right' })
    doc.autoTable({
      startY: 22,
      head: [['Fecha', 'Parcela(s)', 'Cultivo', 'Sup. (ha)', 'Plaga / motivo', 'Producto', 'Nº registro', 'Dosis', 'Caldo L/ha', 'P. seg.', 'Aplicador', 'Carné', 'Equipo']],
      body: filas.map(f => [fechaES(f.fecha), f.parcelas, f.cultivo, f.superficie === '' ? '' : String(f.superficie), f.plaga, f.producto + (f.materia ? `\n(${f.materia})` : ''), f.registro, f.dosis, f.caldo, f.carencia, f.aplicador, f.carnet, f.equipo]),
      theme: 'grid',
      headStyles: { fillColor: [31, 77, 51], fontSize: 7 },
      bodyStyles: { fontSize: 6.5, cellPadding: 1.4, overflow: 'linebreak' },
      columnStyles: { 0: { cellWidth: 16 }, 1: { cellWidth: 40 }, 2: { cellWidth: 16 }, 3: { cellWidth: 12 }, 4: { cellWidth: 28 }, 5: { cellWidth: 30 }, 6: { cellWidth: 18 }, 7: { cellWidth: 12 }, 8: { cellWidth: 13 }, 9: { cellWidth: 11 }, 10: { cellWidth: 22 }, 11: { cellWidth: 18 }, 12: { cellWidth: 21 } },
      margin: { left: 10, right: 10 },
    })
    doc.save(`cuaderno_tratamientos_${anio || 'todo'}.pdf`)
  }

  if (loading) return <Cargando texto="Preparando el cuaderno…" />

  return (
    <div>
      <Avisos error={error} />
      <Cabecera titulo="Cuaderno de tratamientos" descripcion="Registro de tratamientos fitosanitarios para inspecciones, a partir de lo que apuntas en Tratamientos.">
        <button type="button" className="btn btn-accent" onClick={exportarCSV} disabled={!filas.length}><Download size={16} aria-hidden="true" /> CSV</button>
        <button type="button" className="btn btn-primary" onClick={exportarPDF} disabled={!filas.length}><FileDown size={16} aria-hidden="true" /> PDF</button>
      </Cabecera>

      <div className="flex gap-12 mb-16 flex-wrap">
        <select className="form-select" style={{ width: 'auto' }} value={anio} onChange={e => setAnio(e.target.value)} aria-label="Año">
          <option value="">Todos los años</option>
          {anios.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="form-select" style={{ width: 'auto' }} value={finca} onChange={e => setFinca(e.target.value)} aria-label="Finca">
          <option value="">Todas las fincas</option>
          {fincas.map(f => <option key={f.id_finca} value={String(f.id_finca)}>{f.nombre}</option>)}
        </select>
      </div>

      {!explotacion.nif_titular && (
        <div className="alert alert-info">Pon tu nombre y NIF en <button type="button" onClick={() => onNavigate?.('configuracion')} style={{ background: 'none', border: 'none', padding: 0, textDecoration: 'underline', cursor: 'pointer', font: 'inherit', color: 'inherit' }}>Ajustes</button> para que salgan en la cabecera del cuaderno.</div>
      )}
      {incompletas > 0 && (
        <div className="alert alert-warning" style={{ background: 'var(--aviso-fondo)', border: '1px solid var(--aviso)', borderRadius: 12, padding: 12, marginBottom: 16 }}>
          {incompletas} {incompletas === 1 ? 'tratamiento no tiene' : 'tratamientos no tienen'} todos los datos (nº de registro, aplicador, carné o superficie tratada). Complétalos en{' '}
          <button type="button" onClick={() => onNavigate?.('aplicaciones')} style={{ background: 'none', border: 'none', padding: 0, textDecoration: 'underline', cursor: 'pointer', font: 'inherit', color: 'inherit' }}>Tratamientos</button>.
          {' '}Si no pones superficie, se usa la de la finca entera.
        </div>
      )}

      <div className="card">
        <div className="card-title">Tratamientos ({filas.length})</div>
        {filas.length === 0 ? (
          <Vacio texto="No hay tratamientos para este filtro." />
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Fecha</th><th>Parcela(s)</th><th>Cultivo</th><th>Sup. (ha)</th><th>Producto</th><th>Nº registro</th><th>Dosis</th><th>P. seguridad</th><th>Aplicador</th></tr></thead>
              <tbody>
                {filas.map(f => (
                  <tr key={f.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fechaES(f.fecha)}</td>
                    <td style={{ fontSize: 13 }}>{f.parcelas}</td>
                    <td>{f.cultivo}</td>
                    <td>{f.superficie === '' ? '—' : `${f.superficie}${f.superficieEstimada ? '*' : ''}`}</td>
                    <td>{f.producto}<div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{f.plaga}</div></td>
                    <td style={{ color: f.registro ? undefined : 'var(--color-danger)' }}>{f.registro || 'Falta'}</td>
                    <td>{f.dosis || '—'}</td>
                    <td>{f.carencia || '—'}</td>
                    <td style={{ color: f.aplicador ? undefined : 'var(--color-danger)' }}>{f.aplicador || 'Falta'}{f.carnet && <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Carné {f.carnet}</div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
        * Superficie de la finca completa (no se indicó la superficie tratada). El formato oficial del cuaderno puede variar según la comunidad autónoma: revisa que tenga lo que te piden.
      </p>
    </div>
  )
}

export default CuadernoPage
