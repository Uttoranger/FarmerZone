'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { FehlerAnsicht } from '@/components/shared/fehler-ansicht'
import { HOF_FEHLER_TEXT, ZU_HEUTE } from '@/lib/fehlerseite'

/**
 * Die Fehlergrenze des Hofbereichs (Nr. 175, Board system-sterne-kein-netz,
 * Punkt 4 und 5): Sie liegt UNTER dem Layout der Gruppe — HofShell mit
 * Seitenleiste und Unterleiste bleibt stehen, der Hof sieht seine fünf Plätze
 * auch im Fehlerfall. Vorher fiel jeder Fehler auf src/app/error.tsx mit dem
 * einzigen Weg zur Startseite der Kundinnen.
 *
 * Fehlernummer, „Nochmal versuchen" (reset), „Zu Heute" und „Problem melden"
 * in den Briefkasten des Hofbereichs; Texte aus src/lib/fehlerseite.ts.
 * Gemeldet wird wie in src/app/error.tsx: Ein Fehler, den eine React-
 * Fehlergrenze gefangen hat, erreicht den Client-SDK nicht von selbst, und
 * diese Grenze fängt ihn jetzt vor der im Wurzelsegment. Der Filter aus
 * src/lib/sentry-hygiene.ts hängt am `beforeSend` und gilt auch hier.
 *
 * Ein Fehler im Layout selbst (Laden des Hofbereichs) erreicht diese Datei
 * nicht — dafür bleibt src/app/error.tsx.
 */
export default function HofFehler({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
    // Wie src/app/error.tsx: auf die Konsole nur außerhalb der Produktion.
    if (process.env.NODE_ENV !== 'production') console.error(error)
  }, [error])

  return (
    <FehlerAnsicht
      fehlernummer={error.digest}
      nochmal={reset}
      ziel={{ href: '/dashboard', text: ZU_HEUTE }}
      text={HOF_FEHLER_TEXT}
      meldenPfad="/fehler-melden"
      imLayout
    />
  )
}
