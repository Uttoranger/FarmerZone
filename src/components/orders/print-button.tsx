'use client'

import { cn } from '@/lib/utils'

/**
 * „Drucken" auf den Druckseiten (Papier, hell in beiden Themes; Boards
 * s2-/w2-druck): orange gefüllt ohne Symbol wie die Hauptaktion im
 * Hofbereich (N42 a), im Leerzustand als Umriss (`zweit`, Board Bild 3 — es
 * gibt nichts Dringendes zu drucken). Orange und die fast schwarze Schrift
 * sind Tokens, die in Hell und Dunkel gleich sind. Auf dem Papier erscheint
 * er nicht.
 */
export function PrintButton({ zweit = false }: { zweit?: boolean }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={cn(
        'inline-flex min-h-11 items-center rounded-full px-5 text-[15px] font-bold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground focus-visible:outline-solid print:hidden',
        zweit ? 'border-[1.5px] border-primary-foreground/70 bg-transparent' : 'bg-primary'
      )}
    >
      Drucken
    </button>
  )
}
