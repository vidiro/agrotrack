// Inicio: lo importante, en grande.
// 1) Apuntar (4 botones)  2) Recordatorios y avisos  3) Cómo va la campaña  4) Números y gráficos (bajo demanda)
import { useState, useEffect, lazy, Suspense } from 'react'
import { fetchAll, isMissingTable } from '../utils/fetchAll'
import { gastosCorrientes } from '../utils/gastos'
import { getIcon } from '../utils/lucideIcons'
import { calendarioCampanas } from '../utils/campanas'
import { useExplotacion } from '../utils/explotacion'
import { eur } from '../utils/formato'
import { esErrorDeRed } from '../utils/offline'
import Pendientes from './Pendientes'
import RecordatoriosCard from './RecordatoriosCard'
import AccionesApuntar from './campo/AccionesApuntar'

const ResumenDetallado = lazy(() => import('./ResumenDetallado'))

function saludo() {
  const h = new Date().getHours()
  if (h < 6) return 'Buenas noches'
  if (h < 14) return 'Buenos días'
  if (h < 21) return 'Buenas tardes'
  return 'Buenas noches'
}

function Dashboard(props) {
  const { fincas, personal, maquinaria, params, onNavigate } = props
  const [datos, setDatos] = useState({ labores: [], cosechas: [], gastos: [], ingresos: [] })
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [verDetalle, setVerDetalle] = useState(false)
  const { explotacion } = useExplotacion()

  const cargar = async () => {
    setError('')
    try {
      const [lab, cos, gas, ing] = await Promise.all([
        fetchAll('labores', q => q.order('fecha', { ascending: false })),
        fetchAll('cosechas', q => q.order('fecha', { ascending: false })),
        fetchAll('gastos_manual', q => q.order('fecha', { ascending: false })),
        fetchAll('ingresos', q => q.order('fecha', { ascending: false })),
      ])
      for (const r of [lab, cos, gas]) if (r.error) throw r.error
      if (ing.error && !isMissingTable(ing.error)) throw ing.error
      setDatos({ labores: lab.data || [], cosechas: cos.data || [], gastos: gas.data || [], ingresos: ing.data || [] })
    } catch (err) {
      setError(esErrorDeRed(err) ? 'Sin cobertura: puedes apuntar igual. Las cifras se actualizan cuando vuelva la señal.' : err.message)
    } finally {
      setCargando(false)
    }
  }
  useEffect(() => { cargar() }, [])

  const { labores, cosechas, gastos, ingresos } = datos

  // Campaña en curso, con su fecha de inicio real (Ajustes → Campañas)
  const cal = calendarioCampanas(params)
  const campana = cal.campanaDe(new Date())
  const { start, end } = cal.rango(campana)
  const dentro = (f) => { if (!f) return false; const d = new Date(String(f).substring(0, 10) + 'T00:00:00'); return d >= start && d < end }
  const ingresado = ingresos.filter(i => dentro(i.fecha)).reduce((s, i) => s + (parseFloat(i.cantidad) || 0), 0)
  const gastado = gastosCorrientes(gastos).filter(g => dentro(g.fecha)).reduce((s, g) => s + (parseFloat(g.importe) || 0), 0)
  const manoDeObra = labores.filter(l => dentro(l.fecha)).reduce((s, l) => s + (parseFloat(l.coste_total) || 0), 0)
  const resultado = ingresado - gastado - manoDeObra
  const jornadas = labores.filter(l => dentro(l.fecha)).length
  const kg = cosechas.filter(c => dentro(c.fecha)).reduce((s, c) => s + (parseFloat(c.kg) || 0), 0)

  const nombre = String(explotacion?.nombre_titular || '').trim().split(/\s+/)[0]
  const hoyTexto = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  const hoyLargo = hoyTexto.charAt(0).toUpperCase() + hoyTexto.slice(1)
  const fmt = (d) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

  return (
    <div className="inicio">
      <header className="inicio-saludo">
        <p className="inicio-fecha">{hoyLargo}</p>
        <h1>{saludo()}{nombre ? `, ${nombre}` : ''}</h1>
      </header>

      {error && (
        <div className="alert alert-error" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span>{error}</span>
          <button className="btn btn-small btn-primary" onClick={cargar}>Reintentar</button>
        </div>
      )}

      <section aria-labelledby="titulo-apuntar" className="inicio-bloque">
        <h2 id="titulo-apuntar" className="bloque-titulo">¿Qué quieres apuntar?</h2>
        <AccionesApuntar modo="tiles" {...props} onDataChange={() => { cargar(); props.onDataChange?.() }} />
      </section>

      <div className="inicio-columnas">
        <RecordatoriosCard fincas={fincas} onNavigate={onNavigate} />
        <Pendientes fincas={fincas} labores={labores} cosechas={cosechas} gastos={gastos} ingresos={ingresos} onNavigate={onNavigate} sinNotas />
      </div>

      <section className="panel panel-campana" aria-labelledby="titulo-campana">
        <div className="panel-cabecera">
          <h2 id="titulo-campana">{getIcon('Sprout', { size: 20 })} Campaña {campana}</h2>
          <span className="panel-nota">{fmt(start)} – {fmt(new Date(end.getTime() - 86400000))}</span>
        </div>
        {cargando ? <p className="panel-vacio">Cargando…</p> : (
          <>
            <div className="cifras">
              <button type="button" className="cifra" onClick={() => onNavigate?.('ingresos')}>
                <span className="cifra-etiqueta">Ingresado</span>
                <span className="cifra-valor positivo">{eur(ingresado, 0)}</span>
              </button>
              <button type="button" className="cifra" onClick={() => onNavigate?.('gastos')}>
                <span className="cifra-etiqueta">Gastos</span>
                <span className="cifra-valor">{eur(gastado, 0)}</span>
              </button>
              <button type="button" className="cifra" onClick={() => onNavigate?.('labores')}>
                <span className="cifra-etiqueta">Jornales y máquinas</span>
                <span className="cifra-valor">{eur(manoDeObra, 0)}</span>
              </button>
              <button type="button" className="cifra cifra-destacada" onClick={() => onNavigate?.('finanzas')}>
                <span className="cifra-etiqueta">Resultado</span>
                <span className={`cifra-valor ${resultado >= 0 ? 'positivo' : 'negativo'}`}>{resultado >= 0 ? '+' : '−'}{eur(Math.abs(resultado), 0)}</span>
              </button>
            </div>
            <p className="panel-pie">
              {jornadas} {jornadas === 1 ? 'jornada apuntada' : 'jornadas apuntadas'} · {Math.round(kg).toLocaleString('es-ES')} kg cosechados.
              Las inversiones (compra de tierra, plantación…) no restan aquí.
            </p>
          </>
        )}
      </section>

      <div className="inicio-mas">
        <button type="button" className="btn btn-grande-sec" onClick={() => setVerDetalle(v => !v)} aria-expanded={verDetalle}>
          {getIcon('BarChart3', { size: 20 })} {verDetalle ? 'Ocultar números del mes' : 'Ver números del mes y gráficos'}
        </button>
        <button type="button" className="btn btn-grande-sec" onClick={() => onNavigate?.('informes')}>
          {getIcon('FileText', { size: 20 })} Informes y PDF
        </button>
      </div>

      {verDetalle && (
        <Suspense fallback={<div className="empty-state"><div className="spinner" /></div>}>
          <ResumenDetallado fincas={fincas} personal={personal} maquinaria={maquinaria} labores={labores} cosechas={cosechas} gastos={gastos} ingresos={ingresos} />
        </Suspense>
      )}
    </div>
  )
}

export default Dashboard
