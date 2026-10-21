'use client'

import { Calendar } from 'lucide-react'
import { beitragMarke, type NeuerBeitrag } from '@/lib/hofuebersicht'
import { cn } from '@/lib/utils'
import { useUhr } from '@/components/hoefe/use-uhr'

/**
 * Die Marke „Neu · vor 2 Std.“ am Bild der Hofkarte (Register N22, Ergänzung
 * Nr. 129; Board system-k2-beitraege-v2, Abschnitt 4) — EIN Baustein für die
 * Liste auf /hoefe (HofKarte) und das Karussell der Karte.
 *
 * Gerechnet mit der Uhr des Browsers (useUhr, wie die Abholzeile): Die Liste
 * ist bis zu zehn Minuten alt, die Marke verschwindet trotzdem nach sieben
 * Tagen bzw. mit dem Ende des Beitrags (beitragMarke).
 *
 * Eine eigene, deckende Fläche (Karte, Rand, Schatten) unter der Schrift: So
 * hält der Kontrast auf jedem Foto und jeder Illustration, in beiden Themes.
 * Die sichtbare Marke ist für den Screenreader verborgen; der Satz „Neuer
 * Beitrag vor 2 Stunden: <Titel>“ steht unter `beschreibungId` und hängt per
 * aria-describedby am Link der Karte — die Karte bleibt EIN Link.
 */
export function BeitragMarke({
  beitrag,
  jetzt,
  beschreibungId,
  kompakt = false,
  className,
}: {
  beitrag: NeuerBeitrag | null | undefined
  /** Der Zeitpunkt des Servers beim Bauen der Seite (ISO-Text). */
  jetzt: string
  /** Die Kennung des Satzes für den Screenreader (aria-describedby am Link der Karte). */
  beschreibungId: string
  /** Schmale Bildfläche (Splitscreen, Karussell): kleiner, ohne Symbol. */
  kompakt?: boolean
  className?: string
}): React.JSX.Element | null {
  const uhr = useUhr(jetzt)
  const marke = beitragMarke(beitrag, uhr)
  if (!marke) return null
  return (
    <>
      <span
        aria-hidden="true"
        data-slot="beitrag-marke"
        className={cn(
          'pointer-events-none inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-card font-semibold whitespace-nowrap text-foreground shadow-sm',
          kompakt ? 'h-6 px-2 text-[11px]' : 'h-7 px-2.5 text-[12px]',
          className
        )}
      >
        {!kompakt && <Calendar className="size-3.5 shrink-0 text-status-fertig" strokeWidth={2} aria-hidden="true" />}
        <span className="min-w-0 truncate">{marke.kurz}</span>
      </span>
      <span id={beschreibungId} hidden>
        {marke.satz}
      </span>
    </>
  )
}
