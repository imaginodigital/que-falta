import { useEffect, useState } from 'react'
import { downloadPDF, sharePDF, toText } from './exporter'

// Ventana "Exportar": enviar la lista a alguien o guardarla en este dispositivo.
export default function ExportSheet({ doc, onToast, onClose }) {
  const [busy, setBusy] = useState('')
  const canShare = typeof navigator !== 'undefined' && !!navigator.share

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function copyText() {
    try {
      await navigator.clipboard.writeText(toText(doc))
      onToast('Lista copiada como texto')
    } catch {
      alert(toText(doc))
    }
    onClose()
  }

  async function sendText() {
    if (!canShare) return copyText()
    try { await navigator.share({ title: doc.title, text: toText(doc) }) } catch { /* cancelado */ }
    onClose()
  }

  async function sendPDF() {
    setBusy('send')
    try {
      const sent = await sharePDF(doc)
      if (!sent) {
        // El dispositivo no permite adjuntar archivos: lo guardamos para que lo envíes tú.
        await downloadPDF(doc)
        onToast('PDF descargado. Adjúntalo desde tus archivos.')
      }
      onClose()
    } catch (e) {
      alert('No se pudo crear el PDF: ' + e.message)
      setBusy('')
    }
  }

  async function savePDF() {
    setBusy('save')
    try {
      await downloadPDF(doc)
      onToast('PDF descargado')
      onClose()
    } catch (e) {
      alert('No se pudo crear el PDF: ' + e.message)
      setBusy('')
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Exportar lista" onClick={(e) => e.stopPropagation()}>
        <p className="sheet-eyebrow">Exportar</p>
        <h2 className="sheet-title">{doc.title}</h2>
        <p className="muted export-note">Solo lo pendiente, con su cantidad.</p>

        <p className="field-label">Enviar a alguien</p>
        <div className="sheet-actions">
          <button className="sheet-option stack" onClick={sendText}>
            <span className="opt-main">Como texto</span>
            <span className="opt-sub">{canShare ? 'WhatsApp, correo o cualquier app' : 'Se copia para que lo pegues donde quieras'}</span>
          </button>
          <button className="sheet-option stack" onClick={sendPDF} disabled={!!busy}>
            <span className="opt-main">{busy === 'send' ? 'Creando PDF…' : 'Como PDF'}</span>
            <span className="opt-sub">Se envía como archivo adjunto</span>
          </button>
        </div>

        <p className="field-label">Guardar en este dispositivo</p>
        <div className="sheet-actions">
          <button className="sheet-option stack" onClick={savePDF} disabled={!!busy}>
            <span className="opt-main">{busy === 'save' ? 'Creando PDF…' : 'Descargar PDF'}</span>
            <span className="opt-sub">Queda en tus descargas o archivos</span>
          </button>
          <button className="sheet-option stack" onClick={copyText}>
            <span className="opt-main">Copiar texto</span>
            <span className="opt-sub">Para pegarlo en tus notas u otra app</span>
          </button>
        </div>

        <div className="modal-footer">
          <button className="pill outline sm" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
