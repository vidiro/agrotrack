import { useEffect, useMemo, useState } from 'react'
import { fetchAll } from './fetchAll'
import { getParamValue } from './params'
import { calcRecuperacion } from './inversion'

/**
 * Carga el histórico completo y calcula la recuperación de la inversión de cada finca.
 * Usa las props que App ya pasa a cada página (fincas, amortizaciones, params, destinos, preciosDestino).
 */
export function useRecuperacion({ fincas, amortizaciones, params, destinos, preciosDestino, personal, maquinaria }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const [lab, cos, gas, ing] = await Promise.all([
          fetchAll('labores'), fetchAll('cosechas'), fetchAll('gastos_manual'), fetchAll('ingresos'),
        ])
        for (const r of [lab, cos, gas, ing]) if (r.error) throw r.error
        if (vivo) setDatos({ labores: lab.data, cosechas: cos.data, gastos: gas.data, ingresos: ing.data })
      } catch (err) {
        if (vivo) setError(err.message)
      }
    })()
    return () => { vivo = false }
  }, [amortizaciones])

  const resultados = useMemo(() => {
    if (!datos) return []
    return calcRecuperacion({
      fincas, inversiones: amortizaciones || [], ...datos,
      params, destinos, preciosDestino, personal, maquinaria,
      precioGasoil: getParamValue(params, ['precio_gasoil_l', 'coste_gasoleo'], 0),
      startMonth: getParamValue(params, ['campana_mes_inicio'], 9),
      startDay: getParamValue(params, ['campana_dia_inicio'], 15),
    })
  }, [datos, fincas, amortizaciones, params, destinos, preciosDestino, personal, maquinaria])

  return { resultados, cargando: !datos && !error, error }
}
