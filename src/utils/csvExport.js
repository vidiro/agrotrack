/**
 * Utilidad para exportar datos a CSV
 * @param {string} filename - Nombre del archivo
 * @param {string[]} headers - Encabezados de columnas
 * @param {Object[]} rows - Filas de datos (array de objetos)
 */
export function downloadCSV(filename, headers, rows) {
  // Crear contenido CSV
  const escape = (val) => {
    const str = String(val ?? '')
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str
  }

  const csvContent = [
    headers.map(escape).join(','),
    ...rows.map(row => headers.map(h => escape(row[h])).join(','))
  ].join('\n')

  // Crear blob y descargar
  const BOM = '\uFEFF' // BOM para Excel
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
