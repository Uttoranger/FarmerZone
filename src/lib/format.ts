import { UNIT_LABELS } from '@/schemas/product'

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

/** „€ 2,90" · „€ 1.234,50" · „€ 0,00" */
export function formatEuro(n: number): string {
  return `€ ${geldFormat.format(Number.isFinite(n) ? n : 0)}`
}

/** „0,5" · „2" · „1.234" — eine Zahl ohne Einheit, deutsch geschrieben. */
export function formatZahl(n: number): string {
  return mengenFormat.format(Number.isFinite(n) ? n : 0)
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

/** „€ 3,50 / kg" bzw. „€ 4,20 / 0,5 kg" — der Grundpreis auf der Produktkarte. */
export function formatGrundpreis(
  price: number,
  unit: string,
  unitSize?: number | { toString(): string } | null
): string {
  const size = unitSize == null ? null : Number(unitSize.toString())
  const label = einheitLabel(unit)
  if (size && size !== 1) return `${formatEuro(price)} / ${formatZahl(size)} ${label}`
  return `${formatEuro(price)} / ${label}`
}
