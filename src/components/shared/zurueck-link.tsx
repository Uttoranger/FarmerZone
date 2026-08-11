'use client'

import { useRouter } from 'next/navigation'

/**
 * „← Zurück" über einer Inhaltsseite.
 *
 * Warum eine eigene Komponente statt `<Link href="javascript:history.back()">`:
 * React blockiert `javascript:`-URLs als Sicherheitsvorkehrung und ersetzt sie
 * beim Rendern durch ein `javascript:throw new Error(…)`. Der Link SIEHT aus
 * wie ein Link, tut aber nichts — nachgeprüft am gebauten HTML.
 *
 * Sonderfall direkter Aufruf: Wer die Seite aus einer Mail oder Suche öffnet,
 * hat keine Vorgeschichte im Tab. `router.back()` liefe ins Leere, deshalb
 * dann auf die Startseite.
 */
export function ZurueckLink({ className }: { className?: string }) {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back()
        else router.push('/')
      }}
      className={className ?? 'text-sm text-primary hover:underline mb-6 inline-block'}
    >
      ← Zurück
    </button>
  )
}
