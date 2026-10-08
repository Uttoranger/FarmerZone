/**
 * Die Testumgebung test.farmerzone.at (Register Z3, Nachtlauf Nr. 43) — die
 * Regeln für Oberfläche und Post, rein, ohne process.env
 * (tests/testumgebung.test.ts).
 *
 * In der Produktion gibt es keinen Umschalter zwischen Test und Live (Z3).
 * Echte Abläufe testet man in der Testumgebung: Branch staging,
 * Entwicklungsdatenbank, Stripe im Testmodus. Damit niemand die beiden
 * verwechselt, sagt der Admin-Kopf, welcher Stripe-Modus gilt, und es gibt
 * Wege hin und zurück. Und damit ein Probelauf niemandem schreibt, der nichts
 * bestellt hat, geht außerhalb der Produktion Post nur an freigegebene Adressen.
 *
 * Welche Umgebung gilt und welcher Stripe-Modus, entscheidet allein
 * bestimmeUmgebung (src/lib/umgebung.ts) — aus Etiketten, nie aus dem Schlüssel.
 */
import { PRODUKTION_ADRESSE, type Umgebung, type UmgebungsArt } from '@/lib/umgebung'

// ─── Marke im Admin-Kopf ─────────────────────────────────────────────────────

/** Wörtlich aus freigabe.md §12 (Nr. 43). */
export const STRIPE_MARKE_TEXT = { live: 'Stripe Live', test: 'Stripe Test' } as const

export type StripeMarke = {
  text: (typeof STRIPE_MARKE_TEXT)[keyof typeof STRIPE_MARKE_TEXT]
  /** Ton der StatusBadge: Grün nur, wo echtes Geld fließen soll; sonst Orange. */
  ton: 'fertig' | 'offen'
}

/**
 * „Stripe Live" bzw. „Stripe Test" für den Admin-Kopf — nur aus dem Modus.
 *
 * Grün allein für die Produktion mit Live-Schlüssel: Dort fließt echtes Geld,
 * wie es soll. Orange sonst — der Testbetrieb der Produktion (wie die orange
 * Karte aus Nr. 42), die Testumgebung, lokal und ein Live-Schlüssel außerhalb
 * der Produktion (dort startet Stripe gar nicht). Ohne erkennbaren Schlüssel
 * keine Marke: §12 nennt nur Live und Test.
 */
export function stripeMarke(u: Pick<Umgebung, 'art' | 'stripe'>): StripeMarke | null {
  if (u.stripe === 'live') return { text: STRIPE_MARKE_TEXT.live, ton: u.art === 'produktion' ? 'fertig' : 'offen' }
  if (u.stripe === 'test') return { text: STRIPE_MARKE_TEXT.test, ton: 'offen' }
  return null
}

// ─── Wege zwischen den Umgebungen ────────────────────────────────────────────

/** Der Weg aus der Testumgebung zurück — Ziel ist die feste Adresse der echten Seite. */
export const ZUR_ECHTEN_SEITE = { text: 'Zur echten Seite', href: PRODUKTION_ADRESSE } as const

/**
 * „Zur echten Seite" im Umgebungsbanner — nur in der Vorschau, denn dort liegt
 * die Testumgebung. Lokal nicht: Vom eigenen Rechner soll kein Klick in die
 * Produktion führen, in der man dann weiterklickt, als wäre es ein Test.
 */
export function bannerLink(u: Pick<Umgebung, 'art'>): typeof ZUR_ECHTEN_SEITE | null {
  return u.art === 'preview' ? ZUR_ECHTEN_SEITE : null
}

// ─── Post außerhalb der Produktion ───────────────────────────────────────────

/** Die Domain der Seed- und Testkonten (prisma/seed-daten.ts, Tests). */
const TEST_DOMAIN = 'example.com'

/**
 * Genau EINE schlichte Adresse: ein @, kein Leerzeichen, kein Trenner, keine
 * Anführung, kein „Name <…>". Sonst käme „fremd@…, test@example.com" als
 * Ganzes durch die Prüfung der Domain, und Resend schriebe beiden.
 */
const SCHLICHTE_ADRESSE = /^[^\s@,;:<>()[\]\\"']+@[a-z0-9-]+(\.[a-z0-9-]+)+$/

function normalisiert(adresse: string): string {
  return adresse.trim().toLowerCase()
}

/**
 * Die Liste aus TEST_EMPFAENGER: getrennt an Komma (auch Semikolon und
 * Leerzeichen), klein geschrieben. Was keine schlichte Adresse ist, fällt
 * weg — an sie geht dann eben keine Mail, die sichere Richtung.
 */
export function leseTestEmpfaenger(roh: string | undefined): ReadonlySet<string> {
  if (!roh) return new Set()
  return new Set(
    roh
      .split(/[\s,;]+/)
      .map(normalisiert)
      .filter((eintrag) => SCHLICHTE_ADRESSE.test(eintrag))
  )
}

/**
 * Darf an diese Adresse in dieser Umgebung eine Mail gehen?
 *
 * Die Produktion immer — eine echte Bestellbestätigung hängt an keiner Liste.
 * Außerhalb (Testumgebung, andere Vorschauen, lokal mit Resend-Schlüssel) nur
 * Adressen aus TEST_EMPFAENGER und der Domain example.com: Die
 * Entwicklungsdatenbank kann Adressen tragen, die nie Post aus einem Test
 * bekommen sollen. Ohne Liste gehen dort also nur Mails an Testkonten.
 */
export function darfMailEmpfangen(adresse: string, art: UmgebungsArt, testEmpfaenger: ReadonlySet<string>): boolean {
  if (art === 'produktion') return true
  const a = normalisiert(adresse)
  if (!SCHLICHTE_ADRESSE.test(a)) return false
  if (a.slice(a.lastIndexOf('@') + 1) === TEST_DOMAIN) return true
  return testEmpfaenger.has(a)
}
