// Empresas guardadas (tabla proveedores): nombre + NIF/CIF para autocompletar facturas
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../data/supabaseClient'
import { isMissingTable } from './fetchAll'
import { normalizarNIF, limpiarNIF, empresasConocidas } from './facturas'

const clave = (nombre) => String(nombre || '').trim().toLowerCase()

/**
 * Lista de empresas para autocompletar: primero las guardadas en «proveedores»,
 * completadas con las que ya aparecen en gastos/facturas.
 * Si la tabla aún no existe (migración v1.7 pendiente), usa solo el historial.
 */
export function useProveedores(gastos = []) {
  const [guardadas, setGuardadas] = useState([])
  const [disponible, setDisponible] = useState(true)

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from('proveedores').select('*').order('nombre')
    if (error) {
      if (isMissingTable(error)) setDisponible(false)
      return
    }
    setDisponible(true)
    setGuardadas(data || [])
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const empresas = useMemo(() => {
    const mapa = new Map()
    for (const e of empresasConocidas(gastos)) mapa.set(clave(e.proveedor), { ...e, guardada: false })
    for (const p of guardadas) {
      mapa.set(clave(p.nombre), { id: p.id, proveedor: p.nombre, nif_proveedor: p.nif || mapa.get(clave(p.nombre))?.nif_proveedor || '', guardada: true })
    }
    return [...mapa.values()].sort((a, b) => a.proveedor.localeCompare(b.proveedor, 'es'))
  }, [gastos, guardadas])

  /** Busca por nombre exacto (sin mayúsculas) o por NIF */
  const buscar = useCallback((texto) => {
    const k = clave(texto)
    const nif = normalizarNIF(texto)
    return empresas.find(e => clave(e.proveedor) === k) || (nif ? empresas.find(e => normalizarNIF(e.nif_proveedor) === nif) : null) || null
  }, [empresas])

  /**
   * Guarda (o actualiza el NIF de) una empresa. Si el NIF cambia, lo corrige también
   * en todas sus facturas ya registradas. Devuelve cuántas facturas se han corregido.
   * No lanza errores: es un extra.
   */
  const guardar = useCallback(async (nombre, nif) => {
    const n = String(nombre || '').trim()
    if (!n) return 0
    const nifN = limpiarNIF(nif) || null // se guarda tal como se escribe (p. ej. «B-96/934120»)
    let corregidas = 0
    try {
      if (disponible) {
        const existente = guardadas.find(p => clave(p.nombre) === clave(n))
        if (existente) {
          if (nifN && existente.nif !== nifN) {
            await supabase.from('proveedores').update({ nif: nifN }).eq('id', existente.id)
          }
        } else {
          await supabase.from('proveedores').insert([{ nombre: n, nif: nifN }])
        }
      }
      if (nifN) {
        // Facturas de esa empresa (por nombre, sin distinguir mayúsculas) con otro NIF o escrito de otra forma
        const nombreExacto = n.replace(/[\\%_]/g, m => '\\' + m)
        const { data } = await supabase.from('gastos_manual').select('id_gasto, nif_proveedor').ilike('proveedor', nombreExacto)
        const aCorregir = (data || []).filter(g => g.nif_proveedor !== nifN).map(g => g.id_gasto)
        if (aCorregir.length) {
          const { error } = await supabase.from('gastos_manual').update({ nif_proveedor: nifN }).in('id_gasto', aCorregir)
          if (!error) corregidas = aCorregir.length
        }
      }
    } catch { /* no bloquea el guardado de la factura */ }
    await cargar()
    return corregidas
  }, [guardadas, disponible, cargar])

  const borrar = useCallback(async (id) => {
    await supabase.from('proveedores').delete().eq('id', id)
    await cargar()
  }, [cargar])

  return { empresas, buscar, guardar, borrar, disponible, recargar: cargar }
}

/**
 * Al escribir la empresa: si es una conocida, rellena su NIF/CIF.
 * Al escribir el NIF: si es de una empresa conocida y no hay nombre, rellena el nombre.
 */
export function autocompletarEmpresa(form, campo, valor, buscar) {
  if (campo === 'proveedor') {
    const e = buscar(valor)
    if (e?.nif_proveedor) return { ...form, proveedor: valor, nif_proveedor: e.nif_proveedor }
    // Si el NIF puesto era el de la empresa anterior (autocompletado), se limpia al cambiar de empresa
    const anterior = buscar(form.proveedor)
    const eraAutocompletado = anterior?.nif_proveedor && normalizarNIF(anterior.nif_proveedor) === normalizarNIF(form.nif_proveedor)
    return { ...form, proveedor: valor, nif_proveedor: eraAutocompletado ? '' : form.nif_proveedor }
  }
  const e = buscar(valor)
  return { ...form, nif_proveedor: valor, proveedor: form.proveedor.trim() ? form.proveedor : (e?.proveedor || form.proveedor) }
}
