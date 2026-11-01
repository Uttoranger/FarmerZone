/**
 * Admin › Höfe im Regelbetrieb (Register N32; Nachtlauf Nr. 187; Mockup
 * admin-hoefe-neu): Zustand in einem Wort, Signale, Filter und Suche der
 * Liste — rein und ohne Datenbank prüfbar (tests/admin-hoefe-liste.test.ts).
 *
 * SIGNALE: `hofSignale` ist die EINE Regel dafür, wann ein Hof Blick braucht
 * (wartet, Stripe fehlt, ohne Abholzeit, lange ohne Bestellung). Die Liste
 * filtert damit „Braucht Blick“; die Aufgaben in Admin › Heute (Nr. 185,
 * src/lib/admin-aufgaben.ts) sollen dieselbe Funktion nehmen und nur Frist und
 * Ziel ergänzen — keine zweite Logik.
 *
 * Kein Date an die Client-Komponente (CODING_STANDARDS „Serialisierung“): Die
 * Zeile kommt fertig als Text, Zahl und Wahrheitswert vom Server.
 */
import { zuletztText } from '@/lib/betrieb'
import { HOF_EMAIL_TEXT } from '@/lib/hof-kontakt'
import { freischaltSperre, FREISCHALTUNG_ABHOLZEIT_OFFEN_TEXT, FREISCHALTUNG_HOF_EMAIL_OFFEN_TEXT, FREISCHALTUNG_PRODUKT_OFFEN_TEXT, FREISCHALTUNG_STRIPE_OFFEN_TEXT } from '@/lib/admin-hoefe'
import { FREISCHALTUNG_EMAIL_OFFEN_TEXT } from '@/lib/email-bestaetigung'
import { ADMIN_HOEFE_HREF } from '@/lib/admin-hof-akte'

/** Ein freigeschalteter Hof ohne Bestellung so lange braucht Blick (Freigabe 185: „seit 14 Tagen ohne Bestellung“). */
export const OHNE_BESTELLUNG_TAGE = 14

/** Die Zahlen „Bestellungen 30 Tage“ der Liste und der Akte. */
export const AKTIVITAET_TAGE = 30

const TAG_MS = 86_400_000
const STUNDE_MS = 3_600_000

// ─── Zustand ────────────────────────────────────────────────────────────────

export type HofZustandId = 'geschlossen' | 'stillgelegt' | 'testhof' | 'wartet' | 'gesperrt' | 'pausiert' | 'verkauft'

/** Der Ton des Zustandsworts — dieselben Werte wie StatusBadge. Das Wort steht immer dabei, nie nur Farbe. */
export type HofZustand = { id: HofZustandId; text: string; ton: 'offen' | 'fertig' | 'neutral' }

export type ZustandHof = {
  approvedAt: Date | null
  archivedAt: Date | null
  geschlossenAm: Date | null
  istTesthof: boolean
  adminGesperrtAm: Date | null
  isPaused: boolean
}

/**
 * Der Zustand in einem Wort (Mockup: Spalte „Zustand“). Reihenfolge zählt:
 * Geschlossen (Konto schließen, N36) und Stillgelegt nehmen die Hofseite vom
 * Netz; ein Testhof ist nie „verkauft“; dann Wartet, Gesperrt (vom Team, N34)
 * vor Pausiert (vom Hof) — die Pause bleibt unabhängig, das Team sticht.
 */
export function hofZustand(hof: ZustandHof): HofZustand {
  if (hof.geschlossenAm) return { id: 'geschlossen', text: 'Geschlossen', ton: 'neutral' }
  if (hof.archivedAt) return { id: 'stillgelegt', text: 'Stillgelegt', ton: 'neutral' }
  if (hof.istTesthof) return { id: 'testhof', text: 'Testhof', ton: 'neutral' }
  if (hof.approvedAt === null) return { id: 'wartet', text: 'Wartet', ton: 'offen' }
  if (hof.adminGesperrtAm) return { id: 'gesperrt', text: 'Gesperrt', ton: 'offen' }
  if (hof.isPaused) return { id: 'pausiert', text: 'Pausiert', ton: 'neutral' }
  return { id: 'verkauft', text: 'Verkauft', ton: 'fertig' }
}

// ─── Signale ────────────────────────────────────────────────────────────────

export type HofSignalId = 'wartet' | 'stripe-fehlt' | 'ohne-abholzeit' | 'ohne-bestellung'
export type HofSignal = { id: HofSignalId; text: string }

export type SignalHof = ZustandHof & {
  emailBestaetigungOffen: boolean
  stripeBereit: boolean
  produktImShop: boolean
  abholzeitAktiv: boolean
  /** Hof-E-Mail für die Kundschaft fehlt (Nr. 212) — Teil der Freischalt-Sperre. */
  hofEmailFehlt: boolean
  /** Die jüngste Bestellung des Hofs (ohne Testzahlungen) — null ohne Bestellung. */
  letzteBestellungAm: Date | null
}

