'use client'

import { ANMELDECODE_LAENGE, normalisiereCode } from '@/lib/anmeldecode'
import { cn } from '@/lib/utils'
import { FELD } from '@/components/anmelden/stil'

/**
 * Das Feld für den 6-stelligen Code: EIN sichtbares, beschriftetes Eingabefeld
 * (Boards s2-/w2-kundenkonto, Bild 2: „6-stelliger Code aus der E-Mail“ mit
 * dem Platzhalter „6 Ziffern“; bis Nr. 239 sechs Kästchen über einem
 * unsichtbaren Feld). Ein Feld, weil
 *  - das Telefon den Code aus der Mail nur in ein Feld mit
 *    autocomplete="one-time-code" einsetzt,
 *  - Einfügen („481 234" aus der Mail) und Löschen dann einfach funktionieren,
 *  - der Screenreader genau ein Feld „Code" ansagt.
 * Die Beschriftung setzt der Aufrufer sichtbar darüber (`<label htmlFor={id}>`).
 * Was eingetippt wird, geht durch normalisiereCode — nur Ziffern, höchstens
 * sechs; nie `maxLength`, das schnitte Eingefügtes stumm ab.
 * Während geprüft wird, ist das Feld nur `readOnly` + `aria-busy`, nie
 * `disabled`: disabled nähme ihm beim automatischen Absenden den Fokus, und
 * nach einem Fehler stünden Tastatur und Screenreader im Nichts.
 */
export function CodeFeld({
  id,
  wert,
  onWert,
  ungueltig,
  beschreibtVon,
  gesperrt,
  feldRef,
}: {
  id: string
  wert: string
  onWert: (code: string) => void
  ungueltig: boolean
  beschreibtVon?: string
  /** Prüfung läuft: Feld nimmt nichts an, behält aber den Fokus. */
  gesperrt?: boolean
  feldRef?: React.Ref<HTMLInputElement>
}): React.JSX.Element {
  return (
    <input
      ref={feldRef}
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]*"
      value={wert}
      onChange={(e) => onWert(normalisiereCode(e.target.value))}
      placeholder={`${ANMELDECODE_LAENGE} Ziffern`}
      aria-invalid={ungueltig || undefined}
      aria-describedby={beschreibtVon}
      readOnly={gesperrt}
      aria-busy={gesperrt || undefined}
      // 16 px am Handy, sonst zoomt iOS. Grundschrift ohne Sperrung, nur gleich breite Ziffern (Liste Lauf 32, meine-bestellungen).
      className={cn(FELD, 'tabular-nums')}
    />
  )
}
