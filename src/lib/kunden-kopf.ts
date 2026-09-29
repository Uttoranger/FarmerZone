/**
 * Kopfzeile der Kundenseiten — welche Form sie hat und wohin „Zurück" führt.
 * Rein, ohne Browser prüfbar (tests/kunden-kopf.test.ts); die Komponente
 * src/components/shared/kunden-kopf.tsx zeigt nur an, was hier entschieden
 * wird.
 *
 * Anlass: Außer der Startseite hatte keine Kundenseite eine Navigation. Wer
 * über einen geteilten Link auf einer Hofseite landete, kam nur über den
 * Zurück-Knopf des Browsers weiter — und der führte zurück zu WhatsApp.
 */
import { hoefeLink } from '@/lib/bereiche-anzeige'
import type { AnzeigeBereich } from '@/lib/taxonomie'

/** Die Kundenseiten mit Kopfzeile. Die Startseite hat ihre eigene (LandingNav). */
export type KundenSeite =
  /** `bereich` ist der tatsächlich angezeigte (teileHofseite), nicht der URL-Parameter:
   *  Ein reiner Futterhof zeigt Futter auch ohne `?bereich`, und geteilte Links tragen keinen. */
  | { art: 'hofseite'; hofSlug: string; bereich: AnzeigeBereich }
  | { art: 'checkout'; hofSlug: string }
  | { art: 'bestaetigung'; hofSlug: string }
  | { art: 'bestellung'; hofSlug: string }
  /** Bestellverfolgung mit ungültigem Link: nicht einmal der Hof ist bestätigt. */
  | { art: 'bestellung-ungueltig' }
  | { art: 'hofuebersicht' }
  /** Impressum, Datenschutz, Konditionen, Problem melden. */
  | { art: 'info' }

export type KopfForm = {
  /**
   * Handy: der Zurück-Knopf in der Leiste. Nur, wo „Zurück" woanders hinführt
   * als das F-Icon daneben — auf der Hofübersicht ginge er zur Startseite:
   * zwei Knöpfe mit demselben Ziel nebeneinander.
   */
  zurueck: boolean
  /**
   * Das Warenkorb-Symbol (Handy-Leiste und Browser-Kopfzeile). Auf der
   * Hofseite nicht — dort sitzt der Warenkorb-Knopf unten, wie bei den
   * Vorbildern. In Checkout, Bestätigung und Bestellverfolgung nicht — dort
   * ist der Warenkorb gerade der Inhalt der Seite oder schon eine Bestellung.
   */
  warenkorb: boolean
  /** Browser: unter der Kopfzeile ein Rückweg-Link, wo die Kopfzeile selbst keinen hat. */
  rueckwegZeile: boolean
}

export function kopfForm(seite: KundenSeite): KopfForm {
  const zurueck = rueckweg(seite, false).href !== '/'
  switch (seite.art) {
    case 'hofseite':
    case 'checkout':
    case 'bestaetigung':
    case 'bestellung':
      return { zurueck, warenkorb: false, rueckwegZeile: true }
    case 'bestellung-ungueltig':
      // Kein Hof, zu dem eine Rückweg-Zeile führen könnte — die Kopfzeile
      // führt zur Hofübersicht.
      return { zurueck, warenkorb: false, rueckwegZeile: false }
    case 'hofuebersicht':
    case 'info':
      // Im Browser führen „FarmerZone" und „Höfe entdecken" schon zurück.
      return { zurueck, warenkorb: true, rueckwegZeile: false }
  }
}

export type Rueckweg = {
  /** Wohin der Link führt — immer ein echter Link, auch ohne JavaScript und im neuen Tab. */
  href: string
  /** true: stattdessen einen Schritt im Verlauf zurück, dorthin, wo der Kunde herkam (mit Scrollposition und Filtern). */
  verlauf: boolean
}

/**
 * Wohin „Zurück" führt.
 *
 * Kam der Kunde von einer eigenen Seite (`vorgaengerEigen`), geht es im
 * Verlauf dorthin zurück. Sonst — geteilter Link, neuer Tab, Suche — zum
 * übergeordneten Ort: von der Hofseite zur Hofübersicht (im angezeigten
 * Bereich), von Checkout, Bestätigung und Bestellverfolgung zur Hofseite, von
 * der Hofübersicht zur Startseite.
 *
 * Bestätigung und Bestellverfolgung gehen NIE über den Verlauf: Nach der
 * Zahlung stehen dort Stripe und die Bank, und die Bestellverfolgung wird aus
 * einer Mail geöffnet.
 */
export function rueckweg(seite: KundenSeite, vorgaengerEigen: boolean): Rueckweg {
  switch (seite.art) {
    case 'hofseite':
      return { href: hoefeLink(seite.bereich), verlauf: vorgaengerEigen }
    case 'checkout':
      return { href: `/${seite.hofSlug}`, verlauf: vorgaengerEigen }
    case 'bestaetigung':
    case 'bestellung':
      return { href: `/${seite.hofSlug}`, verlauf: false }
    case 'bestellung-ungueltig':
      return { href: '/hoefe', verlauf: false }
    case 'hofuebersicht':
      return { href: '/', verlauf: vorgaengerEigen }
    case 'info':
      return { href: '/hoefe', verlauf: vorgaengerEigen }
  }
}

