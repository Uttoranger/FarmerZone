import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Die kleine Versalzeile über einer Überschrift der Startseite. Grün für die
 * Kundenwelt, Orange nur im Band „Für Höfe" (DESIGN_SYSTEM, „Farbrollen") —
 * als Text die Zustandsfarben, nie die Knopffarben: Die erreichen als Schrift
 * auf hellem Grund keine 4,5:1. `leise` (Nr. 234, Board w1-startseite): die
 * graue Überzeile der kurzen Karten; dort ist sie selbst die Überschrift
 * (`als="h2"`).
 */
export function Kicker({
  children,
  ton = 'gruen',
  als: Element = 'p',
  id,
  className,
}: {
  children: ReactNode
  ton?: 'gruen' | 'orange' | 'leise'
  als?: 'p' | 'h2'
  id?: string
  className?: string
}): React.JSX.Element {
  return (
    <Element
      id={id}
      className={cn(
        'text-[12.5px] font-bold tracking-[1.6px] uppercase',
        ton === 'gruen' ? 'text-status-fertig' : ton === 'orange' ? 'text-status-offen' : 'tracking-[0.6px] text-muted-foreground',
        className
      )}
    >
      {children}
    </Element>
  )
}
