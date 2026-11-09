/**
 * Ein Tipp auf die Beschriftung „Menge“ der Produktseite (Runde 1 Nr. 271): Das Label umschließt den Mengen-Stepper
 * (ui/stepper.tsx nimmt keine id an, ein htmlFor ginge nicht). Ohne Eingriff leitete der Browser den Tipp an das erste
 * beschriftbare Kind weiter — den Minus-Knopf — und senkte die Menge. Hier wird er abgefangen und der Fokus ins
 * Mengenfeld gesetzt. Tipps auf einen Knopf oder ins Feld selbst laufen unverändert durch.
 */
export function mengeLabelTipp(e: { target: EventTarget | null; currentTarget: HTMLElement; preventDefault: () => void }): void {
  const ziel = typeof Element !== 'undefined' && e.target instanceof Element ? e.target : null
  if (ziel?.closest('button, input')) return
  e.preventDefault()
  e.currentTarget.querySelector('input')?.focus()
}