/** Der Pfad eines Links ohne Suchparameter und Anker. */
function pfadVon(href: string): string {
  return href.split(/[?#]/)[0]
}

/**
 * Die Browser-Zeile unter der Kopfzeile ist nach ihrem Ziel benannt („‹ Alle
 * Höfe", „‹ {Hof}"). Den Verlauf nimmt sie nur, wenn er genau dorthin führt —
 * dann mit Filtern und Scrollposition. Sonst ist sie ein Link: Stand davor die
 * Startseite, führte ein Schritt zurück nicht zu „Alle Höfe".
 */
export function zeileNimmtVerlauf(seite: KundenSeite, vorgaengerPfad: string | null): boolean {
  const weg = rueckweg(seite, vorgaengerPfad !== null)
  return weg.verlauf && vorgaengerPfad === pfadVon(weg.href)
}

/** Was ein Tipp auf einen Rückweg tut: ein Schritt im Verlauf — oder dem Link folgen und damit hinaufsteigen. */
export type RueckwegTipp = { aktion: 'verlauf' } | { aktion: 'hinauf'; ziel: string }

/**
 * Die Entscheidung beim Tipp — für den Zurück-Knopf (`knopf`) und die
 * Browser-Zeile (`zeile`). Folgt der Tipp dem Link, steigt er zum Ziel hinauf;
 * das merkt sich der RueckwegMerker (für GENAU diesen Pfad), damit „Zurück"
 * dort nicht wieder hinunterführt.
 */
export function tippAufRueckweg(seite: KundenSeite, vorgaengerPfad: string | null, form: 'knopf' | 'zeile'): RueckwegTipp {
  const weg = rueckweg(seite, vorgaengerPfad !== null)
  const verlauf = form === 'zeile' ? zeileNimmtVerlauf(seite, vorgaengerPfad) : weg.verlauf
  return verlauf ? { aktion: 'verlauf' } : { aktion: 'hinauf', ziel: pfadVon(weg.href) }
}

/**
 * Wie das Dokument zur aktuellen Seite kam:
 * - 'start': erste Seite dieses Dokuments (geteilter Link, neuer Tab, Neuladen),
 * - 'link': ein Seitenwechsel in der App (Link, router.push), von `von`,
 * - 'hinauf': über den Ersatz-Link eines Rückwegs hinauf (Hofseite → Hofübersicht),
 * - 'verlauf': Zurück oder Vorwärts im Browser,
 * - 'nurQuery': nur die Suchparameter haben sich geändert (Filter, Bereich).
 */
export type SeitenWechsel =
  | { art: 'start' }
  | { art: 'link'; von: string }
  | { art: 'hinauf' }
  | { art: 'verlauf' }
  | { art: 'nurQuery' }

/**
 * Ordnet einen Pfadwechsel ein — was der RueckwegMerker beobachtet hat:
 * `von` (null beim ersten Mal), der neue `pfad`, ob ein popstate mit
 * Seitenwechsel vorausging (`durchVerlauf`) und wohin ein Tipp gerade
 * hinaufsteigt (`hinaufZiel`). Zurück/Vorwärts geht vor, dann das
 * Hinaufsteigen — aber nur zu genau seinem Ziel: Ein anderer Link, der noch
 * dazwischenkam, ist ein gewöhnlicher Seitenwechsel.
 */
export function ordneWechsel(beobachtet: {
  von: string | null
  pfad: string
  durchVerlauf: boolean
  hinaufZiel: string | null
}): SeitenWechsel {
  const { von, pfad, durchVerlauf, hinaufZiel } = beobachtet
  if (von === null) return { art: 'start' }
  if (von === pfad) return { art: 'nurQuery' }
  if (durchVerlauf) return { art: 'verlauf' }
  if (hinaufZiel === pfad) return { art: 'hinauf' }
  return { art: 'link', von }
}

/**
 * Der Pfad der eigenen Seite vor der aktuellen — oder null. Nachgeführt bei
 * jedem Wechsel und bewusst vorsichtig: Nur ein Seitenwechsel in der App
 * beweist einen eigenen Vorgänger. Nach Zurück oder Vorwärts ist unbekannt,
 * was davor steht; dann lieber der Link als ein Schritt zu einer fremden Seite.
 *
 * 'hinauf' zählt NICHT als Vorgänger: Wer von der Hofseite über den
 * Ersatz-Link zur Hofübersicht hinaufgestiegen ist, will mit dem nächsten
 * „Zurück" weiter hinauf (zur Startseite), nicht wieder hinunter auf die
 * Hofseite — sonst pendelte ein Kunde aus einem geteilten Link zwischen beiden
 * und erreichte die Startseite nie.
 */
export function merkeVorgaenger(vorher: string | null, wechsel: SeitenWechsel): string | null {
  switch (wechsel.art) {
    case 'start':
    case 'hinauf':
    case 'verlauf':
      return null
    case 'link':
      return wechsel.von
    case 'nurQuery':
      return vorher
  }
}

/**
 * Das Urteil „eigene Seite davor" — ihr Pfad oder null.
 * - Kennt der Browser die Navigation API, sagt sie es genau: der vorige
 *   Eintrag, nur zusammenhängend und desselben Ursprungs, auch nach Neuladen
 *   (`navigation.vorherigerPfad`, null wenn keiner). Wurde der aktuelle
 *   Eintrag durch Hinaufsteigen erreicht (`hinaufErreicht`), gilt die Seite
 *   darunter nicht als „zurück".
 * - Sonst gilt der Merker (merkeVorgaenger), der 'hinauf' schon kennt.
 */
export function eigenerVorgaenger(
  navigation: { vorherigerPfad: string | null } | undefined,
  merker: string | null,
  hinaufErreicht: boolean
): string | null {
  if (!navigation) return merker
  return hinaufErreicht ? null : navigation.vorherigerPfad
}
