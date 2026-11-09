'use client'

import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'

/**
 * Öffnet den Druckdialog des Browsers — dort lässt sich auch als PDF speichern.
 * Die AGB müssen sich jederzeit abrufen, speichern und ausdrucken lassen
 * (§ 11 ECG); auf dem Papier erscheint der Knopf nicht. Seit Nr. 279 ohne
 * Drucker-Symbol, Rand in Feldfarbe und Schrift halbfett wie das Board
 * s3-/w3-rechtstexte (Abnahme Lauf 32, rechtstexte Bild 1–3).
 */
export function SeiteDrucken({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={cn(
        'inline-flex min-h-11 items-center rounded-full border border-input bg-card px-4 text-[14px] font-semibold text-foreground transition-colors duration-[250ms] hover:bg-muted print:hidden',
        FOKUS_RAHMEN
      )}
    >
      {children}
    </button>
  )
}
