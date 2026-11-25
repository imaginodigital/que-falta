import { useState } from 'react'
import { supabase } from './supabase'
import { APP_NAME } from './config'

// Login sin contraseña: te llega un mail con un botón (magic link).
export default function Auth({ pendingInvite }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function sendLink(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    // Si venía con invitación, volvemos a esa misma URL después de entrar.
    const redirectTo = pendingInvite
      ? `${window.location.origin}?invite=${pendingInvite}`
      : window.location.origin
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    })
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="center lime">
      <div className="hero-card">
        <div className="wordmark"><img className="logo" src="/icon-192.png" alt="" />{APP_NAME}</div>
        {sent ? (
          <p className="muted">
            Te enviamos un enlace a <b>{email}</b>. Ábrelo desde este teléfono para entrar.
          </p>
        ) : (
          <form onSubmit={sendLink}>
            <p className="muted">Escribe tu correo y te enviamos un enlace para entrar.</p>
            <input
              type="email"
              required
              placeholder="tucorreo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="pill ink block" disabled={loading}>
              {loading ? 'Enviando…' : 'Enviar enlace'}
            </button>
            {error && <p className="error">{error}</p>}
          </form>
        )}
      </div>
    </div>
  )
}
