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
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center px-4 text-center">
      <span className="text-6xl mb-6">⚠️</span>
      <h1 className="text-2xl font-bold text-foreground mb-3">Etwas ist schiefgelaufen</h1>
      <p className="text-muted-foreground mb-8 max-w-sm leading-relaxed">
        Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.
      </p>
      <button
        onClick={reset}
        className="bg-primary text-primary-foreground hover:opacity-90 font-semibold rounded-xl px-5 py-2.5 transition-colors"
      >
        Erneut versuchen
      </button>
    </div>
  )
}

