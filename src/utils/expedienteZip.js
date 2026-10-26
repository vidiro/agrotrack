// Genera el expediente de una ayuda en un ZIP: índice en PDF + facturas + justificantes + documentos
import { descargarAdjunto, extensionDe } from './adjuntos'
import { eur, fechaES, nombreArchivo } from './formato'

function csv(filas) {
  const esc = (v) => {
    const s = String(v ?? '')
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  // Punto y coma: Excel en español lo abre en columnas
  return '﻿' + filas.map(f => f.map(esc).join(';')).join('\n')
}

/**
 * @param {object} p
 * @param {object} p.expediente
 * @param {Array} p.requisitos
 * @param {Array} p.facturas - gastos vinculados
 * @param {(id) => string} p.nombreFinca
 * @param {(msg: string) => void} [p.onProgreso]
 * @returns {Promise<{ blob: Blob, nombre: string, faltan: string[] }>}
 */
export async function generarExpedienteZip({ expediente, requisitos, facturas, nombreFinca, onProgreso }) {
  const [{ default: JSZip }, { jsPDF }, { applyPlugin }] = await Promise.all([
    import('jszip'), import('jspdf'), import('jspdf-autotable'),
  ])
  applyPlugin(jsPDF)
  const zip = new JSZip()
  const faltan = []
  const ordenadas = [...facturas].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))

  // === Adjuntos ===
  const nombres = new Map() // id_gasto -> { factura, pago }
  let i = 0
  for (const f of ordenadas) {
    i++
    const pref = `${String(i).padStart(2, '0')}_${nombreArchivo(f.num_factura || 'sin-num')}_${nombreArchivo(f.proveedor || 'empresa')}`
    const reg = {}
    if (f.adjunto_path) {
      onProgreso?.(`Añadiendo factura ${i} de ${ordenadas.length}…`)
      try {
        const blob = await descargarAdjunto(f.adjunto_path)
        reg.factura = `facturas/${pref}.${extensionDe(f.adjunto_path) || 'jpg'}`
        zip.file(reg.factura, blob)
      } catch { faltan.push(`No se pudo descargar la foto de la factura ${f.num_factura || i}`) }
    } else {
      faltan.push(`Factura ${f.num_factura || i} (${f.proveedor || 'sin empresa'}) sin foto o PDF`)
    }
    if (f.justificante_pago_path) {
      try {
        const blob = await descargarAdjunto(f.justificante_pago_path)
        reg.pago = `justificantes_pago/${pref}_pago.${extensionDe(f.justificante_pago_path) || 'pdf'}`
        zip.file(reg.pago, blob)
      } catch { faltan.push(`No se pudo descargar el justificante de pago de la factura ${f.num_factura || i}`) }
    } else {
      faltan.push(`Factura ${f.num_factura || i} sin justificante de pago`)
    }
    if (!f.nif_proveedor) faltan.push(`Factura ${f.num_factura || i} sin CIF de la empresa`)
    nombres.set(f.id_gasto, reg)
  }

  let j = 0
  for (const r of requisitos) {
    j++
    if (r.adjunto_path) {
      try {
        const blob = await descargarAdjunto(r.adjunto_path)
        zip.file(`documentos/${String(j).padStart(2, '0')}_${nombreArchivo(r.texto)}.${extensionDe(r.adjunto_path) || 'pdf'}`, blob)
      } catch { faltan.push(`No se pudo descargar el documento «${r.texto}»`) }
    }
    if (!r.hecho) faltan.push(`Pendiente: ${r.texto}`)
  }

  // === Índice en PDF ===
  onProgreso?.('Preparando el índice…')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  doc.setFillColor(31, 77, 51)
  doc.rect(0, 0, W, 30, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.text(expediente.nombre || 'Expediente de ayuda', 14, 14)
  doc.setFontSize(10)
  doc.text([expediente.organismo, expediente.convocatoria].filter(Boolean).join(' · ') || ' ', 14, 22)
  doc.setTextColor(30, 30, 30)

  const total = ordenadas.reduce((s, f) => s + (parseFloat(f.importe) || 0), 0)
  doc.autoTable({
    startY: 38,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } },
    body: [
      ['Estado', expediente.estado || '-'],
      ['Fecha límite', fechaES(expediente.fecha_limite)],
      ['Finca', expediente.id_finca ? nombreFinca(expediente.id_finca) : 'General'],
      ['Importe solicitado', expediente.importe_solicitado ? eur(expediente.importe_solicitado) : '-'],
      ['Facturas', `${ordenadas.length} · total ${eur(total)}`],
      ['Generado', new Date().toLocaleString('es-ES')],
    ],
    margin: { left: 14, right: 14 },
  })

  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 6,
    head: [['Nº', 'Fecha', 'Nº factura', 'Empresa', 'CIF', 'Concepto', 'Importe', 'Pagada']],
    body: ordenadas.map((f, k) => [
      String(k + 1).padStart(2, '0'), fechaES(f.fecha), f.num_factura || '-', f.proveedor || '-', f.nif_proveedor || '-',
      f.concepto || '-', eur(f.importe), f.fecha_pago ? fechaES(f.fecha_pago) : (f.justificante_pago_path ? 'Sí' : '-'),
    ]),
    foot: [['', '', '', '', '', 'TOTAL', eur(total), '']],
    theme: 'grid',
    headStyles: { fillColor: [31, 77, 51], fontSize: 7.5 },
    footStyles: { fillColor: [240, 240, 235], textColor: 20, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 7, cellPadding: 1.6 },
    columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 18 }, 2: { cellWidth: 22 }, 3: { cellWidth: 32 }, 4: { cellWidth: 20 }, 5: { cellWidth: 44 }, 6: { cellWidth: 20, halign: 'right' }, 7: { cellWidth: 18 } },
    margin: { left: 14, right: 14 },
  })

  if (requisitos.length) {
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 6,
      head: [['Documentación', 'Estado']],
      body: requisitos.map(r => [r.texto, r.hecho ? 'Hecho' : 'Pendiente']),
      theme: 'grid',
      headStyles: { fillColor: [31, 77, 51], fontSize: 8 },
      bodyStyles: { fontSize: 8, cellPadding: 1.8 },
      columnStyles: { 1: { cellWidth: 28 } },
      margin: { left: 14, right: 14 },
    })
  }

  if (faltan.length) {
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 6,
      head: [['Revisar antes de presentar']],
      body: faltan.map(t => [t]),
      theme: 'grid',
      headStyles: { fillColor: [166, 58, 43], fontSize: 8 },
      bodyStyles: { fontSize: 8, cellPadding: 1.8 },
      margin: { left: 14, right: 14 },
    })
  }

  zip.file('00_INDICE.pdf', doc.output('blob'))
  zip.file('facturas.csv', csv([
    ['Nº', 'Fecha', 'Nº factura', 'Empresa', 'CIF', 'Concepto', 'Importe', 'Fecha de pago', 'Archivo factura', 'Archivo pago'],
    ...ordenadas.map((f, k) => {
      const r = nombres.get(f.id_gasto) || {}
      return [k + 1, fechaES(f.fecha), f.num_factura || '', f.proveedor || '', f.nif_proveedor || '', f.concepto || '', (parseFloat(f.importe) || 0).toFixed(2).replace('.', ','), f.fecha_pago ? fechaES(f.fecha_pago) : '', r.factura || '', r.pago || '']
    }),
  ]))

  onProgreso?.('Comprimiendo…')
  const blob = await zip.generateAsync({ type: 'blob' })
  return { blob, nombre: `Expediente_${nombreArchivo(expediente.nombre)}.zip`, faltan }
}

export function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
