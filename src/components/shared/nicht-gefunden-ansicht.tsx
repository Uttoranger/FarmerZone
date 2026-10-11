import Link from 'next/link'
import { Compass, Search } from 'lucide-react'
import { SUCHTEXT_MAX, SUCHTEXT_PARAMETER } from '@/schemas/hoefe-filter'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'

/*
 * Die 404 im neuen Design (seit Nr. 54; Mockups fehler-404-seite-nicht-
 * gefunden.html und fehler-404-mobil.html): Kreis mit Kompass, „Fehler 404",
 * Überschrift, Satz, zwei Wege zurück (einer grün, einer als Umriss) und das
 * Suchfeld als Pille. EINE Ansicht für die 404 des Hauses und die der
 * Hofadresse — nur Texte und die Reihenfolge der Wege unterscheiden sich.
 *
 * Die Shell (KundeShellMitSitzung) bindet die Seite ein, nicht diese Ansicht
 * (tests/shells.test.ts: unter src/components bindet nichts eine Shell ein).
 *
 * Das Suchfeld ist ein gewöhnliches GET-Formular auf /hoefe und braucht kein
 * JavaScript; Enter schickt es ab. Den Text liest dort `leseHoefeFilter` als
 * Parameter — eine Systemgrenze, die Müll verwirft, statt eine Fehlerseite zu
 * zeigen.
 */

type Weg = { href: string; text: string }

const KNOPF = cn(
  'inline-flex h-[46px] items-center justify-center rounded-full px-[18px] text-[14px] transition-opacity duration-[250ms]',
  FOKUS_RAHMEN
)

export function NichtGefundenAnsicht({
  titel,
  text,
  haupt,
  neben,
  suchfeldId,
}: {
  titel: string
  text: string
  /** Der eine grüne Weg (Kundenaktion, DESIGN_SYSTEM „Farbrollen"). */
  haupt: Weg
  /** Der zweite Weg, als Umriss. */
  neben: Weg
  /** Eindeutige Kennung des Suchfelds — die Beschriftung verweist darauf. */
  suchfeldId: string
}): React.JSX.Element {
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-3.5 px-[22px] pt-[70px] pb-16 text-center md:pt-[110px]">
      <span className="flex size-[76px] items-center justify-center rounded-full border border-border bg-card" aria-hidden="true">
        <Compass className="size-[34px] text-status-fertig" strokeWidth={1.7} aria-hidden="true" />
      </span>
      <p className="text-[12.5px] font-bold tracking-[1.6px] text-muted-foreground uppercase">Fehler 404</p>
      <h1 className="font-heading text-[24px] leading-tight font-semibold text-balance break-words text-foreground md:text-[30px]">
        {titel}
      </h1>
      <p className="text-[15px] leading-normal text-muted-foreground">{text}</p>

      <div className="mt-1.5 flex flex-wrap justify-center gap-2.5">
        <Link href={haupt.href} className={cn(KNOPF, 'bg-accent font-semibold text-accent-foreground hover:opacity-90')}>
          {haupt.text}
        </Link>
        <Link href={neben.href} className={cn(KNOPF, 'border border-border font-medium text-foreground hover:bg-muted')}>
          {neben.text}
        </Link>
      </div>

      <form action="/hoefe" method="get" role="search" className="mt-2.5 w-full max-w-[340px] md:max-w-[420px]">
        <label htmlFor={suchfeldId} className="sr-only">
          Hof oder Produkt suchen
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.7}
            aria-hidden="true"
          />
          <input
            id={suchfeldId}
            type="search"
            name={SUCHTEXT_PARAMETER}
            maxLength={SUCHTEXT_MAX}
            placeholder="Hof oder Produkt suchen …"
            className={cn(
              'h-[46px] w-full rounded-full border border-border bg-card pr-4 pl-10 text-base text-foreground placeholder:text-muted-foreground md:text-[14px]',
              FOKUS_RAHMEN
            )}
          />
        </div>
      </form>
    </div>
  )
}
