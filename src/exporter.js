import { APP_NAME } from './config'

// Arma el contenido limpio de la lista: título, fecha y SOLO lo pendiente.
export function buildDoc(listName, pending) {
  const date = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const items = pending.map((i) => ({ name: i.name, qty: i.quantity ?? 1 }))
  const count = `${items.length} ${items.length === 1 ? 'artículo' : 'artículos'}`
  return { title: listName, subtitle: `${APP_NAME} · ${date} · ${count}`, items }
}

const EMPTY = 'No queda nada pendiente.'

// Versión texto (para WhatsApp, correo, notas).
export function toText(doc) {
  const lines = [doc.title.toUpperCase(), doc.subtitle, '']
  if (doc.items.length === 0) lines.push(EMPTY)
  for (const it of doc.items) lines.push(`• ${it.name} — ${it.qty}`)
  return lines.join('\n').trim()
}

const slug = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'lista'

// Versión PDF (A4): título, fecha y una tabla de dos columnas: Artículo | Cantidad.
// Devuelve el archivo listo para descargar o enviar.
export async function makePDF(doc) {
  const { jsPDF } = await import('jspdf') // se carga solo cuando se exporta
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const M = 20 // margen
  const W = 210
  const QTY_X = W - M // cantidad alineada a la derecha
  const NAME_W = 135
  const BOTTOM = 297 - M
  const INK = [23, 23, 23]
  const MUTED = [120, 115, 110]
  const LINE = [215, 210, 205]
  let y = M + 4

  const header = () => {
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(...MUTED)
    pdf.text('ARTÍCULO', M, y)
    pdf.text('CANTIDAD', QTY_X, y, { align: 'right' })
    y += 3
    pdf.setDrawColor(...INK); pdf.setLineWidth(0.5); pdf.line(M, y, W - M, y)
    y += 8
  }

  // Título y fecha
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(22); pdf.setTextColor(...INK)
  const titleLines = pdf.splitTextToSize(doc.title.toUpperCase(), W - 2 * M)
  pdf.text(titleLines, M, y + 4)
  y += 4 + titleLines.length * 9
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(...MUTED)
  pdf.text(doc.subtitle, M, y)
  y += 12

  if (doc.items.length === 0) {
    pdf.setFontSize(12); pdf.setTextColor(...INK)
    pdf.text(EMPTY, M, y)
  } else {
    header()
    for (const it of doc.items) {
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(12); pdf.setTextColor(...INK)
      const lines = pdf.splitTextToSize(it.name, NAME_W)
      const h = lines.length * 5.2 + 5.5
      if (y + h > BOTTOM) { pdf.addPage(); y = M + 4; header() }
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(12); pdf.setTextColor(...INK)
      pdf.text(lines, M, y)
      pdf.text(String(it.qty), QTY_X, y, { align: 'right' })
      y += lines.length * 5.2 - 1.5
      pdf.setDrawColor(...LINE); pdf.setLineWidth(0.2); pdf.line(M, y, W - M, y)
      y += 7
    }
  }

  // Número de página si hay más de una
  const pages = pdf.getNumberOfPages()
  if (pages > 1) {
    for (let i = 1; i <= pages; i++) {
      pdf.setPage(i)
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(...MUTED)
      pdf.text(`${i} / ${pages}`, W - M, 297 - 10, { align: 'right' })
    }
  }

  const name = `${slug(doc.title)}.pdf`
  return new File([pdf.output('blob')], name, { type: 'application/pdf' })
}

// Guarda el PDF en este dispositivo.
export async function downloadPDF(doc) {
  const file = await makePDF(doc)
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

// Envía el PDF como adjunto (WhatsApp, correo…). Devuelve false si el dispositivo no lo permite.
export async function sharePDF(doc) {
  const file = await makePDF(doc)
  if (!navigator.canShare || !navigator.canShare({ files: [file] })) return false
  try {
    await navigator.share({ files: [file], title: doc.title })
  } catch { /* cancelado */ }
  return true
}
