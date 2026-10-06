/**
 * Hofladen und Futtermittel in der Kundenansicht (Sprint Bereiche 2,
 * docs/konzepte/bereiche.md §6.0–6.3) — rein, ohne Datenbank und ohne Browser
 * prüfbar (tests/bereiche-anzeige.test.ts).
 *
 * Hier wird entschieden:
 *   - was „kaufbar" heißt (EINE Regel für Chips, Suche, Facetten, Karte und
 *     Grundpreis-Sortierung),
 *   - welche Höfe ein Bereich und seine Facetten auf /hoefe zeigen,
 *   - welche Chips es gibt und was sie zählen,
 *   - wie die Hofseite ihre Produkte in Bereiche und Sektionen teilt.
 *
 * Der Bereich eines Produkts kommt immer aus anzeigeBereichVon (taxonomie.ts),
 * nie aus einem Vergleich mit einer Kategorie.
 */
import {
  ANZEIGE_BEREICHE,
  ANZEIGE_BEREICH_VALUES,
  FUTTERMITTELART_LABEL,
  KATEGORIE_LABEL,
  NETTO_EINHEIT_LABEL,
  TIERART_LABEL,
  PRODUCT_CATEGORY_VALUES,
  PRODUCT_LABEL_VALUES,
  TIERART_VALUES,
  UNTERKATEGORIE_LABEL,
  anzeigeBereichVon,
  gehoertZu,
  istGrossgebinde,
  unterkategorienVon,
  type AnzeigeBereich,
  type FuttermittelartValue,
  type NettoEinheitValue,
  type ProductCategoryValue,
  type ProductLabelValue,
  type ProductSubcategoryValue,
  type TierartValue,
} from '@/lib/taxonomie'
import type { GebindeWahl, HoefeFilter } from '@/schemas/hoefe-filter'
import { formatMenge, formatZahl, kilopreisNetto } from '@/lib/format'
import { produktZustand } from '@/lib/produkt-sichtbarkeit'

// ─── Kaufbar ────────────────────────────────────────────────────────────────

/**
 * Kaufbar heißt: im Shop sichtbar UND freier Bestand über null (Bestand
 * abzüglich Reservierung). Vor Bereiche 2 zählten die Kategorie-Chips jedes
 * sichtbare Produkt, die Suche nur solche mit freiem Bestand — ein Hof mit
 * ausverkauftem Heu stand unter „Heu & Stroh", fand sich aber nicht über die
 * Suche. Jetzt fragen alle hier.
 */
export function istKaufbar(p: { isAvailable: boolean; stock: number; reservedStock: number }): boolean {
  return p.isAvailable && p.stock - p.reservedStock > 0
}

// ─── Das Angebot eines Hofs ─────────────────────────────────────────────────

/** Kilo- bzw. Literpreis eines Futtermittels — nur Anzeige und Sortierung, nie Abrechnung. */
export type Grundpreis = { wert: number; einheit: NettoEinheitValue }

/** Ein KAUFBARES Produkt, so schmal, wie Chips, Facetten und Suche es brauchen. */
export type AngebotsZeile = {
  name: string
  category: ProductCategoryValue | null
  subcategory: ProductSubcategoryValue | null
  labels: ProductLabelValue[]
  /** Aus der Futter-Kennzeichnung; leer ohne Kennzeichnung. */
  tiere: TierartValue[]
  /** null ohne Kennzeichnung oder ohne brauchbare Nettomenge. */
  grundpreis: Grundpreis | null
  /** Über KLEINGEBINDE_BIS_KG; null ohne Kennzeichnung (dann weder klein noch groß). */
  grossgebinde: boolean | null
}

/**
 * Eine Angebotszeile mit dem, was die Produktsuche auf /hoefe zeigt (Nr. 09:
 * „Produkte statt Höfe"): Kennung, Preis je Gebinde, Einheit, Gebinde und
 * Bild. Dieselbe schmale Abfrage wie die Zeile selbst — alle kaufbaren
 * Produkte, ungedeckelt; die Vorschau-Zeilen der Karte (höchstens acht je
 * Hof) wären für die Suche ein falsches Negativ ab Platz neun.
 */
