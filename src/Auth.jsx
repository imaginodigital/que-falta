import { useState } from 'react'
import { supabase } from './supabase'
import { APP_NAME } from './config'
import { authErrorMessage } from './authErrors'
import PasswordField from './PasswordField'

// Entrar o crear cuenta con correo y contraseña. La sesión queda guardada
// en el dispositivo hasta que la persona toque "Cerrar sesión".
export default function Auth() {
  const [mode, setMode] = useState('login') // login | signup | forgot
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  function switchTo(m) {
    setMode(m)
    setError('')
    setNotice('')
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    setNotice('')
    setLoading(true)
    const clean = email.trim()

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: clean, password })
      if (error) setError(authErrorMessage(error))
    } else if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email: clean, password })
      if (error) setError(authErrorMessage(error))
      // Si en Supabase sigue activa la confirmación por correo, no llega sesión todavía.
      else if (!data.session) setNotice(`Te enviamos un correo a ${clean} para confirmar tu cuenta.`)
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(clean, { redirectTo: window.location.origin })
      if (error) setError(authErrorMessage(error))
      else setNotice(`Si ${clean} tiene una cuenta, te llegará un correo para crear una contraseña nueva.`)
    }
    setLoading(false)
  }

  const submitText = {
    login: loading ? 'Entrando…' : 'Entrar',
    signup: loading ? 'Creando cuenta…' : 'Crear cuenta',
    forgot: loading ? 'Enviando…' : 'Enviar correo',
  }[mode]

  return (
    <div className="center lime">
      <div className="hero-card">
        <div className="wordmark"><img className="logo" src="/icon-192.png" alt="" />{APP_NAME}</div>

        {mode === 'forgot' ? (
          <>
            <p className="name-q">Recuperar contraseña</p>
            <p className="muted">Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva.</p>
          </>
        ) : (
          <div className="tabs" role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => switchTo('login')}>
              Entrar
            </button>
            <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'on' : ''} onClick={() => switchTo('signup')}>
              Crear cuenta
            </button>
          </div>
        )}

        <form onSubmit={submit}>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="tucorreo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Correo"
          />
          {mode !== 'forgot' && (
            <PasswordField
              value={password}
              onChange={setPassword}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              placeholder={mode === 'signup' ? 'Contraseña (mín. 6)' : 'Contraseña'}
            />
          )}
          <button className="pill ink block" disabled={loading}>{submitText}</button>
          {error && <p className="error">{error}</p>}
          {notice && <p className="notice-ok">{notice}</p>}
        </form>

        <p className="auth-foot">
          {mode === 'login' && (
            <button type="button" className="text-link" onClick={() => switchTo('forgot')}>¿Olvidaste tu contraseña?</button>
          )}
          {mode === 'forgot' && (
            <button type="button" className="text-link" onClick={() => switchTo('login')}>Volver a entrar</button>
          )}
        </p>
      </div>
    </div>
  )
}
