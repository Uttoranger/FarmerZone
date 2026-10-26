'use client'

import { Printer } from 'lucide-react'

/**
 * „Drucken" auf den Druckseiten (Papier, hell in beiden Themes): fast
 * schwarzer Knopf mit Crème-Schrift aus den Tokens, die in Hell und Dunkel
 * gleich sind. Auf dem Papier erscheint er nicht.
 */
export function PrintButton(): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary-foreground px-4 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-accent-foreground print:hidden"
    >
      <Printer className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
      Drucken
    </button>
  )
}
