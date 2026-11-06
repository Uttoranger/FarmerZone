import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { KARTE } from '@/components/bestaetigung/bestaetigung-teile'

/*
 * Die Karte der Abmelde-Seite (/account/unsubscribe) im neuen Design (Nr. 14),
 * seit Nr. 239 nach Board s2-/w2-abmelden: ohne Symbol, links bündig, im
 * Browser an der linken Kante der Inhaltsspalte (wie der Seitenfuß), höchstens
 * 520 px. Ein ungültiger Link trägt die Überschrift in der Warnfarbe
 * (`text-status-offen`). Nur Gestalt; Ablauf und Texte stehen in page.tsx bzw.
 * unsubscribe-client.tsx.
 */

/** Fließtext der Karte in voller Textfarbe (Board), nicht leise. */
export const KARTEN_TEXT = 'text-[15px] leading-normal text-foreground'

export function AbmeldenKarte({
  ton = 'leise',
  titel,
  children,
}: {
  /** `orange`: Überschrift in der Warnfarbe (ungültiger Link); sonst Textfarbe. */
  ton?: 'leise' | 'gruen' | 'orange'
  titel: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className="mx-auto w-full max-w-[1032px] px-4 pt-4 pb-10">
      <div className={cn(KARTE, 'flex max-w-[520px] flex-col gap-2 px-[18px] py-[18px]')}>
        <h1 className={cn('font-heading text-[22px] leading-tight font-semibold', ton === 'orange' && 'text-status-offen')}>{titel}</h1>
        {children}
      </div>
    </div>
  )
}
