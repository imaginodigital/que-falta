import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase'
import { go } from './router'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ItemSheet from './ItemSheet'
import ConfirmSheet from './ConfirmSheet'
import { IconBack, IconCheck, IconDots, IconExport, IconGrip, IconHistory, IconPrint, IconRefresh, IconSettings, IconShareNodes, IconSort } from './icons'
import ExportSheet from './ExportSheet'
import PrintView from './PrintView'
import { buildDoc } from './exporter'
import HistorySheet from './HistorySheet'
import ListSettings from './ListSettings'
import ShareSheet from './ShareSheet'
import { useRefreshOnReturn } from './live'

const byName = (a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
const byPos = (a, b) => (a.position - b.position) || byName(a, b)

const DISMISSED_KEY = 'lista-avisos-cerrados'
function readDismissed() {
  try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]') } catch { return [] }
}

// "hoy 21:00", "ayer 18:30" o "mié 24/11, 21:00"
function formatWhen(ts) {
  const d = new Date(ts)
  const now = new Date()
  const time = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((day(now) - day(d)) / 86400000)
  if (diff === 0) return `hoy ${time}`
  if (diff === 1) return `ayer ${time}`
  const wd = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][d.getDay()]
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${wd} ${dd}/${mm}, ${time}`
}

export default function ListView({ listId, session }) {
  const myId = session.user.id
  const [list, setList] = useState(null)
  const [items, setItems] = useState([])
  const [newItem, setNewItem] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null) // ítem con el menú ⋯ abierto
  const [toast, setToast] = useState('')
  const [confirm, setConfirm] = useState(null) // 'uncheck' | 'clear'
  const [people, setPeople] = useState({}) // id de usuario -> nombre
  const [memberIds, setMemberIds] = useState([])
  const [shareOpen, setShareOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [missing, setMissing] = useState(false) // la lista ya no existe o saliste
  const [activity, setActivity] = useState([]) // avisos: "Pato salió de la lista"
  const itemIds = useRef(new Set())
  useEffect(() => { itemIds.current = new Set(items.map((i) => i.id)) }, [items])

  const loadList = useCallback(async () => {
    const { data } = await supabase.from('lists').select('*').eq('id', listId).maybeSingle()
    if (!data) setMissing(true)
    else setList(data)
  }, [listId])

  const loadItems = useCallback(async () => {
    const { data } = await supabase.from('items').select('*').eq('list_id', listId)
    setItems(data ?? [])
    setLoading(false)
  }, [listId])

  // Quiénes están en la lista y sus nombres (para mostrar "por Ana").
  const loadPeople = useCallback(async () => {
    const { data: members } = await supabase.from('list_members').select('user_id').eq('list_id', listId)
    const ids = (members ?? []).map((m) => m.user_id)
    setMemberIds(ids)
    if (ids.length === 0) return
    const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', ids)
    setPeople(Object.fromEntries((profiles ?? []).map((p) => [p.id, p.name])))
  }, [listId])

  // Avisos de los últimos 14 días que no hayas cerrado.
  const loadActivity = useCallback(async () => {
    const since = new Date(Date.now() - 14 * 86400000).toISOString()
    const { data } = await supabase
      .from('list_activity')
      .select('id, user_name, kind, created_at')
      .eq('list_id', listId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
    const hidden = readDismissed()
    setActivity((data ?? []).filter((a) => !hidden.includes(a.id)))
  }, [listId])

  const reloadAll = useCallback(
    () => Promise.all([loadList(), loadItems(), loadPeople(), loadActivity()]),
    [loadList, loadItems, loadPeople, loadActivity],
  )

  useEffect(() => {
    reloadAll()
    // Tiempo real: si otra persona cambia algo, se actualiza solo.
    const channel = supabase
      .channel(`list-${listId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `list_id=eq.${listId}` }, loadItems)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lists', filter: `id=eq.${listId}` }, loadList)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'list_members', filter: `list_id=eq.${listId}` }, loadPeople)
      // Los borrados no se pueden filtrar por lista: revisamos si el artículo era de esta.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'items' }, (p) => {
        if (itemIds.current.has(p.old?.id)) loadItems()
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'lists' }, (p) => {
        if (p.old?.id === listId) setMissing(true)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'list_activity', filter: `list_id=eq.${listId}` }, () => {
        loadActivity()
        loadPeople()
      })
      .subscribe((status) => {
        // Cada vez que la conexión en vivo se (re)establece, traemos lo que pudo faltar.
        if (status === 'SUBSCRIBED') reloadAll()
      })
    return () => { supabase.removeChannel(channel) }
  }, [listId, loadItems, loadList, loadPeople, loadActivity, reloadAll])

  // Al volver a la app (o recuperar internet), recargamos.
  useRefreshOnReturn(reloadAll)

  async function manualRefresh() {
    setRefreshing(true)
    await Promise.all([reloadAll(), new Promise((r) => setTimeout(r, 500))])
    setRefreshing(false)
  }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(t)
  }, [toast])

  // Pendientes arriba, listos abajo. Dentro de cada grupo: alfabético o manual.
  const { pending, done } = useMemo(() => {
    const sorter = list?.sort_mode === 'manual' ? byPos : byName
    return {
      pending: items.filter((i) => !i.bought).sort(sorter),
      done: items.filter((i) => i.bought).sort(sorter),
    }
  }, [items, list])

  // Contenido limpio para exportar e imprimir: solo lo que falta, con nombre y cantidad.
  const printDoc = useMemo(() => buildDoc(list?.name ?? '', pending), [list?.name, pending])

  async function addItem(e) {
    e.preventDefault()
    const name = newItem.trim()
    if (!name) return
    setNewItem('')
    const maxPos = items.reduce((m, i) => Math.max(m, i.position ?? 0), 0)
    const { error } = await supabase.from('items').insert({
      list_id: listId,
      name,
      quantity: 1,
      bought: false,
      position: maxPos + 1,
      created_by: myId,
    })
    if (error) alert(error.message)
  }

  async function toggleBought(item) {
    const change = { bought: !item.bought, bought_by: item.bought ? null : myId }
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...change } : i)))
    await supabase.from('items').update(change).eq('id', item.id)
  }

  async function setQuantity(item, q) {
    const quantity = Math.max(1, q)
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, quantity } : i)))
    await supabase.from('items').update({ quantity }).eq('id', item.id)
  }

  async function renameItem(item, name) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, name } : i)))
    await supabase.from('items').update({ name }).eq('id', item.id)
  }

  async function deleteItem(item) {
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    await supabase.from('items').delete().eq('id', item.id)
  }

  // Mover el ítem a otra lista: cambia su list_id y queda al final de esa lista.
  async function moveItem(item, target) {
    const { error } = await supabase
      .from('items')
      .update({ list_id: target.id, position: Date.now() })
      .eq('id', item.id)
    if (error) return alert(error.message)
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    setToast(`"${item.name}" se movió a ${target.name}`)
  }

  // Borrar todos los listos (se llama después de confirmar).
  async function clearBought() {
    const n = done.length
    setItems((prev) => prev.filter((i) => !i.bought))
    const { error } = await supabase.from('items').delete().eq('list_id', listId).eq('bought', true)
    if (error) return alert(error.message)
    setToast(n === 1 ? 'Se borró 1 artículo' : `Se borraron ${n} artículos`)
  }

  // Desmarcar todos: los listos vuelven a la parte de arriba (pendientes).
  async function uncheckAll() {
    const n = done.length
    setItems((prev) => prev.map((i) => (i.bought ? { ...i, bought: false, bought_by: null } : i)))
    const { error } = await supabase.from('items').update({ bought: false, bought_by: null }).eq('list_id', listId).eq('bought', true)
    if (error) return alert(error.message)
    setToast(n === 1 ? '1 artículo volvió a pendientes' : `${n} artículos volvieron a pendientes`)
  }

  async function toggleNames(show_names) {
    setList((l) => ({ ...l, show_names }))
    await supabase.from('lists').update({ show_names }).eq('id', listId)
  }

  async function renameList(name) {
    const { error } = await supabase.from('lists').update({ name }).eq('id', listId)
    if (error) return alert(error.message)
    setList((l) => ({ ...l, name }))
    setToast('Nombre actualizado')
  }

  // Quien la creó la borra; los demás salen de ella.
  async function removeList() {
    const { error } = isOwner
      ? await supabase.from('lists').delete().eq('id', listId)
      : await supabase.rpc('leave_list', { p_list_id: listId })
    if (error) return alert(error.message)
    go({ name: 'home' })
  }

  function dismissActivity(id) {
    setActivity((all) => all.filter((a) => a.id !== id))
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...readDismissed(), id].slice(-200)))
    } catch { /* sin almacenamiento: se vuelve a mostrar la próxima vez */ }
  }

  async function sortAlpha() {
    if (list?.sort_mode === 'alpha') return
    setList((l) => ({ ...l, sort_mode: 'alpha' }))
    await supabase.from('lists').update({ sort_mode: 'alpha' }).eq('id', listId)
  }

  // Reordenar dentro de un grupo -> la lista pasa a modo manual.
  async function reorder(group, oldIndex, newIndex) {
    const next = arrayMove(group, oldIndex, newIndex)
    const base = group === pending ? 0 : 1000
    const updates = next.map((it, idx) => ({ id: it.id, position: base + idx }))
    setItems((prev) =>
      prev.map((i) => {
        const u = updates.find((x) => x.id === i.id)
        return u ? { ...i, position: u.position } : i
      }),
    )
    if (list?.sort_mode !== 'manual') {
      setList((l) => ({ ...l, sort_mode: 'manual' }))
      await supabase.from('lists').update({ sort_mode: 'manual' }).eq('id', listId)
    }
    await Promise.all(
      updates.map((u) => supabase.from('items').update({ position: u.position }).eq('id', u.id)),
    )
  }


  // "por Ana": quién lo marcó como listo. Solo en listos y si la lista tiene la opción activada.
  const who = (item) => {
    if (!list?.show_names || !item.bought) return null
    return people[item.bought_by] || null
  }
  const updatedBy = memberIds.length > 1 ? people[list?.updated_by] : null

  const isOwner = list?.owner === myId

  if (missing) {
    return (
      <div className="center">
        <div className="hero-card">
          <p className="name-q">Esta lista ya no está</p>
          <p className="muted">Quien la creó la borró, o ya no estás en ella.</p>
          <button className="pill ink block" onClick={() => go({ name: 'home' })}>Ir a mis listas</button>
        </div>
      </div>
    )
  }

  if (loading || !list) return <div className="center muted">Cargando…</div>

  return (
    <div className="screen">
      <header className="band">
        <div className="band-inner">
          <div className="band-nav">
            <button className="pill outline sm" onClick={() => go({ name: 'home' })}>
              <IconBack width={16} height={16} /> Listas
            </button>
            <div className="band-actions">
              <button
                className={`round-btn ${refreshing ? 'spinning' : ''}`}
                onClick={manualRefresh}
                aria-label="Actualizar lista"
                title="Actualizar"
              >
                <IconRefresh width={18} height={18} />
              </button>
              <button className="round-btn" onClick={() => setHistoryOpen(true)} aria-label="Historial" title="Historial">
                <IconHistory width={18} height={18} />
              </button>
              <button className="round-btn" onClick={() => setSettingsOpen(true)} aria-label="Ajustes de la lista" title="Ajustes">
                <IconSettings width={18} height={18} />
              </button>
              <button className="round-btn" onClick={() => setShareOpen(true)} aria-label="Compartir lista" title="Compartir">
                <IconShareNodes width={18} height={18} />
              </button>
            </div>
          </div>
          <h1 className="title">{list.name}</h1>
          <p className="band-sub">
            {pending.length} {pending.length === 1 ? 'pendiente' : 'pendientes'} · {done.length}{' '}
            {done.length === 1 ? 'listo' : 'listos'}
          </p>
          {list.updated_at && (
            <p className="band-update">
              Últ. act.{updatedBy && ` por ${updatedBy}`} · {formatWhen(list.updated_at)}
            </p>
          )}
        </div>
      </header>

      <main className="page">
        {activity.map((a) => (
          <div key={a.id} className="notice" role="status">
            <span><b>{a.user_name || 'Alguien'}</b> salió de la lista · {formatWhen(a.created_at)}</span>
            <button className="notice-close" onClick={() => dismissActivity(a.id)} aria-label="Cerrar aviso">×</button>
          </div>
        ))}

        <form className="add-card" onSubmit={addItem}>
          <input
            placeholder="Agregar artículo…"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            aria-label="Nombre del artículo"
          />
          <button className="pill ink">Agregar</button>
        </form>

        <div className="toolbar">
          <button className="pill outline sm" onClick={sortAlpha} disabled={list.sort_mode === 'alpha'}>
            <IconSort width={16} height={16} />
            <span className="label-long">Ordenar alfabéticamente</span>
            <span className="label-short">Ordenar A–Z</span>
          </button>
          <div className="toolbar-icons">
            <button className="round-btn" onClick={() => setExportOpen(true)} aria-label="Exportar lista" title="Exportar">
              <IconExport width={18} height={18} />
            </button>
            <button className="round-btn" onClick={() => window.print()} aria-label="Imprimir lista" title="Imprimir">
              <IconPrint width={18} height={18} />
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="empty">
            <p className="empty-title">La lista está vacía</p>
            <p className="muted">Escribe arriba lo que falta en casa y toca Agregar.</p>
          </div>
        ) : (
          <>
            <Group items={pending} onReorder={reorder} onToggle={toggleBought} onQty={setQuantity} onMenu={setSelected} who={who} />
            {done.length > 0 && (
              <>
                <div className="section-head">
                  <h2 className="section-label">Listos</h2>
                  <div className="section-actions">
                    <button className="text-link" onClick={() => setConfirm('uncheck')}>Desmarcar todos</button>
                    <button className="text-link" onClick={() => setConfirm('clear')}>Borrar todos</button>
                  </div>
                </div>
                <Group items={done} onReorder={reorder} onToggle={toggleBought} onQty={setQuantity} onMenu={setSelected} who={who} />
              </>
            )}
          </>
        )}
      </main>

      {selected && (
        <ItemSheet
          item={selected}
          currentListId={listId}
          onClose={() => setSelected(null)}
          onRename={renameItem}
          onDelete={deleteItem}
          onMove={moveItem}
        />
      )}

      {confirm === 'uncheck' && (
        <ConfirmSheet
          title="Desmarcar todos"
          message={`${done.length === 1 ? 'El artículo listo vuelve' : `Los ${done.length} artículos listos vuelven`} a la lista de pendientes.`}
          confirmLabel="Desmarcar todos"
          onConfirm={uncheckAll}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm === 'clear' && (
        <ConfirmSheet
          title="Borrar todos"
          message={`Se ${done.length === 1 ? 'borra el artículo listo' : `borran los ${done.length} artículos listos`} de esta lista, para todas las personas que la comparten. No se puede deshacer.`}
          confirmLabel="Borrar todos"
          danger
          onConfirm={clearBought}
          onClose={() => setConfirm(null)}
        />
      )}

      {settingsOpen && (
        <ListSettings
          list={list}
          isOwner={isOwner}
          ownerName={people[list.owner]}
          members={memberIds.map((id) => people[id]).filter(Boolean)}
          onToggleNames={toggleNames}
          onRename={renameList}
          onRemove={removeList}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {exportOpen && (
        <ExportSheet doc={printDoc} onToast={setToast} onClose={() => setExportOpen(false)} />
      )}

      <PrintView doc={printDoc} />

      {historyOpen && (
        <HistorySheet
          listId={listId}
          myId={myId}
          shared={memberIds.length > 1}
          formatWhen={formatWhen}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {shareOpen && (
        <ShareSheet
          list={list}
          memberIds={memberIds}
          onToggleNames={toggleNames}
          onToast={setToast}
          onClose={() => setShareOpen(false)}
        />
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}

function Group({ items, onReorder, onToggle, onQty, onMenu, who }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  )

  function onDragEnd(e) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    onReorder(items, oldIndex, newIndex)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className="items">
          {items.map((item) => (
            <Row key={item.id} item={item} by={who(item)} onToggle={onToggle} onQty={onQty} onMenu={onMenu} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function Row({ item, by, onToggle, onQty, onMenu }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`item ${item.bought ? 'bought' : ''} ${isDragging ? 'dragging' : ''}`}
      {...attributes}
    >
      <button
        className={`check ${item.bought ? 'on' : ''}`}
        onClick={() => onToggle(item)}
        aria-label={item.bought ? `Desmarcar ${item.name}` : `Marcar ${item.name} como listo`}
      >
        {item.bought && <IconCheck width={16} height={16} strokeWidth={3} />}
      </button>

      <div className="item-text">
        <span className="item-name">{item.name}</span>
        {by && <span className="by">por {by}</span>}
      </div>

      <div className="qty">
        <button className="qty-btn" onClick={() => onQty(item, item.quantity - 1)} aria-label="Restar uno">−</button>
        <span className="qty-n">{item.quantity}</span>
        <button className="qty-btn" onClick={() => onQty(item, item.quantity + 1)} aria-label="Sumar uno">+</button>
      </div>

      <button className="icon-btn" onClick={() => onMenu(item)} aria-label={`Opciones de ${item.name}`}>
        <IconDots />
      </button>
      <button className="drag" {...listeners} aria-label="Arrastrar para reordenar">
        <IconGrip />
      </button>
    </li>
  )
}
