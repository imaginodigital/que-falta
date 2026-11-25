import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { go } from './router'
import { APP_NAME } from './config'

// Pantalla que aparece al abrir un enlace de invitación.
export default function AcceptInvite({ token }) {
  const [state, setState] = useState('loading') // loading | preview | joining | done | error
  const [listName, setListName] = useState('')
  const [error, setError] = useState('')
  const [listId, setListId] = useState(null)

  useEffect(() => {
    supabase.rpc('invite_info', { p_token: token }).then(({ data, error }) => {
      if (error || !data) { setError('Esta invitación no es válida o expiró.'); setState('error') }
      else { setListName(data.name); setState('preview') }
    })
  }, [token])

  async function accept() {
    setState('joining')
    const { data, error } = await supabase.rpc('accept_invite', { p_token: token })
    if (error) { setError(error.message); setState('error') }
    else { setListId(data); setState('done') }
  }

  return (
    <div className="center lime">
      <div className="hero-card">
        <div className="wordmark"><img className="logo" src="/icon-192.png" alt="" />{APP_NAME}</div>
        {state === 'loading' && <p className="muted">Cargando invitación…</p>}
        {state === 'error' && (
          <>
            <p className="error">{error}</p>
            <button className="pill outline block" onClick={() => go({ name: 'home' })}>Ir a mis listas</button>
          </>
        )}
        {state === 'preview' && (
          <>
            <p>Te invitaron a la lista <b>{listName}</b>.</p>
            <button className="pill ink block" onClick={accept}>Aceptar y agregar a mi app</button>
            <button className="pill outline block" onClick={() => go({ name: 'home' })}>Ahora no</button>
          </>
        )}
        {state === 'joining' && <p className="muted">Agregando…</p>}
        {state === 'done' && (
          <>
            <p>¡Listo! Ya tienes <b>{listName}</b> en tu app.</p>
            <button className="pill ink block" onClick={() => go({ name: 'list', id: listId })}>Abrir la lista</button>
          </>
        )}
      </div>
    </div>
  )
}
