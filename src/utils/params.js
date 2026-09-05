export function getParamValue(params, keys, fallback = 0) {
  const list = Array.isArray(keys) ? keys : [keys]
  for (const key of list) {
    const found = params?.find(p => p.clave === key)
    if (found != null && found.valor != null && found.valor !== '') {
      const n = Number(found.valor)
      if (!Number.isNaN(n)) return n
    }
  }
  return fallback
}
