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
  const grund = `Preise zzgl. ${formatZahl(satz.prozent)} % Servicegebühr (mind. ${formatEuro(satz.mindestCents / 100)})`
  return {
    kurz: `${grund} – im Warenkorb einzeln ausgewiesen. Der Hof bekommt den vollen Preis.`,
    produkte: `${grund} – einmal pro Bestellung, egal wie viel du in den Korb legst.`,
    korb: 'zzgl. Servicegebühr',
  }
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
