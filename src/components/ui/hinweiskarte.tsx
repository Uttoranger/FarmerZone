import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Hinweiskarte: ein ruhiger Hinweis auf getönter Fläche mit Rahmen —
 * Grün für Kundensachen und Gutes („Wir zeigen Höfe rund um …", „Registrierter
 * Futtermittelbetrieb"), Orange für Hofsachen und Offenes („Online-Zahlung
 * pausiert", „Teile deinen Hof"). Kein Alarm, kein Modal: Fehler stehen
 * inline am Feld (DESIGN_SYSTEM, „Zustände").
 *
 * Die Schrift bleibt die normale Textfarbe; die Tönung liegt bei 12 % der
 * Markenfarbe, so hält der Text in beiden Themes 4,5:1. Aktionen (Knöpfe,
 * Links) kommen als `aktion` herein und stehen rechts bzw. am Handy darunter.
 */
export function Hinweiskarte({
  ton = 'gruen',
  symbol: Symbol,
  titel,
  children,
  aktion,
  className,
}: {
  ton?: 'gruen' | 'orange'
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
        ton === 'gruen' ? 'border-accent/45 bg-accent/12' : 'border-primary/45 bg-primary/12',
        className
      )}
    >
      <div className="flex min-w-0 flex-1 gap-3">
        {Symbol && (
          <Symbol
            className={cn('mt-0.5 size-5 shrink-0', ton === 'gruen' ? 'text-status-fertig' : 'text-status-offen')}
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
