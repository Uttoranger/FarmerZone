/**
 * Die Eingabe-Attribute der Hof-Felder — die Quelle für das Hofprofil
 * (components/settings/profile-form.tsx). Mein Hof
 * (components/mein-hof/abschnitt-formulare.tsx) schreibt sie von Hand und
 * spiegelt sie; ein Test hält beide gleich. Sie wählen die Tastatur am Handy
 * (type, inputMode) und das, was der Browser vorschlägt (autoComplete).
 *
 * `enterKeyHint` steht NICHT hier: Er hängt davon ab, ob ein Feld das letzte
 * ist (`enterTaste`).
 */
export const FELD_ATTRIBUTE = {
  name: { autoComplete: 'organization' },
  ownerName: { autoComplete: 'name' },
  address: { autoComplete: 'street-address' },
  postalCode: { inputMode: 'numeric', autoComplete: 'postal-code' },
  city: { autoComplete: 'address-level2' },
  phone: { type: 'tel', autoComplete: 'tel' },
  email: { type: 'email', autoComplete: 'email' },
} as const

/** Die Taste unten rechts am Handy: „Weiter" in einem Formular mit mehreren Feldern, am letzten „Fertig" bzw. „Senden". */
export function enterTaste(letztes: boolean, art: 'done' | 'send' = 'done'): 'next' | 'done' | 'send' {
  return letztes ? art : 'next'
}

/** Was `weiterMitEnter` vom Ereignis braucht — absichtlich schmal, damit es ohne DOM prüfbar bleibt. */
type EnterEreignis = {
  key: string
  nativeEvent?: { isComposing?: boolean }
  defaultPrevented: boolean
  preventDefault: () => void
  target: unknown
  currentTarget: unknown
}
type FeldKnoten = { tagName: string; enterKeyHint?: string; disabled?: boolean; type?: string; focus: () => void }
type FormKnoten = { elements: ArrayLike<FeldKnoten> }

/**
 * Enter an einem Feld mit `enterKeyHint="next"` springt zum nächsten Feld,
 * statt das Formular abzuschicken – sonst hielte die „Weiter"-Taste nicht, was
 * sie verspricht. Am letzten Feld („done"/„send"), in Textfeldern mit Umbruch
 * (textarea) und auf Knöpfen bleibt alles beim Browser: Enter schickt ab.
 * Als `onKeyDown` am `<form>`.
 */
export function weiterMitEnter(e: EnterEreignis): void {
  if (e.key !== 'Enter' || e.nativeEvent?.isComposing || e.defaultPrevented) return
  const feld = e.target as FeldKnoten | null
  const form = e.currentTarget as FormKnoten | null
  if (!feld || !form || feld.tagName !== 'INPUT' || feld.enterKeyHint !== 'next') return
  const alle = Array.from(form.elements)
  const weiter = alle.slice(alle.indexOf(feld) + 1).find((f) => !f.disabled && f.type !== 'hidden' && f.tagName !== 'FIELDSET')
  if (!weiter) return
  e.preventDefault()
  weiter.focus()
}
