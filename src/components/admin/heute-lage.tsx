import { CalendarCheck, Euro, Server, Tractor, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Marke } from '@/components/ui/marke'
import { KARTE, LEISE } from '@/components/hof-bestellungen/stil'
import { HEUTE_TEXT, type LageKachel } from '@/lib/admin-aufgaben'

const SYMBOL: Record<LageKachel['id'], LucideIcon> = { bestellungen: CalendarCheck, geld: Euro, dienste: Server, hoefe: Tractor }

/**
 * Die Lage-Kacheln von Admin › Heute (Nr. 185; Mockup admin-heute): Symbol,
 * Titel, Zahl in Fraunces mit Einheit, Zustandswort als Marke und zwei leise
 * Zeilen. Eigene Kacheln statt `Kennzahlen`, weil das Mockup ein
 * Zustandswort und zwei Zeilen je Kachel zeigt; Zahl und Ton wie dort.
 * Ab 1024 px vier nebeneinander, am Handy zwei.
 */
export function HeuteLage({ kacheln, className }: { kacheln: readonly LageKachel[]; className?: string }): React.JSX.Element {
  return (
    <section aria-label={HEUTE_TEXT.lage} className={className}>
      <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
        {kacheln.map((k) => {
          const Symbol = SYMBOL[k.id]
          return (
            <li key={k.id} className={cn(KARTE, 'flex min-w-0 flex-col gap-1.5 p-4')}>
              <span className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                <Symbol className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
                {k.titel}
              </span>
              <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-heading text-[24px] leading-tight font-semibold whitespace-nowrap text-foreground tabular-nums md:text-[28px]">{k.wert}</span>
                <span className={cn('text-[13px]', LEISE)}>{k.einheit}</span>
                {k.marke && (
                  <Marke art={k.marke.art} className="ml-auto">
                    {k.marke.wort}
                  </Marke>
                )}
              </span>
              {k.zeilen.map((z) => (
                <span key={z} className={cn('text-[12.5px] leading-snug', LEISE)}>
                  {z}
                </span>
              ))}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
