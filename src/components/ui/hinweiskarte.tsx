import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Hinweiskarte: ein ruhiger Hinweis auf getönter Fläche mit Rahmen —
 * Grün für Kundensachen und Gutes („Wir zeigen Höfe rund um …", „Registrierter
 * Futtermittelbetrieb"), Orange für Hofsachen und Offenes („Online-Zahlung
 * pausiert", „Teile deinen Hof"), Neutral für ruhige Hinweise ohne Wertung
 * („Testhof – nur zum Ausprobieren", Register N21). Kein Alarm, kein Modal:
 * Fehler stehen inline am Feld (DESIGN_SYSTEM, „Zustände").
 *
 * Die Schrift bleibt die normale Textfarbe; die Tönung liegt bei 12 % der
 * Markenfarbe, so hält der Text in beiden Themes 4,5:1. Neutral liegt auf der
 * Nebenfläche (`bg-muted`) mit dem normalen Rahmen und leisem Symbol — weder
 * Grün (gut) noch Orange (offen), weil der Hinweis nichts bewertet. Aktionen
 * (Knöpfe, Links) kommen als `aktion` herein und stehen rechts bzw. am Handy
 * darunter.
 */
type Ton = 'gruen' | 'orange' | 'neutral'

const TON_FLAECHE: Record<Ton, string> = {
  gruen: 'border-accent/45 bg-accent/12',
  orange: 'border-primary/45 bg-primary/12',
  neutral: 'border-border bg-muted',
}

const TON_SYMBOL: Record<Ton, string> = {
  gruen: 'text-status-fertig',
  orange: 'text-status-offen',
  neutral: 'text-muted-foreground',
}

export function Hinweiskarte({
  ton = 'gruen',
  symbol: Symbol,
  titel,
  children,
  aktion,
  className,
}: {
  ton?: Ton
  symbol?: LucideIcon
  titel?: string
  children?: ReactNode
  aktion?: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div
      data-slot="hinweiskarte"
      data-ton={ton}
      className={cn(
        'flex flex-col gap-3 rounded-2xl border px-4 py-3.5 text-[13.5px] text-foreground sm:flex-row sm:items-center',
        TON_FLAECHE[ton],
        className
      )}
    >
      <div className="flex min-w-0 flex-1 gap-3">
        {Symbol && (
          <Symbol
            className={cn('mt-0.5 size-5 shrink-0', TON_SYMBOL[ton])}
            strokeWidth={1.7}
            aria-hidden="true"
          />
        )}
        <div className="min-w-0 flex-1">
          {titel && <p className="font-semibold">{titel}</p>}
          {children && <div className={cn(titel && 'mt-0.5')}>{children}</div>}
        </div>
      </div>
      {aktion && <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">{aktion}</div>}
    </div>
  )
}
