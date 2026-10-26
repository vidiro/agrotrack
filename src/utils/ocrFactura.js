// Lectura automática de facturas a partir de una foto (Tesseract, en el propio móvil/ordenador;
// la imagen no se envía a ningún servicio externo). Los datos de idioma se descargan la primera vez.
import { normalizarNIF, nifValido } from './facturas'

/** Convierte "1.234,56" / "1234.56" / "1 234,56" en número */
export function parseImporte(txt) {
  let s = String(txt).replace(/[€\s]/g, '').replace(/[Oo]/g, '0')
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
  else if (/\.\d{1,2}$/.test(s)) s = s.replace(/,/g, '')
  else s = s.replace(/[.,]/g, '')
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

function fechaISO(d, m, a) {
  let y = parseInt(a, 10)
  if (y < 100) y += 2000
  const mm = parseInt(m, 10)
  const dd = parseInt(d, 10)
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || y < 2000 || y > 2100) return null
  return `${y}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

/**
 * Extrae los datos de una factura del texto leído.
 * @param {string} texto
 * @param {string[]} nifsPropios - NIF del propio agricultor, para no confundirlo con el de la empresa
 * @returns {{ nif_proveedor?: string, num_factura?: string, fecha?: string, importe?: number }}
 */
export function extraerDatosFactura(texto, nifsPropios = []) {
  const t = String(texto || '').replace(/\r/g, '')
  const lineas = t.split('\n').map(l => l.trim()).filter(Boolean)
  const res = {}
  const propios = new Set(nifsPropios.map(normalizarNIF))

  // CIF/NIF: primero los que van tras «CIF/NIF», luego cualquiera válido
  const candidatos = []
  const reEtiqueta = /(?:C\.?\s?I\.?\s?F\.?|N\.?\s?I\.?\s?F\.?|NIF|CIF|VAT)\s*[:.\-]?\s*(?:ES)?\s*([A-Z0-9][\s.\-]?\d{7}[\s.\-]?[A-Z0-9]|\d{8}[\s.\-]?[A-Z])/gi
  for (const m of t.matchAll(reEtiqueta)) candidatos.push(m[1])
  for (const m of t.matchAll(/\b([ABCDEFGHJNPQRSUVW][\s.\-]?\d{7}[\s.\-]?[0-9A-J]|[XYZ]\d{7}[A-Z]|\d{8}[\s.\-]?[A-Z])\b/g)) candidatos.push(m[1])
  const nif = candidatos.map(normalizarNIF).find(n => nifValido(n) && !propios.has(n))
    || candidatos.map(normalizarNIF).find(n => n.length === 9 && !propios.has(n))
  if (nif) res.nif_proveedor = nif

  // Nº de factura
  const reNum = /(?:factura|fra\.?|invoice|n[º°o]\.?\s*(?:de\s*)?factura|n[úu]m(?:ero)?\.?\s*(?:de\s*)?factura)\s*(?:n[º°o.]|n[úu]m(?:ero)?\.?)?\s*[:#.\-]?\s*([A-Z0-9][A-Z0-9/.\-_]{2,24})/i
  for (const l of lineas) {
    const m = l.match(reNum)
    if (m && /\d/.test(m[1]) && !/^(19|20)\d{2}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(m[1])) {
      res.num_factura = m[1].replace(/[.\-]$/, '')
      break
    }
  }

  // Fecha: la que va tras «fecha», o la primera que aparezca
  const reFecha = /(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/
  const lineaFecha = lineas.find(l => /fecha/i.test(l) && reFecha.test(l)) || lineas.find(l => reFecha.test(l))
  if (lineaFecha) {
    const m = lineaFecha.match(reFecha)
    const f = m && fechaISO(m[1], m[2], m[3])
    if (f) res.fecha = f
  }

  // Importe total: líneas con «total» (no «subtotal»/«base»), el mayor importe
  const reImporte = /(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})|\d+(?:[.,]\d{2}))\s*€?/g
  const importesDe = (l) => [...l.matchAll(reImporte)].map(m => parseImporte(m[1])).filter(n => n != null && n > 0)
  const lineasTotal = lineas.filter(l => /total/i.test(l) && !/sub\s*total|base/i.test(l))
  let total = Math.max(0, ...lineasTotal.flatMap(importesDe))
  if (!total) total = Math.max(0, ...lineas.filter(l => /€|eur/i.test(l)).flatMap(importesDe))
  if (total) res.importe = Math.round(total * 100) / 100

  return res
}

let workerPromesa = null
let progresoActual = null
async function obtenerWorker() {
  if (!workerPromesa) {
    workerPromesa = (async () => {
      const { createWorker } = await import('tesseract.js')
      return createWorker('spa', 1, {
        logger: (m) => { if (m.status === 'recognizing text') progresoActual?.(m.progress) },
      })
    })().catch(err => { workerPromesa = null; throw err })
  }
  return workerPromesa
}

/**
 * Lee una foto de factura y devuelve los datos encontrados (los que no encuentre, no vienen).
 * @param {File|Blob} imagen
 */
export async function leerFactura(imagen, { onProgreso, nifsPropios } = {}) {
  progresoActual = onProgreso
  const worker = await obtenerWorker()
  const { data } = await worker.recognize(imagen)
  progresoActual = null
  return { ...extraerDatosFactura(data.text, nifsPropios), texto: data.text }
}
