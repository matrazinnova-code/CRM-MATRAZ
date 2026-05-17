'use client'

export default function PrintButton() {
  return (
    <button
      className="btn primary"
      style={{ display: 'inline-flex' }}
      onClick={() => window.print()}
    >
      🖨️ Guardar / Imprimir PDF
    </button>
  )
}
