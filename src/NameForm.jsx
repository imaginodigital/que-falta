import { useState } from 'react'
import { supabase } from './supabase'

const MAX_NAME = 20

// Guarda el nombre o apodo de la persona (crea el perfil si no existe).
async function saveName(userId, email, name) {
  return supabase.from('profiles').upsert({ id: userId, email, name })
}

// Formulario mínimo: un campo y un botón.
export default function NameForm({ session, initial = '', submitLabel = 'Listo', onSaved }) {
  const [name, setName] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    const clean = name.trim().replace(/\s+/g, ' ')
    if (!clean) return
    setBusy(true)
    const { error } = await saveName(session.user.id, session.user.email, clean)
    setBusy(false)
    if (error) return setError(error.message)
    onSaved(clean)
  }

  return (
    <form onSubmit={submit}>
      <input
        autoFocus
        value={name}
        maxLength={MAX_NAME}
        placeholder="Ej. Ana, Gus, Pato"
        onChange={(e) => setName(e.target.value)}
        aria-label="Tu nombre o apodo"
      />
      <button className="pill ink block" disabled={busy || !name.trim()}>
        {busy ? 'Guardando…' : submitLabel}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  )
}
