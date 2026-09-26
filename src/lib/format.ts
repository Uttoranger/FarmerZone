import { UNIT_LABELS } from '@/schemas/product'
import {
  KATEGORIE_LABEL,
  UNTERKATEGORIE_LABEL,
  NETTO_EINHEIT_LABEL,
  istGrossgebindeEinheit,
  type NettoEinheitValue,
  type ProductCategoryValue,
  type ProductSubcategoryValue,
} from '@/lib/taxonomie'

/**
 * EINE Darstellung für Geld, Mengen und Positionen — überall.
 *
 * Vorgeschichte (Bug-Report Befund 13): Dieselbe Bestellposition las sich je
 * nach Seite anders. Im Checkout „2 kg × € 4,99", auf der Bestätigung
 * „2× Tomaten (1 kg)", im Bauern-Backend wieder anders. Drei Schreibweisen für
 * eine Sache — und „6 Paket" ohne Plural. Deshalb stehen die Regeln jetzt hier,
 * an einer Stelle, und alle Ansichten rufen sie auf.
 *
 * DIE REGELN:
 *   Geld    immer „€ 2,90" — Symbol vorn, Dezimalkomma, zwei Nachkommastellen.
 *           (Intl mit style:'currency' setzt das Symbol im de-AT hinten; die
 *           Plattform zeigt es seit jeher vorn, das bleibt so.)
 *   Menge   ohne Gebindegröße die schlichte Menge: „2 kg", „3 Stück",
 *           „6 Pakete". MIT Gebindegröße die Rechnung offen: „2 × 0,5 L" —
 *           „1 L" würde verschweigen, dass es zwei Flaschen sind.
 *   Position „Tomaten · 2 kg · € 9,98" — Name, Menge, Zeilensumme.
 *
 * Alle Zahlen laufen über Intl mit de-AT: Dezimalkomma, Tausenderpunkt.
 */

/** Einheiten, deren Plural sich im Deutschen unterscheidet. Maßeinheiten bleiben gleich. */
const EINHEIT_PLURAL: Record<string, string> = {
  PAKET: 'Pakete',
  BIGBAG: 'Big Bags',
}

const mengenFormat = new Intl.NumberFormat('de-AT', {
  minimumFractionDigits: 0,
  // Drei Stellen reichen für 0,125 kg; mehr wäre im Laden nicht ablesbar.
  maximumFractionDigits: 3,
})

const geldFormat = new Intl.NumberFormat('de-AT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const ganzeEuroFormat = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 0 })

/** Der Betrag ohne Symbol — mit zwei Nachkommastellen oder in ganzen Euro. */
function betrag(n: number, stellen: 0 | 2): string {
  return (stellen === 0 ? ganzeEuroFormat : geldFormat).format(Number.isFinite(n) ? n : 0)
}

/**
 * „€ 2,90" · „€ 1.234,50" · „€ 0,00". Mit `stellen = 0` in ganzen Euro:
 * „€ 150" — nur für Grundpreise je Tonne oder Doppelzentner (Umfeld), wo ein
 * Cent bedeutungslos ist. Abgerechnet wird nie in ganzen Euro.
 */
export function formatEuro(n: number, stellen: 0 | 2 = 2): string {
  return `€ ${betrag(n, stellen)}`
}

/** „0,5" · „2" · „1.234" — eine Zahl ohne Einheit, deutsch geschrieben. */
export function formatZahl(n: number): string {
  return mengenFormat.format(Number.isFinite(n) ? n : 0)
}

/**
 * Dezimalzahl aus getipptem Text — für Preis, Gebindegröße und MwSt im
 * Produktformular. Komma UND Punkt gelten als Dezimaltrenner (die Tastatur
 * am Handy bietet je nach Sprache nur eines von beiden), Leerzeichen werden
 * entfernt. KEIN Tausendertrenner: „1.500" ist zweideutig (1,5 oder 1500)
 * und wird abgelehnt — ebenso mehr als ein Trenner oder Buchstaben.
 *
 * Die eine Ausnahme: „0,125" hat auch drei Nachkommastellen, ist aber kein
 * Tausender — bei einer führenden 0 gibt es nichts zu tausendern. So bleibt
 * eine Gebindegröße von 125 g möglich.
 */
export function parseDezimal(text: string): number | null {
  // Auch das schmale geschützte Leerzeichen, das formatZahl als Tausender setzt.
  const bereinigt = text.replace(/[\s  ]/g, '')
  if (bereinigt === '') return null
  const trenner = bereinigt.match(/[.,]/g)?.length ?? 0
  if (trenner > 1) return null
  const normiert = bereinigt.replace(',', '.')
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(normiert)) return null
  // Zweideutiger Tausender: 1–3 Ziffern, Trenner, genau 3 Ziffern („1.500").
  const tausender = normiert.match(/^(\d{1,3})\.\d{3}$/)
  if (tausender && tausender[1] !== '0') return null
  const n = Number(normiert)
  return Number.isFinite(n) ? n : null
}

