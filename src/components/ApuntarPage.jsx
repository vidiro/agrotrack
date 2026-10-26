// Apuntar en el campo: cuatro botones grandes que abren un asistente a pantalla completa.
// Funciona sin cobertura: usa los datos guardados en el móvil y envía lo apuntado al volver la señal.
import { useEffect, useState } from 'react'
import { supabase } from '../data/supabaseClient'
import { getIcon } from '../utils/lucideIcons'
import { guardarCatalogos, leerCatalogos } from '../utils/copiaLocal'
import { useColaPendiente, procesarCola, elementosEnCola } from '../utils/offline'

// Se cargan junto con la página (no por separado) para que estén siempre disponibles sin cobertura
import JornadaWizard from './campo/JornadaWizard'
import TratamientoWizard from './campo/TratamientoWizard'
import FotoGastoWizard from './campo/FotoGastoWizard'
import NotaWizard from './campo/NotaWizard'

const TILES = [
  { id: 'jornada', icono: 'ClipboardList', titulo: 'Jornada', sub: 'Quién, dónde y cuántas horas' },
  { id: 'tratamiento', icono: 'SprayCan', titulo: 'Tratamiento', sub: 'Va directo al cuaderno' },
  { id: 'gasto', icono: 'Camera', titulo: 'Foto de factura', sub: 'Gasto o tique' },
  { id: 'nota', icono: 'StickyNote', titulo: 'Recordatorio', sub: 'Foto de algo por hacer' },
]

const ETIQUETA_TABLA = { labores: 'Jornada', __tratamiento: 'Tratamiento', gastos_manual: 'Gasto', notas_campo: 'Recordatorio' }

// Catálogos para autocompletar (productos, plagas, empresas…), guardados en el móvil
async function cargarCatalogos() {
  const [apl, gas, exp] = await Promise.all([
    supabase.from('aplicaciones').select('*').order('id_aplicacion', { ascending: false }).limit(500),
    supabase.from('gastos_manual').select('*').order('fecha', { ascending: false }).limit(800),
    supabase.from('explotacion').select('nif_titular').limit(1),
  ])
  if (apl.error && gas.error) throw apl.error
  const aplicaciones = apl.data || []
  const gastos = gas.data || []
  const unicos = (lista, clave) => [...new Map(lista.filter(x => x[clave]).map(x => [String(x[clave]).trim().toLowerCase(), x])).values()]
  const cat = {
    productos: unicos(aplicaciones, 'producto').map(a => ({
      producto: a.producto, materia_activa: a.materia_activa, dosis: a.dosis, volumen_caldo: a.volumen_caldo,
      carencia_dias: a.carencia_dias, num_registro: a.num_registro,
    })),
    plagas: unicos(aplicaciones, 'justificacion').map(a => a.justificacion),
    aplicadores: unicos(aplicaciones, 'aplicador').map(a => ({ aplicador: a.aplicador, carnet_aplicador: a.carnet_aplicador })),
    conceptos: unicos(gastos, 'concepto').map(g => g.concepto).filter(c => c.length <= 30).slice(0, 15),
    empresas: unicos(gastos, 'proveedor').map(g => ({ proveedor: g.proveedor, nif_proveedor: g.nif_proveedor })),
    nifTitular: exp.data?.[0]?.nif_titular || '',
  }
  guardarCatalogos(cat)
  return cat
}

function ApuntarPage({ fincas, personal, maquinaria, params, onDataChange, onNavigate }) {
  const [abierto, setAbierto] = useState(null)
  const [catalogos, setCatalogos] = useState(leerCatalogos)
  const { pendientes, enLinea } = useColaPendiente()
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!navigator.onLine) return
    cargarCatalogos().then(setCatalogos).catch(() => { /* sin cobertura: se usan los guardados */ })
  }, [])

  const enviarAhora = async () => {
    setEnviando(true)
    try { await procesarCola() } finally { setEnviando(false) }
  }

  const props = {
    fincas, personal, maquinaria, params, catalogos,
    nifTitular: catalogos.nifTitular,
    onCerrar: () => setAbierto(null),
    onGuardado: () => { if (navigator.onLine) onDataChange?.() },
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 12 }}>
        <h1 className="page-title">Apuntar</h1>
        <p className="text-muted" style={{ margin: '4px 0 0' }}>
          {enLinea ? 'Toca lo que quieras apuntar.' : 'Sin cobertura: puedes apuntar igual, se enviará al volver la señal.'}
        </p>
      </div>

      {pendientes > 0 && (
        <div className="alert alert-info" role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200 }}>
            {getIcon('CloudOff', { size: 20 })}
            <span>
              <strong>{pendientes} {pendientes === 1 ? 'apunte espera' : 'apuntes esperan'} cobertura</strong>
              <small style={{ display: 'block' }}>
                {elementosEnCola().map(e => ETIQUETA_TABLA[e.tabla] || e.tabla).join(', ')}
              </small>
            </span>
          </span>
          {enLinea && (
            <button type="button" className="btn btn-small btn-primary" onClick={enviarAhora} disabled={enviando}>
              {enviando ? 'Enviando…' : 'Enviar ahora'}
            </button>
          )}
        </div>
      )}

      <div className="apuntar-grid">
        {TILES.map(t => (
          <button key={t.id} type="button" className="apuntar-tile" onClick={() => setAbierto(t.id)}>
            <span className="apuntar-tile-icono">{getIcon(t.icono, { size: 26 })}</span>
            <span>
              <strong>{t.titulo}</strong>
              <span className="sub">{t.sub}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="chips" style={{ marginTop: 16 }}>
        <button type="button" className="chip" onClick={() => onNavigate?.('notas')}>{getIcon('ListChecks', { size: 20 })} Ver recordatorios</button>
        <button type="button" className="chip" onClick={() => onNavigate?.('cosechas')}>{getIcon('Grape', { size: 20 })} Cosechas</button>
        <button type="button" className="chip" onClick={() => onNavigate?.('labores')}>{getIcon('ClipboardList', { size: 20 })} Ver jornadas</button>
      </div>

      {abierto === 'jornada' && <JornadaWizard {...props} />}
      {abierto === 'tratamiento' && <TratamientoWizard {...props} />}
      {abierto === 'gasto' && <FotoGastoWizard {...props} />}
      {abierto === 'nota' && <NotaWizard {...props} />}
    </div>
  )
}

export default ApuntarPage
