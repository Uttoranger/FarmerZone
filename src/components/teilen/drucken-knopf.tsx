'use client'

import { Printer } from 'lucide-react'

/** „Plakat drucken" — öffnet den Druckdialog des Browsers; auf dem Papier erscheint er nicht. */
export function DruckenKnopf({ className }: { className?: string }): React.JSX.Element {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      <Printer className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
      Plakat drucken
    </button>
  )
}
