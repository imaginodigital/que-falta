// Pruebas de la detección de artículos repetidos. Ejecutar con: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findDuplicate, sameItem } from './itemMatch.js'

test('ignora tildes y mayúsculas', () => {
  assert.ok(sameItem('Pimentón', 'pimenton'))
  assert.ok(sameItem('PIÑA', 'pina'))
  assert.ok(sameItem('Azúcar', 'AZUCAR'))
})

test('ignora espacios y signos de más', () => {
  assert.ok(sameItem('  Papel   higiénico ', 'papel higienico'))
  assert.ok(sameItem('Leche (entera)', 'leche entera'))
})

test('reconoce el plural simple', () => {
  assert.ok(sameItem('Huevo', 'Huevos'))
  assert.ok(sameItem('Pan', 'Panes'))
  assert.ok(sameItem('Tomate', 'tomates'))
  assert.ok(sameItem('Pimentón', 'Pimentones'))
})

test('no confunde artículos distintos', () => {
  assert.ok(!sameItem('Leche', 'Leche condensada'))
  assert.ok(!sameItem('Pan', 'Pana'))
  assert.ok(!sameItem('Café', 'Cafetera'))
  assert.ok(!sameItem('', ''))
})

test('encuentra el repetido dentro de la lista', () => {
  const items = [{ id: 1, name: 'Arroz' }, { id: 2, name: 'Pimentón' }]
  assert.equal(findDuplicate(items, 'pimenton')?.id, 2)
  assert.equal(findDuplicate(items, 'Fideos'), undefined)
})
