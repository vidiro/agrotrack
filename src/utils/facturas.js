// Datos de factura de un gasto (columnas num_factura, proveedor, nif_proveedor en gastos_manual)

export const CAMPOS_FACTURA = ['num_factura', 'proveedor', 'nif_proveedor']

/** ¿El gasto tiene datos de factura? */
export function esFactura(g) {
  return Boolean((g?.num_factura || '').trim() || (g?.proveedor || '').trim() || (g?.nif_proveedor || '').trim())
}

/** NIF/CIF sin símbolos, solo para comparar y validar (no es lo que se guarda) */
export function normalizarNIF(nif) {
  // Quita espacios, puntos, guiones, barras y cualquier otro símbolo: «B96/934120» → «B96934120»
  let n = String(nif || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  // NIF-IVA intracomunitario español: «ESB96934120» → «B96934120»
  if (n.length === 11 && n.startsWith('ES')) n = n.slice(2)
  return n
}

/**
 * NIF/CIF tal como se escribe (p. ej. «B-96/934120»): se respeta el formato, solo se quitan
 * espacios sobrantes y se pasa a mayúsculas. Es lo que se guarda.
 * normalizarNIF() se usa únicamente para comparar y validar.
 */
export function limpiarNIF(nif) {
  return String(nif || '').trim().replace(/\s+/g, ' ').toUpperCase()
}

const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE'

/**
 * Comprueba el formato y la letra/dígito de control de un NIF español (DNI, NIE o CIF de empresa).
 * Devuelve true si es válido. Solo se usa para avisar, nunca bloquea el guardado.
 */
export function nifValido(nifRaw) {
  const nif = normalizarNIF(nifRaw)
  if (!nif) return true // vacío: no hay nada que validar

  // DNI: 8 dígitos + letra
  if (/^\d{8}[A-Z]$/.test(nif)) {
    return LETRAS_DNI[parseInt(nif.slice(0, 8), 10) % 23] === nif[8]
  }
  // NIE: X/Y/Z + 7 dígitos + letra
  if (/^[XYZ]\d{7}[A-Z]$/.test(nif)) {
    const num = 'XYZ'.indexOf(nif[0]) + nif.slice(1, 8)
    return LETRAS_DNI[parseInt(num, 10) % 23] === nif[8]
  }
  // CIF: letra + 7 dígitos + control (dígito o letra)
  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(nif)) {
    const digitos = nif.slice(1, 8)
    let pares = 0
    let impares = 0
    for (let i = 0; i < 7; i++) {
      const d = parseInt(digitos[i], 10)
      if (i % 2 === 0) {
        const doble = d * 2
        impares += Math.floor(doble / 10) + (doble % 10)
      } else {
        pares += d
      }
    }
    const control = (10 - ((pares + impares) % 10)) % 10
    const letraControl = 'JABCDEFGHI'[control]
    const ultimo = nif[8]
    if ('PQRSNW'.includes(nif[0])) return ultimo === letraControl
    if ('ABEH'.includes(nif[0])) return ultimo === String(control)
    return ultimo === String(control) || ultimo === letraControl
  }
  return false
}

/** Clave para detectar facturas repetidas: mismo emisor + mismo número */
export function claveFactura(g) {
  const emisor = normalizarNIF(g.nif_proveedor) || String(g.proveedor || '').trim().toLowerCase()
  const num = String(g.num_factura || '').trim().toUpperCase()
  return emisor && num ? `${emisor}|${num}` : null
}

/** Empresas ya usadas (para autocompletar), con su NIF más reciente */
export function empresasConocidas(gastos = []) {
  const mapa = new Map()
  for (const g of [...gastos].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))) {
    const nombre = String(g.proveedor || '').trim()
    if (!nombre) continue
    mapa.set(nombre.toLowerCase(), { proveedor: nombre, nif_proveedor: g.nif_proveedor || mapa.get(nombre.toLowerCase())?.nif_proveedor || '' })
  }
  return [...mapa.values()].sort((a, b) => a.proveedor.localeCompare(b.proveedor, 'es'))
}

/** Mensaje claro si falta la migración v1.6 */
export function mensajeErrorFactura(err) {
  const msg = err?.message || String(err)
  if (CAMPOS_FACTURA.some(c => msg.includes(c))) {
    return 'Para guardar datos de factura hay que aplicar la migración docs/SQL_migracion_v1.6_facturas.sql en Supabase.'
  }
  return msg
}
