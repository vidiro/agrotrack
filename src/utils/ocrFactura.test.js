import { describe, it, expect } from 'vitest'
import { extraerDatosFactura, parseImporte } from './ocrFactura'

const ejemplo = `AGROQUIMICOS VEGAS S.L.
C.I.F.: B-12345674
Ctra. de Badajoz km 3, Almendralejo
FACTURA Nº: F-2026/0123
Fecha: 14/03/2026
Cliente: Vicente Díaz  NIF 12345678Z
Concepto                 Cant.   Importe
Abono NPK 15-15-15        20     640,00
Base imponible                    640,00 €
IVA 10%                            64,00 €
TOTAL FACTURA                   1.704,00 €`

describe('extraerDatosFactura', () => {
  it('saca CIF, nº, fecha e importe total', () => {
    const r = extraerDatosFactura(ejemplo, ['12345678Z'])
    expect(r.nif_proveedor).toBe('B12345674')
    expect(r.num_factura).toBe('F-2026/0123')
    expect(r.fecha).toBe('2026-03-14')
    expect(r.importe).toBe(1704)
  })
  it('no confunde el NIF del agricultor con el de la empresa', () => {
    const r = extraerDatosFactura('NIF 12345678Z\nTotal 10,00 €', ['12345678Z'])
    expect(r.nif_proveedor).toBeUndefined()
  })
  it('lee importes en formato español', () => {
    expect(parseImporte('1.234,56')).toBe(1234.56)
    expect(parseImporte('1234.56')).toBe(1234.56)
    expect(parseImporte('64,00 €')).toBe(64)
  })
})
