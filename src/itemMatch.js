// Detecta si dos artículos son "el mismo" aunque estén escritos distinto:
// sin importar tildes, mayúsculas, espacios, signos ni el plural simple.
// Ej.: "Pimentón" = "pimenton" = "Pimentones"; "Pan" = "panes"; "Tomate" = "tomates".

export function normalizeName(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita tildes (á → a, ñ → n)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ') // signos y espacios repetidos → un espacio
    .trim()
}

export function sameItem(a, b) {
  const x = normalizeName(a)
  const y = normalizeName(b)
  if (!x || !y) return false
  return x === y || x + 's' === y || y + 's' === x || x + 'es' === y || y + 'es' === x
}

// Primer artículo de la lista que coincide con el nombre (o undefined).
export function findDuplicate(items, name) {
  return items.find((i) => sameItem(i.name, name))
}
