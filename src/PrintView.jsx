// Versión para imprimir: título, fecha y una tabla Artículo | Cantidad
// solo con lo pendiente. En pantalla no se ve; aparece únicamente al imprimir.
export default function PrintView({ doc }) {
  return (
    <div className="print-doc" aria-hidden="true">
      <h1>{doc.title}</h1>
      <p className="print-sub">{doc.subtitle}</p>
      {doc.items.length === 0 ? (
        <p>No queda nada pendiente.</p>
      ) : (
        <table>
          <thead>
            <tr><th>Artículo</th><th className="q">Cantidad</th></tr>
          </thead>
          <tbody>
            {doc.items.map((it, i) => (
              <tr key={i}><td>{it.name}</td><td className="q">{it.qty}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
