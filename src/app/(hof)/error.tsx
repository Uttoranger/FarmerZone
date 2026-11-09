'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { FehlerAnsicht } from '@/components/shared/fehler-ansicht'
import { HOF_FEHLER_TEXT, ZU_HEUTE } from '@/lib/fehlerseite'
import { hofAktiverPunkt, hofNavigation } from '@/lib/bauern-navigation'
import { WERKZEUG_KOPF_LEISTE, WERKZEUG_KOPF_SPALTE, WERKZEUG_KOPF_TITEL } from '@/components/ui/werkzeug-kopf-stil'
import { cn } from '@/lib/utils'

/**
 * Der Name des Bereichs, in dem der Fehler kam („Heute“, „Mein Hof“ …) — aus derselben Ordnung wie die Seitenleiste.
 * Ohne Treffer kein Kopf: Lieber nichts als ein falscher Name.
 */
function bereichDesFehlers(pfad: string | null): string | null {
  if (!pfad) return null
  const id = hofAktiverPunkt(pfad)
  if (id === null) return null
  const n = hofNavigation({ isAdmin: true })
  return [...n.haupt, ...n.verkaufUndKunden, ...n.unten].find((p) => p.id === id)?.label ?? null
}

/**
 * Die Fehlergrenze des Hofbereichs (Nr. 175, Board system-sterne-kein-netz,
 * Punkt 4 und 5): Sie liegt UNTER dem Layout der Gruppe — HofShell mit
 * Seitenleiste und Unterleiste bleibt stehen, der Hof sieht seine fünf Plätze
 * auch im Fehlerfall. Vorher fiel jeder Fehler auf src/app/error.tsx mit dem
 * einzigen Weg zur Startseite der Kundinnen.
 *
 * Fehlernummer, „Nochmal versuchen" (reset), „Zu Heute" und „Problem melden"
 * in den Briefkasten des Hofbereichs; Texte aus src/lib/fehlerseite.ts. Seit
 * Nr. 231 ist „Nochmal versuchen" hier orange (Board w3-fehlerseiten Bild 5,
 * V51: Hauptknopf im Hofbereich orange).
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
  const bereich = bereichDesFehlers(usePathname())
  useEffect(() => {
    Sentry.captureException(error)
    // Wie src/app/error.tsx: auf die Konsole nur außerhalb der Produktion.
    if (process.env.NODE_ENV !== 'production') console.error(error)
  }, [error])

  return (
    <>
      {/* Am Handy der Kopf des Bereichs über der Fehlerkarte (Board s3-fehlerseiten Bild 5; Liste Lauf 32, fehlerseiten
          „Kopf ‚Heute‘ fehlt auf der Hof-Fehlerseite“, Nr. 279): Der Hof soll sehen, wo er ist. Keine Überschrift (die h1
          ist „Da ist etwas schiefgelaufen“), kein Hofname: Die Grenze lädt nichts — die Zeile „<Hof> · Stand …“ fehlt.
          Leiste und Titel in den Maßen des Werkzeug-Kopfs (werkzeug-kopf-stil.ts): fest oben, 56 px, der Platz davor
          hält ihre Höhe. Ohne `data-werkzeug-kopf`: Das Layout blendete sonst den Hof-Balken aus, ohne ihn darunter zu zeigen. */}
      {bereich && (
        <div className="md:hidden print:hidden">
          <div className="h-14" aria-hidden="true" />
          <div className={WERKZEUG_KOPF_LEISTE} data-unterseiten-leiste="">
            <div className={cn(WERKZEUG_KOPF_SPALTE, 'pl-3')}>
              <p className={WERKZEUG_KOPF_TITEL}>{bereich}</p>
            </div>
          </div>
        </div>
      )}
      <FehlerAnsicht
        fehlernummer={error.digest}
        nochmal={reset}
        ziel={{ href: '/dashboard', text: ZU_HEUTE }}
        text={HOF_FEHLER_TEXT}
        meldenPfad="/fehler-melden"
        imLayout
        welt="hof"
      />
    </>
  )
}
