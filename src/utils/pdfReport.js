import { jsPDF } from 'jspdf'
import { applyPlugin } from 'jspdf-autotable'
import { esAmortizable, cuotaMensual } from './inversion'
import { esGastoInversion } from './gastos'
applyPlugin(jsPDF)

/**
 * Generate a comprehensive economic report PDF
 * @param {Object} opts - Report options
 * @returns {jsPDF} - PDF document ready to save
 */
export function generateReportPDF(opts) {
  const {
    title,
    periodLabel,
    periodType,
    selectedYear,
    totales,
    gastosPorCategoria,
    ingresosPorOrigen,
    evolucionMensual,
    produccionPorFinca,
    costesPorFinca,
    ingresosDetallados,
    gastosDetallados,
    laboresDetalladas,
    cosechasDetalladas,
    amortizaciones,
    fincas,
    varIngresos,
    varGastos,
    varProduccion,
    periodoAnterior,
    totalInversiones = 0,
  } = opts

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  let y = 20

  // === COLORS ===
  const GREEN = [26, 71, 42]
  const GOLD = [212, 160, 23]
  const RED = [192, 57, 43]
  const BLUE = [41, 128, 185]
  const DARK = [30, 30, 30]
  const GRAY = [100, 100, 100]
  const LIGHT_BG = [245, 247, 243]

  // === HEADER ===
  doc.setFillColor(...GREEN)
  doc.rect(0, 0, pageWidth, 40, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.text('AGROtrack', 14, 18)

  doc.setFontSize(12)
  doc.text(title, 14, 27)

  doc.setFontSize(10)
  doc.text(periodLabel, 14, 34)

  // Date
  doc.setFontSize(8)
  const now = new Date()
  const dateStr = now.toLocaleDateString('es-ES') + ' ' + now.toLocaleTimeString('es-ES')
  doc.text(dateStr, pageWidth - 14, 34, { align: 'right' })

  y = 50

  // === HELPER FUNCTIONS ===
  const sectionTitle = (text, color = GREEN) => {
    if (y > 260) { doc.addPage(); y = 20 }
    doc.setFillColor(...LIGHT_BG)
    doc.rect(14, y - 4, pageWidth - 28, 10, 'F')
    doc.setDrawColor(...color)
    doc.setLineWidth(0.5)
    doc.line(14, y + 6, pageWidth - 14, y + 6)
    doc.setTextColor(...color)
    doc.setFontSize(13)
    doc.text(text, 18, y + 2)
    y += 14
  }

  const normalText = () => {
    doc.setTextColor(...DARK)
    doc.setFontSize(9)
  }

  // === SUMMARY TABLE ===
  sectionTitle('Resumen General')

  const summaryData = [
    ['Ingresos', totales.totalIngresos.toFixed(2) + ' €', totales.numIngresos + ' registros'],
    ['Gastos directos', totales.totalGastos.toFixed(2) + ' €', totales.numGastos + ' registros'],
    ['Costes labores', totales.totalCostesLabores.toFixed(2) + ' €', totales.numLabores + ' registros'],
    ['  - Salarios', totales.totalCostePeones.toFixed(2) + ' €', ''],
    ['  - Maquinaria', totales.totalCosteMaquinaria.toFixed(2) + ' €', ''],
    ['  - Gasóleo', totales.totalCosteGasoil.toFixed(2) + ' €', ''],
    ['Producción', totales.totalProduccion.toFixed(0) + ' kg', totales.numCosechas + ' cosechas'],
  ]

  const balColor = totales.balance >= 0 ? GREEN : RED
  let balanceRowIndex = -1
  // Solo texto: la fuente estándar de jsPDF no incluye emojis ni flechas
  const balLabel = totales.balance >= 0 ? 'Superávit' : 'Déficit'
  balanceRowIndex = summaryData.length
  summaryData.push([
    'BALANCE',
    (totales.balance >= 0 ? '+' : '') + totales.balance.toFixed(2) + ' €',
    balLabel
  ])

  // Inversiones: se informan, pero no restan en el balance
  if (totalInversiones > 0) {
    summaryData.push(['Inversiones (no restan)', totalInversiones.toFixed(2) + ' €', 'Ver detalle de gastos'])
  }

  doc.autoTable({
    startY: y,
    head: [['Concepto', 'Importe', 'Detalle']],
    body: summaryData,
    theme: 'grid',
    headStyles: { fillColor: GREEN, fontSize: 9 },
    bodyStyles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 58 },
      1: { halign: 'right', cellWidth: 52 },
      2: { halign: 'left', cellWidth: 64 },
    },
    didParseCell: function(data) {
      if (data.section === 'body' && data.row.index === balanceRowIndex) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = totales.balance >= 0 ? [232, 245, 233] : [254, 226, 226]
        data.cell.styles.textColor = balColor
      }
    },
    margin: { left: 18, right: 18 },
  })

  y = doc.lastAutoTable.finalY + 8

  // === VARIATION vs ANTERIOR ===
  if (periodoAnterior && (periodoAnterior.ingresos > 0 || periodoAnterior.gastos > 0)) {
    sectionTitle('Variación vs Período Anterior')
    const varData = [
      ['Ingresos', (varIngresos.positive ? '+' : '') + varIngresos.pct.toFixed(1) + '%', varIngresos.positive ? 'Mejor' : 'Peor'],
      ['Gastos + Costes', (varGastos.positive ? '+' : '') + varGastos.pct.toFixed(1) + '%', !varGastos.positive ? 'Menos gasto' : 'Más gasto'],
      ['Producción', (varProduccion.positive ? '+' : '') + varProduccion.pct.toFixed(1) + '%', varProduccion.positive ? 'Más producción' : 'Menos producción'],
    ]
    doc.autoTable({
      startY: y,
      head: [['Concepto', 'Variación', 'Interpretación']],
      body: varData,
      theme: 'grid',
      headStyles: { fillColor: BLUE, fontSize: 9 },
      bodyStyles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { halign: 'right', cellWidth: 45 },
        2: { halign: 'left', cellWidth: 80 },
      },
      didParseCell: function(data) {
        if (data.column.index === 1) {
          const val = data.cell.raw
          const isPositive = String(val).includes('+')
          if (data.row.index === 0) data.cell.styles.textColor = isPositive ? GREEN : RED
          if (data.row.index === 1) data.cell.styles.textColor = !isPositive ? GREEN : RED
          if (data.row.index === 2) data.cell.styles.textColor = isPositive ? GREEN : RED
        }
      },
      margin: { left: 18, right: 18 },
    })
    y = doc.lastAutoTable.finalY + 8
  }

  // === GASTOS POR CATEGORÍA ===
  if (gastosPorCategoria && gastosPorCategoria.length > 0) {
    sectionTitle('Distribución de Gastos por Categoría')

    const totalGastosCostes = totales.totalGastos + totales.totalCostesLabores

    doc.autoTable({
      startY: y,
      head: [['Categoría', 'Importe', '% del total']],
      body: gastosPorCategoria.map(g => {
        const pct = totalGastosCostes > 0 ? ((g.valor / totalGastosCostes) * 100).toFixed(1) : '0.0'
        return [g.nombre, g.valor.toFixed(2) + ' €', pct + '%']
      }),
      theme: 'grid',
      headStyles: { fillColor: GREEN, fontSize: 8 },
      bodyStyles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { halign: 'right', cellWidth: 45 },
        2: { halign: 'right', cellWidth: 40 },
      },
      margin: { left: 18, right: 18 },
    })
    y = doc.lastAutoTable.finalY + 8
  }

  // === INGRESOS POR ORIGEN ===
  if (ingresosPorOrigen && ingresosPorOrigen.length > 0) {
    sectionTitle('Distribución de Ingresos por Origen', BLUE)

    doc.autoTable({
      startY: y,
      head: [['Origen', 'Importe', '% del total']],
      body: ingresosPorOrigen.map(i => {
        const pct = totales.totalIngresos > 0 ? ((i.valor / totales.totalIngresos) * 100).toFixed(1) : '0.0'
        return [i.nombre, i.valor.toFixed(2) + ' €', pct + '%']
      }),
      theme: 'grid',
      headStyles: { fillColor: BLUE, fontSize: 8 },
      bodyStyles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { halign: 'right', cellWidth: 45 },
        2: { halign: 'right', cellWidth: 40 },
      },
      margin: { left: 18, right: 18 },
    })
    y = doc.lastAutoTable.finalY + 8
  }

  // === EVOLUCIÓN MENSUAL ===
  if (evolucionMensual && evolucionMensual.length > 0) {
    sectionTitle('Evolución Mensual')

    doc.autoTable({
      startY: y,
      head: [['Mes', 'Ingresos', 'Gastos + Costes', 'Balance', 'Producción (kg)']],
      body: evolucionMensual.map(m => {
        const bal = m.ingresos - m.gastos
        return [
          m.mes,
          m.ingresos.toFixed(2) + ' €',
          m.gastos.toFixed(2) + ' €',
          (bal >= 0 ? '+' : '') + bal.toFixed(2) + ' €',
          m.produccion.toFixed(0)
        ]
      }),
      theme: 'grid',
      headStyles: { fillColor: GREEN, fontSize: 8 },
      bodyStyles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { halign: 'right', cellWidth: 35 },
        2: { halign: 'right', cellWidth: 35 },
        3: { halign: 'right', cellWidth: 35 },
        4: { halign: 'right', cellWidth: 30 },
      },
      didParseCell: function(data) {
        if (data.column.index === 3 && data.section === 'body') {
          const val = parseFloat(data.cell.raw)
          data.cell.styles.textColor = val >= 0 ? GREEN : RED
        }
      },
      margin: { left: 18, right: 18 },
    })
    y = doc.lastAutoTable.finalY + 10
  }

  // === PRODUCCIÓN POR FINCA (separada por cultivo) ===
  if (produccionPorFinca && (produccionPorFinca.vina.length > 0 || produccionPorFinca.olivar.length > 0)) {
    const VINA_COLOR = [40, 90, 150]
    const OLIVAR_COLOR = [120, 100, 30]

    if (produccionPorFinca.vina.length > 0) {
      sectionTitle('Producción por Finca — Viña', VINA_COLOR)

      doc.autoTable({
        startY: y,
        head: [['Finca', 'Kg uva', 'Kilogrados']],
        body: produccionPorFinca.vina.map(f => [
          f.finca,
          f.kg.toFixed(0) + ' kg',
          f.kilogrados > 0 ? f.kilogrados.toLocaleString('es-ES') + ' kg°' : '-'
        ]),
        theme: 'grid',
        headStyles: { fillColor: VINA_COLOR, fontSize: 8 },
        bodyStyles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { halign: 'right', cellWidth: 45 },
          2: { halign: 'right', cellWidth: 45 },
        },
        margin: { left: 18, right: 18 },
      })
      y = doc.lastAutoTable.finalY + 8
    }

    if (produccionPorFinca.olivar.length > 0) {
      sectionTitle('Producción por Finca — Olivar', OLIVAR_COLOR)

      doc.autoTable({
        startY: y,
        head: [['Finca', 'Kg aceituna', 'Aceite pot. (kg)']],
        body: produccionPorFinca.olivar.map(f => [
          f.finca,
          f.kg.toFixed(0) + ' kg',
          f.aceite > 0 ? f.aceite.toFixed(1) + ' kg' : '-'
        ]),
        theme: 'grid',
        headStyles: { fillColor: OLIVAR_COLOR, fontSize: 8 },
        bodyStyles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { halign: 'right', cellWidth: 45 },
          2: { halign: 'right', cellWidth: 45 },
        },
        margin: { left: 18, right: 18 },
      })
      y = doc.lastAutoTable.finalY + 8
    }
  }

  // === COSTES POR FINCA + COSTE/BENEFICIO ===
  if (costesPorFinca && costesPorFinca.length > 0) {
    sectionTitle('Análisis Coste/Beneficio por Finca', GOLD)

    const fincaAnalysis = costesPorFinca.map(cf => {
      const prodVina = produccionPorFinca?.vina?.find(pf => pf.finca === cf.finca)
      const prodOlivar = produccionPorFinca?.olivar?.find(pf => pf.finca === cf.finca)
      const prodKg = (prodVina?.kg || 0) + (prodOlivar?.kg || 0)
      const gastos = cf.gastos || 0
      const labores = cf.total - gastos
      const costeKg = prodKg > 0 ? (cf.total / prodKg).toFixed(2) + ' €/kg' : '-'
      return [
        cf.finca,
        labores.toFixed(2) + ' €',
        gastos.toFixed(2) + ' €',
        cf.total.toFixed(2) + ' €',
        prodKg.toFixed(0) + ' kg',
        costeKg,
      ]
    })

    doc.autoTable({
      startY: y,
      head: [['Finca', 'Labores', 'Gastos', 'Total', 'Producción', 'Coste/kg']],
      body: fincaAnalysis,
      theme: 'grid',
      headStyles: { fillColor: GOLD, fontSize: 8 },
      bodyStyles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 38 },
        1: { halign: 'right', cellWidth: 26 },
        2: { halign: 'right', cellWidth: 26 },
        3: { halign: 'right', cellWidth: 28 },
        4: { halign: 'right', cellWidth: 26 },
        5: { halign: 'right', cellWidth: 26 },
      },
      margin: { left: 18, right: 18 },
    })
    y = doc.lastAutoTable.finalY + 8
  }

  // === AMORTIZACIONES ===
  if (amortizaciones && amortizaciones.length > 0) {
    sectionTitle('Inversiones y Amortización', [230, 126, 34])

    const amortData = amortizaciones.map(a => {
      const importe = parseFloat(a.importe_compra) || 0
      const residual = parseFloat(a.valor_residual) || 0
      const amortizable = esAmortizable(a)
      const amortMensual = cuotaMensual(a)
      const amortAnual = amortMensual * 12
      return [
        (a.descripcion || 'Sin descripción') + (amortizable ? '' : ' (terreno, no se amortiza)'),
        fincas?.find(f => String(f.id_finca) === String(a.id_finca))?.nombre || a.finca_nombre || 'General',
        importe.toFixed(2) + ' €',
        amortizable ? amortMensual.toFixed(2) + ' €/mes' : '-',
        amortizable ? amortAnual.toFixed(2) + ' €/año' : '-',
        residual.toFixed(2) + ' €',
        a.fecha_compra || '-',
      ]
    })

    doc.autoTable({
      startY: y,
      head: [['Descripción', 'Finca', 'Compra', 'Amort. mensual', 'Amort. anual', 'Residual', 'Fecha']],
      body: amortData,
      theme: 'grid',
      headStyles: { fillColor: [230, 126, 34], fontSize: 7 },
      bodyStyles: { fontSize: 7, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 22 },
        2: { halign: 'right', cellWidth: 20 },
        3: { halign: 'right', cellWidth: 22 },
        4: { halign: 'right', cellWidth: 22 },
        5: { halign: 'right', cellWidth: 20 },
        6: { cellWidth: 22 },
      },
      margin: { left: 14, right: 14 },
    })
    y = doc.lastAutoTable.finalY + 8
  }

  // === DETALLE DE INGRESOS ===
  if (ingresosDetallados && ingresosDetallados.length > 0) {
    doc.addPage()
    y = 20
    sectionTitle('Detalle de Ingresos', BLUE)

    doc.autoTable({
      startY: y,
      head: [['Fecha', 'Origen', 'Concepto', 'Cantidad']],
      body: ingresosDetallados.map(i => [
        i.fecha || '-',
        i.origen || i.tipo || '-',
        i.concepto || '-',
        (i.cantidad || 0).toFixed(2) + ' €'
      ]),
      theme: 'grid',
      headStyles: { fillColor: BLUE, fontSize: 7 },
      bodyStyles: { fontSize: 7, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 35 },
        2: { cellWidth: 75 },
        3: { halign: 'right', cellWidth: 30 },
      },
      margin: { left: 18, right: 18 },
    })
    y = doc.lastAutoTable.finalY + 8
  }

  // === DETALLE DE GASTOS ===
  if (gastosDetallados && gastosDetallados.length > 0) {
    if (y > 220) { doc.addPage(); y = 20 }
    sectionTitle('Detalle de Gastos y Facturas', RED)

    // Con datos de factura: nº de factura, empresa y CIF (para justificar ayudas)
    const fechaES = (f) => (f ? `${String(f).substring(8, 10)}/${String(f).substring(5, 7)}/${String(f).substring(0, 4)}` : '-')
    doc.autoTable({
      startY: y,
      head: [['Fecha', 'Nº factura', 'Empresa', 'CIF/NIF', 'Concepto', 'Finca', 'Importe']],
      body: gastosDetallados.map(g => [
        fechaES(g.fecha),
        g.num_factura || '-',
        g.proveedor || '-',
        g.nif_proveedor || '-',
        (g.concepto || '-') + (esGastoInversion(g) ? ' *' : '') + (g.categoria ? `\n(${g.categoria})` : ''),
        g.finca_nombre || 'General',
        (g.importe || 0).toFixed(2) + ' €'
      ]),
      theme: 'grid',
      headStyles: { fillColor: RED, fontSize: 7 },
      bodyStyles: { fontSize: 6.5, cellPadding: 1.8, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 17 },
        1: { cellWidth: 22 },
        2: { cellWidth: 33 },
        3: { cellWidth: 20 },
        4: { cellWidth: 40 },
        5: { cellWidth: 25 },
        6: { halign: 'right', cellWidth: 25 },
      },
      margin: { left: 14, right: 14 },
    })
    y = doc.lastAutoTable.finalY + 8
    if (gastosDetallados.some(esGastoInversion)) {
      if (y > 280) { doc.addPage(); y = 20 }
      doc.setFontSize(7)
      doc.setTextColor(...GRAY)
      doc.text('* Inversión: se justifica como gasto, pero no resta en el balance de la campaña.', 18, y)
      y += 6
    }
  }

  // === FOOTER on all pages ===
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(...GRAY)
    doc.text(i + ' / ' + totalPages, pageWidth / 2, pageHeight - 8, { align: 'center' })
    doc.text('AGROtrack - Informe Económico', 14, pageHeight - 8)
  }

  return doc
}
