/**
 * Der Freischaltungs-Moment auf Heute (Mockup web-h1-freigeschaltet-jetzt-teilen,
 * Nachtlauf Nr. 17): „Dein Hof ist online!" — höchstens einmal je Gerät.
 *
 * Es gibt kein Feld „gesehen" in der Datenbank, und eine Schema-Änderung ist in
 * diesem Gate nicht vorgesehen. Deshalb zwei Bedingungen, beide nötig:
 *  - Zeitfenster: nur in den ersten FREISCHALT_MOMENT_TAGE Tagen nach
 *    `approvedAt` (Server entscheidet, mit dem Zeitpunkt der Seite). So sieht
 *    ein Hof, der lange freigeschaltet ist, ihn auf einem neuen Gerät nie.
 *  - Gerätemerker im localStorage, je Hof ein Schlüssel. Fehlt der Speicher
 *    oder wirft er (privates Fenster, gesperrte Website-Daten), erscheint der
 *    Moment NICHT: „höchstens einmal" lässt sich dann nicht halten, und die
 *    Seite funktioniert ohne ihn vollständig.
 * Grenze: Auf einem zweiten Gerät erscheint er im Zeitfenster noch einmal.
 *
 * Rein; den Speicher bekommen die Funktionen hereingereicht (tests/heute-seite.test.ts).
 */
import { freischaltGesehenSchema } from '@/schemas/freischalt-moment'

export const FREISCHALT_MOMENT_TAGE = 14
const FENSTER_MS = FREISCHALT_MOMENT_TAGE * 24 * 60 * 60 * 1000

/** Darf der Moment überhaupt kommen? Öffentlich, freigeschaltet, Freigabe jünger als das Zeitfenster. */
export function freischaltMomentMoeglich(
  hof: { approvedAt: Date | null; oeffentlich: boolean },
  jetzt: Date
): boolean {
  if (!hof.oeffentlich || !hof.approvedAt) return false
  const seit = jetzt.getTime() - hof.approvedAt.getTime()
  return seit >= 0 && seit < FENSTER_MS
}

export type FreischaltGesehen = 'ja' | 'nein' | 'unbekannt'

type Speicher = Pick<Storage, 'getItem' | 'setItem'>

export function freischaltSchluessel(farmId: string): string {
  return `farmerzone_freigeschaltet_gezeigt:${farmId}`
}

/** Der localStorage des Browsers — oder null, wo es keinen gibt oder schon der Zugriff wirft. */
export function browserSpeicher(): Speicher | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    // Gesperrte Website-Daten: Zugriff wirft. Dann kein Moment (siehe oben).
    return null
  }
}

export function leseFreischaltGesehen(speicher: Speicher | null, farmId: string): FreischaltGesehen {
  if (!speicher) return 'unbekannt'
  try {
    return freischaltGesehenSchema.safeParse(speicher.getItem(freischaltSchluessel(farmId))).success ? 'ja' : 'nein'
  } catch {
    // Kein Lesezugriff: Ob er schon kam, wissen wir nicht — also nicht zeigen.
    return 'unbekannt'
  }
}

export function merkeFreischaltGesehen(speicher: Speicher | null, farmId: string): void {
  try {
    speicher?.setItem(freischaltSchluessel(farmId), '1')
  } catch {
    // Voller oder gesperrter Speicher: Das Lesen davor hat geklappt, also kann
    // der Moment im Zeitfenster noch einmal kommen — mehr Schaden gibt es nicht.
  }
}

/** Öffnen nur, wenn er kommen darf und das Gerät ihn sicher noch nicht gezeigt hat. */
export function freischaltMomentOeffnen(moeglich: boolean, gesehen: FreischaltGesehen): boolean {
  return moeglich && gesehen === 'nein'
}
