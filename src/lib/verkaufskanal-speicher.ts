/**
 * Der zuletzt benutzte Verkaufskanal — EINE Stelle für Schlüssel, Lesen und
 * Schreiben. Wer immer im Hofladen verkauft, soll nicht jedes Mal „Hofladen"
 * tippen. Der Kanal gehört dem Gerät, nicht dem Hof: keine Spalte in der
 * Datenbank.
 *
 * Gelesen wird mit Zod, und nichts hier wirft: Ein privates Fenster oder
 * gesperrte Website-Daten dürfen den Dialog nie aufhalten — dann gilt eben
 * der Standard. Den Speicher bekommen die Funktionen hereingereicht
 * (tests/verkauf-eintragen.test.ts).
 */
import { verkaufskanalSchema, type Verkaufskanal } from '@/schemas/verkaufskanal'

export const VERKAUFSKANAL_SCHLUESSEL = 'farmerzone_verkauf_kanal'

/** Vorausgewählt, solange nichts gemerkt ist: der häufigste Weg ab Hof. */
export const STANDARD_KANAL: Verkaufskanal = 'HOFLADEN'

type Speicher = Pick<Storage, 'getItem' | 'setItem'>

/** Der localStorage des Browsers — oder null, wo es keinen gibt oder schon der Zugriff wirft. */
export function kanalSpeicher(): Speicher | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    // Gesperrte Website-Daten: Zugriff auf localStorage wirft. Dann ohne Merker.
    return null
  }
}

/** Der Kanal, der beim Öffnen des Dialogs gewählt ist. */
export function kanalVorauswahl(speicher: Speicher | null): Verkaufskanal {
  if (!speicher) return STANDARD_KANAL
  try {
    const gelesen = verkaufskanalSchema.safeParse(speicher.getItem(VERKAUFSKANAL_SCHLUESSEL))
    return gelesen.success ? gelesen.data : STANDARD_KANAL
  } catch {
    // Kein Lesezugriff: Dann ist nichts gemerkt, und der Standard gilt.
    return STANDARD_KANAL
  }
}

export function merkeKanal(speicher: Speicher | null, kanal: Verkaufskanal): void {
  try {
    speicher?.setItem(VERKAUFSKANAL_SCHLUESSEL, kanal)
  } catch {
    // Kein Schreibzugriff (privates Fenster, voller Speicher): Das nächste Mal
    // ist eben der Standard gewählt — der Verkauf selbst ist gespeichert.
  }
}
