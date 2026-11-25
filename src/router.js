// Router mínimo basado en la URL, sin librerías extra.
// ?invite=<token>  -> pantalla para aceptar una lista compartida
// ?list=<id>       -> ver una lista
// (nada)           -> pantalla principal con todas tus listas
export function readRoute() {
  const p = new URLSearchParams(window.location.search)
  if (p.get('invite')) return { name: 'invite', token: p.get('invite') }
  if (p.get('list')) return { name: 'list', id: p.get('list') }
  return { name: 'home' }
}

export function go(route) {
  const url =
    route.name === 'invite' ? `?invite=${route.token}`
    : route.name === 'list' ? `?list=${route.id}`
    : window.location.pathname
  window.history.pushState({}, '', url)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
