// Almacén mínimo en IndexedDB para guardar fotos en el móvil mientras no hay cobertura
// (localStorage no admite archivos y tiene poco espacio).

const DB = 'agrotrack'
const STORE = 'fotos'

function abrir() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('Este navegador no permite guardar fotos sin conexión')); return }
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE) }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function operar(modo, fn) {
  const db = await abrir()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, modo)
    const req = fn(tx.objectStore(STORE))
    tx.oncomplete = () => { db.close(); resolve(req?.result) }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export const guardarFoto = (clave, blob) => operar('readwrite', s => s.put(blob, clave))
export const leerFoto = (clave) => operar('readonly', s => s.get(clave))
export const borrarFoto = (clave) => operar('readwrite', s => s.delete(clave))
