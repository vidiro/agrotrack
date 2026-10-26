// Copia en el móvil de los datos básicos (fincas, personal, máquinas, ajustes…) y de los catálogos
// que usan los asistentes del campo, para poder apuntar sin cobertura.

const CLAVE_BASE = 'agrotrack-copia-base'
const CLAVE_CATALOGOS = 'agrotrack-catalogos'
const CLAVE_RECIENTES = 'agrotrack-recientes'

const leerJSON = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def } catch { return def } }
const escribirJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* sin espacio o sin permiso */ } }

export function guardarCopiaLocal(datos) {
  escribirJSON(CLAVE_BASE, { fecha: new Date().toISOString(), datos })
}
export function leerCopiaLocal() {
  return leerJSON(CLAVE_BASE, null)
}

/** Catálogos para autocompletar en el campo: productos usados, plagas, aplicadores… */
export function guardarCatalogos(c) {
  escribirJSON(CLAVE_CATALOGOS, { fecha: new Date().toISOString(), ...c })
}
export function leerCatalogos() {
  return leerJSON(CLAVE_CATALOGOS, { productos: [], plagas: [], conceptos: [] })
}

/** Últimas elecciones (finca, peones, máquina…) para no repetir toques */
export function leerRecientes() {
  return leerJSON(CLAVE_RECIENTES, {})
}
export function recordar(clave, valor) {
  const r = leerRecientes()
  r[clave] = valor
  escribirJSON(CLAVE_RECIENTES, r)
}
/** Añade un id al principio de una lista de «usados recientemente» (máx. 8) */
export function recordarUso(clave, id) {
  const r = leerRecientes()
  const lista = [String(id), ...(r[clave] || []).filter(x => x !== String(id))].slice(0, 8)
  r[clave] = lista
  escribirJSON(CLAVE_RECIENTES, r)
}
