import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { AktuellZeile } from '@/lib/mein-hof-ansicht'
import { Marke } from '@/components/ui/marke'
import { FOKUS_RAHMEN, FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { RUNDUNG } from '@/components/ui/rundung'
import { cn } from '@/lib/utils'
import { MEIN_HOF_GRUPPE_TITEL, MEIN_HOF_ZEILE_TITEL, MEIN_HOF_ZEILE_WERT } from '@/components/mein-hof/zeilen-stil'

/*
 * „Aktuell vom Hof“ in Mein Hof › Hofseite nach den Boards s1-/w1-mein-hof (Nr. 274):
 * Überschrift wie die übrigen Gruppen, darunter EINE Zeile mit dem Titel des
 * laufenden Beitrags, „läuft noch …“ und der Marke „Läuft“ — ohne Symbol. Ohne
 * Beitrag „Kein Beitrag“ mit dem Weg zum neuen Beitrag. Wo der Block steht,
 * entscheidet der Aufrufer (Register E12: ab lg als erste Zeile vor den Gruppen).
 *
 * Ohne `onUmschalten` ist die Zeile EIN Link zu Mein Hof › Beiträge (Liste unter
 * lg). Mit `onUmschalten` (Editor ab lg) ist die Zeile ein Knopf, der den Abschnitt
 * in der Vorschau markiert und wieder freigibt (Freigabe 129.4) — der Link zu den
 * Beiträgen steht dann daneben.
 */
export function AktuellBlock({
  aktuell,
  kennung,
  markiert = false,
  onUmschalten,
}: {
  aktuell: AktuellZeile
  /** Kennung der Überschrift — je Aufrufer eine eigene, denn Liste und Editor stehen beide im Dokument. */
  kennung: string
  markiert?: boolean
  onUmschalten?: () => void
}): React.JSX.Element {
  const inhalt = (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className={cn('break-words', MEIN_HOF_ZEILE_TITEL)}>{aktuell.beitrag?.titel ?? aktuell.wert}</span>
      <span className={MEIN_HOF_ZEILE_WERT}>{aktuell.beitrag ? aktuell.beitrag.stand : aktuell.link.text}</span>
      {aktuell.beitrag && (
        <Marke art="laeuft" form="schild" className="self-start">
          Läuft
        </Marke>
      )}
    </span>
  )

  return (
    <section aria-labelledby={kennung} className="flex flex-col">
      <h2 id={kennung} className={MEIN_HOF_GRUPPE_TITEL}>
        {aktuell.titel}
      </h2>
      {onUmschalten ? (
        <div
          data-bearbeiten-zeile="aktuell"
          className={cn('flex min-h-14 items-center gap-1 overflow-hidden border border-border bg-card pr-2', RUNDUNG.karte, markiert && 'bg-muted/30')}
        >
          <button
            type="button"
            onClick={onUmschalten}
            aria-pressed={markiert}
            className={cn('flex min-h-14 min-w-0 flex-1 items-center py-1.5 pl-3 text-left hover:bg-muted/60', FOKUS_RAHMEN_INNEN)}
          >
            {inhalt}
          </button>
          <Link
            href={aktuell.link.href}
            className={cn('inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-sm px-1.5 text-[14px] font-semibold whitespace-nowrap text-brand-text', FOKUS_RAHMEN)}
          >
            <span className="sr-only">{aktuell.titel}: </span>
            {aktuell.link.text}
            <ChevronRight className="size-[18px]" strokeWidth={2} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <Link
          href={aktuell.link.href}
          data-bearbeiten-zeile="aktuell"
          className={cn('flex min-h-14 items-center gap-2.5 border border-border bg-card px-3 py-1.5 hover:bg-muted/60', RUNDUNG.karte, FOKUS_RAHMEN)}
        >
          {inhalt}
          <ChevronRight className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={2} aria-hidden="true" />
        </Link>
      )}
    </section>
  )
}
