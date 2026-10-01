'use client'

import { useEffect } from 'react'
import { FehlerAnsicht } from '@/components/shared/fehler-ansicht'

/**
 * Die Fehlergrenze innerhalb des Root-Layouts: Hier landet alles, was beim
 * Rendern einer Seite scheitert. Reißt das Layout selbst, greift stattdessen
 * `global-error.tsx` — dieselbe Ansicht, eigenes `<html>`.
 *
 * Nach Sentry gemeldet wird von hier NICHT: Server-Fehler fängt die
 * Instrumentierung, Client-Fehler die Grenze in `global-error.tsx`. Eine
 * zweite Meldung an derselben Stelle wäre ein doppelter Eintrag.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Nur außerhalb der Produktion auf die Konsole — dort steht sonst ein
    // Fehlertext, den niemand liest und der etwas verraten kann (Muster aus
    // src/lib/upload-fehler.ts).
    if (process.env.NODE_ENV !== 'production') console.error(error)
  }, [error])

  return <FehlerAnsicht fehlernummer={error.digest} nochmal={reset} />
}