export type AngebotsProdukt = AngebotsZeile & {
  id: string
  price: number
  unit: string
  unitSize: number | null
  imageUrl: string | null
}

/**
 * Preis ÷ Nettomenge. Die Nettomenge ist der Inhalt EINES Gebindes (Konzept
 * §5), der Preis gilt je Gebinde — also ist das der Kilopreis.
 */
export function grundpreisAusKennzeichnung(
  price: number,
  kennzeichnung: { nettoMenge: number; nettoEinheit: NettoEinheitValue } | null
): Grundpreis | null {
  if (!kennzeichnung) return null
  const wert = kilopreisNetto(price, kennzeichnung.nettoMenge)
  return wert === null ? null : { wert, einheit: kennzeichnung.nettoEinheit }
}

/** Die Rohzeile der Query → Angebotszeile; null, wenn das Produkt nicht kaufbar ist. */
export function baueAngebotsZeile(p: {
  name: string
  isAvailable: boolean
  stock: number
  reservedStock: number
  price: number
  category: ProductCategoryValue | null
  subcategory: ProductSubcategoryValue | null
  labels: ProductLabelValue[]
  futter: { zielTierarten: TierartValue[]; nettoMenge: number; nettoEinheit: NettoEinheitValue } | null
}): AngebotsZeile | null {
  if (!istKaufbar(p)) return null
  return {
    name: p.name,
    category: p.category,
    subcategory: p.subcategory,
    labels: p.labels,
    tiere: p.futter?.zielTierarten ?? [],
    grundpreis: grundpreisAusKennzeichnung(p.price, p.futter),
    grossgebinde: p.futter ? istGrossgebinde(p.futter.nettoMenge, p.futter.nettoEinheit) : null,
  }
}

/**
 * Kategorien (Taxonomie-Reihenfolge) und Suchnamen aus DEMSELBEN Angebot —
 * deshalb zählen Chips und Suche jetzt dasselbe.
 */
export function fasseAngebotZusammen(
  angebot: readonly AngebotsZeile[],
  bereich: AnzeigeBereich | null = null
): { kategorien: ProductCategoryValue[]; suchNamen: string[] } {
  const zeilen = bereich ? angebot.filter((z) => anzeigeBereichVon(z.category) === bereich) : angebot
  const vorhanden = new Set(zeilen.flatMap((z) => (z.category ? [z.category] : [])))
  return {
    kategorien: PRODUCT_CATEGORY_VALUES.filter((k) => vorhanden.has(k)),
    suchNamen: zeilen.map((z) => z.name),
  }
}

// ─── /hoefe: Bereich und Facetten ───────────────────────────────────────────

/** Die Teile des Filters, die je PRODUKT gelten. */
export type ProduktFilter = Pick<HoefeFilter, 'bereich' | 'kategorien' | 'sorten' | 'siegel' | 'tiere' | 'gebinde'>

type HofMitAngebot = { angebot: readonly AngebotsZeile[] }

function gebindePasst(z: AngebotsZeile, gebinde: GebindeWahl | null): boolean {
  if (gebinde === null) return true
  if (z.grossgebinde === null) return false
  return gebinde === 'GROSS' ? z.grossgebinde : !z.grossgebinde
}

/**
 * Passt EIN Produkt zu ALLEN gewählten Bedingungen zugleich? So trifft
 * „Bio + Heu & Stroh" nicht den Hof mit Bio-Eiern und normalem Heu.
 * Innerhalb einer Facette ist Mehrfachwahl ein ODER (Heu ODER Getreide,
 * Pferde ODER Rinder), nur Siegel sind ein UND (Bio UND AMA).
 */
