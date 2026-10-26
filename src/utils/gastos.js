// Gastos de categoría «Inversión» (compra de tierra, plantación, maquinaria…):
// se siguen registrando y listando en Gastos (justificación de ayudas, contabilidad),
// pero NO son coste corriente de la campaña: se excluyen de balances y costes
// y cuentan como inversión de su finca en la recuperación de la inversión.

const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

export function esGastoInversion(g) {
  return normalizar(g?.categoria) === 'inversion'
}

/** Gastos corrientes (sin inversiones) */
export function gastosCorrientes(list = []) {
  return list.filter(g => !esGastoInversion(g))
}

/** Gastos de inversión */
export function gastosInversion(list = []) {
  return list.filter(esGastoInversion)
}
