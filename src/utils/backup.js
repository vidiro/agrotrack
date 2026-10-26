// Copia de seguridad: todas las tablas en un ZIP con un JSON por tabla (y un CSV para abrir en Excel)
import { fetchAll } from './fetchAll'
import { descargarBlob } from './expedienteZip'

export const TABLAS_BACKUP = [
  'fincas', 'personal', 'maquinaria', 'params', 'labores', 'aplicaciones', 'cosechas', 'gastos_manual', 'ingresos',
  'inventario', 'destinos', 'precios_destino', 'amortizaciones', 'proveedores', 'explotacion',
  'vencimientos', 'expedientes', 'expediente_requisitos', 'expediente_gastos',
]

function aCSV(filas) {
  if (!filas.length) return ''
  const cols = [...new Set(filas.flatMap(f => Object.keys(f)))]
  const esc = (v) => {
    const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + [cols.join(';'), ...filas.map(f => cols.map(c => esc(f[c])).join(';'))].join('\n')
}

export async function descargarCopiaSeguridad(onProgreso) {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const resumen = {}
  for (const t of TABLAS_BACKUP) {
    onProgreso?.(`Copiando ${t}…`)
    const { data, error } = await fetchAll(t)
    if (error) { resumen[t] = `no disponible (${error.message})`; continue }
    resumen[t] = data.length
    zip.file(`json/${t}.json`, JSON.stringify(data, null, 1))
    zip.file(`excel/${t}.csv`, aCSV(data))
  }
  zip.file('LEEME.txt', [
    `Copia de seguridad de AGROtrack · ${new Date().toLocaleString('es-ES')}`,
    '',
    'json/: datos completos (para restaurar).',
    'excel/: las mismas tablas en CSV para abrir con Excel.',
    'Las fotos y PDF de facturas están en Supabase Storage (carpeta «documentos») y no se incluyen.',
    '',
    ...Object.entries(resumen).map(([t, n]) => `${t}: ${n}`),
  ].join('\n'))
  onProgreso?.('Comprimiendo…')
  const blob = await zip.generateAsync({ type: 'blob' })
  const d = new Date()
  descargarBlob(blob, `AGROtrack_copia_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.zip`)
  return resumen
}
