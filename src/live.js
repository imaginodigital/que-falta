import { useEffect, useRef } from 'react'

// Vuelve a cargar los datos cuando la app "despierta":
// al volver a la pestaña/app, al recuperar el foco o al recuperar internet.
export function useRefreshOnReturn(reload) {
  const ref = useRef(reload)
  useEffect(() => { ref.current = reload }, [reload])

  useEffect(() => {
    let last = 0
    const run = () => {
      // Evita recargar dos veces seguidas (focus y visibilidad llegan juntos).
      if (Date.now() - last < 1500) return
      last = Date.now()
      ref.current()
    }
    const onVisible = () => document.visibilityState === 'visible' && run()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', run)
    window.addEventListener('online', run)
    window.addEventListener('pageshow', run)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', run)
      window.removeEventListener('online', run)
      window.removeEventListener('pageshow', run)
    }
  }, [])
}
