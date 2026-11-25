import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { IconShareNodes } from './icons'
import { APP_NAME } from './config'

// Ventana "Compartir": enviar un enlace o invitar a un contacto.
export default function ShareSheet({ list, memberIds, onToggleNames, onToast, onClose }) {
  const shared = memberIds.length > 1
  // Si la lista todavía no está compartida, la opción viene marcada.
  const [showNames, setShowNames] = useState(shared ? list.show_names : true)
  const [contacts, setContacts] = useState(null)
  const [pending, setPending] = useState([]) // ids ya invitados
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    supabase.rpc('my_contacts').then(({ data }) => setContacts(data ?? []))
    supabase
      .from('list_invites')
      .select('to_user')
      .eq('list_id', list.id)
      .then(({ data }) => setPending((data ?? []).map((i) => i.to_user)))
  }, [list.id])

  // Guarda la opción de nombres al compartir (si cambió).
  function applyNames() {
    if (showNames !== list.show_names) onToggleNames(showNames)
  }

  function changeNames(v) {
    setShowNames(v)
    if (shared) onToggleNames(v) // si ya está compartida, se guarda al instante
  }

  async function invite(c) {
    setBusy(c.id)
    const { error } = await supabase.rpc('invite_contact', { p_list_id: list.id, p_user: c.id })
    setBusy(null)
    if (error) return alert(error.message)
    applyNames()
    setPending((p) => [...p, c.id])
    onToast(`Invitación enviada a ${c.name}`)
  }

  async function sendLink() {
    const { data, error } = await supabase.rpc('create_invite', { p_list_id: list.id })
    if (error) return alert(error.message)
    applyNames()
    const link = `${window.location.origin}?invite=${data}`
    const text = `Te comparto la lista "${list.name}"`
    if (navigator.share) {
      try { await navigator.share({ title: APP_NAME, text, url: link }) } catch { /* cancelado */ }
    } else {
      await navigator.clipboard.writeText(link)
      onToast('Enlace copiado. Pégalo donde quieras compartirlo.')
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={`Compartir ${list.name}`} onClick={(e) => e.stopPropagation()}>
        <p className="sheet-eyebrow">Compartir</p>
        <h2 className="sheet-title">{list.name}</h2>

        <button className="pill ink block" onClick={sendLink}>
          <IconShareNodes width={16} height={16} /> Enviar enlace
        </button>
        <label className="opt plain">
          <input type="checkbox" checked={showNames} onChange={(e) => changeNames(e.target.checked)} />
          Mostrar quién marcó cada artículo como listo
        </label>

        {contacts && contacts.length > 0 ? (
          <>
            <p className="field-label modal-section">O invita a tus contactos</p>
            <ul className="contact-list">
              {contacts.map((c) => {
                const inList = memberIds.includes(c.id)
                const invited = pending.includes(c.id)
                return (
                  <li key={c.id} className="contact-row">
                    <span className="contact-name">{c.name}</span>
                    {inList ? (
                      <span className="contact-state">En la lista</span>
                    ) : invited ? (
                      <span className="contact-state">Invitación enviada</span>
                    ) : (
                      <button className="pill outline sm" disabled={busy === c.id} onClick={() => invite(c)}>
                        Invitar
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        ) : (
          contacts && (
            <p className="muted share-hint">
              Quien acepte quedará en tus contactos para invitarlo directo la próxima vez.
            </p>
          )
        )}

        <div className="modal-footer">
          <button className="pill outline sm" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
