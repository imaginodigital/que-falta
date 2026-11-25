import { useState } from 'react'
import { supabase } from './supabase'
import { authErrorMessage } from './authErrors'
import PasswordField from './PasswordField'

// Guarda una contraseña nueva para la persona con sesión iniciada.
export default function PasswordForm({ submitLabel = 'Guardar contraseña', onSaved, autoFocus }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setError(authErrorMessage(error))
    setPassword('')
    onSaved()
  }

  return (
    <form onSubmit={submit}>
      <PasswordField
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        placeholder="Mínimo 6 caracteres"
        autoFocus={autoFocus}
      />
      <button className="pill ink block" disabled={busy || password.length < 6}>
        {busy ? 'Guardando…' : submitLabel}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  )
}
