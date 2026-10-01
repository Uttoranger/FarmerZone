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
 * Gemeldet wird von hier, und nur von hier: Ein Fehler im Root-Layout erreicht
 * keine andere Grenze, wäre also unsichtbar. Der Filter aus
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
      <body className="min-h-full">
        <FehlerAnsicht fehlernummer={error.digest} nochmal={reset} />
      </body>
    </html>
  )
}
