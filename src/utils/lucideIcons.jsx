/**
 * Helper para renderizar iconos de lucide-react por nombre
 * Todos con size=20 y strokeWidth=2 por defecto
 */
import * as LucideIcons from 'lucide-react'

const iconMap = {
  Home: 'Home',
  ClipboardList: 'ClipboardList',
  Grape: 'Grape',
  Wallet: 'Wallet',
  BarChart3: 'BarChart3',
  SprayCan: 'SprayCan',
  Receipt: 'Receipt',
  Banknote: 'Banknote',
  Factory: 'Factory',
  MapPin: 'MapPin',
  FileText: 'FileText',
  Users: 'Users',
  Tractor: 'Tractor',
  Wrench: 'Wrench',
  Package: 'Package',
  Settings: 'Settings',
  Sun: 'Sun',
  Moon: 'Moon',
  LogOut: 'LogOut',
  Menu: 'Menu',
  X: 'X',
  Plus: 'Plus',
  Search: 'Search',
  ChevronDown: 'ChevronDown',
  TrendingUp: 'TrendingUp',
  TrendingDown: 'TrendingDown',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  Leaf: 'Leaf',
  Sprout: 'Sprout',
  Calendar: 'Calendar',
  Download: 'Download',
  Edit: 'Edit',
  Trash2: 'Trash2',
  RefreshCw: 'RefreshCw',
  AlertTriangle: 'AlertTriangle',
  Check: 'Check',
  FileSpreadsheet: 'FileSpreadsheet',
  FileText: 'FileText',
  MoreHorizontal: 'MoreHorizontal',
  SunMoon: 'SunMoon',
  Droplets: 'Droplets',
  Zap: 'Zap',
  Truck: 'Truck',
  ShoppingCart: 'ShoppingCart',
  Tag: 'Tag',
  Eye: 'Eye',
  EyeOff: 'EyeOff',
}

export function getIcon(name, props = {}) {
  const iconName = iconMap[name] || name
  const IconComponent = LucideIcons[iconName]
  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in lucide-react`)
    return null
  }
  return <IconComponent {...props} />
}
