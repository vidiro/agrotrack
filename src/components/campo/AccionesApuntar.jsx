// Las cuatro acciones del campo (jornada, tratamiento, foto de factura, recordatorio).
// - modo "tiles": botones grandes (Inicio y Apuntar)
// - modo "fab": botón redondo «+» que abre un menú con las cuatro acciones (resto de páginas, en el móvil)
// Funciona sin cobertura: usa los datos guardados en el móvil y envía lo apuntado al volver la señal.
import { useEffect, useState } from 'react'
import { supabase } from '../../data/supabaseClient'
import { getIcon } from '../../utils/lucideIcons'
import { guardarCatalogos, leerCatalogos } from '../../utils/copiaLocal'

// Se cargan junto con la página (no por separado) para que estén siempre disponibles sin cobertura
import JornadaWizard from './JornadaWizard'
import TratamientoWizard from './TratamientoWizard'
import FotoGastoWizard from './FotoGastoWizard'
import NotaWizard from './NotaWizard'
import AbonadoWizard from './AbonadoWizard'
import { esFertilizante } from '../../utils/fertilizacion'

export const ACCIONES = [
  { id: 'jornada', icono: 'ClipboardList', titulo: 'Jornada', sub: 'Quién, dónde y cuántas horas', color: 'verde' },
  { id: 'tratamiento', icono: 'SprayCan', titulo: 'Tratamiento', sub: 'Fitosanitario o abono', color: 'vina' },
  { id: 'gasto', icono: 'Camera', titulo: 'Foto de factura', sub: 'Gasto o tique', color: 'trigo' },
  { id: 'nota', icono: 'StickyNote', titulo: 'Recordatorio', sub: 'Algo que hay que hacer', color: 'teja' },
]

// Catálogos para autocompletar (productos, plagas, empresas…), guardados en el móvil.
// Se piden una vez por sesión.
let catalogosSesion = null
async function cargarCatalogos() {
  if (catalogosSesion) return catalogosSesion
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
    productos: unicos(aplicaciones.filter(a => !esFertilizante(a)), 'producto').map(a => ({
      producto: a.producto, materia_activa: a.materia_activa, dosis: a.dosis, volumen_caldo: a.volumen_caldo,
      carencia_dias: a.carencia_dias, num_registro: a.num_registro,
    })),
    abonos: unicos(aplicaciones.filter(esFertilizante), 'producto').map(a => ({
      producto: a.producto, tipo_fertilizante: a.tipo_fertilizante, riqueza_n: a.riqueza_n, riqueza_p: a.riqueza_p, riqueza_k: a.riqueza_k,
      dosis: a.dosis, unidad_dosis: a.unidad_dosis, metodo_aplicacion: a.metodo_aplicacion,
    })),
    plagas: unicos(aplicaciones.filter(a => !esFertilizante(a)), 'justificacion').map(a => a.justificacion),
    aplicadores: unicos(aplicaciones, 'aplicador').map(a => ({ aplicador: a.aplicador, carnet_aplicador: a.carnet_aplicador })),
    conceptos: unicos(gastos, 'concepto').map(g => g.concepto).filter(c => c.length <= 30).slice(0, 15),
    empresas: unicos(gastos, 'proveedor').map(g => ({ proveedor: g.proveedor, nif_proveedor: g.nif_proveedor })),
    nifTitular: exp.data?.[0]?.nif_titular || '',
  }
  guardarCatalogos(cat)
  catalogosSesion = cat
  return cat
}

function AccionesApuntar({ modo = 'tiles', fincas, personal, maquinaria, params, onDataChange }) {
  const [abierto, setAbierto] = useState(null)
  const [menu, setMenu] = useState(false)
  const [catalogos, setCatalogos] = useState(() => catalogosSesion || leerCatalogos())

  useEffect(() => {
    if (!navigator.onLine) return
    cargarCatalogos().then(setCatalogos).catch(() => { /* sin cobertura: se usan los guardados */ })
  }, [])

  const abrir = (id) => { setMenu(false); setAbierto(id) }
  const props = {
    fincas, personal, maquinaria, params, catalogos,
    nifTitular: catalogos.nifTitular,
    onCerrar: () => setAbierto(null),
    onGuardado: () => {
      catalogosSesion = null // por si hay un producto o empresa nuevos
      window.dispatchEvent(new Event('agrotrack-apuntado'))
      if (navigator.onLine) onDataChange?.()
    },
  }

  return (
    <>
      {modo === 'tiles' && (
        <div className="acciones-grid">
          {ACCIONES.map(a => (
            <button key={a.id} type="button" className={`accion accion-${a.color}`} onClick={() => abrir(a.id)}>
              <span className="accion-icono">{getIcon(a.icono, { size: 30, strokeWidth: 2 })}</span>
              <span className="accion-texto">
                <strong>{a.titulo}</strong>
                <span>{a.sub}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {modo === 'fab' && (
        <>
          <button type="button" className="fab-apuntar" onClick={() => setMenu(true)} aria-label="Apuntar jornada, tratamiento, factura o recordatorio" aria-expanded={menu}>
            {getIcon('Plus', { size: 30, strokeWidth: 2.5 })}
          </button>
          {menu && (
            <div className="hoja-fondo" onClick={() => setMenu(false)} role="presentation">
              <div className="hoja" role="dialog" aria-modal="true" aria-label="¿Qué quieres apuntar?" onClick={e => e.stopPropagation()}>
                <div className="hoja-asa" aria-hidden="true" />
                <h2 className="hoja-titulo">¿Qué quieres apuntar?</h2>
                <div className="acciones-grid">
                  {ACCIONES.map(a => (
                    <button key={a.id} type="button" className={`accion accion-${a.color}`} onClick={() => abrir(a.id)}>
                      <span className="accion-icono">{getIcon(a.icono, { size: 28, strokeWidth: 2 })}</span>
                      <span className="accion-texto">
                        <strong>{a.titulo}</strong>
                        <span>{a.sub}</span>
                      </span>
                    </button>
                  ))}
                </div>
                <button type="button" className="btn hoja-cerrar" onClick={() => setMenu(false)}>Cancelar</button>
              </div>
            </div>
          )}
        </>
      )}

      {abierto === 'jornada' && <JornadaWizard {...props} />}
      {abierto === 'tratamiento' && <TratamientoWizard {...props} onAbono={() => setAbierto('abonado')} />}
      {abierto === 'abonado' && <AbonadoWizard {...props} />}
      {abierto === 'gasto' && <FotoGastoWizard {...props} />}
      {abierto === 'nota' && <NotaWizard {...props} />}
    </>
  )
}

export default AccionesApuntar
