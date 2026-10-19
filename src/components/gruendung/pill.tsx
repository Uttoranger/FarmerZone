import { Star } from 'lucide-react'
import { GRUENDUNG_TEXT, type GruendungSeiten } from '@/lib/gruendungshof'
import { cn } from '@/lib/utils'

/**
 * Baustein (2) der Gründungshöfe (Register K2-Ergänzung, Nr. 93): die Pill
 * „Gründungsphase · noch n von m Plätzen" über der Überschrift von
 * /fuer-hoefe (Mockups web-/mobil-k2-fuer-hoefe-gruendung). Eine Angabe, kein
 * Knopf und kein Zustand — deshalb nicht `Marke`. Oranger Text in
 * `text-status-offen` (DESIGN_SYSTEM: nie `text-primary` für Schrift). Bricht
 * am schmalen Handy um, statt aus der Spalte zu laufen.
 */
export function GruendungPill({ gruendung, className }: { gruendung: GruendungSeiten | null; className?: string }): React.JSX.Element | null {
  if (!gruendung?.zeigen) return null
  return (
    <span
      className={cn(
        'inline-flex min-h-[30px] max-w-full items-center gap-[7px] rounded-full border border-primary/50 bg-primary/14 py-1 pr-3 pl-2.5 text-[12.5px] leading-tight font-semibold text-status-offen',
        className
      )}
    >
      <Star className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
      {GRUENDUNG_TEXT.pill(gruendung)}
    </span>
  )
}
