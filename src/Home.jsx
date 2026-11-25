import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { go } from './router'
import { IconInvite, IconPencil, IconSettings, IconTrash } from './icons'
import { APP_NAME, shareAppText } from './config'
import { useRefreshOnReturn } from './live'
import NameForm from './NameForm'
import PasswordForm from './PasswordForm'
import ConfirmSheet from './ConfirmSheet'

// Pantalla principal: todas las listas a las que perteneces.
export default function Home({ session, myName, onNameChange }) {
  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [loadError, setLoadError] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [changingPw, setChangingPw] = useState(false)
  const [showNames, setShowNames] = useState(true)
  const [contacts, setContacts] = useState([]) // [{ id, name }]
  const [picked, setPicked] = useState([]) // ids de contactos elegidos al crear
  const [invites, setInvites] = useState([]) // invitaciones que me llegaron
  const [toast, setToast] = useState('')
  const [owners, setOwners] = useState({}) // id -> nombre de quien creó cada lista
  const [renaming, setRenaming] = useState(null) // lista que se está renombrando
  const [renameValue, setRenameValue] = useState('')
  const [removing, setRemoving] = useState(null) // lista a borrar o de la que salir
  const myId = session.user.id

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('lists')
      .select('id, name, owner, sort_mode, items(id, bought), list_members(user_id)')
      .order('created_at', { ascending: true })
    if (error) {
      console.error(error)
      setLoadError(error.message)
    } else {
      setLoadError('')
      setLists(data ?? [])
      const ownerIds = [...new Set((data ?? []).map((l) => l.owner).filter((id) => id !== myId))]
      if (ownerIds.length) {
        const { data: profs } = await supabase.from('profiles').select('id, name').in('id', ownerIds)
        setOwners(Object.fromEntries((profs ?? []).map((p) => [p.id, p.name])))
      }
    }
    setLoading(false)
  }, [myId])

  const loadSocial = useCallback(async () => {
    const [c, i] = await Promise.all([supabase.rpc('my_contacts'), supabase.rpc('my_invites')])
    if (!c.error) setContacts(c.data ?? [])
    if (!i.error) setInvites(i.data ?? [])
  }, [])

  const loadAll = useCallback(() => Promise.all([load(), loadSocial()]), [load, loadSocial])

  useEffect(() => {
    loadAll()
    // Si alguien cambia algo en tus listas o te invita, se actualiza solo.
    const channel = supabase
      .channel('home')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lists' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'list_members' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'list_invites' }, loadSocial)
      .subscribe((status) => status === 'SUBSCRIBED' && loadAll())
    return () => { supabase.removeChannel(channel) }
  }, [load, loadSocial, loadAll])

  useRefreshOnReturn(loadAll)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(t)
  }, [toast])

  function togglePick(id) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  }

  async function acceptInvite(inv) {
    setInvites((all) => all.filter((x) => x.id !== inv.id))
    const { error } = await supabase.rpc('accept_list_invite', { p_invite: inv.id })
    if (error) return alert(error.message)
    setToast(`Se agregó ${inv.list_name} a tus listas`)
    loadAll()
  }

  async function declineInvite(inv) {
    setInvites((all) => all.filter((x) => x.id !== inv.id))
    await supabase.from('list_invites').delete().eq('id', inv.id)
  }

  async function createList(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    const sharing = picked.length > 0
    const { error } = await supabase.rpc('create_list', {
      list_name: name,
      p_show_names: sharing && showNames,
      p_invite: picked,
    })
    if (error) return alert(error.message)
    if (sharing) {
      const names = contacts.filter((c) => picked.includes(c.id)).map((c) => c.name)
      setToast(`Invitación enviada a ${names.join(', ')}`)
    }
    setNewName('')
    setPicked([])
    setShowNames(true)
    load()
  }

  function startRename(list) {
    setRenaming(list)
    setRenameValue(list.name)
  }

  async function saveRename(e) {
    e.preventDefault()
    const name = renameValue.trim()
    if (!name || name === renaming.name) return setRenaming(null)
    const { error } = await supabase.from('lists').update({ name }).eq('id', renaming.id)
    if (error) return alert(error.message)
    setRenaming(null)
    load()
  }

  // Comparte la app con instrucciones para instalarla en el teléfono.
  async function shareApp() {
    const text = shareAppText()
    if (navigator.share) {
      try { await navigator.share({ title: APP_NAME, text }) } catch { /* cancelado */ }
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      setToast('Mensaje copiado. Pégalo en WhatsApp o en un correo.')
    } catch {
      alert(text)
    }
  }

  // Quien creó la lista la borra para todos; los demás solo salen de ella.
  async function removeOrLeave(list) {
    const { error } = list.owner === myId
      ? await supabase.from('lists').delete().eq('id', list.id)
      : await supabase.rpc('leave_list', { p_list_id: list.id })
    if (error) return alert(error.message)
    setToast(list.owner === myId ? `Se borró ${list.name}` : `Saliste de ${list.name}`)
    load()
  }

  return (
    <div className="screen">
      <header className="band">
        <div className="band-inner home-band">
          <div className="brand-block">
            <img className="logo lg" src="/icon-192.png" alt="" />
            <div>
              <h1 className="title brand-title">{APP_NAME}</h1>
              <p className="band-sub">Hola, {myName}</p>
            </div>
          </div>
          <div className="band-icons">
            <button className="round-btn" onClick={() => setSettingsOpen(true)} aria-label="Ajustes" title="Ajustes">
              <IconSettings width={18} height={18} />
            </button>
            <button className="round-btn" onClick={shareApp} aria-label="Compartir app" title="Compartir app">
              <IconInvite width={18} height={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="page">
        {invites.map((inv) => (
          <div key={inv.id} className="invite-card">
            <p className="invite-text">
              <b>{inv.from_name}</b> te invitó a <span className="invite-list">{inv.list_name}</span>
            </p>
            <div className="invite-actions">
              <button className="pill outline sm" onClick={() => declineInvite(inv)}>Rechazar</button>
              <button className="pill ink sm" onClick={() => acceptInvite(inv)}>Aceptar</button>
            </div>
          </div>
        ))}

        <h2 className="section-label home-label new-label">Nueva lista</h2>
        <form onSubmit={createList}>
          <div className="add-card">
            <input
              placeholder="Ej. Casa, Supermercado"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              aria-label="Nombre de la nueva lista"
            />
            <button className="pill ink">Crear</button>
          </div>
          {contacts.length > 0 && (
            <div className="share-pick">
              <span className="share-pick-label">Compartir con:</span>
              {contacts.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className={`chip ${picked.includes(c.id) ? 'on' : ''}`}
                  aria-pressed={picked.includes(c.id)}
                  onClick={() => togglePick(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
          {picked.length > 0 && (
            <label className="opt">
              <input type="checkbox" checked={showNames} onChange={(e) => setShowNames(e.target.checked)} />
              Mostrar quién marcó cada artículo como listo
            </label>
          )}
        </form>

        {loadError && <p className="error">No se pudieron cargar las listas: {loadError}</p>}

        <h2 className="section-label home-label">Mis listas</h2>

        {loading ? (
          <p className="muted">Cargando…</p>
        ) : lists.length === 0 ? (
          <div className="empty">
            <p className="empty-title">Todavía no tienes listas</p>
            <p className="muted">Crea la primera arriba y empieza a agregar artículos.</p>
          </div>
        ) : (
          <ul className="lists">
            {lists.map((l) => {
              const pending = l.items?.filter((i) => !i.bought).length ?? 0
              const total = l.items?.length ?? 0
              const mine = l.owner === myId
              const shared = (l.list_members?.length ?? 1) > 1
              return (
                <li key={l.id} className="list-card">
                  <button className="list-open" onClick={() => go({ name: 'list', id: l.id })}>
                    <span className="list-name">
                      {l.name}
                      {shared && !mine && <span className="creator inline">creada por {owners[l.owner] || '…'}</span>}
                    </span>
                    <span className="list-meta">
                      {total === 0 ? 'Vacía' : (
                        <span><span className="count">{pending}</span> {pending === 1 ? 'pendiente' : 'pendientes'} de {total}</span>
                      )}
                      {shared && <span className="tag">Compartida</span>}
                    </span>
                  </button>
                  <div className="row-actions">
                    {mine && (
                      <button className="icon-btn" aria-label={`Renombrar ${l.name}`} onClick={() => startRename(l)}>
                        <IconPencil />
                      </button>
                    )}
                    <button
                      className="icon-btn"
                      aria-label={mine ? `Borrar ${l.name}` : `Quitar ${l.name} de mis listas`}
                      onClick={() => setRemoving({ ...l, shared })}
                    >
                      <IconTrash />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </main>

      {settingsOpen && (
        <div className="sheet-backdrop" onClick={() => { setSettingsOpen(false); setChangingPw(false) }}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Ajustes" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h2 className="sheet-title">Ajustes</h2>
            <p className="field-label">Tu nombre o apodo</p>
            <NameForm
              session={session}
              initial={myName}
              submitLabel="Guardar nombre"
              onSaved={(n) => { onNameChange(n); setSettingsOpen(false) }}
            />
            <p className="field-label modal-section">Contraseña</p>
            {changingPw ? (
              <PasswordForm
                autoFocus
                onSaved={() => { setChangingPw(false); setSettingsOpen(false); setToast('Contraseña guardada') }}
              />
            ) : (
              <button className="pill outline block" onClick={() => setChangingPw(true)}>Cambiar contraseña</button>
            )}
            <p className="sheet-account muted">Sesión iniciada como {session.user.email}</p>
            <button
              className="pill outline block"
              onClick={() => { setSettingsOpen(false); setConfirmLogout(true) }}
            >
              Cerrar sesión
            </button>
            <div className="modal-footer">
              <button className="pill outline sm" onClick={() => { setSettingsOpen(false); setChangingPw(false) }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {renaming && (
        <div className="sheet-backdrop" onClick={() => setRenaming(null)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Cambiar nombre de la lista" onClick={(e) => e.stopPropagation()}>
            <h2 className="sheet-title">Cambiar nombre</h2>
            <form onSubmit={saveRename}>
              <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} aria-label="Nombre de la lista" />
              <div className="sheet-buttons">
                <button type="button" className="pill outline sm" onClick={() => setRenaming(null)}>Cancelar</button>
                <button className="pill ink sm">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {removing && (removing.owner === myId ? (
        <ConfirmSheet
          title="Borrar lista"
          message={removing.shared
            ? `Se borra "${removing.name}" con todos sus artículos para todas las personas que la comparten. No se puede deshacer.`
            : `Se borra "${removing.name}" con todos sus artículos. No se puede deshacer.`}
          confirmLabel="Borrar lista"
          danger
          onConfirm={() => removeOrLeave(removing)}
          onClose={() => setRemoving(null)}
        />
      ) : (
        <ConfirmSheet
          title="Quitar de mis listas"
          message={`Vas a salir de "${removing.name}". Las demás personas la siguen teniendo y verán que saliste.`}
          confirmLabel="Salir de la lista"
          danger
          onConfirm={() => removeOrLeave(removing)}
          onClose={() => setRemoving(null)}
        />
      ))}

      {toast && <div className="toast" role="status">{toast}</div>}

      {confirmLogout && (
        <ConfirmSheet
          title="Cerrar sesión"
          message="Vas a salir de la app en este dispositivo. Para volver a entrar necesitarás tu correo y tu contraseña."
          confirmLabel="Cerrar sesión"
          onConfirm={() => supabase.auth.signOut()}
          onClose={() => setConfirmLogout(false)}
        />
      )}
    </div>
  )
}
