import { useState } from 'react'
import { supabase, isSupabaseConfigured } from '../data/supabaseClient'

function LoginPage({ darkMode, toggleDarkMode }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!isSupabaseConfigured) {
      setError('Faltan las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. Copia .env.example a .env.')
      return
    }

    setLoading(true)
    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (err) {
        if (err.message?.toLowerCase().includes('invalid login')) {
          throw new Error('Email o contraseña incorrectos.')
        }
        throw err
      }
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      <button
        type="button"
        className="login-theme-btn"
        onClick={toggleDarkMode}
        aria-label={darkMode ? 'Modo claro' : 'Modo oscuro'}
      >
        {darkMode ? '☀️' : '🌙'}
      </button>
      <div className="login-card">
        <div className="login-brand">
          <span className="login-logo" aria-hidden="true">🚜</span>
          <h1>AGROtrack</h1>
          <p>Gestión de la explotación. Acceso restringido.</p>
        </div>

        {!isSupabaseConfigured && (
          <div className="alert alert-error" role="alert">
            Configura el archivo <code>.env</code> con la URL y la clave anon de Supabase.
          </div>
        )}

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <label className="form-label" htmlFor="login-email">Email</label>
          <input
            id="login-email"
            className="form-input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            placeholder="tu@email.com"
          />

          <label className="form-label" htmlFor="login-password">Contraseña</label>
          <div className="password-field">
            <input
              id="login-password"
              className="form-input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(v => !v)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>

          <button type="submit" className={`btn btn-primary btn-full ${loading ? 'btn-loading' : ''}`} disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="login-hint">
          Los usuarios se crean en Supabase (Authentication → Users). No hay registro público.
        </p>
      </div>
    </div>
  )
}

export default LoginPage