/** „1,00" · „5,99" · „0,125" — eine Zahl mit FESTER Stellenzahl, deutsch, ohne Einheit. */
export function formatDezimal(n: number, stellen: number): string {
  return new Intl.NumberFormat('de-AT', {
    minimumFractionDigits: stellen,
    maximumFractionDigits: stellen,
  }).format(Number.isFinite(n) ? n : 0)
}

/** Wie viele Nachkommastellen eine Zahl hat — „5.99" → 2, „2" → 0. */
export function nachkommastellen(n: number): number {
  if (!Number.isFinite(n)) return 0
  const text = n.toString()
  const exp = text.match(/e-(\d+)$/)
  if (exp) return Number(exp[1])
  const komma = text.indexOf('.')
  return komma === -1 ? 0 : text.length - komma - 1
}

/** Das Einheitenkürzel, bei Bedarf im Plural: „kg" · „Stück" · „Pakete". */
export function einheitLabel(unit: string, anzahl = 1): string {
  const basis = UNIT_LABELS[unit] ?? unit
  if (anzahl === 1) return basis
  return EINHEIT_PLURAL[unit] ?? basis
}

/**
 * Die Menge einer Position.
 *   ohne Gebindegröße (null oder 1): „2 kg", „6 Pakete", „3 Stück"
 *   mit Gebindegröße:                „2 × 0,5 L"
 * `unitSize` kommt je nach Quelle als Zahl oder als Prisma-Decimal.
 */
export function formatMenge(
  quantity: number,
  unit: string,
  unitSize?: number | { toString(): string } | null
): string {
  const size = unitSize == null ? null : Number(unitSize.toString())
  if (size && size !== 1) {
    return `${formatZahl(quantity)} × ${formatZahl(size)} ${einheitLabel(unit)}`
  }
  return `${formatZahl(quantity)} ${einheitLabel(unit, quantity)}`
}

/**
 * Eine Bestellposition in EINER Schreibweise, für Warenkorb, Checkout,
 * Bestätigung, E-Mail und Bauern-Backend: „Tomaten · 2 kg · € 9,98".
 * Ohne Zeilensumme (z. B. in einer Tabelle mit eigener Preisspalte) bleiben
 * Name und Menge: „Tomaten · 2 kg".
 */
export function formatPosition(p: {
  name: string
  quantity: number
  unit?: string | null
  unitSize?: number | { toString(): string } | null
  totalPrice?: number | null
}): string {
  const teile = [p.name]
  if (p.unit) teile.push(formatMenge(p.quantity, p.unit, p.unitSize))
  // Ohne bekannte Einheit bleibt die nackte Anzahl — besser als gar nichts.
  else teile.push(`${formatZahl(p.quantity)}×`)
  if (p.totalPrice != null) teile.push(formatEuro(p.totalPrice))
  return teile.join(' · ')
}

