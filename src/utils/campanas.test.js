import { describe, it, expect } from 'vitest'
import { calendarioCampanas, aNumero } from './campanas'

const base = [{ clave: 'campana_mes_inicio', valor: 8 }, { clave: 'campana_dia_inicio', valor: 4 }]

describe('campañas con fecha de inicio distinta cada año', () => {
  it('sin fechas propias usa el día y mes por defecto', () => {
    const cal = calendarioCampanas(base)
    expect(cal.campanaDe('2026-08-03')).toBe(2026)
    expect(cal.campanaDe('2026-08-04')).toBe(2027)
  })
  it('usa la fecha real de cada año y termina el día antes de la siguiente', () => {
    const cal = calendarioCampanas([...base,
      { clave: 'campana_inicio_2026', valor: aNumero('2025-08-18') },
      { clave: 'campana_inicio_2027', valor: '20260825' },
    ])
    expect(cal.campanaDe('2025-08-17')).toBe(2025)
    expect(cal.campanaDe('2025-08-18')).toBe(2026)
    expect(cal.campanaDe('2026-08-20')).toBe(2026) // la 2027 aún no ha empezado
    expect(cal.campanaDe('2026-08-25')).toBe(2027)
    expect(cal.etiqueta(2026)).toBe('Campaña 2026 (18 ago 2025 – 24 ago 2026)')
  })
})
