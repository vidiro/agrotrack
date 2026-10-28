import { describe, it, expect } from 'vitest'
import { leerNPK, aportes, esFertilizante, textoNPK, dosisKgHa } from './fertilizacion'

describe('fertilización', () => {
  it('reconoce la riqueza N-P-K escrita de varias formas', () => {
    expect(leerNPK('15-15-15')).toEqual({ n: 15, p: 15, k: 15 })
    expect(leerNPK('20,5-0-0')).toEqual({ n: 20.5, p: 0, k: 0 })
    expect(leerNPK('8/15/15')).toEqual({ n: 8, p: 15, k: 15 })
    expect(leerNPK('urea')).toBeNull()
  })

  it('calcula las unidades fertilizantes por hectárea y en total', () => {
    const a = { dosis: 300, unidad_dosis: 'kg/ha', riqueza_n: 15, riqueza_p: 15, riqueza_k: 15, superficie_ha: 2 }
    expect(aportes(a)).toMatchObject({ n: 45, p: 45, k: 45, totalN: 90, kgTotales: 600 })
  })

  it('pasa las toneladas a kg (estiércol)', () => {
    expect(dosisKgHa({ dosis: 20, unidad_dosis: 't/ha' })).toBe(20000)
    expect(aportes({ dosis: 20, unidad_dosis: 't/ha', riqueza_n: 0.5 }, 1).n).toBe(100)
  })

  it('las filas sin tipo son fitosanitarios', () => {
    expect(esFertilizante({})).toBe(false)
    expect(esFertilizante({ tipo: 'fertilizante' })).toBe(true)
    expect(textoNPK({ riqueza_n: 20.5, riqueza_p: 0, riqueza_k: 0 })).toBe('20,5-0-0')
  })
})
