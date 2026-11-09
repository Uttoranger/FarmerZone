import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { AktuellZeile } from '@/lib/mein-hof-ansicht'
import { Marke } from '@/components/ui/marke'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { RUNDUNG } from '@/components/ui/rundung'
import { cn } from '@/lib/utils'
import { MEIN_HOF_GRUPPE_TITEL } from '@/components/mein-hof/zeilen-stil'

/*
 * „Aktuell vom Hof“ als letzter Abschnitt von Mein Hof › Hofseite (Boards
 * s1-/w1-mein-hof, Nr. 274): Überschrift wie die übrigen Gruppen, darunter EINE
 * Zeile mit dem Titel des laufenden Beitrags, „läuft noch …“ und der Marke
 * „Läuft“ — ohne Symbol. Verwaltet wird unter Mein Hof › Beiträge, darum ein Link.
 * Ohne Beitrag „Kein Beitrag“ mit dem Weg zum neuen Beitrag.
 */
export function AktuellBlock({ aktuell, onFokus }: { aktuell: AktuellZeile; onFokus?: () => void }): React.JSX.Element {
  return (
    <section aria-labelledby="mein-hof-aktuell" className="flex flex-col">
      <h2 id="mein-hof-aktuell" className={MEIN_HOF_GRUPPE_TITEL}>
        {aktuell.titel}
      </h2>
      <Link
        href={aktuell.link.href}
        data-bearbeiten-zeile="aktuell"
        onFocus={onFokus}
        className={cn('flex min-h-14 items-center gap-2.5 border border-border bg-card px-3 py-1.5 hover:bg-muted/60', RUNDUNG.karte, FOKUS_RAHMEN)}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15px] leading-snug font-semibold break-words text-foreground">{aktuell.beitrag?.titel ?? aktuell.wert}</span>
          <span className="text-[13px] text-muted-foreground">{aktuell.beitrag ? aktuell.beitrag.stand : aktuell.link.text}</span>
          {aktuell.beitrag && (
            <Marke art="laeuft" form="schild" className="self-start">
              Läuft
            </Marke>
          )}
        </span>
        <ChevronRight className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={2} aria-hidden="true" />
      </Link>
    </section>
  )
}
