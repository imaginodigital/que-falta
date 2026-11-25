import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import Auth from './Auth'
import Home from './Home'
import ListView from './ListView'
import AcceptInvite from './AcceptInvite'
import NameForm from './NameForm'
import PasswordForm from './PasswordForm'
import { readRoute } from './router'
import { APP_NAME } from './config'

export default function App() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)
  const [route, setRoute] = useState(readRoute())
  const [myName, setMyName] = useState(undefined) // undefined = cargando, null = sin nombre
  const [recovering, setRecovering] = useState(false) // volvió del correo para crear contraseña nueva

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setSession(s)
    })
    const onPop = () => setRoute(readRoute())
    window.addEventListener('popstate', onPop)
    return () => {
      sub.subscription.unsubscribe()
      window.removeEventListener('popstate', onPop)
    }
  }, [])

  // Al entrar, buscamos el nombre/apodo de la persona.
  const userId = session?.user?.id
  useEffect(() => {
    if (!userId) return
    setMyName(undefined)
    supabase
      .from('profiles')
      .select('name')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => setMyName(data?.name || null))
  }, [userId])

  if (!ready) return <div className="center muted">Cargando…</div>

  // Sin sesión: entrar o crear cuenta. Si venía con una invitación, la dirección
  // se mantiene y se retoma apenas entra.
  if (!session) return <Auth />

  // Volvió desde el correo de "Olvidé mi contraseña": crear una nueva.
  if (recovering) {
    return (
      <div className="center lime">
        <div className="hero-card">
          <div className="wordmark"><img className="logo" src="/icon-192.png" alt="" />{APP_NAME}</div>
          <p className="name-q">Contraseña nueva</p>
          <p className="muted">Elige tu nueva contraseña para {session.user.email}.</p>
          <PasswordForm autoFocus onSaved={() => setRecovering(false)} />
        </div>
      </div>
    )
  }

  if (myName === undefined) return <div className="center muted">Cargando…</div>

  // Primera vez: pedir solo el nombre o apodo.
  if (myName === null) {
    return (
      <div className="center lime">
        <div className="hero-card">
          <div className="wordmark"><img className="logo" src="/icon-192.png" alt="" />{APP_NAME}</div>
          <p className="name-q">¿Cómo te llaman?</p>
          <p className="muted">Tu nombre o apodo. Así, en las listas compartidas, se ve quién marcó cada cosa como lista.</p>
          <NameForm session={session} onSaved={setMyName} />
        </div>
      </div>
    )
  }

  if (route.name === 'invite') return <AcceptInvite token={route.token} session={session} />
  if (route.name === 'list') return <ListView listId={route.id} session={session} myName={myName} />
  return <Home session={session} myName={myName} onNameChange={setMyName} />
}