export function zeilePasst(z: AngebotsZeile, f: ProduktFilter): boolean {
  if (anzeigeBereichVon(z.category) !== f.bereich) return false
  if (f.kategorien.length > 0 && (z.category === null || !f.kategorien.includes(z.category))) return false
  const sorten = wirksameSorten(f)
  if (sorten.length > 0 && (z.subcategory === null || !sorten.includes(z.subcategory))) return false
  if (!f.siegel.every((s) => z.labels.includes(s))) return false
  if (f.bereich === 'FUTTERMITTEL') {
    if (f.tiere.length > 0 && !f.tiere.some((t) => z.tiere.includes(t))) return false
    if (!gebindePasst(z, f.gebinde)) return false
  }
  return true
}

/** Sorten zählen nur, solange ihre Kategorie gewählt ist. */
function wirksameSorten(f: ProduktFilter): ProductSubcategoryValue[] {
  return f.sorten.filter((s) => f.kategorien.some((k) => gehoertZu(k, s)))
}

/** Ist irgendein Filter gesetzt, der je Produkt gilt? (Leermeldung, Hofladen-Basis) */
export function hatProduktfilter(f: ProduktFilter): boolean {
  return (
    f.kategorien.length > 0 ||
    f.siegel.length > 0 ||
    (f.bereich === 'FUTTERMITTEL' && (f.tiere.length > 0 || f.gebinde !== null))
  )
}

/**
 * Zeigt der Bereich diesen Hof? Im Bereich Futtermittel NUR mit mindestens
 * einem kaufbaren, passenden Futtermittel — „wer verkauft Futter in meiner
 * Nähe". Im Hofladen ohne Filter zusätzlich die Höfe, die gerade GAR NICHTS
 * kaufbar haben: Sie standen schon vor Bereiche 2 in der Liste (mit „macht
 * Pause" oder leerem Schaufenster) und sollen nicht verschwinden, nur weil
 * alles verkauft ist. Ein reiner Futterhof steht dagegen nie im Hofladen.
 */
export function hofPasst(hof: HofMitAngebot, f: ProduktFilter): boolean {
  if (hof.angebot.some((z) => zeilePasst(z, f))) return true
  return f.bereich === 'LEBENSMITTEL' && !hatProduktfilter(f) && hof.angebot.length === 0
}

export function filtereNachAngebot<H extends HofMitAngebot>(hoefe: H[], f: ProduktFilter): H[] {
  return hoefe.filter((h) => hofPasst(h, f))
}

export type Chip<T extends string> = { wert: T; label: string; anzahl: number }

function zaehleHoefe<T extends string>(
  hoefe: readonly HofMitAngebot[],
  werte: readonly T[],
  basis: ProduktFilter,
  traegt: (z: AngebotsZeile, wert: T) => boolean
): Map<T, number> {
  const anzahl = new Map<T, number>()
  for (const hof of hoefe) {
    for (const wert of werte) {
      if (hof.angebot.some((z) => zeilePasst(z, basis) && traegt(z, wert))) {
        anzahl.set(wert, (anzahl.get(wert) ?? 0) + 1)
      }
    }
  }
  return anzahl
}

/** Chips ohne Treffer fehlen — außer sie sind gewählt; dann muss man sie abwählen können. */
function chipsAus<T extends string>(
  werte: readonly T[],
  anzahl: Map<T, number>,
  gewaehlt: readonly T[],
  label: (w: T) => string
): Chip<T>[] {
  return werte
    .filter((w) => (anzahl.get(w) ?? 0) > 0 || gewaehlt.includes(w))
    .map((w) => ({ wert: w, label: label(w), anzahl: anzahl.get(w) ?? 0 }))
}

/**
 * Die Kategorie-Chips (L1) des Bereichs in Taxonomie-Reihenfolge — Brennholz
 * und Sonstiges als letzte im Hofladen. Gezählt wird ohne die eigene
 * Kategorie- und Sortenwahl (sonst verschwänden die übrigen Chips, sobald
 * einer gewählt ist), aber mit Siegeln und Futter-Facetten.
 */
