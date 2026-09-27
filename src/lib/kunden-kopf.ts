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
  | { art: 'hofuebersicht' }
  /** Impressum, Datenschutz, Konditionen, Problem melden. */
  | { art: 'info' }

export type KopfForm = {
  /** Handy: runde Knöpfe über dem Titelbild, die schmale Leiste erst beim Scrollen — oder die Leiste von Anfang an. */
  handy: 'titelbild-knoepfe' | 'leiste'
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
  switch (seite.art) {
    case 'hofseite':
      return { handy: 'titelbild-knoepfe', warenkorb: false, rueckwegZeile: true }
    case 'checkout':
    case 'bestaetigung':
    case 'bestellung':
      return { handy: 'leiste', warenkorb: false, rueckwegZeile: true }
    case 'hofuebersicht':
    case 'info':
      // Im Browser führen „FarmerZone" und „Höfe entdecken" schon zurück.
      return { handy: 'leiste', warenkorb: true, rueckwegZeile: false }
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
    case 'hofuebersicht':
      return { href: '/', verlauf: vorgaengerEigen }
    case 'info':
      return { href: '/hoefe', verlauf: vorgaengerEigen }
  }
}

/**
 * Wie das Dokument zur aktuellen Seite kam:
 * - 'start': erste Seite dieses Dokuments (geteilter Link, neuer Tab, Neuladen),
 * - 'link': ein Seitenwechsel in der App (Link, router.push),
 * - 'verlauf': Zurück oder Vorwärts im Browser,
 * - 'nurQuery': nur die Suchparameter haben sich geändert (Filter, Bereich).
 */
export type SeitenWechsel = 'start' | 'link' | 'verlauf' | 'nurQuery'

/**
 * Ob vor der aktuellen Seite eine eigene steht — nachgeführt bei jedem
 * Wechsel. Bewusst vorsichtig: Nur ein Seitenwechsel in der App beweist
 * einen eigenen Vorgänger. Nach Zurück oder Vorwärts ist unbekannt, was davor
 * steht; dann lieber der Link als ein Schritt zu einer fremden Seite.
 */
export function merkeVorgaenger(vorher: boolean, wechsel: SeitenWechsel): boolean {
  switch (wechsel) {
    case 'start':
    case 'verlauf':
      return false
    case 'link':
      return true
    case 'nurQuery':
      return vorher
  }
}

/**
 * Das Urteil „eigener Vorgänger": Kennt der Browser die Navigation API, sagt
 * `navigation.canGoBack` es genau (nur zusammenhängende Einträge desselben
 * Ursprungs, auch nach Neuladen). Sonst gilt der Merker.
 */
export function vorgaengerEigen(canGoBack: boolean | undefined, merker: boolean): boolean {
  return canGoBack ?? merker
}
