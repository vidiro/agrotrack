/**
 * Helper para renderizar iconos de lucide-react por nombre.
 * Importaciones explícitas (no `import *`) para que el bundle solo incluya los iconos usados.
 * Para añadir un icono nuevo: impórtalo aquí y añádelo a ICONS.
 */
import {
  Home, ClipboardList, Grape, Wallet, BarChart3, SprayCan, Receipt, Banknote,
  Factory, MapPin, FileText, Users, Tractor, Wrench, Package, Settings,
  Sun, Moon, LogOut, Menu, X, MoreHorizontal, RefreshCw, Eye,
  EyeOff, FileSpreadsheet, Sprout, FolderOpen, CalendarClock, BookOpen, Clock, Briefcase,
  Contrast, CloudOff, Camera, Paperclip, ListChecks, DatabaseBackup, AlertTriangle, ChevronRight,
  CheckCircle2, ChevronLeft, StickyNote, Circle, Trash2, PlusCircle, Plus,
} from 'lucide-react'

const ICONS = {
  Home, ClipboardList, Grape, Wallet, BarChart3, SprayCan, Receipt, Banknote,
  Factory, MapPin, FileText, Users, Tractor, Wrench, Package, Settings,
  Sun, Moon, LogOut, Menu, X, MoreHorizontal, RefreshCw, Eye,
  EyeOff, FileSpreadsheet, Sprout, FolderOpen, CalendarClock, BookOpen, Clock, Briefcase,
  Contrast, CloudOff, Camera, Paperclip, ListChecks, DatabaseBackup, AlertTriangle, ChevronRight,
  CheckCircle2, ChevronLeft, StickyNote, Circle, Trash2, PlusCircle, Plus,
}

export function getIcon(name, props = {}) {
  const IconComponent = ICONS[name]
  if (!IconComponent) {
    if (import.meta.env.DEV) console.warn(`Icono "${name}" no registrado en utils/lucideIcons.jsx`)
    return null
  }
  return <IconComponent aria-hidden="true" {...props} />
}
