import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { KARTE } from '@/components/bestaetigung/bestaetigung-teile'

/*
 * Die Karte der Abmelde-Seite (/account/unsubscribe) im neuen Design (Nr. 14):
 * Symbol, Überschrift, Inhalt — mittig, 440 px. Nur Gestalt; Ablauf und Texte
 * stehen in page.tsx bzw. unsubscribe-client.tsx.
 */

/** Grüner Textlink mit Trefferfläche 44 px (wie TEXTKNOPF der Anmeldeseite). */
export const TEXTLINK = cn(
  'inline-flex min-h-11 items-center rounded-full px-2 text-sm font-semibold text-status-fertig hover:underline hover:underline-offset-2',
  FOKUS_RAHMEN
)

export function AbmeldenKarte({
  symbol: Symbol,
  ton = 'leise',
  titel,
  children,
}: {
  symbol: LucideIcon
  ton?: 'leise' | 'gruen' | 'orange'
  titel: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className="mx-auto w-full max-w-[440px] px-4 pt-10 pb-12 md:pt-16">
      <div className={cn(KARTE, 'flex flex-col items-center gap-3 px-6 py-8 text-center')}>
        <Symbol
          className={cn(
            'size-12',
            ton === 'gruen' ? 'text-status-fertig' : ton === 'orange' ? 'text-status-offen' : 'text-muted-foreground'
          )}
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <h1 className="font-heading text-[22px] leading-tight font-semibold">{titel}</h1>
        {children}
      </div>
    </div>
  )
}
