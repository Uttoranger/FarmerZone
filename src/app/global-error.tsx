'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { FehlerAnsicht } from '@/components/shared/fehler-ansicht'
// Das Root-Layout ist hier WEG — mit ihm der Import des Stylesheets. Ohne
// diese Zeile stünde die Fehlerseite ohne jede Formatierung da.
import './globals.css'

/**
 * Die letzte Fehlergrenze: Sie greift, wenn das Root-Layout selbst scheitert
 * (Theme-Provider, Schriften, Banner). Dann ersetzt diese Datei das Dokument
 * und muss `<html>` und `<body>` selbst mitbringen.
 *
 * WAS HIER FEHLT, UND WARUM DAS IN ORDNUNG IST:
 * - Keine Schrift-Variablen (die stehen am `<html>` des Layouts) — die Seite
 *   fällt auf die Systemschrift zurück. Lesbar, nur nicht Fraunces.
 * - Kein next-themes und damit kein `data-theme`: Die Werte aus `:root`
 *   gelten, also der helle Modus. Ein Mensch im Dunkelmodus sieht diese EINE
 *   Seite hell. Dafür hängt sie an keinem Provider, der gerade kaputt ist —
 *   und genau das ist ihre Aufgabe.
 *
 * Gemeldet wird von hier wie aus `error.tsx` — doppelt wird es nicht, weil
 * sich die beiden Grenzen ausschließen: Diese greift nur für Fehler im
 * Root-Layout und für solche, die `error.tsx` selbst wirft. Der Filter aus
 * src/lib/sentry-hygiene.ts hängt am Client-Haken (`beforeSend`) und gilt auch
 * für diesen Aufruf.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="de">
      {/* Keine Höhenklasse am body: Das eigene <html> trägt kein h-full, und
          die Ansicht bringt min-h-screen selbst mit. */}
      <body>
        <FehlerAnsicht fehlernummer={error.digest} nochmal={reset} />
      </body>
    </html>
  )
}
