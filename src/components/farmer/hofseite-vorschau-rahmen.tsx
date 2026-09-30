'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { MARKIERUNG_TYP, type HofseiteZeileId } from '@/schemas/hofseite-vorschau'
import { VORSCHAU_PARAMETER, leseBereit, vorschauAdresse } from '@/lib/hofseite-vorschau'

/**
 * Die Vorschau im Editor ab lg: die echte öffentliche Hofseite im
 * Vorschau-Modus (?vorschau=1) in einem Handyrahmen. Der iframe ist 390 CSS-px
 * breit — so rendert die Seite ihr Handy-Layout — und wird auf die
 * Rahmenbreite verkleinert. `stand` steckt in der Adresse: Jedes Speichern
 * zählt hoch, und der Rahmen lädt neu.
 *
 * Die geöffnete Zeile geht per postMessage an den Rahmen — nur an den eigenen
 * Ursprung. Nach jedem Laden meldet sich die Seite im Rahmen „bereit"
 * (components/farm/vorschau-im-rahmen.tsx), und die Markierung geht noch
 * einmal hin: Ein Neuladen verliert sie, und das `load`-Ereignis des iframes
 * käme womöglich vor ihrem Empfänger.
 */
const SEITEN_BREITE = 390
const SEITEN_HOEHE = 844
const SCHIRM_BREITE = 304
const MASSSTAB = SCHIRM_BREITE / SEITEN_BREITE

export function HofseiteVorschauRahmen({
  slug,
  stand,
  markiert,
}: {
  slug: string
  stand: number
  markiert: HofseiteZeileId | null
}): React.JSX.Element {
  const rahmen = useRef<HTMLIFrameElement>(null)

  // Der erste Stand steht im src; jeder weitere ersetzt die Adresse im
  // Rahmen (location.replace), statt src zu ändern — ein neues src legte im
  // gemeinsamen Verlauf des Browsers einen Eintrag an, und „Zurück" führte
  // erst durch alle alten Stände der Vorschau.
  const [anfang] = useState(stand)
  useEffect(() => {
    if (stand === anfang) return
    rahmen.current?.contentWindow?.location.replace(vorschauAdresse(slug, stand))
  }, [slug, stand, anfang])

  useEffect(() => {
    const sende = () =>
      rahmen.current?.contentWindow?.postMessage({ typ: MARKIERUNG_TYP, abschnitt: markiert }, window.location.origin)
    // Nur die eigene Seite im eigenen Rahmen darf „bereit" sagen.
    const beiNachricht = (ereignis: MessageEvent) => {
      if (ereignis.source !== rahmen.current?.contentWindow) return
      if (leseBereit(ereignis, window.location.origin)) sende()
    }
    sende()
    window.addEventListener('message', beiNachricht)
    return () => window.removeEventListener('message', beiNachricht)
  }, [markiert])

  return (
    <aside className="sticky top-6" aria-label="Vorschau">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-app-ink-faint">Vorschau</p>
      {/* Der Rahmen in der Tintenfarbe: in beiden Modi dunkler als die Karte
          darunter. Sein Schatten ist schwarz mit Deckkraft wie der der
          Titelbild-Knöpfe — er liegt auf der Fläche, nicht auf einer Karte,
          und soll in beiden Modi gleich tief wirken. */}
      <div className="mx-auto mt-2 w-[320px] rounded-[2.4rem] bg-app-ink p-2 shadow-[0_12px_32px_rgba(0,0,0,0.25)]">
        <div
          className="relative overflow-hidden rounded-[2rem] bg-card"
          style={{ width: SCHIRM_BREITE, height: Math.round(SEITEN_HOEHE * MASSSTAB) }}
        >
          <iframe
            ref={rahmen}
            title="Vorschau deiner Hofseite"
            src={vorschauAdresse(slug, anfang)}
            className="absolute left-0 top-0 border-0"
            style={{
              width: SEITEN_BREITE,
              height: SEITEN_HOEHE,
              transform: `scale(${MASSSTAB})`,
              transformOrigin: 'top left',
            }}
          />
        </div>
      </div>
      <div className="mx-auto mt-3 w-[320px]">
        <a
          href={`/${slug}?${VORSCHAU_PARAMETER}=1`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-text underline-offset-2 hover:underline"
        >
          In neuem Tab öffnen
          <ArrowUpRight className="size-4" strokeWidth={1.7} aria-hidden="true" />
        </a>
        <p className="mt-1 text-xs leading-relaxed text-app-ink-faint">
          So sehen Kunden deine Hofseite. Die markierte Stelle gehört zur geöffneten Zeile.
        </p>
      </div>
    </aside>
  )
}
