/**
 * Betriebsnachweis im Checkout (Sprint Bereiche 1, docs/konzepte/bereiche.md §4).
 *
 * Ein Hof kann ein Futtermittel mit abgabe = NUR_BETRIEBE nur an
 * landwirtschaftliche Betriebe abgeben. Liegt so eine Position im Korb, muss
 * die Bestellung als BETRIEB mit einer Betriebsnummer kommen.
 *
 * EINE Regel für Browser und Server: Das Checkout-Formular prüft damit zum
 * Komfort, der Checkout-Handler prüft damit ERNEUT — mit der Abgabe aus der
 * Datenbank, nie mit dem, was der Browser über seinen Korb behauptet.
 */

export const KAEUFER_ART_VALUES = ['PRIVAT', 'BETRIEB'] as const

export type KaeuferArtValue = (typeof KAEUFER_ART_VALUES)[number]

/** Mindestlänge einer Betriebsnummer — dieselbe Grenze im Checkout und in den Hof-Einstellungen. */
export const BETRIEBSNUMMER_MIN_ZEICHEN = 5

/** Wortlaut aus dem Konzept §4 — im Formular und in der 400-Antwort des Handlers. */
export const BETRIEBSNACHWEIS_FEHLER =
  'Dieses Futtermittel gibt der Hof nur an landwirtschaftliche Betriebe ab. Bitte trag deine Betriebsnummer ein.'

/** Maschinenlesbarer Code der 400-Antwort, damit der Browser den Fall erkennt. */
export const CODE_BETRIEBSNACHWEIS_FEHLT = 'BETRIEBSNACHWEIS_FEHLT'

export type Betriebsnachweis = {
  /** Liegt mindestens eine Position mit abgabe = NUR_BETRIEBE im Korb? */
  nurBetriebeImKorb: boolean
  kaeuferArt: KaeuferArtValue
  betriebsnummer?: string | null
}

export type BetriebsnachweisErgebnis =
  | { ok: true }
  | { ok: false; feld: 'kaeuferArt' | 'betriebsnummer'; meldung: string }

export function pruefeBetriebsnachweis(eingabe: Betriebsnachweis): BetriebsnachweisErgebnis {
  if (!eingabe.nurBetriebeImKorb) return { ok: true }
  if (eingabe.kaeuferArt !== 'BETRIEB') {
    return { ok: false, feld: 'kaeuferArt', meldung: BETRIEBSNACHWEIS_FEHLER }
  }
  if ((eingabe.betriebsnummer ?? '').trim().length < BETRIEBSNUMMER_MIN_ZEICHEN) {
    return { ok: false, feld: 'betriebsnummer', meldung: BETRIEBSNACHWEIS_FEHLER }
  }
  return { ok: true }
}

/**
 * Was als Betriebsnummer in der Bestellung landet: nur bei BETRIEB, getrimmt,
 * leer = null. Eine Privatbestellung speichert keine Nummer, auch wenn der
 * Browser eine mitschickt.
 */
export function betriebsnummerFuerBestellung(
  kaeuferArt: KaeuferArtValue,
  betriebsnummer: string | null | undefined
): string | null {
  if (kaeuferArt !== 'BETRIEB') return null
  const nummer = (betriebsnummer ?? '').trim()
  return nummer === '' ? null : nummer
}
