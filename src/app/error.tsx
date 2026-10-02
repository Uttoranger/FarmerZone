'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { FehlerAnsicht } from '@/components/shared/fehler-ansicht'

/**
 * Die Fehlergrenze innerhalb des Root-Layouts: Hier landet alles, was beim
 * Rendern einer Seite scheitert. Reißt das Layout selbst, greift stattdessen
 * `global-error.tsx` — dieselbe Ansicht, eigenes `<html>`.
 *
 * GEMELDET WIRD VON HIER, und das ist nicht doppelt: Die zwei Grenzen
 * schließen sich aus (global-error fängt nur Fehler im Root-Layout und solche,
 * die diese Datei selbst wirft). Ein Render-Fehler im Seitenbaum landet also
 * genau hier — und wäre ohne diesen Aufruf STUMM: `onRequestError`
 * (src/instrumentation.ts) deckt nur den Server ab, und ein Fehler, den eine
 * React-Fehlergrenze gefangen hat, erreicht den Client-SDK nicht von selbst.
 * Der Filter aus src/lib/sentry-hygiene.ts hängt am `beforeSend` und gilt auch
 * für diesen Aufruf.
 *
 * Bei einem reinen Client-Fehler ist `error.digest` übrigens `undefined` —
 * dann zeigt die Ansicht keine Fehlernummer, und Sentry ist die einzige Spur.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
    // Zusätzlich auf die Konsole, aber nur außerhalb der Produktion: dort
    // stünde ein Fehlertext, den niemand liest und der etwas verraten kann
    // (Muster aus src/lib/upload-fehler.ts).
    if (process.env.NODE_ENV !== 'production') console.error(error)
  }, [error])

  return <FehlerAnsicht fehlernummer={error.digest} nochmal={reset} />
}
