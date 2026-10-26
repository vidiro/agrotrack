// Datos del titular de la explotación (nombre, NIF, REGA…) para cabeceras de informes y para la lectura de facturas
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../data/supabaseClient'
import { isMissingTable } from './fetchAll'

export function useExplotacion() {
  const [datos, setDatos] = useState(null)
  const [disponible, setDisponible] = useState(true)

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from('explotacion').select('*').limit(1)
    if (error) {
      if (isMissingTable(error)) setDisponible(false)
      return
    }
    setDisponible(true)
    setDatos(data?.[0] || {})
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const guardar = useCallback(async (cambios) => {
    const fila = { ...(datos || {}), ...cambios }
    const { id, ...resto } = fila
    const { error } = id
      ? await supabase.from('explotacion').update(resto).eq('id', id)
      : await supabase.from('explotacion').insert([resto])
    if (error) throw error
    await cargar()
  }, [datos, cargar])

  return { explotacion: datos || {}, disponible, guardar, recargar: cargar }
}

/** Cabecera de texto para PDF: «Nombre · NIF · REGA» */
export function lineaTitular(e = {}) {
  return [e.nombre_titular, e.nif_titular && `NIF ${e.nif_titular}`, e.rega && `REGA ${e.rega}`].filter(Boolean).join(' · ')
}
