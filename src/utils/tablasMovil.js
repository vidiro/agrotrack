// En el móvil, las tablas (.data-table) se muestran como tarjetas: cada celda lleva
// el nombre de su columna. Este observador añade esas etiquetas (data-label) a todas
// las tablas de la app sin tener que tocar cada página.
// Para que una tabla NO se convierta en tarjetas, añádele la clase «sin-tarjetas».

function etiquetarTabla(tabla) {
  if (tabla.classList.contains('sin-tarjetas')) return
  const cabeceras = [...tabla.querySelectorAll('thead th')].map(th => th.textContent.trim())
  if (cabeceras.length === 0) return
  tabla.classList.add('tarjetas')
  for (const fila of tabla.querySelectorAll('tbody tr')) {
    let col = 0
    for (const celda of fila.children) {
      const etiqueta = cabeceras[col] ?? ''
      if (celda.getAttribute('data-label') !== etiqueta) celda.setAttribute('data-label', etiqueta)
      col += parseInt(celda.getAttribute('colspan') || '1', 10)
    }
  }
}

function etiquetarTodo(raiz = document) {
  raiz.querySelectorAll?.('table.data-table').forEach(etiquetarTabla)
}

export function iniciarTablasMovil() {
  if (typeof window === 'undefined' || !('MutationObserver' in window)) return
  let pendiente = false
  const obs = new MutationObserver(() => {
    if (pendiente) return
    pendiente = true
    requestAnimationFrame(() => {
      pendiente = false
      etiquetarTodo()
    })
  })
  obs.observe(document.body, { childList: true, subtree: true })
  etiquetarTodo()
}