/**
 * Singular oder Plural — für Sätze wie „1 Produkt" statt „1 Produkte"
 * (Bug-Report Befund 11). Die Zahl steht mit davor.
 */
export function mitAnzahl(n: number, singular: string, plural: string): string {
  return `${formatZahl(n)} ${n === 1 ? singular : plural}`
}

/** Nur das Wort, ohne Zahl — wenn die Zahl schon woanders steht. */
export function plural(n: number, singular: string, mehrzahl: string): string {
  return n === 1 ? singular : mehrzahl
}

/**
 * PREIS-SEMANTIK, an einer Stelle festgehalten: `price` ist der Preis je
 * Gebinde, `unitSize` die Gebindegröße, der Warenkorb rechnet price × Anzahl.
 * Ein Preis von 50 mit Gebindegröße 2 kg kostet also 50 Euro für das ganze
 * 2-kg-Paket — nicht 50 Euro je Kilo. Der Schrägstrich „€ 50,00 / 2 kg" las
 * sich als „pro" und hat genau dieses Missverständnis erzeugt. Deshalb schreibt
 * die Anzeige bei einer Gebindegröße jetzt „für": „€ 50,00 für 2 kg".
 */

/** Maßeinheiten, bei denen ein Grundpreis je Einheit etwas sagt — bei Stück und Paket nicht. */
const MASS_EINHEITEN = new Set(['KG', 'G', 'LITER', 'ML', 'M3'])

export function istMassEinheit(unit: string): boolean {
  return MASS_EINHEITEN.has(unit)
}

/** Die Gebindegröße als brauchbare Zahl — sonst null (leer, 0, negativ, NaN). */
export function gebindeGroesse(unitSize?: number | { toString(): string } | null): number | null {
  if (unitSize == null) return null
  const size = Number(unitSize.toString())
  return Number.isFinite(size) && size > 0 ? size : null
}

/** „€ 3,50 / kg" ohne Gebinde, „€ 50,00 für 2 kg" bzw. „€ 3,60 für 6 Pakete" mit Gebinde. */
export function formatGrundpreis(
  price: number,
  unit: string,
  unitSize?: number | { toString(): string } | null
): string {
  const size = gebindeGroesse(unitSize)
  if (size && size !== 1) return `${formatEuro(price)} für ${formatZahl(size)} ${einheitLabel(unit, size)}`
  return `${formatEuro(price)} / ${einheitLabel(unit)}`
}

/**
 * Preis je EINZELNER Einheit (Kilo, Liter, Stück): Gebindepreis geteilt durch
 * Gebindegröße; ohne Gebinde der Preis selbst. null bei unbrauchbaren Zahlen.
 * NUR zur Anzeige, auf Cent gerundet — abgerechnet wird nie damit.
 */
export function grundpreisJeEinheit(
  price: number,
  unitSize?: number | { toString(): string } | null
): number | null {
  if (!Number.isFinite(price)) return null
  if (unitSize == null) return price
  const size = gebindeGroesse(unitSize)
  if (size == null) return null
  return Math.round((price / size) * 100) / 100
}

/**
 * Das Label des Bestandsfelds: ohne Gebinde die Einheit („Bestand (kg)",
 * „Bestand (Stück)"), mit Gebinde zählt der Bestand Pakete („Bestand (Pakete)").
 */
export function bestandLabel(unit: string, unitSize?: number | { toString(): string } | null): string {
  // Ballen und Big Bags zählen Gebinde; ihr Gewicht steht in der Kennzeichnung.
  if (istGrossgebindeEinheit(unit)) return `Bestand (${einheitLabel(unit, 2)})`
  const size = gebindeGroesse(unitSize)
  if (size && size !== 1) return 'Bestand (Pakete)'
  return `Bestand (${einheitLabel(unit)})`
}

