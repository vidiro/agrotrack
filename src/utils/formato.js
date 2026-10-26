// Formatos comunes (es-ES). toLocaleString('es-ES') no agrupa cifras de 4 dígitos (7500), por eso se hace a mano.

export function eur(v, decimales = 2) {
  const n = parseFloat(v) || 0
  const [ent, dec] = Math.abs(n).toFixed(decimales).split('.')
  const miles = ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${n < 0 ? '−' : ''}${miles}${dec ? ',' + dec : ''} €`
}

export function fechaES(f) {
  if (!f) return '-'
  const s = String(f)
  return `${s.substring(8, 10)}/${s.substring(5, 7)}/${s.substring(0, 4)}`
}

export function hoyISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Suma años a una fecha yyyy-MM-dd (para renovar vencimientos) */
export function sumarAnios(fecha, anios = 1) {
  const s = String(fecha || hoyISO())
  const y = parseInt(s.substring(0, 4), 10) + anios
  let mmdd = s.substring(4, 10)
  if (mmdd === '-02-29') mmdd = '-02-28'
  return `${y}${mmdd}`
}

/** Nombre de archivo seguro */
export function nombreArchivo(texto) {
  return String(texto || 'archivo')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80) || 'archivo'
}
