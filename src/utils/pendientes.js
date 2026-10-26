// Lista de cosas pendientes para la pantalla de Inicio
import { esFactura } from './facturas'
import { laborFincaIds } from './labores'

const DIA = 24 * 60 * 60 * 1000

export function aFecha(f) {
  if (!f) return null
  if (f instanceof Date) return Number.isNaN(f.getTime()) ? null : new Date(f.getFullYear(), f.getMonth(), f.getDate())
  const d = new Date(String(f).substring(0, 10) + 'T00:00:00')
  return Number.isNaN(d.getTime()) ? null : d
}

export function diasHasta(fecha, hoy = new Date()) {
  const d = aFecha(fecha)
  if (!d) return null
  const h = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  return Math.round((d - h) / DIA)
}

export const fechaCorta = (f) => {
  const d = aFecha(f)
  return d ? d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '-'
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

/**
 * @returns {Array<{ id, nivel: 'urgente'|'aviso'|'info', icono, texto, detalle, page }>}
 *  ordenada de más a menos urgente
 */
export function calcPendientes({
  gastos = [], aplicaciones = [], labores = [], vencimientos = [], expedientes = [], requisitos = [],
  cosechas = [], ingresos = [], fincas = [], notas = [], hoy = new Date(),
}) {
  const lista = []
  const anio = String(hoy.getFullYear())
  const nombreFinca = (id) => fincas.find(f => String(f.id_finca) === String(id))?.nombre || 'finca'

  // 1. Plazos de seguridad de tratamientos que aún no han terminado
  for (const a of aplicaciones) {
    const dias = parseInt(a.carencia_dias, 10)
    if (!dias) continue
    const labor = labores.find(l => String(l.id_labor) === String(a.id_labor))
    const inicio = a.fecha_aplicacion || labor?.fecha
    const d0 = aFecha(inicio)
    if (!d0) continue
    const fin = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + dias)
    const quedan = diasHasta(fin, hoy)
    if (quedan >= 0) {
      const fincasTxt = labor ? [...new Set(laborFincaIds(labor))].map(nombreFinca).join(', ') : 'la finca tratada'
      lista.push({
        id: `carencia-${a.id_aplicacion}`,
        nivel: 'urgente',
        icono: 'SprayCan',
        texto: `No cosechar en ${fincasTxt} hasta el ${fechaCorta(fin)}`,
        detalle: `Plazo de seguridad de ${a.producto || 'un tratamiento'} (${dias} días)`,
        page: 'aplicaciones',
      })
    }
  }

  // 2. Vencimientos (ITV, seguros, carnés, PAC…)
  for (const v of vencimientos) {
    if (v.hecho) continue
    const quedan = diasHasta(v.fecha, hoy)
    if (quedan == null) continue
    const aviso = parseInt(v.aviso_dias, 10) || 30
    if (quedan < 0) {
      lista.push({ id: `venc-${v.id}`, nivel: 'urgente', icono: 'CalendarClock', texto: `${v.descripcion || v.tipo} venció el ${fechaCorta(v.fecha)}`, detalle: v.tipo, page: 'vencimientos' })
    } else if (quedan <= aviso) {
      lista.push({ id: `venc-${v.id}`, nivel: quedan <= 7 ? 'urgente' : 'aviso', icono: 'CalendarClock', texto: `${v.descripcion || v.tipo} ${quedan === 0 ? 'vence hoy' : `vence en ${plural(quedan, 'día', 'días')}`}`, detalle: `${v.tipo} · ${fechaCorta(v.fecha)}`, page: 'vencimientos' })
    }
  }

  // 3. Ayudas: fecha límite cercana y requisitos sin hacer
  for (const e of expedientes) {
    if (['Presentada', 'Cobrada', 'Cerrada', 'Denegada'].includes(e.estado)) continue
    const faltan = requisitos.filter(r => String(r.id_expediente) === String(e.id) && !r.hecho).length
    const quedan = diasHasta(e.fecha_limite, hoy)
    if (quedan != null && quedan <= 30) {
      lista.push({
        id: `exp-${e.id}`,
        nivel: quedan <= 7 ? 'urgente' : 'aviso',
        icono: 'FolderOpen',
        texto: quedan < 0 ? `El plazo de «${e.nombre}» terminó el ${fechaCorta(e.fecha_limite)}` : `Quedan ${plural(quedan, 'día', 'días')} para presentar «${e.nombre}»`,
        detalle: faltan > 0 ? `Faltan ${plural(faltan, 'documento', 'documentos')}` : 'Documentación completa',
        page: 'expedientes',
      })
    } else if (faltan > 0) {
      lista.push({ id: `exp-${e.id}`, nivel: 'info', icono: 'FolderOpen', texto: `Faltan ${plural(faltan, 'documento', 'documentos')} para «${e.nombre}»`, detalle: e.organismo || 'Ayuda', page: 'expedientes' })
    }
  }

  // 3b. Recordatorios del campo con fecha (vencidos o en los próximos 3 días)
  for (const n of notas) {
    if (n.hecho || !n.fecha_limite) continue
    const quedan = diasHasta(n.fecha_limite, hoy)
    if (quedan == null || quedan > 3) continue
    const donde = n.id_finca ? ` · ${nombreFinca(n.id_finca)}` : ''
    lista.push({
      id: `nota-${n.id}`,
      nivel: quedan <= 0 ? 'urgente' : 'aviso',
      icono: 'StickyNote',
      texto: n.texto,
      detalle: `${quedan < 0 ? `Era para el ${fechaCorta(n.fecha_limite)}` : quedan === 0 ? 'Para hoy' : quedan === 1 ? 'Para mañana' : `Para el ${fechaCorta(n.fecha_limite)}`}${donde}`,
      page: 'notas',
    })
  }

  // 4. Facturas con datos incompletos
  const incompletas = gastos.filter(g => esFactura(g) && (!g.num_factura || !g.proveedor || !g.nif_proveedor))
  if (incompletas.length) {
    lista.push({ id: 'facturas-incompletas', nivel: 'aviso', icono: 'FileSpreadsheet', texto: `${plural(incompletas.length, 'factura', 'facturas')} sin CIF, empresa o nº`, detalle: 'Complétalas para el informe y las ayudas', page: 'facturas' })
  }

  // 5. Gastos del año sin datos de factura
  const sinFactura = gastos.filter(g => !esFactura(g) && String(g.fecha || '').startsWith(anio) && (parseFloat(g.importe) || 0) >= 50)
  if (sinFactura.length) {
    lista.push({ id: 'gastos-sin-factura', nivel: 'info', icono: 'Receipt', texto: `${plural(sinFactura.length, 'gasto', 'gastos')} de ${anio} sin datos de factura`, detalle: 'De 50 € o más', page: 'gastos' })
  }

  // 6. Facturas sin foto o PDF adjunto (este año)
  const sinAdjunto = gastos.filter(g => esFactura(g) && 'adjunto_path' in g && !g.adjunto_path && String(g.fecha || '').startsWith(anio))
  if (sinAdjunto.length) {
    lista.push({ id: 'facturas-sin-foto', nivel: 'info', icono: 'Camera', texto: `${plural(sinAdjunto.length, 'factura', 'facturas')} de ${anio} sin foto`, detalle: 'Guárdala para no buscar papeles después', page: 'facturas' })
  }

  // 7. Cosechas sin cobro registrado hace más de 60 días
  const cobradas = new Set(ingresos.filter(i => i.id_cosecha).map(i => String(i.id_cosecha)))
  const sinCobrar = cosechas.filter(c => !cobradas.has(String(c.id_cosecha)) && (diasHasta(c.fecha, hoy) ?? 0) < -60)
  if (sinCobrar.length) {
    lista.push({ id: 'cosechas-sin-cobro', nivel: 'info', icono: 'Banknote', texto: `${plural(sinCobrar.length, 'cosecha', 'cosechas')} sin cobro registrado`, detalle: 'Entregadas hace más de 2 meses', page: 'ingresos' })
  }

  const orden = { urgente: 0, aviso: 1, info: 2 }
  return lista.sort((a, b) => orden[a.nivel] - orden[b.nivel])
}
