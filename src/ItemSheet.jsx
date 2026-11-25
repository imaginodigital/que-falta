import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { IconBack, IconMove, IconPencil, IconPlus, IconTrash } from './icons'

// Panel que sube desde abajo con las opciones de un artículo:
// editar nombre, mover a otra lista o borrar.
export default function ItemSheet({ item, currentListId, onClose, onRename, onDelete, onMove }) {
  const [view, setView] = useState('menu') // menu | rename | move
  const [name, setName] = useState(item.name)
  const [lists, setLists] = useState(null)
  const [newList, setNewList] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function openMove() {
    setView('move')
    const { data } = await supabase
      .from('lists')
      .select('id, name')
      .neq('id', currentListId)
      .order('created_at', { ascending: true })
    setLists(data ?? [])
  }

  async function saveName(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    await onRename(item, trimmed)
    onClose()
  }

  async function moveTo(target) {
    setBusy(true)
    await onMove(item, target)
    onClose()
  }

  async function createAndMove(e) {
    e.preventDefault()
    const listName = newList.trim()
    if (!listName) return
    setBusy(true)
    const { data: id, error } = await supabase.rpc('create_list', { list_name: listName })
    if (error) {
      setBusy(false)
      return alert(error.message)
    }
    await onMove(item, { id, name: listName })
    onClose()
  }

  async function remove() {
    await onDelete(item)
    onClose()
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`Opciones de ${item.name}`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />

        {view === 'menu' && (
          <>
            <p className="sheet-eyebrow">Artículo</p>
            <h2 className="sheet-title">{item.name}</h2>
            <div className="sheet-actions">
              <button className="sheet-option" onClick={() => setView('rename')}>
                <IconPencil /> Editar nombre
              </button>
              <button className="sheet-option" onClick={openMove}>
                <IconMove /> Mover a otra lista
              </button>
              <button className="sheet-option danger" onClick={remove}>
                <IconTrash /> Borrar
              </button>
            </div>
            <div className="modal-footer">
              <button className="pill outline sm" onClick={onClose}>Cerrar</button>
            </div>
          </>
        )}

        {view === 'rename' && (
          <form onSubmit={saveName}>
            <button type="button" className="sheet-back" onClick={() => setView('menu')}>
              <IconBack width={16} height={16} /> Volver
            </button>
            <h2 className="sheet-title">Editar nombre</h2>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre del artículo" />
            <button className="pill ink block">Guardar</button>
          </form>
        )}

        {view === 'move' && (
          <>
            <button className="sheet-back" onClick={() => setView('menu')}>
              <IconBack width={16} height={16} /> Volver
            </button>
            <h2 className="sheet-title">Mover a…</h2>

            {lists === null ? (
              <p className="muted">Cargando listas…</p>
            ) : lists.length === 0 ? (
              <p className="muted sheet-note">No tienes otras listas. Crea una y el artículo se moverá ahí.</p>
            ) : (
              <div className="sheet-actions">
                {lists.map((l) => (
                  <button key={l.id} className="sheet-option" disabled={busy} onClick={() => moveTo(l)}>
                    <IconMove /> {l.name}
                  </button>
                ))}
              </div>
            )}

            <form className="sheet-new" onSubmit={createAndMove}>
              <input
                placeholder="Nueva lista…"
                value={newList}
                onChange={(e) => setNewList(e.target.value)}
                aria-label="Nombre de la nueva lista"
              />
              <button className="pill ink" disabled={busy}>
                <IconPlus width={16} height={16} /> Crear y mover
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
