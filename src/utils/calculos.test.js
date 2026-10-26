// Pruebas de los cálculos de dinero y plazos (npm test)
import { describe, it, expect } from 'vitest'
import { calcRecuperacion, campanaDeFecha, cuotaMensual, esAmortizable } from './inversion'
import { laborFincaIds, laborShareFinca, parseSecciones, repartoLabor } from './labores'
import { nifValido, normalizarNIF, limpiarNIF, claveFactura } from './facturas'
import { esGastoInversion, gastosCorrientes } from './gastos'
import { calcPendientes, diasHasta } from './pendientes'
import { jornadasPorTrabajador } from './jornadas'
import { eur, sumarAnios, nombreArchivo } from './formato'

const HOY = new Date('2026-10-22T12:00:00Z')
const seccionesAB = JSON.stringify([
  { tipo_trabajo: 'Poda', fincas: [{ id_finca: 'A', peones: [{ id_operario: 1, horas: 8 }] }, { id_finca: 'B', peones: [{ id_operario: 2, horas: 6 }] }], maquinaria: [] },
])

describe('labores', () => {
  it('reparte la jornada entre sus fincas', () => {
    const l = { asignaciones_fincas: seccionesAB, coste_total: 100 }
    expect(laborFincaIds(l)).toEqual(['A', 'B'])
    expect(laborShareFinca(l, 'B')).toBe(0.5)
  })
  it('entiende el formato antiguo y JSON roto', () => {
    expect(parseSecciones({ tipo_trabajo: 'Poda', asignaciones_fincas: [{ id_finca: 'C' }] })[0].fincas).toHaveLength(1)
    expect(laborFincaIds({ id_finca: 'D', asignaciones_fincas: '{malo' })).toEqual(['D'])
  })
})

describe('reparto de una jornada entre fincas', () => {
  // 14/10: tractor en PAJARITOS y cogida de aceituna con peones en otra finca
  const labor = {
    coste_peones: 160, coste_maquinaria: 30, coste_gasoil: 11, coste_total: 201,
    asignaciones_fincas: JSON.stringify([
      { tipo_trabajo: 'Trabajos con tractor', fincas: [{ id_finca: 'PAJ', peones: [] }], maquinaria: [{ id_equipo: 'T1', horas: 2 }], include_gasoil: true },
      { tipo_trabajo: 'Cogida de aceitunas', fincas: [{ id_finca: 'OLI', peones: [{ id_operario: 1, horas: 8 }, { id_operario: 2, horas: 8 }] }], maquinaria: [], include_gasoil: true },
    ]),
  }
  const ctx = { personal: [{ id_operario: 1, coste_h: 10 }, { id_operario: 2, coste_h: 10 }], maquinaria: [{ id_equipo: 'T1', coste_h: 15, consumo_l_h: 5 }], precioGasoil: 1.1 }
  it('cada finca solo tiene su trabajo, sus horas y su coste', () => {
    const r = repartoLabor(labor, ctx)
    expect(r.get('PAJ').tipos).toEqual(['Trabajos con tractor'])
    expect(r.get('PAJ').horasMaq).toBe(2)
    expect(r.get('PAJ').horasPeones).toBe(0)
    expect(r.get('PAJ').total).toBeCloseTo(41, 2) // maquinaria + gasóleo
    expect(r.get('OLI').tipos).toEqual(['Cogida de aceitunas'])
    expect(r.get('OLI').total).toBeCloseTo(160, 2) // los peones
    expect(r.get('PAJ').total + r.get('OLI').total).toBeCloseTo(201, 2)
  })
})

describe('gastos e inversiones', () => {
  it('la categoría Inversión no cuenta como gasto corriente', () => {
    const gs = [{ categoria: 'Inversión', importe: 1000 }, { categoria: 'inversion', importe: 5 }, { categoria: 'Material', importe: 10 }]
    expect(gs.filter(esGastoInversion)).toHaveLength(2)
    expect(gastosCorrientes(gs)).toEqual([{ categoria: 'Material', importe: 10 }])
  })
  it('el terreno no se amortiza', () => {
    expect(esAmortizable({ categoria: 'Terreno' })).toBe(false)
    expect(cuotaMensual({ categoria: 'Terreno', importe_compra: 50000 })).toBe(0)
    expect(cuotaMensual({ categoria: 'Maquinaria', importe_compra: 12000, valor_residual: 0, meses_amortizacion: 120 })).toBe(100)
  })
  it('campañas: el día de inicio pertenece a la campaña nueva', () => {
    expect(campanaDeFecha('2025-09-14', 9, 15)).toBe(2025)
    expect(campanaDeFecha('2025-09-15', 9, 15)).toBe(2026)
  })
})

