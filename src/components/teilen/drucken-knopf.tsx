'use client'

/**
 * „Drucken" — öffnet den Druckdialog des Browsers; auf dem Papier erscheint er nicht. Seit Nr. 250 heißt er wie
 * im Board s2-/w2-whatsapp-plakat nur „Drucken“ (vorher „Plakat drucken“): Die Seite heißt schon QR-Plakat.
 * Seit Nr. 278 ohne Drucker-Symbol, wie im Board.
 */
export function DruckenKnopf({ className }: { className?: string }): React.JSX.Element {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      Drucken
    </button>
  )
}
