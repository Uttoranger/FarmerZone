'use client'

import { Printer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'

/**
 * Öffnet den Druckdialog des Browsers — dort lässt sich auch als PDF speichern.
 * Die AGB müssen sich jederzeit abrufen, speichern und ausdrucken lassen
 * (§ 11 ECG); auf dem Papier erscheint der Knopf nicht.
 */
export function SeiteDrucken({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={cn(
        'inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-[14px] font-medium text-foreground transition-colors duration-[250ms] hover:bg-muted print:hidden',
        FOKUS_RAHMEN
      )}
    >
      <Printer className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
      {children}
    </button>
  )
}
