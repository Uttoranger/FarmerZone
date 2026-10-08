/**
 * Stripe-Testbetrieb und Modus-Wache (Register Z2, Nachtlauf Nr. 42) — rein,
 * ohne Stripe-SDK und ohne process.env (tests/stripe-modus.test.ts).
 *
 * Den Modus kennt nur `bestimmeUmgebung` (src/lib/umgebung.ts): die Umgebung
 * (produktion | preview | lokal) und Stripe (test | live | fehlt) — aus dem
 * Präfix, nie aus dem Schlüssel selbst. Hier stehen die zwei Regeln, die
 * darauf aufbauen, und die Sätze, die daraus folgen:
 *
 *  - Ein Live-Schlüssel startet den Stripe-Client nur im Produktions-
 *    Deployment bei Vercel (src/lib/stripe.ts); überall sonst startet er
 *    nicht. Ein falsch kopierter Schlüssel machte sonst aus einem Test eine
 *    echte Abbuchung — bis Lauf 8 teilten sich Vorschau und Produktion bei
 *    Vercel EINE Variable.
 *  - Läuft die Produktion mit Test-Schlüssel, sagen Kasse, Admin und
 *    Zahlungs-Einstellungen das deutlich (Testbetrieb). Mit Live-Schlüssel
 *    verschwinden die Hinweise von selbst — niemand muss beim Umschalten an
 *    drei Stellen daran denken.
 *
 * Client-Komponenten bekommen nur den Wahrheitswert (TESTBETRIEB aus
 * umgebung-server.ts), nie den Modus oder gar den Schlüssel.
 */
import type { Umgebung, UmgebungsArt } from '@/lib/umgebung'

export type StripeModus = Pick<Umgebung, 'art' | 'stripe' | 'vercelProduktion'>

/**
 * Darf der Stripe-Client hier NICHT starten?
 *
 * Fail-closed (Entscheidung des Dirigenten, Nr. 42 Runde 1): Ein
 * Live-Schlüssel (`sk_live_`, `rk_live_`) startet den Client NUR im
 * Produktions-Deployment bei Vercel — `art` produktion UND
 * `VERCEL_ENV=production`. Jede andere Lage sperrt: Vorschau, lokal mit
 * `next dev` oder `next start`, Vitest, die CI, test:integration, Unbekanntes.
 * `art` allein reicht nicht, weil `bestimmeUmgebung` Unbekanntes bewusst als
 * „produktion" einordnet (dort ist ein fehlendes Banner der kleinere Fehler) —
 * hier wäre ein durchgelassener Live-Schlüssel der größere.
 *
 * Test-Schlüssel sind überall erlaubt; ob die Produktion damit im
 * Testbetrieb läuft, sagt `istTestbetrieb`.
 */
export function stripeStartGesperrt(u: StripeModus): boolean {
  if (u.stripe !== 'live') return false
  return !(u.art === 'produktion' && u.vercelProduktion)
}

/**
 * Die Fehlermeldung der Wache — für Protokoll und Sentry, nicht für
 * Kundinnen (die sehen den Satz ihres Wegs, etwa „Online-Zahlung ist gerade
 * nicht möglich"). Bewusst ohne Schlüssel und ohne Präfix eines Schlüssels.
 * „produktion" heißt hier: gebaut wie die Produktion, aber nicht das
 * Produktions-Deployment bei Vercel (lokaler Produktions-Build, Test, CI).
 */
export function stripeGesperrtMeldung(art: UmgebungsArt): string {
  switch (art) {
    case 'preview':
      return 'Stripe startet nicht: Die Vorschau läuft mit einem Live-Schlüssel. Ein Live-Schlüssel ist nur im Produktions-Deployment bei Vercel erlaubt – bitte für die Vorschau einen Test-Schlüssel eintragen.'
    case 'lokal':
      return 'Stripe startet nicht: Lokal ist ein Live-Schlüssel eingetragen. Ein Live-Schlüssel ist nur im Produktions-Deployment bei Vercel erlaubt – bitte lokal einen Test-Schlüssel eintragen.'
    case 'produktion':
      return 'Stripe startet nicht: Ein Live-Schlüssel ist eingetragen, aber hier läuft nicht das Produktions-Deployment bei Vercel (VERCEL_ENV=production fehlt) – etwa ein lokaler Produktions-Build, ein Test oder die CI. Bitte hier einen Test-Schlüssel eintragen.'
  }
}

/**
 * Der Name der Sperre (`StripeModusGesperrt` in src/lib/stripe.ts). Wer sie
 * erkennen muss — etwa der Webhook, der sie nicht als ungültige Signatur
 * melden darf —, fragt `istModusSperre` und muss dafür weder das SDK-Modul
 * laden noch dessen Klasse kennen (in Tests ist es oft gemockt).
 */
export const MODUS_SPERRE = 'StripeModusGesperrt'

export function istModusSperre(fehler: unknown): fehler is Error {
  return fehler instanceof Error && fehler.name === MODUS_SPERRE
}

/**
 * Testbetrieb: Die Produktion läuft mit Test-Schlüssel — echte Karten lehnt
 * Stripe dann ab, Online-Zahlungen sind Testzahlungen. Vorschau und lokal
 * zählen nie: Dort sagt es das Umgebungsbanner („Stripe Test").
 */
export function istTestbetrieb(u: Pick<Umgebung, 'art' | 'stripe'>): boolean {
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
