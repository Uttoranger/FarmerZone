import Link from 'next/link'
import { ChevronRight, LifeBuoy } from 'lucide-react'
import { FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { EINSTELLUNGEN_SATZ, EINSTELLUNGEN_TITEL, TON_TEXT, type EinstellungBereich, type EinstellungTon } from '@/lib/hof-einstellungen'
import { cn } from '@/lib/utils'

/** Der Punkt neben dem Titel: Zustandsfarbe des Themes, grau = nur zur Info. */
const PUNKT: Record<EinstellungTon, string> = {
  fertig: 'bg-status-fertig',
  offen: 'bg-status-offen',
  neutral: 'bg-muted-foreground',
}

/**
 * Übersicht der Einstellungen (Mockups web-h1-einstellungen-uebersicht und
 * mobil-h5-einstellungen, Nachtlauf Nr. 22d). Was in einem Bereich steht und
 * welche Farbe sein Punkt hat, entscheidet einstellungenBereiche
 * (src/lib/hof-einstellungen.ts) — hier nur die Gestalt.
 *
 * Am Handy Zeilen mit feinen Linien (wie das Mockup), ab 768 px Karten, ab
 * 1024 px in zwei Spalten. Jede Zeile ist ganz ein Link; der Punkt ist nur
 * Farbe und deshalb aria-hidden, seine Bedeutung steht als sr-only-Text dabei.
 */
export function EinstellungenUebersicht({ bereiche }: { bereiche: readonly EinstellungBereich[] }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2.5">
      <h1 className="font-heading text-2xl font-semibold text-foreground md:text-[26px]">{EINSTELLUNGEN_TITEL}</h1>
      <p className="text-[13.5px] leading-relaxed text-muted-foreground">{EINSTELLUNGEN_SATZ}</p>

      <ul className="mt-1.5 flex flex-col md:grid md:gap-3 lg:grid-cols-2">
        {bereiche.map((b) => (
          <li key={b.id} className="border-t border-border last:border-b md:border-0 md:last:border-b-0">
            <Link
              href={b.href}
              className={cn(
                'flex min-h-[64px] items-center gap-3.5 py-3 transition-colors duration-[250ms] md:h-full md:rounded-2xl md:border md:border-border md:bg-card md:px-[18px] md:py-4 md:hover:bg-muted',
                'hover:bg-muted max-md:-mx-2 max-md:rounded-lg max-md:px-2',
                FOKUS_RAHMEN_INNEN
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="min-w-0 text-[14.5px] font-semibold text-foreground md:text-[15.5px]">{b.titel}</span>
                  <span data-ton={b.ton} className={cn('size-2 shrink-0 rounded-full', PUNKT[b.ton])} aria-hidden="true" />
                  <span className="sr-only">{TON_TEXT[b.ton]}:</span>
                </span>
                <span
                  className="mt-0.5 line-clamp-2 block text-[12.5px] leading-normal break-words text-muted-foreground md:text-[13px]"
                  title={b.zeile}
                >
                  {b.zeile}
                </span>
              </span>
              <ChevronRight className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>

      {/* Abmelden steht in der Seitenleiste bzw. im Mehr-Blatt — hier nur der Weg zur Hilfe. */}
      <div className="mt-2">
        <Link href="/meldungen" className={KNOPF_RAHMEN}>
          <LifeBuoy className="size-4" strokeWidth={1.7} aria-hidden="true" />
          Hilfe und Rückmeldung
        </Link>
      </div>
    </div>
  )
}
