// Agrupa las acciones del historial.
//
// Reglas:
// - Se juntan en una fila las acciones del MISMO TIPO y de la MISMA PERSONA,
//   si cada una pasó a menos de 1 minuto de la anterior (15 minutos al marcar como listo,
//   porque en el súper se marca de a poco).
// - Si esa persona hace otra cosa en el medio, el grupo se corta.
//   Lo que hagan otras personas mientras tanto no lo corta.
// - Toques sin querer se anulan (dentro de 1 minuto, misma persona, mismo artículo):
//   marcar y desmarcar, desmarcar y volver a marcar, agregar y borrar.
//   Si alguien agrega un artículo y lo corrige enseguida, se muestra ya corregido.

const MIN = 60 * 1000
export const WINDOW = { buy: 15 * MIN }
const DEFAULT_WINDOW = MIN
const UNDO_WINDOW = MIN
const UNDOES = { unbuy: 'buy', buy: 'unbuy', delete: 'add' }

const time = (e) => new Date(e.created_at).getTime()

export function groupEvents(events) {
  const sorted = [...events].sort((a, b) => time(a) - time(b))
  const groups = []
  const lastOf = new Map() // persona -> su grupo abierto

  const reopenPrevious = (user) => {
    for (let i = groups.length - 1; i >= 0; i--) {
      if (groups[i].user === user) return lastOf.set(user, groups[i])
    }
    lastOf.delete(user)
  }

  for (const e of sorted) {
    const t = time(e)
    const user = e.user_id ?? 'alguien'
    const g = lastOf.get(user)

    // 1) Toque sin querer: deshace la acción anterior del mismo artículo.
    const undone = UNDOES[e.kind]
    if (undone && g && g.kind === undone) {
      const idx = findLastIndex(g.items, (it) => it.id === e.item_id && t - it.t <= UNDO_WINDOW)
      if (idx !== -1) {
        g.items.splice(idx, 1)
        if (g.items.length === 0) {
          groups.splice(groups.indexOf(g), 1)
          reopenPrevious(user)
        } else {
          g.last = Math.max(...g.items.map((it) => it.t))
        }
        continue
      }
    }

    // 2) Corrección del nombre justo después de agregarlo.
    if (e.kind === 'rename_item' && g && g.kind === 'add') {
      const it = [...g.items].reverse().find((x) => x.id === e.item_id && t - x.t <= UNDO_WINDOW)
      if (it) {
        it.name = e.item_name
        continue
      }
    }

    // 3) ¿Se suma al grupo abierto de esa persona?
    const item = { id: e.item_id, name: e.item_name, extra: e.extra, t }
    const windowMs = WINDOW[e.kind] ?? DEFAULT_WINDOW
    const sameKind = g && g.kind === e.kind && ((e.kind !== 'move' && e.kind !== 'move_in') || g.extra === e.extra)
    if (sameKind && t - g.last <= windowMs) {
      g.items.push(item)
      g.last = t
      g.userName = e.user_name || g.userName
    } else {
      const ng = {
        key: e.id,
        kind: e.kind,
        user,
        userName: e.user_name,
        extra: e.extra,
        items: [item],
        last: t,
      }
      groups.push(ng)
      lastOf.set(user, ng)
    }
  }

  return groups.sort((a, b) => b.last - a.last)
}

function findLastIndex(arr, fn) {
  for (let i = arr.length - 1; i >= 0; i--) if (fn(arr[i])) return i
  return -1
}

const VERBS = {
  add: 'agregó',
  buy: 'marcó',
  unbuy: 'desmarcó',
  delete: 'borró',
  move: 'movió',
  move_in: 'trajo',
  rename_item: 'renombró',
  rename_list: 'cambió el nombre de la lista a',
}

// Texto de una fila (sin el nombre de la persona).
// Devuelve { verb, detail, names, total } para poder recortar la lista de artículos.
export function describe(g) {
  const verb = VERBS[g.kind] ?? g.kind
  if (g.kind === 'rename_list') {
    return { verb, detail: `«${g.items[g.items.length - 1].name}»`, names: [], total: 0 }
  }
  const names = g.items.map((it) =>
    g.kind === 'rename_item' ? `${it.extra} → ${it.name}` : it.name,
  )
  let detail = ''
  if (g.kind === 'buy') detail = names.length > 1 ? 'como listos' : 'como listo'
  if (g.kind === 'move') detail = `a ${g.extra ?? 'otra lista'}`
  if (g.kind === 'move_in') detail = `desde ${g.extra ?? 'otra lista'}`
  return { verb, detail, names, total: names.length }
}

// Recorta la lista de nombres para que quepa en ~2 líneas: "leche, pan y 6 más".
export function shortNames(names, maxChars = 60) {
  const shown = []
  let len = 0
  for (const n of names) {
    if (shown.length > 0 && len + n.length + 2 > maxChars) break
    shown.push(n)
    len += n.length + 2
  }
  return { text: shown.join(', '), rest: names.length - shown.length }
}
