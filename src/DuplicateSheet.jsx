import { useEffect } from 'react'

// Aviso cuando se intenta agregar algo que ya está en la lista.
// - Si está pendiente: sumar 1 a la cantidad o agregarlo igual.
// - Si está en Listos: volverlo a pendientes o agregarlo igual.
export default function DuplicateSheet({ name, existing, onAddAnyway, onIncrease, onRestore, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const done = existing.bought
  // Solo mencionamos lo que escribió si cambia algo más que las mayúsculas.
  const same = existing.name.toLowerCase() === name.toLowerCase()

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="alertdialog" aria-modal="true" aria-label="Artículo repetido" onClick={(e) => e.stopPropagation()}>
        <h2 className="sheet-title">{done ? 'Está en Listos' : 'Ya está en la lista'}</h2>
        <p className="sheet-note">
          {done ? (
            <>«{existing.name}» ya está en esta lista, marcado como listo.{!same && <> (Escribiste «{name}».)</>}</>
          ) : (
            <>«{existing.name}» ya está en la lista{existing.quantity > 1 ? `, con cantidad ${existing.quantity}` : ''}.{!same && <> (Escribiste «{name}».)</>} ¿Quieres agregarlo igual?</>
          )}
        </p>

        <div className="sheet-actions">
          {done ? (
            <button className="sheet-option stack" onClick={onRestore} autoFocus>
              <span className="opt-main">Volver a pendientes</span>
              <span className="opt-sub">Se desmarca el que ya estaba</span>
            </button>
          ) : (
            <button className="sheet-option stack" onClick={onIncrease} autoFocus>
              <span className="opt-main">Sumar 1 a la cantidad</span>
              <span className="opt-sub">Queda en {existing.quantity + 1}</span>
            </button>
          )}
          <button className="sheet-option stack" onClick={onAddAnyway}>
            <span className="opt-main">Agregar igual</span>
            <span className="opt-sub">Quedan los dos en la lista</span>
          </button>
        </div>

        <div className="modal-footer">
          <button className="pill outline sm" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
