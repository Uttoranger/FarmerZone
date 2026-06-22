'use client'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="text-sm bg-green-700 text-white px-3 py-1.5 rounded-lg hover:bg-green-800"
    >
      Drucken
    </button>
  )
}
