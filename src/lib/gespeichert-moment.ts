/**
 * Der Moment „gespeichert" in der Produkttabelle (Mockup mobil-h2-gespeichert-
 * teilen, Gate 7 Aufgabe 5, Nachtlauf Nr. 30): Legt der Hof ein Produkt an,
 * das sofort im Shop steht, fragt die Seite einmal, ob er es teilen will.
 *
 * Einmal-Regel wie bei „freigeschaltet" und „wieder da" — „schon gezeigt" je
 * Gerät im localStorage, Anlass = das neue Produkt (bei Verkaufsgrößen die
 * Familie: EIN Moment für alle Größen). Fehlt der Speicher oder wirft er,
 * kommt der Moment NICHT, weil sich „höchstens einmal" dann nicht halten
 * lässt. Der Anlass selbst (Anlegen) passiert ohnehin nur einmal; der Merker
 * sichert, dass auch ein doppelter Rückruf nicht zweimal fragt.
 * Ob der Moment überhaupt kommen darf (Schalter des Hofs, Hof und Produkt
 * sichtbar), entscheidet vorher gespeichertMomentMoeglich (produkte-hof.ts).
 *
 * Rein; den Speicher bekommen die Funktionen hereingereicht (tests/teilen-momente.test.ts).
 */
import { gespeichertGezeigtSchema } from '@/schemas/gespeichert-moment'
import type { FreischaltGesehen } from '@/lib/freischalt-moment'

export { browserSpeicher } from '@/lib/freischalt-moment'

type Speicher = Pick<Storage, 'getItem' | 'setItem'>

export function gespeichertSchluessel(anlass: string): string {
  return `farmerzone_gespeichert_gezeigt:${anlass}`
}

/** 'ja' = schon gezeigt; 'unbekannt' = kein lesbarer Speicher (dann nie zeigen). */
export function leseGespeichertGezeigt(speicher: Speicher | null, anlass: string): FreischaltGesehen {
  if (!speicher) return 'unbekannt'
  try {
    return gespeichertGezeigtSchema.safeParse(speicher.getItem(gespeichertSchluessel(anlass))).success ? 'ja' : 'nein'
  } catch {
    // Kein Lesezugriff (gesperrte Website-Daten): Ob er schon kam, wissen wir nicht.
    return 'unbekannt'
  }
}

export function merkeGespeichertGezeigt(speicher: Speicher | null, anlass: string): void {
  try {
    speicher?.setItem(gespeichertSchluessel(anlass), '1')
  } catch {
    // Voller oder gesperrter Speicher: Das Lesen davor hat geklappt, und der
    // Anlass (Anlegen) kommt nicht wieder — mehr Schaden gibt es nicht.
  }
}

/** Öffnen nur, wenn das Gerät ihn für diesen Anlass sicher noch nicht gezeigt hat. */
export function gespeichertOeffnen(gesehen: FreischaltGesehen): boolean {
  return gesehen === 'nein'
}