/**
 * Was der Paketbestand in der Einheit bedeutet: 10 Pakete à 2 kg → „20 kg".
 * Nur bei Maßeinheit und Gebinde ungleich 1 — bei Stück und Paket sagt die
 * Rechnung nichts (6er-Pack Eier × 30 sind keine „180 Pakete"). Sonst null.
 */
export function formatBestand(
  stock: number,
  unit: string,
  unitSize?: number | { toString(): string } | null
): string | null {
  const size = gebindeGroesse(unitSize)
  if (!size || size === 1) return null
  if (!istMassEinheit(unit)) return null
  if (!Number.isFinite(stock) || stock < 0) return null
  return `${formatZahl(Math.round(stock * size * 1000) / 1000)} ${einheitLabel(unit)}`
}

/**
 * Die zweite Zeile unter dem Preis: „€ 25,00 / kg". Nur bei einer Maßeinheit
 * UND einer Gebindegröße ungleich 1 — sonst null, dann steht dort nichts.
 */
export function formatGrundpreisZeile(
  price: number,
  unit: string,
  unitSize?: number | { toString(): string } | null
): string | null {
  const size = gebindeGroesse(unitSize)
  if (!size || size === 1) return null
  if (!istMassEinheit(unit)) return null
  const je = grundpreisJeEinheit(price, size)
  if (je == null) return null
  return `${formatEuro(je)} / ${einheitLabel(unit)}`
}

/**
 * Kategorie und Unterkategorie in EINER Schreibweise: „Fleisch & Wurst · Rind",
 * ohne Unterkategorie nur „Fleisch & Wurst". Die Wörter kommen aus
 * src/lib/taxonomie.ts — hier wird nur zusammengesetzt, nirgends ein Hofname
 * oder Sonderfall hart verdrahtet.
 */
export function formatKategorie(
  l1: ProductCategoryValue,
  l2?: ProductSubcategoryValue | null
): string {
  const kategorie = KATEGORIE_LABEL[l1]
  if (!l2) return kategorie
  return `${kategorie} · ${UNTERKATEGORIE_LABEL[l2]}`
}

/**
 * Was ein Bestand in Ballen oder Big Bags wiegt: 10 Ballen à 300 kg → „3.000 kg".
 * Gerechnet aus stock × nettoMenge der Kennzeichnung (Sprint Bereiche 1) —
 * nie fest hinterlegt. null bei unbrauchbaren Zahlen. Nur Anzeige.
 */
export function formatNettoBestand(
  stock: number,
  nettoMenge: number | { toString(): string } | null | undefined,
  nettoEinheit: NettoEinheitValue
): string | null {
  const menge = gebindeGroesse(nettoMenge)
  if (menge == null || !Number.isFinite(stock) || stock < 0) return null
  return `${formatZahl(Math.round(stock * menge * 1000) / 1000)} ${NETTO_EINHEIT_LABEL[nettoEinheit]}`
}

/**
 * DIE Rechenstelle für den Kilo- bzw. Literpreis eines Futtermittels:
 * Gebindepreis ÷ Nettomenge, ungerundet (die Sortierung auf /hoefe braucht
 * die volle Zahl). NUR Anzeige und Sortierung, nie Abrechnung. null ohne
 * brauchbaren Preis oder Menge. Hofkarte, Produktkarte und Detail rechnen
 * alle hierüber, damit sie nicht auseinanderlaufen.
 */
export function kilopreisNetto(
  price: number,
  nettoMenge: number | { toString(): string } | null | undefined
): number | null {
  const menge = gebindeGroesse(nettoMenge)
  if (menge == null || !Number.isFinite(price) || price <= 0) return null
  return price / menge
}

/** Maßeinheiten des Produkts → Grundpreis-Basis und Umrechnung auf kg bzw. L. */
const GRUNDPREIS_BASIS: Record<string, { einheit: NettoEinheitValue; jeBasis: number }> = {
  KG: { einheit: 'KG', jeBasis: 1 },
  G: { einheit: 'KG', jeBasis: 1000 },
  LITER: { einheit: 'LITER', jeBasis: 1 },
  ML: { einheit: 'LITER', jeBasis: 1000 },
}