/** Was einem wartenden Hof zum Freischalten fehlt, kurz — dieselbe Reihenfolge wie freischaltSperre. */
function freischaltKurz(hof: SignalHof): string {
  const sperre = freischaltSperre(hof)
  if (sperre === FREISCHALTUNG_EMAIL_OFFEN_TEXT) return 'E-Mail nicht bestätigt'
  if (sperre === FREISCHALTUNG_STRIPE_OFFEN_TEXT) return 'Stripe fehlt'
  if (sperre === FREISCHALTUNG_PRODUKT_OFFEN_TEXT) return 'kein Produkt im Shop'
  if (sperre === FREISCHALTUNG_ABHOLZEIT_OFFEN_TEXT) return 'Abholzeit fehlt'
  if (sperre === FREISCHALTUNG_HOF_EMAIL_OFFEN_TEXT) return HOF_EMAIL_TEXT.akteFehlt
  return 'bereit zum Prüfen'
}

/**
 * Die Signale eines Hofs — leer heißt: läuft. Geschlossene, stillgelegte und
 * Testhöfe haben keine (Testhöfe nur unter „Testhöfe“). Gesperrt und Pausiert
 * sind gewollte Zustände mit eigenem Filter, keine Signale.
 */
export function hofSignale(hof: SignalHof, jetzt: Date): HofSignal[] {
  const zustand = hofZustand(hof)
  if (zustand.id === 'wartet') return [{ id: 'wartet', text: freischaltKurz(hof) }]
  if (zustand.id !== 'verkauft') return []
  const signale: HofSignal[] = []
  if (!hof.stripeBereit) signale.push({ id: 'stripe-fehlt', text: 'Stripe fehlt' })
  if (!hof.abholzeitAktiv) signale.push({ id: 'ohne-abholzeit', text: 'ohne Abholzeit' })
  const grenze = jetzt.getTime() - OHNE_BESTELLUNG_TAGE * TAG_MS
  // Erst wer länger als die Frist freigeschaltet ist, kann „lange ohne Bestellung“ sein.
  const freiSeitFrist = hof.approvedAt !== null && hof.approvedAt.getTime() <= grenze
  if (freiSeitFrist && (hof.letzteBestellungAm === null || hof.letzteBestellungAm.getTime() < grenze)) {
    signale.push({ id: 'ohne-bestellung', text: `seit ${OHNE_BESTELLUNG_TAGE} Tagen ohne Bestellung` })
  }
  return signale
}

/** „seit 3 h“ bzw. „seit 2 Tagen“ — wie lange ein Hof schon wartet (ab der Registrierung). */
export function wartetSeitText(seit: Date, jetzt: Date): string {
  const ms = Math.max(0, jetzt.getTime() - seit.getTime())
  if (ms < 48 * STUNDE_MS) return `seit ${Math.max(1, Math.floor(ms / STUNDE_MS))} h`
  return `seit ${Math.floor(ms / TAG_MS)} Tagen`
}

// ─── Filter ─────────────────────────────────────────────────────────────────

/** Die Filter der Liste (Freigabe 187, Punkt 1) — „Braucht Blick“ ist der Standard. */
export const HOEFE_LISTE_FILTER = ['braucht-blick', 'wartet', 'verkauft', 'pausiert', 'gesperrt', 'geschlossen', 'testhoefe', 'alle'] as const
export type HoefeListeFilter = (typeof HOEFE_LISTE_FILTER)[number]
export const HOEFE_LISTE_STANDARD: HoefeListeFilter = 'braucht-blick'

export const HOEFE_LISTE_FILTER_LABEL: Record<HoefeListeFilter, string> = {
  'braucht-blick': 'Braucht Blick',
  wartet: 'Wartet',
  verkauft: 'Verkauft',
  pausiert: 'Pausiert',
  gesperrt: 'Gesperrt',
  geschlossen: 'Geschlossen',
  testhoefe: 'Testhöfe',
  alle: 'Alle',
}

/** Zu welchen Filtern ein Hof gehört — einmal am Server, damit Liste, Zahlen und Suche dieselbe Antwort lesen. */
export function hofFilter(zustand: HofZustandId, signale: readonly HofSignal[]): HoefeListeFilter[] {
  const filter: HoefeListeFilter[] = ['alle']
  if (signale.length > 0) filter.push('braucht-blick')
  if (zustand === 'wartet') filter.push('wartet')
  if (zustand === 'verkauft') filter.push('verkauft')
  if (zustand === 'pausiert') filter.push('pausiert')
  if (zustand === 'gesperrt') filter.push('gesperrt')
  if (zustand === 'geschlossen' || zustand === 'stillgelegt') filter.push('geschlossen')
  if (zustand === 'testhof') filter.push('testhoefe')
  return filter
}

// ─── Die Zeile ──────────────────────────────────────────────────────────────