export function kategorieChips(hoefe: readonly HofMitAngebot[], f: ProduktFilter): Chip<ProductCategoryValue>[] {
  const werte = ANZEIGE_BEREICHE[f.bereich].kategorien as readonly ProductCategoryValue[]
  const basis = { ...f, kategorien: [], sorten: [] }
  return chipsAus(werte, zaehleHoefe(hoefe, werte, basis, (z, k) => z.category === k), f.kategorien, (k) => KATEGORIE_LABEL[k])
}

/**
 * Die Sorten-Reihe (L2) mit Zählern (Höfe): erst, wenn eine Kategorie gewählt
 * ist, und nur, wenn die Ergebnismenge mindestens ZWEI Sorten hat — eine
 * einzige wiederholte nur, was ohnehin da ist. Gezählt wird ohne die eigene
 * Sortenwahl, sonst verschwände die Reihe mit dem ersten Tipp.
 */
export function sortenChips(hoefe: readonly HofMitAngebot[], f: ProduktFilter): Chip<ProductSubcategoryValue>[] {
  if (f.kategorien.length === 0) return []
  const werte = f.kategorien.flatMap((k) => unterkategorienVon(k))
  const anzahl = zaehleHoefe(hoefe, werte, { ...f, sorten: [] }, (z, s) => z.subcategory === s)
  const mitTreffer = werte.filter((s) => (anzahl.get(s) ?? 0) > 0)
  if (mitTreffer.length < 2) return []
  return chipsAus(werte, anzahl, wirksameSorten(f), (s) => UNTERKATEGORIE_LABEL[s])
}

/** Siegel-Chips: Bio, Gentechnikfrei, AMA — nur, was es im Ausschnitt gibt. */
export function siegelChips(
  hoefe: readonly HofMitAngebot[],
  f: ProduktFilter,
  label: (s: ProductLabelValue) => string
): Chip<ProductLabelValue>[] {
  const anzahl = zaehleHoefe(hoefe, PRODUCT_LABEL_VALUES, { ...f, siegel: [] }, (z, s) => z.labels.includes(s))
  return chipsAus(PRODUCT_LABEL_VALUES, anzahl, f.siegel, label)
}

/** Tier-Optionen für das Sheet „Für Tiere" — nur im Bereich Futtermittel. */
export function tierChips(
  hoefe: readonly HofMitAngebot[],
  f: ProduktFilter,
  label: (t: TierartValue) => string
): Chip<TierartValue>[] {
  if (f.bereich !== 'FUTTERMITTEL') return []
  const anzahl = zaehleHoefe(hoefe, TIERART_VALUES, { ...f, tiere: [] }, (z, t) => z.tiere.includes(t))
  return chipsAus(TIERART_VALUES, anzahl, f.tiere, label)
}

/** Gebinde Klein | Groß — nur im Bereich Futtermittel und nur, was es gibt. */
export function gebindeChips(hoefe: readonly HofMitAngebot[], f: ProduktFilter): Chip<GebindeWahl>[] {
  if (f.bereich !== 'FUTTERMITTEL') return []
  const werte = ['KLEIN', 'GROSS'] as const
  const anzahl = zaehleHoefe(hoefe, werte, { ...f, gebinde: null }, (z, g) => gebindePasst(z, g))
  return chipsAus(werte, anzahl, f.gebinde ? [f.gebinde] : [], (g) => (g === 'KLEIN' ? 'Klein' : 'Groß'))
}

// ─── Sortierung nach Grundpreis ─────────────────────────────────────────────

/** Der günstigste Kilopreis unter den PASSENDEN Produkten eines Hofs; null ohne. */
export function abGrundpreis(hof: HofMitAngebot, f: ProduktFilter): Grundpreis | null {
  let bester: Grundpreis | null = null
  for (const z of hof.angebot) {
    if (!z.grundpreis || !zeilePasst(z, f)) continue
    if (bester === null || z.grundpreis.wert < bester.wert) bester = z.grundpreis
  }
  return bester
}

/**
 * Höfe nach ihrem günstigsten passenden Kilopreis; ohne berechenbaren Preis
 * ans Ende, dort in der bisherigen Reihenfolge. Liter zählen wie Kilo
 * (dieselbe 1:1-Annahme wie beim Großgebinde).
 */
