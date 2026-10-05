/**
 * Die Hofseite für Kundinnen im neuen Design (Nachtlauf Nr. 10, Gate 4;
 * Mockups web-k2-hofseite, web-k2-alle-produkte-nach-kategorie,
 * mobil-k2-hofseite, mobil-k2-produkte) — was sie anbietet und wie sie es
 * nennt, rein und ohne Browser prüfbar (tests/hofseite-kunde.test.ts). Die
 * Komponenten in src/components/hofseite/ zeigen nur an.
 *
 * Kategorie-Abschnitte und Kartenzustand stehen bei den übrigen Regeln der
 * Kundenansicht in bereiche-anzeige.ts, Abholzeiten in pickup-days.ts, der
 * Gebührensatz in servicegebuehr.ts.
 */
import { formatEuro, formatZahl } from '@/lib/format'
import { zeigeKaufknopf } from '@/lib/bereiche-anzeige'
import { calcLineTotal, decimalZuCents } from '@/lib/order-totals'
import { centsAlsEuro } from '@/lib/servicegebuehr'
import { FARM_ARCHIVED_MESSAGE } from '@/lib/farm-archive'
import { FARM_NOT_APPROVED_MESSAGE } from '@/lib/farm-approval'
import { SHOP_PAUSED_MESSAGE } from '@/lib/shop-pause'
import { WARENKORB_ANKER } from '@/lib/warenkorb-speicher'
import { bereichAusParameter } from '@/schemas/hoefe-filter'
import { REITER_PARAMETER, reiterSchema, type HofReiterId } from '@/schemas/hofseite-reiter'

export type { HofReiterId }

// ─── Reiter ─────────────────────────────────────────────────────────────────

export type HofReiter = { id: HofReiterId; label: string }

/**
 * Übersicht · Produkte · Beiträge. „Beiträge" nur, wenn die Hofseite gerade
 * einen zeigt (der aktive Status, wie bisher in der Übersicht) — ein Reiter
 * ins Leere wäre kein Angebot. Die Produktzahl steht im Reiter wie im Mockup.
 */
export function hofseiteReiter({ produktAnzahl, hatBeitrag }: { produktAnzahl: number; hatBeitrag: boolean }): HofReiter[] {
  return [
    { id: 'uebersicht', label: 'Übersicht' },
    { id: 'produkte', label: produktAnzahl > 0 ? `Produkte · ${formatZahl(produktAnzahl)}` : 'Produkte' },
    ...(hatBeitrag ? [{ id: 'beitraege' as const, label: 'Beiträge' }] : []),
  ]
}

/**
 * Welcher Reiter offen ist. Ein gewählter Reiter aus der Adresse gilt, wenn
 * der Hof ihn anbietet; sonst öffnet `?bereich=futter` die Produkte — so
 * landen die Links von /hoefe und aus dem Umfeld beim Futter (der Sprung zum
 * Abschnitt folgt in der Seite). Alles andere: die Übersicht.
 */
export function aktiverReiter(
  suche: { reiter: string | null; bereich: string | null },
  angebot: readonly HofReiter[]
): HofReiterId {
  const gewaehlt = reiterSchema.parse(suche.reiter)
  if (gewaehlt && angebot.some((r) => r.id === gewaehlt)) return gewaehlt
  if (bereichAusParameter(suche.bereich) === 'FUTTERMITTEL' && angebot.some((r) => r.id === 'produkte')) return 'produkte'
  return 'uebersicht'
}

/**
 * Die Adresse eines Reiters — die übrigen Parameter (Bereich, Nachbestell-
 * Link) bleiben, die Übersicht trägt keinen Reiter-Parameter.
 */
export function reiterAdresse(pfad: string, suche: string, id: HofReiterId): string {
  const params = new URLSearchParams(suche)
  params.delete(REITER_PARAMETER)
  if (id !== 'uebersicht') params.set(REITER_PARAMETER, id)
  const query = params.toString()
  return query ? `${pfad}?${query}` : pfad
}

