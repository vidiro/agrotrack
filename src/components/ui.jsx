// Piezas de interfaz comunes para las páginas nuevas (mismo aspecto en toda la app)
import { Inbox } from 'lucide-react'

export function Avisos({ error, success, onReintentar }) {
  return (
    <>
      {success && <div className="alert alert-success" role="status">{success}</div>}
      {error && (
        <div className="alert alert-error" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span>{error}</span>
          {onReintentar && <button type="button" className="btn btn-small btn-primary" onClick={onReintentar}>Reintentar</button>}
        </div>
      )}
    </>
  )
}

export function Cargando({ texto = 'Cargando…' }) {
  return (
    <div className="empty-state" aria-busy="true">
      <div className="spinner"></div>
      <p className="mt-16">{texto}</p>
    </div>
  )
}

export function Vacio({ texto, children }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" aria-hidden="true"><Inbox size={40} strokeWidth={1.5} /></div>
      <div className="empty-state-text">{texto}</div>
      {children}
    </div>
  )
}

/** Aviso cuando falta aplicar la migración SQL que crea una tabla */
export function FaltaMigracion({ archivo = 'docs/SQL_migracion_v1.8_papeleo.sql' }) {
  return (
    <div className="alert alert-info">
      Este apartado necesita aplicar una vez <code>{archivo}</code> en Supabase (SQL Editor → New query → Run).
    </div>
  )
}

export function Cabecera({ titulo, descripcion, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
      <div style={{ minWidth: 0 }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'var(--fuente-titulo)' }}>{titulo}</h2>
        {descripcion && <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>{descripcion}</p>}
      </div>
      {children && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{children}</div>}
    </div>
  )
}

/** Campo de formulario con etiqueta asociada */
export function Campo({ id, label, children, ayuda }) {
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>{label}</label>
      {children}
      {ayuda && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>{ayuda}</div>}
    </div>
  )
}
