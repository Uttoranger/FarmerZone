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
 * bestellt hat, geht Post nur im Produktions-Deployment an jede Adresse,
 * sonst nur an freigegebene.
 *
 * Welche Umgebung gilt und welcher Stripe-Modus, entscheidet allein
 * bestimmeUmgebung (src/lib/umgebung.ts) — aus Etiketten, nie aus dem Schlüssel.
 */
import { PRODUKTION_ADRESSE, STRIPE_LABEL, type Umgebung } from '@/lib/umgebung'
import { stripeStartGesperrt, type StripeModus } from '@/lib/stripe-modus'

// ─── Marke im Admin-Kopf ─────────────────────────────────────────────────────

/**
 * Wörtlich aus freigabe.md §12 (Nr. 43). „Stripe Test" kommt aus derselben
 * Quelle wie im Umgebungsbanner; „Stripe Live" schreibt nur der Admin so — das
 * Banner ruft dort „Stripe LIVE", weil es in einer Vorschau ein Fehler ist.
 */
export const STRIPE_MARKE_TEXT = { live: 'Stripe Live', test: STRIPE_LABEL.test } as const

export type StripeMarke = {
  text: (typeof STRIPE_MARKE_TEXT)[keyof typeof STRIPE_MARKE_TEXT]
  /** Ton der StatusBadge: Grün nur, wo echtes Geld fließen soll; sonst Orange. */
  ton: 'fertig' | 'offen'
}

/**
 * „Stripe Live" bzw. „Stripe Test" für den Admin-Kopf — nur aus dem Modus.
 *
 * Grün allein dort, wo ein Live-Schlüssel den Stripe-Client auch starten darf
 * — dieselbe Regel wie die Modus-Wache (`stripeStartGesperrt`, Nr. 42: nur
 * das Produktions-Deployment bei Vercel). Dort fließt echtes Geld, wie es
 * soll. Orange sonst: der Testbetrieb der Produktion (wie die orange Karte aus
 * Nr. 42), die Testumgebung, lokal, und ein Live-Schlüssel, den die Wache
 * sperrt. Ohne erkennbaren Schlüssel keine Marke: §12 nennt nur Live und Test.
 */
export function stripeMarke(u: StripeModus): StripeMarke | null {
  if (u.stripe === 'live') return { text: STRIPE_MARKE_TEXT.live, ton: stripeStartGesperrt(u) ? 'offen' : 'fertig' }
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

// ─── Post nur im Produktions-Deployment frei ─────────────────────────────────

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

/** Was die Post-Regel von der Umgebung braucht — wie die Modus-Wache aus Nr. 42. */
export type PostUmgebung = Pick<Umgebung, 'art' | 'vercelProduktion'>

/**
 * Darf an diese Adresse in dieser Umgebung eine Mail gehen?
 *
 * Frei nur im Produktions-Deployment bei Vercel (`art` produktion UND
 * `VERCEL_ENV=production`) — fail-closed wie die Modus-Wache (Nr. 42,
 * Entscheidung des Dirigenten, Nr. 43 Runde 1): `bestimmeUmgebung` ordnet
 * Unbekanntes als „produktion" ein, also auch einen lokalen Produktions-Build,
 * die CI und Skripte. Dort und in Testumgebung, Vorschau und lokal gehen Mails
 * nur an TEST_EMPFAENGER und die Domain example.com: Die
 * Entwicklungsdatenbank kann Adressen tragen, die nie Post aus einem Test
 * bekommen sollen. Ohne Liste also nur an Testkonten.
 */
export function darfMailEmpfangen(adresse: string, u: PostUmgebung, testEmpfaenger: ReadonlySet<string>): boolean {
  if (u.art === 'produktion' && u.vercelProduktion) return true
  const a = normalisiert(adresse)
  if (!SCHLICHTE_ADRESSE.test(a)) return false
  if (a.slice(a.lastIndexOf('@') + 1) === TEST_DOMAIN) return true
  return testEmpfaenger.has(a)
}

/**
 * Sperrt die Post, obwohl die App sich für die Produktion hält? Das ist ein
 * lokaler Produktions-Build, die CI — oder eine echte Produktion, der Vercel
 * die Systemvariablen nicht gibt. Damit Letztere nicht still verstummt,
 * meldet src/lib/email.ts diesen Fall (und nur ihn) einmal je Instanz an Sentry.
 */
export function sperrtTrotzProduktion(u: PostUmgebung): boolean {
  return u.art === 'produktion' && !u.vercelProduktion
}