// ─── Übersicht: Produkte ────────────────────────────────────────────────────

/** So viele Produkte zeigt die Übersicht, „Alle ansehen" führt zum Reiter Produkte (Mockup web-k2-hofseite). */
export const UEBERSICHT_PRODUKTE = 3

/**
 * Die Produkte der Übersicht: zuerst, was man gerade kaufen kann, jeweils in
 * der Reihenfolge des Hofs; reicht das nicht, füllen die übrigen auf — eine
 * Übersicht voller „Ausverkauft" wäre ein schlechtes Schaufenster.
 */
export function uebersichtProdukte<P extends { isAvailable: boolean; stock: number }>(
  produkte: readonly P[],
  isPaused: boolean,
  anzahl: number = UEBERSICHT_PRODUKTE
): P[] {
  const kaufbar = produkte.filter((p) => zeigeKaufknopf(p, isPaused))
  const rest = produkte.filter((p) => !zeigeKaufknopf(p, isPaused))
  return [...kaufbar, ...rest].slice(0, anzahl)
}

/** „10 verfügbar" — wie viele man gerade in den Korb legen kann. */
export function verfuegbarText(produkte: readonly { isAvailable: boolean; stock: number }[], isPaused: boolean): string | null {
  const n = produkte.filter((p) => zeigeKaufknopf(p, isPaused)).length
  return n > 0 ? `${formatZahl(n)} verfügbar` : null
}

// ─── Zahlung (E5) ───────────────────────────────────────────────────────────

export type Zahlungsart = { art: 'online' | 'bar'; text: string }

/**
 * Wie man bei diesem Hof bezahlt. Online nur mit fertigem Stripe-Konto —
 * dieselbe Bedingung wie der Checkout (checkout-form.tsx, /api/checkout).
 * Vor Ort heißt seit E5 nur noch „Bar bei Abholung": Das Preismodell kennt
 * keine Kartenzahlung am Hof; ONSITE_CARD bleibt im Enum, bis keine offene
 * Bestellung ihn mehr trägt, wird aber nicht mehr beworben.
 */
export function zahlungsarten(hof: { acceptsOnline: boolean; stripeAccountReady: boolean; acceptsOnsite: boolean }): Zahlungsart[] {
  return [
    ...(hof.acceptsOnline && hof.stripeAccountReady ? [{ art: 'online' as const, text: 'Online bezahlen' }] : []),
    ...(hof.acceptsOnsite ? [{ art: 'bar' as const, text: 'Bar bei Abholung' }] : []),
  ]
}

// ─── Servicegebühr (E4) ─────────────────────────────────────────────────────

/**
 * Die drei Wortlaute des Gebührenhinweises: in „Zahlung & Kontakt", über den
 * Produkten und im Mini-Warenkorb. Satz und Mindestgebühr kommen aus der
 * Hofeinstellung (servicegebuehrSatz); ohne Satz kein Hinweis. Nie in den
 * Produktpreis eingerechnet (DESIGN_SYSTEM, „Kaufstrecke").
 */
export function gebuehrHinweis(
  satz: { prozent: number; mindestCents: number } | null
): { kurz: string; produkte: string; korb: string } | null {
  if (!satz) return null
  // Ohne Mindestgebühr kein „(mind. € 0,00)" — eine Untergrenze von null ist keine.
  const mindestens = satz.mindestCents > 0 ? ` (mind. ${formatEuro(centsAlsEuro(satz.mindestCents))})` : ''
  const grund = `Preise zzgl. ${formatZahl(satz.prozent)} % Servicegebühr${mindestens}`
  return {
    kurz: `${grund} – im Warenkorb einzeln ausgewiesen. Der Hof bekommt den vollen Preis.`,
    produkte: `${grund} – einmal pro Bestellung, egal wie viel du in den Korb legst.`,
    korb: 'zzgl. Servicegebühr',
  }
}

// ─── Mini-Warenkorb und Mengen ──────────────────────────────────────────────

