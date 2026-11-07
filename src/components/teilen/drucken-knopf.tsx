'use client'

import { Printer } from 'lucide-react'

/**
 * „Drucken" — öffnet den Druckdialog des Browsers; auf dem Papier erscheint er nicht. Seit Nr. 250 heißt er wie
 * im Board s2-/w2-whatsapp-plakat nur „Drucken“ (vorher „Plakat drucken“): Die Seite heißt schon QR-Plakat.
 */
export function DruckenKnopf({ className }: { className?: string }): React.JSX.Element {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      <Printer className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
      Drucken
    </button>
  )
}
