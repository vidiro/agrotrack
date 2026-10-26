import { useEffect, useState } from 'react'
import { useExplotacion } from '../utils/explotacion'
import { nifValido, limpiarNIF } from '../utils/facturas'
import { descargarCopiaSeguridad } from '../utils/backup'
import { procesarCola, useColaPendiente } from '../utils/offline'
import { Campo } from './ui'

// Ajustes nuevos: datos del titular, modo campo, envíos sin cobertura y copia de seguridad
function AjustesExtra({ modoCampo, toggleModoCampo }) {
  const { explotacion, disponible, guardar } = useExplotacion()
  const [form, setForm] = useState({ nombre_titular: '', nif_titular: '', rega: '', direccion: '' })
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [backup, setBackup] = useState('')
  const { pendientes, enLinea } = useColaPendiente()
  let fallidos = []
  try { fallidos = JSON.parse(localStorage.getItem('agrotrack-cola-envios-fallidos') || '[]') } catch { fallidos = [] }

  useEffect(() => {
    setForm({
      nombre_titular: explotacion.nombre_titular || '',
      nif_titular: explotacion.nif_titular || '',
      rega: explotacion.rega || '',
      direccion: explotacion.direccion || '',
    })
  }, [explotacion.id, explotacion.nombre_titular, explotacion.nif_titular, explotacion.rega, explotacion.direccion])

  const guardarTitular = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await guardar({ ...form, nif_titular: limpiarNIF(form.nif_titular) || null })
      setMsg('Datos guardados')
      setTimeout(() => setMsg(''), 3000)
    } catch (err) {
      setError(err.message)
    }
  }

  const copia = async () => {
    setError('')
    try {
      await descargarCopiaSeguridad(setBackup)
      setBackup('')
      setMsg('Copia descargada. Guárdala en un sitio seguro (pendrive, nube…).')
      setTimeout(() => setMsg(''), 5000)
    } catch (err) {
      setBackup('')
      setError(err.message)
    }
  }

  return (
    <>
      {msg && <div className="alert alert-success" role="status">{msg}</div>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="card">
        <div className="card-title">Datos del titular</div>
        {!disponible ? (
          <p style={{ margin: 0, fontSize: 14 }}>Aplica la migración <code>docs/SQL_migracion_v1.8_papeleo.sql</code> en Supabase para guardar estos datos.</p>
        ) : (
          <form onSubmit={guardarTitular}>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '-4px 0 12px' }}>Salen en la cabecera del cuaderno de tratamientos y los informes. Con tu NIF, la lectura de facturas no lo confunde con el de la empresa.</p>
            <div className="form-row">
              <Campo id="t-nombre" label="Nombre o razón social">
                <input id="t-nombre" className="form-input" value={form.nombre_titular} onChange={e => setForm({ ...form, nombre_titular: e.target.value })} />
              </Campo>
              <Campo id="t-nif" label="NIF" ayuda={form.nif_titular && !nifValido(form.nif_titular) ? 'Revisa el NIF: la letra no cuadra.' : undefined}>
                <input id="t-nif" className="form-input" value={form.nif_titular} onChange={e => setForm({ ...form, nif_titular: e.target.value })} autoCapitalize="characters" />
              </Campo>
            </div>
            <div className="form-row">
              <Campo id="t-rega" label="Nº REGA / registro de explotación">
                <input id="t-rega" className="form-input" value={form.rega} onChange={e => setForm({ ...form, rega: e.target.value })} />
              </Campo>
              <Campo id="t-dir" label="Dirección">
                <input id="t-dir" className="form-input" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} />
              </Campo>
            </div>
            <button type="submit" className="btn btn-primary">Guardar datos</button>
          </form>
        )}
      </div>

      <div className="card">
        <div className="card-title">Uso en el campo</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, minHeight: 44, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!modoCampo} onChange={toggleModoCampo} style={{ width: 22, height: 22 }} />
          Modo campo: letra y botones más grandes y más contraste para ver el móvil al sol
        </label>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '8px 0 0' }}>
          Sin cobertura puedes apuntar labores, cosechas, gastos y facturas (sin foto): se guardan en el móvil y se envían solos al volver la señal.
          {' '}{enLinea ? 'Ahora hay conexión.' : 'Ahora mismo no hay conexión.'}
          {pendientes > 0 && <> {pendientes} pendientes de enviar. <button type="button" className="btn btn-small btn-accent" onClick={() => procesarCola()}>Enviar ahora</button></>}
        </p>
        {fallidos.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 13 }}>
            <strong style={{ color: 'var(--color-danger)' }}>{fallidos.length} registros guardados sin cobertura no se pudieron enviar:</strong>
            <ul style={{ margin: '6px 0', paddingLeft: 18 }}>
              {fallidos.slice(0, 10).map(f => <li key={f.id}>{f.tabla} · {new Date(f.creado).toLocaleString('es-ES')} · {f.error}</li>)}
            </ul>
            <button type="button" className="btn btn-small" onClick={() => { localStorage.removeItem('agrotrack-cola-envios-fallidos'); setMsg('Lista vaciada') }}>Vaciar lista</button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">Copia de seguridad</div>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: '0 0 12px' }}>
          Descarga todos tus datos (fincas, labores, cosechas, gastos, facturas, ingresos…) en un ZIP, con versión para Excel. Hazla, por ejemplo, al cerrar cada campaña.
        </p>
        <button type="button" className="btn btn-primary" onClick={copia} disabled={!!backup}>{backup || 'Descargar copia de seguridad'}</button>
      </div>
    </>
  )
}

export default AjustesExtra
