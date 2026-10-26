import { describe, it, expect } from 'vitest'
import { remapLabor, fincaUnida } from './unirFincas'

describe('unir fincas', () => {
  it('pasa las labores a la finca que queda y junta los peones', () => {
    const labor = { id_finca: 'fin_13', asignaciones_fincas: JSON.stringify([{ tipo_trabajo: 'Poda', fincas: [{ id_finca: 'fin_12', peones: [{ id_operario: 1, horas: 4 }] }, { id_finca: 'fin_13', peones: [{ id_operario: 2, horas: 3 }] }, { id_finca: 'fin_99', peones: [] }], maquinaria: [] }]) }
    const r = remapLabor(labor, ['fin_13', 'fin_14'], 'fin_12')
    expect(r.cambiada).toBe(true)
    expect(r.id_finca).toBe('fin_12')
    const sec = JSON.parse(r.asignaciones_fincas)[0]
    expect(sec.fincas.map(f => f.id_finca)).toEqual(['fin_12', 'fin_99'])
    expect(sec.fincas[0].peones).toHaveLength(2)
  })
  it('no toca las labores de otras fincas', () => {
    const labor = { id_finca: 'fin_1', asignaciones_fincas: JSON.stringify([{ tipo_trabajo: 'X', fincas: [{ id_finca: 'fin_1', peones: [] }], maquinaria: [] }]) }
    expect(remapLabor(labor, ['fin_13'], 'fin_12').cambiada).toBe(false)
  })
  it('suma superficies y junta parcelas del mismo polígono', () => {
    const r = fincaUnida(
      { id_finca: 'fin_12', nombre: 'PAJARITOS', superficie_total_ha: 0.4702, poligono: '10', parcela: '62' },
      [{ id_finca: 'fin_13', nombre: 'PAJARITOS', superficie_total_ha: 0.3379, poligono: '10', parcela: '63' }, { id_finca: 'fin_14', nombre: 'PAJARITOS', superficie_total_ha: 0.3288, poligono: '10', parcela: '64' }],
    )
    expect(r.superficie_total_ha).toBe(1.1369)
    expect(r.poligono).toBe('10')
    expect(r.parcela).toBe('62, 63, 64')
    expect(r.notas).toContain('fin_13')
  })
})