export function sortiereNachGrundpreis<H extends HofMitAngebot>(hoefe: H[], f: ProduktFilter): H[] {
  return hoefe
    .map((hof, index) => ({ hof, index, preis: abGrundpreis(hof, f)?.wert ?? null }))
    .sort((a, b) => {
      if (a.preis === null) return b.preis === null ? a.index - b.index : 1
      if (b.preis === null) return -1
      return a.preis - b.preis || a.index - b.index
    })
    .map(({ hof }) => hof)
}

// ─── Hofseite: Kaufknopf ────────────────────────────────────────────────────

/**
 * Zeigt die Hofseite den Kaufknopf? Sichtbar, Bestand über null, Shop nicht
 * pausiert. Bewusst OHNE Reservierungen anderer: Die Hofseite kennt sie
 * nicht (reservedStock wird nirgends beschrieben, echte Halte liegen in
 * StockReservation); ob die Menge frei ist, entscheidet /api/reserve beim
 * Hinzufügen — und der Checkout. istKaufbar oben gilt für die Übersicht.
 * Eine Stelle für Produktkarte UND Produktdetail.
 */
export function zeigeKaufknopf(p: { isAvailable: boolean; stock: number }, isPaused: boolean): boolean {
  return p.isAvailable && p.stock > 0 && !isPaused
}

/**
 * Der Zustand einer Produktkarte auf der Hofseite (Nr. 10, Mockup
 * web-k2-alle-produkte-nach-kategorie): knapp und ausverkauft aus dem echten
 * Bestand, über dieselbe Ableitung wie die Sicht des Hofs (produktZustand,
 * Schwelle LOW_STOCK_THRESHOLD). Wie zeigeKaufknopf OHNE Reservierungen
 * anderer — ob die Menge frei ist, entscheidet /api/reserve. Der Kaufknopf
 * steht genau bei `kaufbar` und `knapp` (Test gegen zeigeKaufknopf).
 *
 * „Merken" gibt es nicht: Eine Benachrichtigung, wenn die Ware wieder da ist,
 * bräuchte Kundenkonto oder Double-Opt-in (E8, S11) — ausverkauft heißt
 * deshalb nur „Ausverkauft". Ein Datum „ab Sa wieder da" kennt das Schema nicht.
 */
export type KartenZustand =
  | { art: 'kaufbar' }
  | { art: 'knapp'; bestand: number }
  | { art: 'ausverkauft' }
  | { art: 'pausiert' }
  | { art: 'nicht-verfuegbar'; grund: string }

export function kartenZustand(
  p: { isAvailable: boolean; stock: number; unavailableReason: string | null },
  isPaused: boolean
): KartenZustand {
  if (isPaused) return { art: 'pausiert' }
  const zustand = produktZustand(p)
  switch (zustand.art) {
    case 'nicht-im-shop':
      return { art: 'nicht-verfuegbar', grund: p.unavailableReason?.trim() || 'Nicht verfügbar' }
    case 'ausverkauft':
      return { art: 'ausverkauft' }
    case 'knapp':
      return { art: 'knapp', bestand: zustand.bestand }
    case 'im-shop':
      return { art: 'kaufbar' }
  }
}

/** „Nur noch 3 kg" · „Nur noch 3 Stück" · „Nur noch 3 × 2 kg" — der Bestand zählt Gebinde, wo es eines gibt. */
export function knappText(bestand: number, unit: string, unitSize: number | null): string {
  return `Nur noch ${formatMenge(bestand, unit, unitSize)}`
}

// ─── Links ──────────────────────────────────────────────────────────────────

/** Der Weg zur Hofseite; im Futter-Bereich landet der Kunde direkt beim Futter. */
export function hofseitenLink(slug: string, bereich: AnzeigeBereich): string {
  return bereich === 'FUTTERMITTEL' ? `/${slug}?bereich=futter` : `/${slug}`
}

