/**
 * Stripe-Testbetrieb und Modus-Wache (Register Z2, Nachtlauf Nr. 42) — rein,
 * ohne Stripe-SDK und ohne process.env (tests/stripe-modus.test.ts).
 *
 * Den Modus kennt nur `bestimmeUmgebung` (src/lib/umgebung.ts): die Umgebung
 * (produktion | preview | lokal) und Stripe (test | live | fehlt) — aus dem
 * Präfix, nie aus dem Schlüssel selbst. Hier stehen die zwei Regeln, die
 * darauf aufbauen, und die Sätze, die daraus folgen:
 *
 *  - Vorschau und lokal laufen nie mit Live-Schlüssel: Der Stripe-Client
 *    startet dann nicht (src/lib/stripe.ts). Ein falsch kopierter Schlüssel
 *    machte sonst aus einem Test in der Vorschau eine echte Abbuchung — bis
 *    Lauf 8 teilten sich Vorschau und Produktion bei Vercel EINE Variable.
 *  - Läuft die Produktion mit Test-Schlüssel, sagen Kasse, Admin und
 *    Zahlungs-Einstellungen das deutlich (Testbetrieb). Mit Live-Schlüssel
 *    verschwinden die Hinweise von selbst — niemand muss beim Umschalten an
 *    drei Stellen daran denken.
 *
 * Client-Komponenten bekommen nur den Wahrheitswert (TESTBETRIEB aus
 * umgebung-server.ts), nie den Modus oder gar den Schlüssel.
 */
import type { Umgebung } from '@/lib/umgebung'

export type StripeModus = Pick<Umgebung, 'art' | 'stripe'>

/**
 * Darf der Stripe-Client hier NICHT starten? Nur in Vorschau und lokal mit
 * Live-Schlüssel. Die Produktion startet mit jedem Schlüssel — ob sie im
 * Testbetrieb läuft, sagt `istTestbetrieb`.
 */
export function stripeStartGesperrt(u: StripeModus): boolean {
  return (u.art === 'preview' || u.art === 'lokal') && u.stripe === 'live'
}

/**
 * Die Fehlermeldung der Wache — für Protokoll und Sentry, nicht für
 * Kundinnen (die sehen den Satz ihres Wegs, etwa „Online-Zahlung ist gerade
 * nicht möglich"). Bewusst ohne Schlüssel und ohne Präfix eines Schlüssels.
 */
export function stripeGesperrtMeldung(art: 'preview' | 'lokal'): string {
  return art === 'preview'
    ? 'Stripe startet nicht: Die Vorschau läuft mit einem Live-Schlüssel. Außerhalb der Produktion ist nur ein Test-Schlüssel erlaubt – bitte für die Vorschau einen Test-Schlüssel eintragen.'
    : 'Stripe startet nicht: Lokal ist ein Live-Schlüssel eingetragen. Außerhalb der Produktion ist nur ein Test-Schlüssel erlaubt – bitte lokal einen Test-Schlüssel eintragen.'
}

/**
 * Testbetrieb: Die Produktion läuft mit Test-Schlüssel — echte Karten lehnt
 * Stripe dann ab, Online-Zahlungen sind Testzahlungen. Vorschau und lokal
 * zählen nie: Dort sagt es das Umgebungsbanner („Stripe Test").
 */
export function istTestbetrieb(u: StripeModus): boolean {
  return u.art === 'produktion' && u.stripe === 'test'
}

/** Die drei Sätze des Testbetriebs, wörtlich aus freigabe.md §12 (Nr. 42). */
export const TESTBETRIEB_TEXT = {
  /** Kasse, an der Zahlart „Online bezahlen". */
  kasse: 'Testbetrieb: Echte Karten werden noch abgelehnt. Bitte wähle Bar bei Abholung.',
  /** AdminShell, orange Hinweiskarte über jeder Admin-Seite. */
  admin: 'Stripe läuft im Testmodus – Online-Zahlungen sind Testzahlungen, es fließt kein echtes Geld.',
  /** Einstellungen → Zahlung, in der Karte „Online-Zahlung (Stripe)". */
  zahlung: 'Online-Zahlung läuft noch im Testbetrieb.',
} as const
