import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Die kleine Versalzeile über einer Überschrift der Startseite. Grün für die
 * Kundenwelt, Orange nur im Band „Für Höfe" (DESIGN_SYSTEM, „Farbrollen") —
 * als Text die Zustandsfarben, nie die Knopffarben: Die erreichen als Schrift
 * auf hellem Grund keine 4,5:1.
 */
export function Kicker({
  children,
  ton = 'gruen',
  className,
}: {
  children: ReactNode
  ton?: 'gruen' | 'orange'
  className?: string
}): React.JSX.Element {
  return (
    <p
      className={cn(
        'text-[12.5px] font-bold tracking-[1.6px] uppercase',
        ton === 'gruen' ? 'text-status-fertig' : 'text-status-offen',
        className
      )}
    >
      {children}
    </p>
  )
}
