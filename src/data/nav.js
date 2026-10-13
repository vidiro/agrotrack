export const PRIMARY_NAV = [
  { id: 'dashboard', icon: 'Home', label: 'Inicio' },
  { id: 'labores', icon: 'ClipboardList', label: 'Labores' },
  { id: 'cosechas', icon: 'Grape', label: 'Cosechas' },
  { id: 'finanzas', icon: 'Wallet', label: 'Finanzas' },
]

export const MORE_NAV = [
  { id: 'informes', icon: 'BarChart3', label: 'Informes' },
  { id: 'aplicaciones', icon: 'SprayCan', label: 'Aplicaciones' },
  { id: 'gastos', icon: 'Receipt', label: 'Gastos' },
  { id: 'ingresos', icon: 'Banknote', label: 'Ingresos' },
  { id: 'destinos', icon: 'Factory', label: 'Destinos' },
  { id: 'fincas', icon: 'MapPin', label: 'Fincas' },
  { id: 'finca_detalle', icon: 'FileText', label: 'Detalle Finca' },
  { id: 'personal', icon: 'Users', label: 'Personal' },
  { id: 'maquinaria', icon: 'Tractor', label: 'Maquinaria' },
  { id: 'amortizaciones', icon: 'Wrench', label: 'Amortizaciones' },
  { id: 'inventario', icon: 'Package', label: 'Inventario' },
  { id: 'configuracion', icon: 'Settings', label: 'Ajustes' },
]

export const ALL_NAV = [...PRIMARY_NAV, ...MORE_NAV]