/**
 * Der vergleichbare Grundpreis eines Produkts: Euro je Kilo bzw. je Liter,
 * ungerundet. NUR Anzeige und Vergleich (Umfeld), nie Abrechnung.
 *
 *   - Mit Futter-Kennzeichnung: Gebindepreis ÷ Nettomenge über kilopreisNetto
 *     — dieselbe Zahl wie der Kilopreis auf /hoefe. Eine unbrauchbare
 *     Nettomenge ergibt null, kein Rückfall auf die Einheit.
 *   - Sonst aus Einheit und Gebindegröße: € 3,00 für 500 g → € 6,00 / kg,
 *     € 4,50 für 5 L → € 0,90 / L. Ohne Gebindegröße gilt der Preis je Einheit.
 *   - Stück, Paket, Raummeter, Ballen und Big Bag ohne Kennzeichnung: null —
 *     „nicht vergleichbar". Ein Stückpreis sagt über den Kilopreis nichts.
 */
export function grundpreisJeKg(
  price: number,
  unit: string,
  unitSize: number | { toString(): string } | null | undefined,
  nettoMenge: number | { toString(): string } | null | undefined,
  nettoEinheit: NettoEinheitValue | null | undefined
): { wert: number; einheit: NettoEinheitValue } | null {
  if (nettoMenge != null && nettoEinheit != null) {
    const wert = kilopreisNetto(price, nettoMenge)
    return wert === null ? null : { wert, einheit: nettoEinheit }
  }
  const basis = GRUNDPREIS_BASIS[unit]
  if (!basis || !Number.isFinite(price) || price <= 0) return null
  const groesse = unitSize == null ? 1 : gebindeGroesse(unitSize)
  if (groesse == null) return null
  return { wert: (price * basis.jeBasis) / groesse, einheit: basis.einheit }
}

/**
 * Eine Preisspanne je Einheit: „€ 120 – 180 / t" (ganze Euro) bzw.
 * „€ 0,12 – 0,18 / kg". Liegen beide Enden auf derselben gezeigten Zahl, steht
 * nur eine da — „€ 150 – 150" wäre keine Spanne.
 */
export function formatPreisSpanne(von: number, bis: number, einheit: string, stellen: 0 | 2): string {
  const links = betrag(von, stellen)
  const rechts = betrag(bis, stellen)
  return links === rechts ? `€ ${links} / ${einheit}` : `€ ${links} – ${rechts} / ${einheit}`
}

/**
 * Kilo- bzw. Literpreis aus Gebindepreis und Nettomenge:
 * € 45,00 für 300 kg → „€ 0,15 / kg". Auf Cent gerundet (Konzept-Glossar
 * „Grundpreis"); null ohne brauchbaren Preis oder Menge.
 */
export function formatGrundpreisNetto(
  price: number,
  nettoMenge: number | { toString(): string } | null | undefined,
  nettoEinheit: NettoEinheitValue
): string | null {
  const wert = kilopreisNetto(price, nettoMenge)
  if (wert == null) return null
  return `${formatEuro(Math.round(wert * 100) / 100)} / ${NETTO_EINHEIT_LABEL[nettoEinheit]}`
}

/**
 * „ab € 0,12 / kg" — der günstigste Kilopreis eines Hofs auf /hoefe, wenn
 * nach Kilopreis sortiert wird (Bereiche 2). Ohne ihn wirkte die Reihenfolge
 * zufällig. Nur Anzeige, auf Cent gerundet.
 */
export function formatAbGrundpreis(grundpreis: { wert: number; einheit: NettoEinheitValue }): string {
  // wert kommt aus kilopreisNetto — dieselbe Rundung wie formatGrundpreisNetto.
  return `ab ${formatEuro(Math.round(grundpreis.wert * 100) / 100)} / ${NETTO_EINHEIT_LABEL[grundpreis.einheit]}`
}