/** Der Weg zur Hofübersicht; aus dem Futter-Bereich zurück in die Futter-Übersicht. */
export function hoefeLink(bereich: AnzeigeBereich): string {
  return bereich === 'FUTTERMITTEL' ? '/hoefe?bereich=futter' : '/hoefe'
}

// ─── Hofseite: Bereiche und Sektionen ───────────────────────────────────────

/** Ab so vielen Produkten im Bereich bekommt die Hofseite Sprungmarken. */
export const SPRUNGMARKEN_AB = 12

export type HofseitenSektion<P> = {
  /** Die Kategorie der Sektion; Produkte ohne Kategorie landen bei SONSTIGES. */
  kategorie: ProductCategoryValue
  titel: string
  /** Für Sprungmarken — stabil und ohne Sonderzeichen. */
  anker: string
  produkte: P[]
}

export type HofseitenAufteilung<P> = {
  /** Die Bereiche, in denen der Hof etwas anbietet, Hofladen zuerst. */
  bereiche: AnzeigeBereich[]
  /** Der gezeigte Bereich; null, wenn der Hof gar keine Produkte hat. */
  aktiv: AnzeigeBereich | null
  /** Nur bei zwei Bereichen. */
  umschalter: boolean
  sektionen: HofseitenSektion<P>[]
  sprungmarken: boolean
}

/**
 * Teilt die Produkte der Hofseite. Erwartet sie in der Reihenfolge des Hofs
 * (PRODUCT_ORDER_BY) und behält sie:
 *   - Bereich: der gewünschte, wenn der Hof ihn anbietet — sonst der erste
 *     vorhandene (Hofladen vor Futtermittel).
 *   - Produkte des anderen Bereichs kommen NICHT in die Sektionen, sie werden
 *     also gar nicht gerendert.
 *   - Sektionen je Kategorie. Ihre Reihenfolge folgt dem jeweils ERSTEN
 *     Produkt der Kategorie in der Sortierung des Hofs, nicht der Taxonomie:
 *     Wer sein Lamm nach oben zieht, bekommt Fleisch zuerst — so behält das
 *     Ziehen im Bearbeitungsmodus seine Bedeutung. Innerhalb der Sektion
 *     bleibt die Reihenfolge des Hofs.
 */
export function teileHofseite<P extends { category: ProductCategoryValue | null }>(
  produkte: readonly P[],
  wunsch: AnzeigeBereich | null
): HofseitenAufteilung<P> {
  const vorhanden = new Set(produkte.map((p) => anzeigeBereichVon(p.category)))
  const bereiche = ANZEIGE_BEREICH_VALUES.filter((b) => vorhanden.has(b))
  const aktiv = wunsch && bereiche.includes(wunsch) ? wunsch : (bereiche[0] ?? null)

  const sektionen = new Map<ProductCategoryValue, HofseitenSektion<P>>()
  let imBereich = 0
  for (const p of produkte) {
    if (anzeigeBereichVon(p.category) !== aktiv) continue
    imBereich += 1
    const kategorie = p.category ?? 'SONSTIGES'
    const sektion = sektionen.get(kategorie) ?? {
      kategorie,
      titel: KATEGORIE_LABEL[kategorie],
      anker: `kategorie-${kategorie.toLowerCase()}`,
      produkte: [],
    }
    sektion.produkte.push(p)
    sektionen.set(kategorie, sektion)
  }

  return {
    bereiche,
    aktiv,
    umschalter: bereiche.length === 2,
    sektionen: [...sektionen.values()],
    sprungmarken: imBereich >= SPRUNGMARKEN_AB,
  }
}

/**
 * Der Bereich, den die Hofseite gerade ZEIGT — dieselbe Regel wie
 * teileHofseite: der gewünschte, wenn der Hof ihn anbietet, sonst der erste
 * vorhandene. Ein reiner Futterhof zeigt also Futter auch ohne ?bereich (und
 * geteilte Links tragen keinen). Ohne Produkte der Hofladen. Der Rückweg der
 * Kopfzeile fragt hier, nicht den URL-Parameter (src/lib/kunden-kopf.ts).
 */