export type HoefeListenRoh = SignalHof & {
  id: string
  name: string
  slug: string
  ort: string
  createdAt: Date
  bestellungen30: number
  /** Letzte Aktivität des Inhabers (jüngste Sitzung) — null, wenn keine bekannt. */
  zuletztAktivAm: Date | null
}

export type HoefeListenZeile = {
  id: string
  name: string
  slug: string
  ort: string
  zustand: HofZustand
  /** „seit 26 h“ bei wartenden Höfen, sonst null. */
  seit: string | null
  signale: string[]
  bestellungen30: number
  zuletztAktiv: string | null
  filter: HoefeListeFilter[]
}

export function hoefeListenZeile(hof: HoefeListenRoh, jetzt: Date): HoefeListenZeile {
  const zustand = hofZustand(hof)
  const signale = hofSignale(hof, jetzt)
  return {
    id: hof.id,
    name: hof.name,
    slug: hof.slug,
    ort: hof.ort,
    zustand,
    seit: zustand.id === 'wartet' ? wartetSeitText(hof.createdAt, jetzt) : null,
    signale: signale.map((s) => s.text),
    bestellungen30: hof.bestellungen30,
    zuletztAktiv: hof.zuletztAktivAm ? zuletztText(hof.zuletztAktivAm, jetzt) : null,
    filter: hofFilter(zustand.id, signale),
  }
}

/**
 * Wer Blick braucht zuerst: wartende (am längsten wartend oben — die Server-
 * Reihenfolge ist „jüngste zuerst“, deshalb umgekehrt), dann Höfe mit Signal,
 * dann der Rest in der Reihenfolge des Servers.
 */
export function sortiereHoefeListe<T extends { zustand: HofZustand; signale: readonly string[] }>(zeilen: readonly T[]): T[] {
  const wartend = zeilen.filter((z) => z.zustand.id === 'wartet').reverse()
  const signal = zeilen.filter((z) => z.zustand.id !== 'wartet' && z.signale.length > 0)
  const rest = zeilen.filter((z) => z.zustand.id !== 'wartet' && z.signale.length === 0)
  return [...wartend, ...signal, ...rest]
}

/** Passt eine Zeile zur Suche? Name, Adresse der Hofseite oder Ort, ohne Groß/klein. */
export function passtZurListenSuche(zeile: { name: string; slug: string; ort: string }, suche: string): boolean {
  const s = suche.trim().toLocaleLowerCase('de-AT')
  if (s === '') return true
  return [zeile.name, zeile.slug, zeile.ort].some((t) => t.toLocaleLowerCase('de-AT').includes(s))
}

export function filtereHoefeListe<T extends HoefeListenZeile>(zeilen: readonly T[], ansicht: { filter: HoefeListeFilter; suche: string }): T[] {
  return zeilen.filter((z) => z.filter.includes(ansicht.filter) && passtZurListenSuche(z, ansicht.suche))
}

/** Die Zahl hinter jedem Filter — ohne Suche. */
export function zaehleHoefeListe(zeilen: readonly HoefeListenZeile[]): Record<HoefeListeFilter, number> {
  const zahlen = Object.fromEntries(HOEFE_LISTE_FILTER.map((f) => [f, 0])) as Record<HoefeListeFilter, number>
  for (const z of zeilen) for (const f of z.filter) zahlen[f]++
  return zahlen
}

/** Die Adresse der Liste mit Filter und Suche — ohne Standardwerte. */
export function hoefeListeAdresse(ansicht: { filter: HoefeListeFilter; suche: string }): string {
  const parameter = new URLSearchParams()
  if (ansicht.filter !== HOEFE_LISTE_STANDARD) parameter.set('filter', ansicht.filter)
  const suche = ansicht.suche.trim()
  if (suche !== '') parameter.set('suche', suche)
  const q = parameter.toString()
  return q ? `${ADMIN_HOEFE_HREF}?${q}` : ADMIN_HOEFE_HREF
}

export const HOEFE_LISTE_TEXT = {
  titel: 'Höfe',
  satz: 'Wer wartet, wer Hilfe braucht, wer läuft – und zu jedem Hof die Akte.',
  tabelle: 'Höfe, wer Blick braucht zuerst',
  regel:
    '„Braucht Blick“ zeigt Höfe, die warten, still sind oder etwas Unvollständiges haben – dieselben Regeln wie die Aufgaben in Heute. Gründungsplätze und Testhöfe stehen in der Akte jedes Hofs.',
  keinerBrauchtBlick: 'Gerade braucht kein Hof deinen Blick.',
  keinerBrauchtBlickSatz: 'Alle Höfe laufen. Unter „Alle“ stehen sie mit ihrer Akte.',
  leerTitel: 'Noch kein Hof angemeldet',
  leerSatz: 'Sobald sich ein Hof registriert, steht er hier mit „Prüfen“.',
  keinTreffer: 'Kein Hof passt',
  keinTrefferSatz: 'Mit diesem Filter oder dieser Suche gibt es keinen Hof.',
  pruefen: 'Prüfen',
  akte: 'Akte',
} as const
