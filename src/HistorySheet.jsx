import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { describe, groupEvents, shortNames } from './history'

const MAX_ROWS = 10

// Ventana "Historial": últimas 10 acciones (agrupadas) de la lista. Se actualiza en vivo.
export default function HistorySheet({ listId, myId, shared, formatWhen, onClose }) {
  const [events, setEvents] = useState(null)
  const [open, setOpen] = useState(null) // fila expandida
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('list_events')
      .select('id, user_id, user_name, kind, item_id, item_name, extra, created_at')
      .eq('list_id', listId)
      .order('created_at', { ascending: false })
      .limit(300)
    if (error) {
      console.error(error)
      setError(error.message)
      setEvents([])
      return
    }
    setError('')
    setEvents(data ?? [])
  }, [listId])

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`history-${listId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'list_events', filter: `list_id=eq.${listId}` }, load)
      .subscribe()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('keydown', onKey)
    }
  }, [listId, load, onClose])

  const rows = useMemo(() => (events ? groupEvents(events).slice(0, MAX_ROWS) : []), [events])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Historial" onClick={(e) => e.stopPropagation()}>
        <h2 className="sheet-title">Historial</h2>

        {error ? (
          <p className="error">No se pudo cargar el historial: {error}</p>
        ) : events === null ? (
          <p className="muted">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="muted sheet-note">
            Todavía no hay movimientos. Aquí verás lo que se agrega, se marca como listo, se desmarca, se borra o se renombra.
          </p>
        ) : (
          <ul className="history">
            {rows.map((g) => {
              const { verb, detail, names, total } = describe(g)
              const expanded = open === g.key
              const cut = shortNames(names)
              const canExpand = cut.rest > 0
              // En una lista solo tuya no hace falta decir quién fue.
              const showWho = shared || g.user !== myId
              const who = g.userName || 'Alguien'
              const verbText = showWho ? verb : verb.charAt(0).toUpperCase() + verb.slice(1)
              return (
                <li key={g.key}>
                  <button
                    className={`history-row ${canExpand ? 'can-expand' : ''}`}
                    onClick={() => canExpand && setOpen(expanded ? null : g.key)}
                    aria-expanded={canExpand ? expanded : undefined}
                    tabIndex={canExpand ? 0 : -1}
                  >
                    <span className="history-text">
                      {showWho && <b>{who} </b>}
                      {verbText}
                      {total > 1 && ` ${total}`}
                      {detail && ` ${detail}`}
                      {names.length > 0 && (total > 1 || detail ? ': ' : ' ')}
                      {names.length > 0 && (expanded || !canExpand ? names.join(', ') : cut.text)}
                      {!expanded && canExpand && <span className="history-more"> y {cut.rest} más</span>}
                    </span>
                    <span className="history-when">{formatWhen(g.last)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <div className="modal-footer">
          <button className="pill outline sm" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
