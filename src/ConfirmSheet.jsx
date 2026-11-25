import { useEffect, useState } from 'react'

// Panel de confirmación que sube desde abajo, con Confirmar y Cancelar.
export default function ConfirmSheet({ title, message, confirmLabel, danger, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function confirm() {
    setBusy(true)
    await onConfirm()
    onClose()
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="alertdialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h2 className="sheet-title">{title}</h2>
        <p className="sheet-note">{message}</p>
        <div className="sheet-buttons">
          <button className="pill outline sm" onClick={onClose} disabled={busy}>Cancelar</button>
          <button className={`pill sm ${danger ? 'danger' : 'ink'}`} onClick={confirm} disabled={busy} autoFocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
