// Pruebas del agrupamiento del historial. Ejecutar con: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { describe as describeGroup, groupEvents, shortNames } from './history.js'

const T0 = Date.parse('2026-11-24T20:00:00Z')
let n = 0
const ev = (sec, user, kind, item, extra) => ({
  id: 'e' + n++,
  created_at: new Date(T0 + sec * 1000).toISOString(),
  user_id: user, user_name: user, kind, item_id: item, item_name: item, extra,
})
// Resultado legible, de la fila más antigua a la más nueva
const rows = (events) =>
  groupEvents(events).reverse().map((g) => `${g.userName} ${g.kind}${g.extra ? `(${g.extra})` : ''}: ${g.items.map((i) => i.name).join(',')}`)

test('10 artículos agregados seguidos quedan en una sola fila', () => {
  const events = Array.from({ length: 10 }, (_, i) => ev(i * 10, 'Ana', 'add', 'i' + i))
  assert.deepEqual(rows(events), ['Ana add: i0,i1,i2,i3,i4,i5,i6,i7,i8,i9'])
})

test('más de 1 minuto entre agregados = dos filas', () => {
  assert.deepEqual(rows([ev(0, 'Ana', 'add', 'A'), ev(90, 'Ana', 'add', 'B')]), ['Ana add: A', 'Ana add: B'])
})

test('la ventana es móvil: uno cada 40 s durante 5 min sigue siendo una fila', () => {
  const events = Array.from({ length: 8 }, (_, i) => ev(i * 40, 'Ana', 'add', 'i' + i))
  assert.equal(rows(events).length, 1)
})

test('marcar como listo agrupa hasta 15 minutos entre uno y otro', () => {
  assert.deepEqual(rows([ev(0, 'Ana', 'buy', 'A'), ev(13 * 60, 'Ana', 'buy', 'B'), ev(27 * 60, 'Ana', 'buy', 'C')]), ['Ana buy: A,B,C'])
  assert.deepEqual(rows([ev(0, 'Ana', 'buy', 'A'), ev(20 * 60, 'Ana', 'buy', 'B')]), ['Ana buy: A', 'Ana buy: B'])
})

test('marcar y desmarcar enseguida no aparece', () => {
  assert.deepEqual(rows([ev(0, 'Ana', 'buy', 'X'), ev(10, 'Ana', 'unbuy', 'X')]), [])
})

test('un toque por error no corta el grupo', () => {
  const events = [ev(0, 'Ana', 'buy', 'A'), ev(5, 'Ana', 'buy', 'B'), ev(25, 'Ana', 'unbuy', 'B'), ev(300, 'Ana', 'buy', 'C')]
  assert.deepEqual(rows(events), ['Ana buy: A,C'])
})

test('lo que hace otra persona en el medio no corta el grupo', () => {
  const events = [ev(0, 'Ana', 'add', 'A'), ev(10, 'Gus', 'add', 'G'), ev(20, 'Ana', 'add', 'B')]
  assert.deepEqual(rows(events), ['Gus add: G', 'Ana add: A,B'])
})

test('otra acción de la misma persona sí corta el grupo', () => {
  const events = [ev(0, 'Ana', 'add', 'A'), ev(10, 'Ana', 'buy', 'X'), ev(20, 'Ana', 'add', 'B')]
  assert.deepEqual(rows(events), ['Ana add: A', 'Ana buy: X', 'Ana add: B'])
})

test('agregar y corregir el nombre enseguida muestra el nombre corregido', () => {
  const events = [{ ...ev(0, 'Ana', 'add', 'id1'), item_name: 'lehce' }, { ...ev(10, 'Ana', 'rename_item', 'id1'), item_name: 'leche', extra: 'lehce' }]
  assert.deepEqual(rows(events), ['Ana add: leche'])
})

test('agregar y borrar enseguida no aparece', () => {
  assert.deepEqual(rows([ev(0, 'Ana', 'add', 'A'), ev(5, 'Ana', 'add', 'B'), ev(15, 'Ana', 'delete', 'B')]), ['Ana add: A'])
})

test('"Desmarcar todos" mucho después no anula lo marcado', () => {
  const events = [ev(0, 'Ana', 'buy', 'A'), ev(30, 'Ana', 'buy', 'B'), ev(630, 'Ana', 'unbuy', 'A'), ev(630, 'Ana', 'unbuy', 'B')]
  assert.deepEqual(rows(events), ['Ana buy: A,B', 'Ana unbuy: A,B'])
})

test('mover a listas distintas genera filas distintas', () => {
  const events = [ev(0, 'Ana', 'move', 'A', 'Super'), ev(5, 'Ana', 'move', 'B', 'Super'), ev(10, 'Ana', 'move', 'C', 'Casa')]
  assert.deepEqual(rows(events), ['Ana move(Super): A,B', 'Ana move(Casa): C'])
})

test('al anular un toque, el grupo anterior vuelve a quedar abierto', () => {
  const events = [ev(0, 'Ana', 'add', 'A'), ev(5, 'Ana', 'buy', 'X'), ev(10, 'Ana', 'unbuy', 'X'), ev(20, 'Ana', 'add', 'B')]
  assert.deepEqual(rows(events), ['Ana add: A,B'])
})

test('la fila que sigue abierta sube al primer lugar al sumar algo', () => {
  const groups = groupEvents([ev(0, 'Ana', 'buy', 'A'), ev(60, 'Gus', 'add', 'G'), ev(13 * 60, 'Ana', 'buy', 'B')])
  assert.equal(groups[0].userName, 'Ana')
  assert.equal(groups[0].items.length, 2)
})

test('textos: "marcó 2 como listos" y "movió a Super"', () => {
  assert.equal(describeGroup({ kind: 'buy', items: [{ name: 'a' }, { name: 'b' }] }).detail, 'como listos')
  assert.equal(describeGroup({ kind: 'buy', items: [{ name: 'a' }] }).detail, 'como listo')
  assert.equal(describeGroup({ kind: 'move', extra: 'Super', items: [{ name: 'a' }] }).detail, 'a Super')
})

test('nombres largos se recortan con "y N más"', () => {
  const r = shortNames(['leche entera', 'pan de molde', 'huevos', 'arroz grado 1', 'detergente', 'papel higiénico', 'café'])
  assert.equal(r.rest, 3)
})
