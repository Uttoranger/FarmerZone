/**
 * Der Moment „wieder da" in der Produkttabelle (Mockups web-h2-ware-wieder-
 * da-teilen, mobil-h2-gespeichert-teilen; Nachtlauf Nr. 18): Geht der Vorrat
 * eines sichtbaren Produkts von 0 auf mehr, fragt die Seite einmal, ob der Hof
 * es teilen will.
 *
 * „Höchstens einmal je Anlass" ohne Spalte in der Datenbank (eine
 * Schema-Änderung ist nicht beauftragt; „in den Einstellungen abschaltbar"
 * kommt mit Gate 7): Anlass = Produkt und Wiener Woche. Wer in derselben Woche
 * wieder auf 0 und zurück geht, wird nicht noch einmal gefragt; nächste Woche
 * wieder. Merker im localStorage, je Produkt ein Schlüssel mit der Woche
 * (Montag, JJJJ-MM-TT). Fehlt der Speicher oder wirft er, kommt der Moment
 * NICHT — „höchstens einmal" lässt sich dann nicht halten. Muster:
 * src/lib/freischalt-moment.ts. Grenze: Ein zweites Gerät fragt noch einmal.
 *
 * Rein; den Speicher bekommen die Funktionen hereingereicht (tests/produkte-seite.test.ts).
 */
import { wiederDaWocheSchema } from '@/schemas/wieder-da-moment'
import type { FreischaltGesehen } from '@/lib/freischalt-moment'

export { browserSpeicher } from '@/lib/freischalt-moment'

type Speicher = Pick<Storage, 'getItem' | 'setItem'>

export function wiederDaSchluessel(productId: string): string {
  return `farmerzone_wieder_da_gezeigt:${productId}`
}

/** 'ja' = in dieser Woche schon gezeigt; 'unbekannt' = kein lesbarer Speicher (dann nie zeigen). */
export function leseWiederDaGezeigt(speicher: Speicher | null, productId: string, woche: string): FreischaltGesehen {
  if (!speicher) return 'unbekannt'
  try {
    const gelesen = wiederDaWocheSchema.safeParse(speicher.getItem(wiederDaSchluessel(productId)))
    return gelesen.success && gelesen.data === woche ? 'ja' : 'nein'
  } catch {
    // Kein Lesezugriff (gesperrte Website-Daten): Ob er schon kam, wissen wir nicht.
    return 'unbekannt'
  }
}

export function merkeWiederDaGezeigt(speicher: Speicher | null, productId: string, woche: string): void {
  try {
    speicher?.setItem(wiederDaSchluessel(productId), woche)
  } catch {
    // Voller oder gesperrter Speicher: Das Lesen davor hat geklappt, also
    // fragt die Seite in dieser Woche höchstens noch einmal — mehr Schaden gibt es nicht.
  }
}

/** Öffnen nur, wenn das Gerät ihn in dieser Woche sicher noch nicht gezeigt hat. */
export function wiederDaOeffnen(gesehen: FreischaltGesehen): boolean {
  return gesehen === 'nein'
}