export function angezeigterBereich(
  produkte: readonly { category: ProductCategoryValue | null }[],
  wunsch: AnzeigeBereich | null
): AnzeigeBereich {
  return teileHofseite(produkte, wunsch).aktiv ?? 'LEBENSMITTEL'
}

// ─── Hofseite: Kategorie-Abschnitte (E1) ────────────────────────────────────

/**
 * Brennholz heißt in der Oberfläche „Brennmaterial" (E11, Startseite und
 * /hoefe). Die Kategorie selbst und ihr Taxonomie-Label ändert erst Gate 6 —
 * bis dahin steht das Wort hier, an EINER Stelle.
 */
export const BRENNMATERIAL_TITEL = 'Brennmaterial'

/** Der Abschnitt Futtermittel — Ziel von ?bereich=futter (Links von /hoefe und aus dem Umfeld). */
export const FUTTER_ABSCHNITT_ANKER = 'kategorie-futtermittel'
export const BRENNMATERIAL_ABSCHNITT_ANKER = 'kategorie-brennmaterial'

export type KategorieAbschnitt<P> = {
  art: 'hofladen' | 'futter' | 'brennmaterial'
  titel: string
  /** Sprungziel und Chip-Adresse — stabil, ohne Sonderzeichen. */
  anker: string
  produkte: P[]
}

/**
 * Die Abschnitte der Hofseite (E1, freigegeben: „Ordne die Hofseiten wieder
 * nach Kategorie an"). Statt des Umschalters Hofladen | Futtermittel steht
 * alles auf EINER Seite, der Bereich bleibt Datenmodell (anzeigeBereichVon):
 *   1. Hofladen je Kategorie, in der Reihenfolge des jeweils ersten Produkts
 *      in der Sortierung des Hofs (wie teileHofseite: Wer sein Lamm nach oben
 *      zieht, bekommt Fleisch zuerst). Sonstiges — auch ohne Kategorie —
 *      schließt den Hofladen ab.
 *   2. Futtermittel: EIN Abschnitt für alle Futter-Kategorien (Mockup), mit
 *      festem Anker.
 *   3. Brennmaterial ganz am Ende — dieselbe Ordnung wie die Kategorie-Reihe
 *      auf /hoefe (E2).
 * Innerhalb eines Abschnitts bleibt die Reihenfolge des Hofs.
 */
export function kategorieAbschnitte<P extends { category: ProductCategoryValue | null }>(
  produkte: readonly P[]
): KategorieAbschnitt<P>[] {
  const hofladen = new Map<ProductCategoryValue, KategorieAbschnitt<P>>()
  const futter: P[] = []
  const brennmaterial: P[] = []
  for (const p of produkte) {
    if (anzeigeBereichVon(p.category) === 'FUTTERMITTEL') {
      futter.push(p)
      continue
    }
    if (p.category === 'BRENNHOLZ') {
      brennmaterial.push(p)
      continue
    }
    const kategorie = p.category ?? 'SONSTIGES'
    const abschnitt = hofladen.get(kategorie) ?? {
      art: 'hofladen' as const,
      titel: KATEGORIE_LABEL[kategorie],
      anker: `kategorie-${kategorie.toLowerCase()}`,
      produkte: [],
    }
    abschnitt.produkte.push(p)
    hofladen.set(kategorie, abschnitt)
  }
  const sonstiges = hofladen.get('SONSTIGES')
  hofladen.delete('SONSTIGES')
  return [
    ...hofladen.values(),
    ...(sonstiges ? [sonstiges] : []),
    ...(futter.length > 0
      ? [{ art: 'futter' as const, titel: ANZEIGE_BEREICHE.FUTTERMITTEL.titel, anker: FUTTER_ABSCHNITT_ANKER, produkte: futter }]
      : []),
    ...(brennmaterial.length > 0
      ? [{ art: 'brennmaterial' as const, titel: BRENNMATERIAL_TITEL, anker: BRENNMATERIAL_ABSCHNITT_ANKER, produkte: brennmaterial }]
      : []),
  ]
}

