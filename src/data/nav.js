// Navegación agrupada en 4 bloques (+ Inicio y Ajustes)

export const PAGES = {
  dashboard: { icon: 'Home', label: 'Inicio' },
  // Campo
  apuntar: { icon: 'PlusCircle', label: 'Apuntar' },
  notas: { icon: 'StickyNote', label: 'Recordatorios' },
  labores: { icon: 'ClipboardList', label: 'Labores' },
  aplicaciones: { icon: 'SprayCan', label: 'Tratamientos' },
  cosechas: { icon: 'Grape', label: 'Cosechas' },
  // Dinero
  gastos: { icon: 'Receipt', label: 'Gastos' },
  facturas: { icon: 'FileSpreadsheet', label: 'Facturas' },
  ingresos: { icon: 'Banknote', label: 'Ingresos' },
  finanzas: { icon: 'Wallet', label: 'Finanzas' },
  amortizaciones: { icon: 'Wrench', label: 'Inversiones' },
  // Fincas
  fincas: { icon: 'MapPin', label: 'Fincas' },
  finca_detalle: { icon: 'FileText', label: 'Detalle finca' },
  personal: { icon: 'Users', label: 'Personal' },
  maquinaria: { icon: 'Tractor', label: 'Maquinaria' },
  inventario: { icon: 'Package', label: 'Inventario' },
  destinos: { icon: 'Factory', label: 'Destinos' },
  // Papeles
  informes: { icon: 'BarChart3', label: 'Informes' },
  expedientes: { icon: 'FolderOpen', label: 'Ayudas' },
  vencimientos: { icon: 'CalendarClock', label: 'Vencimientos' },
  cuaderno: { icon: 'BookOpen', label: 'Cuaderno de campo' },
  jornadas: { icon: 'Clock', label: 'Jornadas' },
  gestoria: { icon: 'Briefcase', label: 'Gestoría' },
  // Otros
  configuracion: { icon: 'Settings', label: 'Ajustes' },
}

export const SECCIONES = [
  { id: 'inicio', label: 'Inicio', icon: 'Home', pages: ['dashboard'] },
  { id: 'campo', label: 'Campo', icon: 'Sprout', pages: ['apuntar', 'labores', 'aplicaciones', 'cosechas', 'notas'] },
  { id: 'dinero', label: 'Dinero', icon: 'Wallet', pages: ['gastos', 'facturas', 'ingresos', 'finanzas', 'amortizaciones'] },
  { id: 'fincas', label: 'Fincas', icon: 'MapPin', pages: ['fincas', 'finca_detalle', 'personal', 'maquinaria', 'inventario', 'destinos'] },
  { id: 'papeles', label: 'Papeles', icon: 'FolderOpen', pages: ['informes', 'expedientes', 'vencimientos', 'cuaderno', 'jornadas', 'gestoria'] },
]

export function seccionDePagina(pageId) {
  return SECCIONES.find(s => s.pages.includes(pageId)) || null
}

// Compatibilidad: lista plana de todas las páginas
export const ALL_NAV = Object.entries(PAGES).map(([id, p]) => ({ id, ...p }))
