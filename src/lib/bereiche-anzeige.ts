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
import type { BildAusschnitt } from '@/schemas/bild-ausschnitt'
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
import { ABHOL_VORLAUF_TAGE } from '@/lib/pickup-days'
import { SHOP_PAUSED_BUTTON_LABEL } from '@/lib/shop-pause'
// Nur zur Laufzeit einer Funktion gebraucht: hofuebersicht.ts bindet dieses Modul selbst ein, der Kreis
// ist harmlos, solange keine Konstante auf Modulebene von dort liest (naechsteAbholung, wienJetzt sind Funktionen).
import { naechsteAbholung, wienJetzt, type AbholFenster } from '@/lib/hofuebersicht'

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

/**
 * Kilo- bzw. Literpreis eines Futtermittels — nur Anzeige und Sortierung, nie
 * Abrechnung. `wert` ist ungerundet und nur zum Sortieren; gezeigt wird über
 * formatKilopreis aus `preis` und `menge` (eine Rundungsstelle, format.ts).
 */
export type Grundpreis = { wert: number; einheit: NettoEinheitValue; preis: number; menge: number }

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
  /** Im Hofpreis-Modell (N38, Nr. 197) schon der Endpreis — dann ist `inklPlattformgebuehr` gesetzt. */
  price: number
  /** N38: Der Preis enthält die Plattformgebühr — die Zeile sagt es unter dem Preis. */
  inklPlattformgebuehr?: boolean
  unit: string
  unitSize: number | null
  imageUrl: string | null
  /** Ausschnitt des Produktfotos (Register N17, Nr. 98), schon geprüft; null = wie heute. */
  bildAusschnitt: BildAusschnitt | null
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
  return wert === null ? null : { wert, einheit: kennzeichnung.nettoEinheit, preis: price, menge: kennzeichnung.nettoMenge }
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

/**
 * Das Angebot eines Hofs, so weit `istBestellbar` es liest: ob es eines gibt, nicht welches. Bewusst nicht
 * `readonly AngebotsZeile[]` — die Futter-Karte füllt dieselbe Stelle mit ihren eigenen Zeilen (`FutterAngebot`,
 * `alsAbholHof` in `futter-kaufen.ts`) und fragt dieselbe Regel.
 */
export type AngebotVorhanden = readonly unknown[]

/**
 * Kann man bei diesem Hof gerade bestellen (Register N22)? Nur mit mindestens
 * einem kaufbaren Produkt (`angebot`, istKaufbar) UND einer aktiven
 * Abholzeit. Ein Hof mit aktiven Abholzeiten kann im Vorlauf trotzdem
 * ausgebucht sein (volle Abholfenster, N19-Ergänzung); das zeigt
 * `naechsteAbholung` bzw. `kaufSperre`, nicht diese Regel. Die Pause zählt
 * bewusst NICHT hinein — sie hat ihre eigene orange Zeile. Ein nicht bestellbarer Hof bleibt an seinem
 * Platz in der Liste (hofPasst, AGB §3, O4) und trägt nur eine andere Zeile.
 * Fehlen die Abholzeiten ganz (Cache-Eintrag von vor Nr. 120), gilt er als
 * nicht bestellbar.
 */
export function istBestellbar(hof: { angebot: AngebotVorhanden; abholfenster?: readonly AbholFenster[] }): boolean {
  return hof.angebot.length > 0 && (hof.abholfenster?.length ?? 0) > 0
}

// ─── Kaufsperre (Register N24) ──────────────────────────────────────────────

/**
 * Warum man bei einem Hof gerade nicht kaufen kann — oder null. EINE Regel für
 * alle Kaufwege der Hof- und Produktseite, den Mini-Warenkorb und die Kasse
 * (Register N24); dieselben Gründe, aus denen die Hofliste „Noch nicht
 * bestellbar“ bzw. keine Abholung zeigt:
 *  - 'pause': Der Hof pausiert. Sticht alles andere — die Pause hat ihre eigene
 *    Karte mit dem Text des Hofs.
 *  - 'keine-abholzeit': keine aktive Abholzeit (die Abfragen liefern nur aktive,
 *    `isActive: true`).
 *  - 'ausgebucht': Es gibt aktive Abholzeiten, aber `naechsteAbholung` findet im
 *    Vorlauf (`ABHOL_VORLAUF_TAGE`) keinen freien Termin, den man noch bestellen
 *    kann — volle Tage aus `ausgebuchtAm` (N19, Ergänzung 21.10.2026).
 *
 * `jetzt` ist der Zeitpunkt, den die Seite einmal auf dem Server bestimmt — keine
 * eigene Uhr, also kein Unterschied beim Hydrieren. Verbindlich bleibt der
 * Server (`/api/checkout`, `imAbholfenster`); die Sperre erspart der Kundin nur
 * einen Korb, den sie nicht abholen kann.
 */