describe('recuperación de la inversión', () => {
  const fincas = [{ id_finca: 'A', nombre: 'A', superficie_total_ha: 3 }, { id_finca: 'B', nombre: 'B', superficie_total_ha: 1 }]
  const gastos = [
    { id_gasto: 10, id_finca: 'A', categoria: 'Inversión', importe: 15000, fecha: '2023-11-02' },
    { id_gasto: 11, id_finca: 'A', categoria: 'Material', importe: 500, fecha: '2025-01-10' },
    { id_gasto: 12, id_finca: null, categoria: 'Material', importe: 400, fecha: '2025-01-10' },
  ]
  const base = {
    fincas, gastos, hoy: HOY,
    labores: [{ fecha: '2024-03-01', coste_total: 400, asignaciones_fincas: seccionesAB }],
    cosechas: [
      { id_cosecha: 1, id_finca: 'A', fecha: '2024-10-20', cultivo: 'Olivar', variedad: 'Manzanilla', kg: 10000 },
      { id_cosecha: 2, id_parcela: 'A', fecha: '2025-10-20', cultivo: 'Olivar', variedad: 'Manzanilla', kg: 8000 },
    ],
    ingresos: [{ id_cosecha: 1, cantidad: 6000, fecha: '2024-12-01' }, { origen: 'Ayuda', cantidad: 2000, fecha: '2025-06-01' }],
    params: [{ clave: 'precio_manzanilla_kg', valor: '0.5' }],
  }

  it('suma cobros, estimados y ayudas por hectárea; resta costes y gastos', () => {
    const [r] = calcRecuperacion({ ...base, inversiones: [] })
    expect(r.inversion).toBe(15000)
    const c2025 = r.campanas.find(c => c.campana === 2025)
    expect(c2025.ingresos).toBe(6000)
    expect(c2025.ayudas).toBe(1500) // 3 de 4 ha
    expect(c2025.gastos).toBe(800) // 500 + 400 × 3/4
    // Jornada repartida por horas de peón en cada finca: 8 h en A y 6 h en B (a 10 €/h por defecto)
    expect(r.campanas.find(c => c.campana === 2024).costes).toBeCloseTo(400 * 8 / 14, 2)
    expect(r.campanas.find(c => c.campana === 2026).estimado).toBe(4000)
    expect(r.recuperado).toBeCloseTo(10700 - 400 * 8 / 14, 2)
    expect(r.estado).toBe('en_curso')
    expect(r.campanaPago).toBe(2028)
  })

  it('no cuenta dos veces una compra registrada en Gastos y en Inversiones', () => {
    const inv = { id_finca: 'A', categoria: 'Terreno', importe_compra: 15000, fecha_compra: '2023-11-02' }
    expect(calcRecuperacion({ ...base, inversiones: [{ ...inv, id_gasto: '10' }] })[0].inversion).toBe(15000)
    expect(calcRecuperacion({ ...base, inversiones: [inv] })[0].inversion).toBe(15000)
  })
})

describe('facturas', () => {
  it('valida NIF, NIE y CIF', () => {
    expect(nifValido('12345678Z')).toBe(true)
    expect(nifValido('12345678A')).toBe(false)
    expect(nifValido('X1234567L')).toBe(true)
    expect(nifValido('B12345674')).toBe(true)
    expect(nifValido('B12345675')).toBe(false)
    expect(normalizarNIF(' b-1234.5674 ')).toBe('B12345674')
    expect(normalizarNIF('B96/934120')).toBe('B96934120')
    expect(normalizarNIF('ESB96934120')).toBe('B96934120')
    expect(nifValido('B96/934120')).toBe(true)
    // Se guarda con el formato escrito; se compara sin símbolos
    expect(limpiarNIF('  b-96/934120 ')).toBe('B-96/934120')
    expect(nifValido('B-96/934120')).toBe(true)
    expect(claveFactura({ nif_proveedor: 'B-96/934120', num_factura: 'A/1' })).toBe(claveFactura({ nif_proveedor: 'B96934120', num_factura: 'A/1' }))
  })
  it('detecta la misma factura de la misma empresa', () => {
    expect(claveFactura({ nif_proveedor: 'b12345674', num_factura: ' f-1 ' })).toBe(claveFactura({ nif_proveedor: 'B12345674', num_factura: 'F-1' }))
  })
})

describe('pendientes', () => {
  it('avisa del plazo de seguridad y de vencimientos', () => {
    const lista = calcPendientes({
      hoy: HOY,
      fincas: [{ id_finca: 'A', nombre: 'La Celipa' }],
      labores: [{ id_labor: 1, fecha: '2026-10-15', asignaciones_fincas: JSON.stringify([{ tipo_trabajo: 'X', fincas: [{ id_finca: 'A', peones: [] }], maquinaria: [] }]) }],
      aplicaciones: [{ id_aplicacion: 9, id_labor: 1, producto: 'Cobre', carencia_dias: 15 }],
      vencimientos: [{ id: 1, tipo: 'ITV', descripcion: 'ITV tractor', fecha: '2026-11-01', aviso_dias: 30 }, { id: 2, tipo: 'Seguro', descripcion: 'Seguro', fecha: '2027-06-01' }],
    })
    expect(lista[0].texto).toContain('La Celipa')
    expect(lista[0].texto).toMatch(/hasta el \d+ oct/)
    expect(lista.some(p => p.texto.includes('ITV tractor vence en 10 días'))).toBe(true)
    expect(lista.some(p => p.texto.includes('Seguro'))).toBe(false)
    expect(diasHasta('2026-10-23', HOY)).toBe(1)
  })
})

describe('jornadas', () => {
  it('suma días y horas por trabajador', () => {
    const labores = [
      { fecha: '2026-03-01', asignaciones_fincas: seccionesAB },
      { fecha: '2026-03-02', asignaciones_fincas: seccionesAB },
      { fecha: '2026-04-01', asignaciones_fincas: seccionesAB },
    ]
    const r = jornadasPorTrabajador(labores, [{ id_operario: 1, nombre: 'Ana', coste_h: 10 }], '2026-03')
    const ana = r.find(x => x.nombre === 'Ana')
    expect(ana.numDias).toBe(2)
    expect(ana.horas).toBe(16)
    expect(ana.coste).toBe(160)
  })
})

describe('formato', () => {
  it('euros con miles y fechas de renovación', () => {
    expect(eur(7500)).toBe('7.500,00 €')
    expect(eur(-1234.5)).toBe('−1.234,50 €')
    expect(sumarAnios('2024-02-29')).toBe('2025-02-28')
    expect(nombreArchivo('Factura Nº 12/2026 Agroquímicos')).toBe('Factura_N_12_2026_Agroquimicos')
  })
})
