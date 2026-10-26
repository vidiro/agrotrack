// Guardar sin cobertura: si no hay conexión, el registro (y sus fotos) se guarda en el móvil
// y se envía solo cuando vuelve la señal.
import { useEffect, useState } from 'react'
import { supabase } from '../data/supabaseClient'
import { subirAdjunto, comprimirImagen } from './adjuntos'
import { guardarFoto, leerFoto, borrarFoto } from './idb'

const CLAVE = 'agrotrack-cola-envios'
const EVENTO = 'agrotrack-cola'

function leer() {
  try { return JSON.parse(localStorage.getItem(CLAVE) || '[]') } catch { return [] }
}
function escribir(lista) {
  try { localStorage.setItem(CLAVE, JSON.stringify(lista)) } catch { /* almacenamiento no disponible */ }
  window.dispatchEvent(new Event(EVENTO))
}

export function pendientesEnCola() {
  return leer().length
}

/** Lista para mostrar en pantalla lo que está esperando a enviarse */
export function elementosEnCola() {
  return leer()
}

// Un error de red (sin respuesta del servidor), no un error de datos
export function esErrorDeRed(err) {
  const msg = String(err?.message || err || '')
  return !navigator.onLine || err instanceof TypeError || /Failed to fetch|NetworkError|Load failed|network|timed out|conexión/i.test(msg)
}

// === Envío de un elemento (con fotos y operaciones compuestas) ===

async function subirFotos(datos, fotos, obtenerBlob) {
  const out = { ...datos }
  for (const f of fotos || []) {
    const blob = await obtenerBlob(f)
    if (!blob) continue
    const file = blob instanceof File ? blob : new File([blob], f.nombre || 'foto.jpg', { type: blob.type || 'image/jpeg' })
    out[f.campo] = await subirAdjunto(file, f.carpeta || 'campo')
  }
  return out
}

async function enviar(tabla, datos) {
  // Tratamiento hecho en el campo: primero la labor y luego el tratamiento ligado a ella
  if (tabla === '__tratamiento') {
    const { data, error } = await supabase.from('labores').insert([datos.labor]).select('id_labor').single()
    if (error) return { error }
    const { error: e2 } = await supabase.from('aplicaciones').insert([{ ...datos.aplicacion, id_labor: data.id_labor }])
    return { error: e2 }
  }
  const { error } = await supabase.from(tabla).insert([datos])
  return { error }
}

/**
 * Guarda en Supabase; si no hay cobertura, lo deja en cola (las fotos, en el móvil).
 * @param {object} p
 * @param {string} p.tabla - tabla, o '__tratamiento' para { labor, aplicacion }
 * @param {object} p.datos
 * @param {Array<{campo: string, file: Blob, carpeta?: string}>} [p.fotos] - fotos que se suben y cuya ruta va en datos[campo]
 * @returns {Promise<{ error: any, encolado: boolean }>}
 */
// Con muy poca cobertura una petición puede quedarse colgada: pasado este tiempo se guarda en el móvil
const ESPERA_MAX = 25000
const conLimite = (promesa) => Promise.race([
  promesa,
  new Promise((_, reject) => setTimeout(() => reject(new TypeError('Sin respuesta: network timed out')), ESPERA_MAX)),
])

export async function guardarConCola({ tabla, datos, fotos: fotosOriginales = [] }) {
  const fotos = []
  // Fotos más ligeras: se suben antes con poca cobertura y ocupan menos en el móvil mientras esperan
  for (const f of fotosOriginales) fotos.push({ ...f, file: await comprimirImagen(f.file) })
  if (navigator.onLine) {
    try {
      const listos = await conLimite(subirFotos(datos, fotos, async f => f.file))
      const { error } = await conLimite(enviar(tabla, listos))
      if (!error) return { error: null, encolado: false }
      if (!esErrorDeRed(error)) return { error, encolado: false }
    } catch (err) {
      if (!esErrorDeRed(err)) return { error: err, encolado: false }
    }
  }
  // Sin cobertura: se guarda en el móvil
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const fotosGuardadas = []
  for (const [i, f] of fotos.entries()) {
    const clave = `${id}-${i}`
    const buf = await f.file.arrayBuffer()
    await guardarFoto(clave, { buf, type: f.file.type || 'image/jpeg', name: f.file.name || 'foto.jpg' })
    fotosGuardadas.push({ campo: f.campo, carpeta: f.carpeta, clave, nombre: f.file.name })
  }
  escribir([...leer(), { id, tabla, datos, fotos: fotosGuardadas, creado: new Date().toISOString() }])
  return { error: null, encolado: true }
}

/** Compatibilidad: insertar sin fotos */
export function insertarConCola(tabla, datos) {
  return guardarConCola({ tabla, datos })
}

let procesando = false
/** Envía lo pendiente. Devuelve cuántos se enviaron. */
export async function procesarCola() {
  if (procesando || !navigator.onLine) return 0
  procesando = true
  let enviados = 0
  try {
    for (const item of leer()) {
      try {
        const datos = await subirFotos(item.datos, item.fotos, async f => {
          const g = await leerFoto(f.clave)
          return g ? new Blob([g.buf], { type: g.type }) : null
        })
        const { error } = await enviar(item.tabla, datos)
        if (error && esErrorDeRed(error)) break // sigue sin red: se reintenta luego
        if (error) {
          const fallidos = JSON.parse(localStorage.getItem(`${CLAVE}-fallidos`) || '[]')
          localStorage.setItem(`${CLAVE}-fallidos`, JSON.stringify([...fallidos, { ...item, error: error.message }]))
        } else {
          enviados++
          for (const f of item.fotos || []) await borrarFoto(f.clave).catch(() => {})
        }
        escribir(leer().filter(x => x.id !== item.id))
      } catch (err) {
        if (esErrorDeRed(err)) break
        const fallidos = JSON.parse(localStorage.getItem(`${CLAVE}-fallidos`) || '[]')
        localStorage.setItem(`${CLAVE}-fallidos`, JSON.stringify([...fallidos, { ...item, error: err.message }]))
        escribir(leer().filter(x => x.id !== item.id))
      }
    }
  } finally {
    procesando = false
  }
  if (enviados > 0) window.dispatchEvent(new CustomEvent('agrotrack-cola-enviada', { detail: enviados }))
  return enviados
}

/** Arranca el envío automático al recuperar la conexión y al volver a la app */
export function iniciarColaAutomatica() {
  window.addEventListener('online', () => { procesarCola() })
  // En iPhone no hay envío en segundo plano: se intenta cada vez que se vuelve a abrir la app
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') procesarCola() })
  procesarCola()
}

/** Estado para la interfaz: registros pendientes y si hay conexión */
export function useColaPendiente() {
  const [pendientes, setPendientes] = useState(pendientesEnCola)
  const [enLinea, setEnLinea] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const act = () => { setPendientes(pendientesEnCola()); setEnLinea(navigator.onLine) }
    window.addEventListener(EVENTO, act)
    window.addEventListener('online', act)
    window.addEventListener('offline', act)
    return () => {
      window.removeEventListener(EVENTO, act)
      window.removeEventListener('online', act)
      window.removeEventListener('offline', act)
    }
  }, [])
  return { pendientes, enLinea }
}