/**
 * Zeilen und Summe des Korbs in ganzen Cent — auf demselben Weg wie der
 * Checkout (calcLineTotal → decimalZuCents, CODING_STANDARDS §2), nie als
 * `price * quantity` in Fließkomma: 3 × 1,10 € wären dort 3,3000000000000003 €.
 * Nur Anzeige; verbindlich rechnet der Server mit den Preisen der Datenbank.
 */
export function korbBetraege(
  positionen: readonly { productId: string; price: number; quantity: number }[]
): { zeilenCents: Map<string, number>; summeCents: number } {
  const zeilenCents = new Map<string, number>()
  let summeCents = 0
  for (const p of positionen) {
    const cents = decimalZuCents(calcLineTotal(p.price, p.quantity))
    zeilenCents.set(p.productId, cents)
    summeCents += cents
  }
  return { zeilenCents, summeCents }
}

/**
 * Bis wohin „+" im Mengen-Stepper der Produktkarte geht: der Bestand, an dem
 * auch „knapp" und „ausverkauft" hängen (kartenZustand). Liegt schon mehr im
 * Korb, als noch da ist (der Hof hat nachgezählt), bleibt die Korbmenge die
 * Grenze — „−" geht, „+" nicht. Verbindlich prüft /api/reserve.
 */
export function stepperObergrenze(bestand: number, imKorb: number): number {
  return Math.max(bestand, imKorb)
}

const MENGE_NICHT_GEAENDERT = 'Wir konnten die Menge nicht ändern. Versuch es gleich noch einmal.'
const VERSTAENDLICH = new Set<string>([SHOP_PAUSED_MESSAGE, FARM_ARCHIVED_MESSAGE, FARM_NOT_APPROVED_MESSAGE])

/**
 * Was die Kundin liest, wenn /api/reserve eine neue Menge ablehnt — statt
 * Stille. „Nur noch N verfügbar" und die Sätze zu Pause/Stilllegung sind
 * verständlich und bleiben; Fachwörter („Ungültige Parameter") nicht.
 */
export function mengeAbgelehntText(fehler: string | undefined): string {
  if (fehler && /^Nur noch \d+ verfügbar$/.test(fehler)) return `${fehler} – mehr hat der Hof gerade nicht.`
  if (fehler && VERSTAENDLICH.has(fehler)) return fehler
  return MENGE_NICHT_GEAENDERT
}

// ─── Beiträge ───────────────────────────────────────────────────────────────

/**
 * Wie lange ein Beitrag her ist — „heute", „vor 3 Stunden", „vor 2 Tagen".
 * Gerechnet vom übergebenen Zeitpunkt, den page.tsx einmal auf dem Server
 * bestimmt: Mit der Uhr beim Rendern wichen Server und Browser voneinander ab
 * (Hydration-Fehler).
 */
export function vorWieLange(iso: string, jetztIso: string): string {
  const stunden = Math.floor((new Date(jetztIso).getTime() - new Date(iso).getTime()) / (1000 * 60 * 60))
  if (stunden < 1) return 'heute'
  if (stunden < 24) return stunden === 1 ? 'vor 1 Stunde' : `vor ${stunden} Stunden`
  const tage = Math.floor(stunden / 24)
  return tage === 1 ? 'vor 1 Tag' : `vor ${tage} Tagen`
}

// ─── Warenkorb-Anker ────────────────────────────────────────────────────────

/**
 * Führt ein Link genau zu DIESER Hofseite mit #warenkorb? Dann öffnet die
 * Seite den Korb, statt zu navigieren: Der Warenkorb der Shell (Kopf und
 * Mittelknopf) zeigt auf `/{hof}#warenkorb`, und ein Link auf die eigene
 * Seite mit Anker lädt nichts neu — der Anker allein öffnete nichts.
 */
export function oeffnetKorbHier(href: string, aktuell: string): boolean {
  const hier = new URL(aktuell)
  const ziel = new URL(href, hier)
  return ziel.origin === hier.origin && ziel.pathname === hier.pathname && ziel.hash === `#${WARENKORB_ANKER}`
}
