// Fotos y PDF de facturas, justificantes y documentos (Supabase Storage, carpeta privada «documentos»)
import { supabase } from '../data/supabaseClient'
import { nombreArchivo } from './formato'

export const BUCKET = 'documentos'

/** Reduce fotos grandes (las del móvil pesan 3-6 MB) a ~2000 px en JPEG */
export async function comprimirImagen(file, maxLado = 2000, calidad = 0.82) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  try {
    const bitmap = await createImageBitmap(file)
    const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height))
    if (escala === 1 && file.size < 1.5 * 1024 * 1024) return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * escala)
    canvas.height = Math.round(bitmap.height * escala)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', calidad))
    return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file
  } catch {
    return file
  }
}

/**
 * Sube un archivo y devuelve su ruta dentro del bucket.
 * @param {File} file
 * @param {string} carpeta - p. ej. 'facturas/2026'
 */
export async function subirAdjunto(file, carpeta = 'varios') {
  const preparado = await comprimirImagen(file)
  const ext = (preparado.name.match(/\.(\w+)$/)?.[1] || 'bin').toLowerCase()
  const base = nombreArchivo(preparado.name.replace(/\.\w+$/, ''))
  const ruta = `${carpeta}/${Date.now()}_${base}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(ruta, preparado, { contentType: preparado.type || undefined, upsert: false })
  if (error) {
    if (/bucket/i.test(error.message || '') || error.statusCode === '404') {
      throw new Error('Para guardar fotos y documentos hay que aplicar la migración docs/SQL_migracion_v1.8_papeleo.sql en Supabase.')
    }
    throw error
  }
  return ruta
}

/** Enlace temporal (1 hora) para ver un adjunto */
export async function urlAdjunto(ruta, segundos = 3600) {
  if (!ruta) return null
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ruta, segundos)
  if (error) throw error
  return data.signedUrl
}

/** Abre el adjunto en una pestaña nueva */
export async function abrirAdjunto(ruta) {
  // Se abre la ventana antes del await para que el navegador no la bloquee
  const ventana = window.open('', '_blank')
  try {
    const url = await urlAdjunto(ruta)
    if (ventana) ventana.location.href = url
    else window.location.href = url
  } catch (err) {
    ventana?.close()
    throw err
  }
}

/** Descarga el contenido (para meterlo en un ZIP) */
export async function descargarAdjunto(ruta) {
  const { data, error } = await supabase.storage.from(BUCKET).download(ruta)
  if (error) throw error
  return data // Blob
}

export async function borrarAdjunto(ruta) {
  if (!ruta) return
  await supabase.storage.from(BUCKET).remove([ruta])
}

export function extensionDe(ruta) {
  return (String(ruta).match(/\.(\w+)$/)?.[1] || '').toLowerCase()
}