// ─── Produktdetail: Futter-Kennzeichnung ────────────────────────────────────

export type KennzeichnungsEingabe = {
  futtermittelart: FuttermittelartValue
  zielTierarten: TierartValue[]
  zusammensetzung: string
  analytischeBestandteile: string
  zusatzstoffe: string | null
  gebrauchshinweis: string | null
  nettoMenge: number
  nettoEinheit: NettoEinheitValue
  rohprotein: number | null
  rohfaser: number | null
  rohfett: number | null
  rohasche: number | null
  betriebsnummer: string | null
}

export type KennzeichnungsZeile = { titel: string; wert: string }

/**
 * Die Zeilen des Akkordeons „Kennzeichnung" im Produktdetail — ALLE
 * Pflichtangaben, die das Datenmodell kennt, in der Reihenfolge des
 * Sackanhängers, dazu der Hof als Verantwortlicher. Fernabsatz verlangt, dass
 * Kundinnen das VOR dem Kauf sehen (Konzept 6.3).
 *
 * Pflichtzeilen stehen immer da, auch leer („Nicht angegeben") — eine
 * fehlende Zeile sähe aus wie eine vergessene. Zusatzstoffe, Gebrauchshinweis
 * und Rohwerte sind freiwillig und fehlen ohne Inhalt.
 *
 * Nicht im Modell und deshalb nicht hier: Chargennummer und
 * Mindesthaltbarkeit — sie wechseln je Lieferung und stehen auf dem
 * Sackanhänger bei der Abholung (Klärung mit der Landwirtschaftskammer offen).
 */
export function kennzeichnungsZeilen(
  k: KennzeichnungsEingabe,
  hof: { name: string; address: string; postalCode: string; city: string }
): KennzeichnungsZeile[] {
  const zeilen: KennzeichnungsZeile[] = [
    { titel: 'Art', wert: FUTTERMITTELART_LABEL[k.futtermittelart] },
    {
      titel: 'Für',
      wert: k.zielTierarten.length > 0 ? k.zielTierarten.map((t) => TIERART_LABEL[t]).join(', ') : 'Nicht angegeben',
    },
    { titel: 'Zusammensetzung', wert: k.zusammensetzung.trim() || 'Nicht angegeben' },
    { titel: 'Analytische Bestandteile', wert: k.analytischeBestandteile.trim() || 'Nicht angegeben' },
  ]
  const rohwerte = (
    [
      ['Rohprotein', k.rohprotein],
      ['Rohfaser', k.rohfaser],
      ['Rohfett', k.rohfett],
      ['Rohasche', k.rohasche],
    ] as const
  )
    .filter(([, wert]) => wert !== null)
    .map(([name, wert]) => `${name} ${formatZahl(wert as number)} %`)
  if (rohwerte.length > 0) zeilen.push({ titel: 'Gehalte', wert: rohwerte.join(' · ') })
  if (k.zusatzstoffe?.trim()) zeilen.push({ titel: 'Zusatzstoffe', wert: k.zusatzstoffe.trim() })
  zeilen.push({
    titel: 'Nettomenge',
    wert: `${formatZahl(k.nettoMenge)} ${NETTO_EINHEIT_LABEL[k.nettoEinheit]} je Gebinde`,
  })
  if (k.gebrauchshinweis?.trim()) zeilen.push({ titel: 'Gebrauchshinweis', wert: k.gebrauchshinweis.trim() })
  // E9: Die Plattform prüft die Nummer nicht — der Hof bestätigt sie selbst.
  const nummer = k.betriebsnummer?.trim()
  zeilen.push(
    { titel: 'Betriebsnummer', wert: nummer ? `${nummer} (laut Angabe des Hofs)` : 'Nicht angegeben' },
    { titel: 'Verantwortlich', wert: `${hof.name}, ${hof.address}, ${hof.postalCode} ${hof.city}` }
  )
  return zeilen
}