export type KaufSperre = null | 'pause' | 'keine-abholzeit' | 'ausgebucht'

export function kaufSperre(hof: { isPaused: boolean; pickupSlots: readonly AbholFenster[] }, jetzt: Date): KaufSperre {
  if (hof.isPaused) return 'pause'
  if (hof.pickupSlots.length === 0) return 'keine-abholzeit'
  return naechsteAbholung(hof.pickupSlots, wienJetzt(jetzt)) === null ? 'ausgebucht' : null
}

/** Die Beschriftung des ruhenden Kaufknopfs ohne Abholtermin — analog zu SHOP_PAUSED_BUTTON_LABEL. */
export const KAUFSPERRE_KNOPF = 'Nicht bestellbar'

/**
 * „der nächsten 2 Wochen“ — aus dem Vorlauf gerechnet, nie als Zahl im Text. Exportiert für den
 * Satz „Gerade ausgebucht“ im Kopf von Mein Hof (zustandsZeile, src/lib/mein-hof.ts, Nr. 143):
 * derselbe Vorlauf wie in der Karte der Kundin, kein Nachbau.
 */
export function vorlaufInWochen(): string {
  const wochen = Math.floor(ABHOL_VORLAUF_TAGE / 7)
  return wochen === 1 ? 'der nächsten Woche' : `der nächsten ${wochen} Wochen`
}

/**
 * Titel und Satz der Hinweiskarte bei 'keine-abholzeit' und 'ausgebucht' — EINE
 * Quelle für Hofseite, Produktseite, Mini-Warenkorb und Kasse. Die Pause hat
 * ihre eigenen Texte (shop-pause.ts).
 */
export function kaufSperreHinweis(sperre: 'keine-abholzeit' | 'ausgebucht', hofName: string): { titel: string; satz: string } {
  if (sperre === 'keine-abholzeit') {
    return { titel: 'Noch nicht bestellbar.', satz: `${hofName} hat gerade keine Abholzeit eingetragen. Schau bald wieder vorbei.` }
  }
  return { titel: 'Gerade ausgebucht.', satz: `Alle Abholzeiten ${vorlaufInWochen()} sind voll. Schau bald wieder vorbei.` }
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
 * Zeigt die Hofseite den Kaufknopf? Sichtbar, Bestand über null, keine
 * Kaufsperre (Pause, keine Abholzeit, ausgebucht — kaufSperre, N24). Bewusst
 * OHNE Reservierungen anderer: Die Hofseite kennt sie nicht (reservedStock
 * wird nirgends beschrieben, echte Halte liegen in StockReservation); ob die
 * Menge frei ist, entscheidet /api/reserve beim Hinzufügen — und der Checkout.
 * istKaufbar oben gilt für die Übersicht. Eine Stelle für Produktkarte UND
 * Produktdetail.
 */
export function zeigeKaufknopf(p: { isAvailable: boolean; stock: number }, sperre: KaufSperre): boolean {
  return p.isAvailable && p.stock > 0 && sperre === null
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
  /** Keine Abholzeit oder ausgebucht (kaufSperre, N24): nichts ist ausverkauft, nur nicht bestellbar. */
  | { art: 'nicht-bestellbar' }
  | { art: 'nicht-verfuegbar'; grund: string }

export function kartenZustand(
  p: { isAvailable: boolean; stock: number; unavailableReason: string | null },
  sperre: KaufSperre
): KartenZustand {
  if (sperre === 'pause') return { art: 'pausiert' }
  if (sperre !== null) return { art: 'nicht-bestellbar' }
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

/**
 * Was statt des Kaufknopfs steht — EINE Stelle für Produktkarte und
 * Produktseite: „Pausiert“, „Nicht bestellbar“, der Grund des Hofs, sonst
 * „Ausverkauft“.
 */
export function ruhenderKnopfText(zustand: KartenZustand): string {
  if (zustand.art === 'pausiert') return SHOP_PAUSED_BUTTON_LABEL
  if (zustand.art === 'nicht-bestellbar') return KAUFSPERRE_KNOPF
  if (zustand.art === 'nicht-verfuegbar') return zustand.grund
  return 'Ausverkauft'
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
 * Die Kategorie BRENNHOLZ heißt in der Oberfläche „Brennmaterial" (E11 Label,
 * Nr. 23). Das Wort steht nur in der Taxonomie; der Name hier bleibt für die
 * Abschnitte der Hofseite.
 */
export const BRENNMATERIAL_TITEL = KATEGORIE_LABEL.BRENNHOLZ

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
