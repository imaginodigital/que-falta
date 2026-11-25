import { useEffect, useState } from 'react'
import ConfirmSheet from './ConfirmSheet'

// Ajustes de una lista: nombre (solo quien la creó), mostrar quién marcó cada artículo como listo,
// quiénes están, y borrar (quien la creó) o salir (los demás).
export default function ListSettings({
  list, isOwner, ownerName, members, onToggleNames, onRename, onRemove, onClose,
}) {
  const shared = members.length > 1
  const [name, setName] = useState(list.name)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (confirming) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, confirming])

  async function saveName(e) {
    e.preventDefault()
    const clean = name.trim()
    if (!clean || clean === list.name) return
    await onRename(clean)
  }

  if (confirming) {
    return isOwner ? (
      <ConfirmSheet
        title="Borrar lista"
        message={shared
          ? `Se borra "${list.name}" con todos sus artículos para todas las personas que la comparten. No se puede deshacer.`
          : `Se borra "${list.name}" con todos sus artículos. No se puede deshacer.`}
        confirmLabel="Borrar lista"
        danger
        onConfirm={onRemove}
        onClose={() => setConfirming(false)}
      />
    ) : (
      <ConfirmSheet
        title="Salir de la lista"
        message={`"${list.name}" desaparece de tus listas. Las demás personas la siguen teniendo y verán que saliste.`}
        confirmLabel="Salir"
        danger
        onConfirm={onRemove}
        onClose={() => setConfirming(false)}
      />
    )
  }

  const changed = name.trim() && name.trim() !== list.name

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Ajustes de la lista" onClick={(e) => e.stopPropagation()}>
        <p className="sheet-eyebrow">Ajustes de la lista</p>

        {isOwner ? (
          <>
            <p className="field-label settings-label">Nombre</p>
            <form className="rename-row" onSubmit={saveName}>
              <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre de la lista" />
              {changed && <button className="pill ink sm">Guardar</button>}
            </form>
          </>
        ) : (
          <>
            <h2 className="sheet-title">{list.name}</h2>
            <p className="creator">Creada por {ownerName || 'otra persona'}</p>
          </>
        )}

        {shared && (
          <>
            <label className="opt plain settings-opt">
              <input type="checkbox" checked={list.show_names} onChange={(e) => onToggleNames(e.target.checked)} />
              Mostrar quién marcó cada artículo como listo
            </label>
            <p className="field-label modal-section">En esta lista</p>
            <p className="members">{members.join(', ')}</p>
          </>
        )}

        <div className="modal-footer">
          <button className="text-link danger-link" onClick={() => setConfirming(true)}>
            {isOwner ? 'Borrar lista' : 'Salir de la lista'}
          </button>
          <button className="pill outline sm" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
