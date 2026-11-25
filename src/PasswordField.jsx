import { useState } from 'react'

// Campo de contraseña con botón para mostrarla u ocultarla.
export default function PasswordField({ value, onChange, autoComplete = 'current-password', placeholder = 'Contraseña', autoFocus }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="pw-field">
      <input
        type={visible ? 'text' : 'password'}
        required
        minLength={6}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={placeholder}
        autoFocus={autoFocus}
      />
      <button type="button" className="pw-toggle" onClick={() => setVisible((v) => !v)}>
        {visible ? 'Ocultar' : 'Ver'}
      </button>
    </div>
  )
}
