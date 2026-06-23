'use client'

import { useEffect } from 'react'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 text-center">
      <span className="text-6xl mb-6">⚠️</span>
      <h1 className="text-2xl font-bold text-slate-800 mb-3">Etwas ist schiefgelaufen</h1>
      <p className="text-slate-500 mb-8 max-w-sm leading-relaxed">
        Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.
      </p>
      <button
        onClick={reset}
        className="bg-green-700 hover:bg-green-800 text-white font-semibold rounded-xl px-5 py-2.5 transition-colors"
      >
        Erneut versuchen
      </button>
    </div>
  )
}
