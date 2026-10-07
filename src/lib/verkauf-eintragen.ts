/**
 * Regeln des Dialogs „Verkauf eintragen" — rein, ohne Browser prüfbar
 * (tests/verkauf-eintragen.test.ts). Der Dialog fragt zuerst den Betrag,
 * dann den Weg; was verkauft wurde, ist freiwillig.
 */
import { einheitLabel, formatEuro, formatMenge, formatZahl } from '@/lib/format'
import { OHNE_PRODUKT } from '@/lib/umsatz'
import type { Verkaufskanal } from '@/schemas/verkaufskanal'

/** Die vier großen Knöpfe unter „Wo verkauft?" — „Anderes" steht klein darunter. */
export const HAUPTKANAELE: { value: Exclude<Verkaufskanal, 'OTHER'>; label: string }[] = [
  { value: 'HOFLADEN', label: 'Hofladen' },
  { value: 'MARKT', label: 'Markt' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'BUSINESS', label: 'Betrieb' },
]

/**
 * Die meistverkauften Produkte nach Anzahl der Verkäufe, bei Gleichstand nach
 * Betrag — so steht, was täglich über den Tisch geht, vor dem einen teuren
 * Stück.
 */
export function meistverkaufteProdukte(verkaeufe: { productId: string; cent: number }[], anzahl = 3): string[] {
  const zaehlung = new Map<string, { anzahl: number; cent: number }>()
  for (const v of verkaeufe) {
    const bisher = zaehlung.get(v.productId) ?? { anzahl: 0, cent: 0 }
    zaehlung.set(v.productId, { anzahl: bisher.anzahl + 1, cent: bisher.cent + v.cent })
  }
  return [...zaehlung.entries()]
    .sort(([idA, a], [idB, b]) => b.anzahl - a.anzahl || b.cent - a.cent || idA.localeCompare(idB))
    .slice(0, anzahl)
    .map(([id]) => id)
}

/**
 * Die Produkt-Chips: die meistverkauften, die es noch gibt, aufgefüllt mit
 * den ersten Produkten des Katalogs — ein neuer Hof ohne Verkäufe sieht so
 * trotzdem drei Chips. Ein schon gewähltes Produkt (Bearbeiten, Wiederholen)
 * steht immer dabei, sonst wäre die Wahl unsichtbar.
 */
export function produktChips<T extends { id: string }>(
  topIds: string[],
  produkte: T[],
  gewaehltId: string | null,
  anzahl = 3
): T[] {
  const nachId = new Map(produkte.map((p) => [p.id, p]))
  const chips: T[] = []
  for (const id of topIds) {
    const produkt = nachId.get(id)
    if (produkt && chips.length < anzahl) chips.push(produkt)
  }
  for (const produkt of produkte) {
    if (chips.length >= anzahl) break
    if (!chips.includes(produkt)) chips.push(produkt)
  }
  const gewaehlt = gewaehltId ? nachId.get(gewaehltId) : undefined
  if (gewaehlt && !chips.includes(gewaehlt)) chips.push(gewaehlt)
  return chips
}

/** Name und Menge sind im Schema Pflicht — was gespeichert wird, wenn der Hof sie weglässt. */
export function verkaufOhneAngaben(eingabe: { productName?: string | null; quantity?: number | null }): {
  productName: string
  quantity: number
} {
  return {
    productName: eingabe.productName?.trim() || OHNE_PRODUKT,
    quantity: eingabe.quantity != null && eingabe.quantity > 0 ? eingabe.quantity : 1,
  }
}

/** Ein Verkauf ohne Produktangabe: Beim Bearbeiten ist dann kein Chip und kein Name gewählt. */
export function istOhneProdukt(verkauf: { productId: string | null; productName: string }): boolean {
  return verkauf.productId === null && verkauf.productName === OHNE_PRODUKT
}

/** Der Knopf nennt den Betrag — „€ 24,50 eintragen". Ohne gültigen Betrag bleibt er grau. */
export function knopfText(betrag: number | null | undefined, bearbeiten: boolean): { text: string; aktiv: boolean } {
  if (betrag == null || !Number.isFinite(betrag) || betrag <= 0) {
    return { text: bearbeiten ? 'Speichern' : 'Eintragen', aktiv: false }
  }
  return { text: `${formatEuro(betrag)} ${bearbeiten ? 'speichern' : 'eintragen'}`, aktiv: true }
}

const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const MONATE = ['Jän', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

/** Das Datum im Kopf des Dialogs: „Heute", „Gestern" oder „Fr, 25. Sep". Beide Tage als JJJJ-MM-TT in Wien. */
export function datumKurz(tag: string, heute: string): string {
  const [j, m, t] = tag.split('-').map(Number)
  const [hj, hm, ht] = heute.split('-').map(Number)
  const abstand = Math.round((Date.UTC(hj, hm - 1, ht) - Date.UTC(j, m - 1, t)) / 86_400_000)
  if (abstand === 0) return 'Heute'
  if (abstand === 1) return 'Gestern'
  const wochentag = WOCHENTAGE[new Date(Date.UTC(j, m - 1, t)).getUTCDay()]
  return `${wochentag}, ${t}. ${MONATE[m - 1]}${j !== hj ? ` ${j}` : ''}`
}

// ─── Vorrat abziehen (Register D1, Nachtlauf Nr. 39) ────────────────────────

/** Der Schalter im Formular — Standard ein, nur beim Eintragen mit einem Produkt aus dem Sortiment. */
export const VORRAT_ABZIEHEN = 'Vorrat abziehen'

/** Reicht der Vorrat nicht, ist der Verkauf trotzdem gebucht; der Vorrat steht dann auf 0, nie darunter. */
export const VORRAT_ZU_KLEIN = 'Gebucht. Dein Vorrat war kleiner als die Menge – er steht jetzt auf 0.'

const VORRAT_NICHT_GEAENDERT = 'Gebucht. Deinen Vorrat konnten wir gerade nicht ändern – bitte prüf ihn unter Produkte.'

/**
 * Wie viele Gebinde ein Verkauf vom Vorrat abzieht. Der Vorrat zählt ganze
 * Gebinde (Register E3, `Product.stock` ist eine ganze Zahl), die Menge darf
 * gebrochen sein (2,5 kg): Aufgerundet, damit online nie mehr angeboten wird,
 * als noch da ist. Erst auf drei Stellen wie die Spalte `ManualSale.quantity`,
 * sonst machte ein Gleitkomma-Rest aus 2 eine 3. Ohne Menge speichert die
 * Action 1 (verkaufOhneAngaben) — dann geht auch 1 ab.
 */
export function gebindeZumAbziehen(menge: number | null | undefined): number {
  if (menge == null || !Number.isFinite(menge) || menge <= 0) return 1
  return Math.max(1, Math.ceil(Math.round(menge * 1000) / 1000))
}

/** Was die Buchung am Vorrat ausgerichtet hat — die Action meldet es, der Dialog zeigt den Satz. */
export type VorratBuchung =
  | { art: 'abgezogen'; vorrat: number }
  | { art: 'auf-null' }
  /** Der Vorrat änderte sich zwischen den Schritten mehrmals (Bestellung, Hof) — selten, nie ein Grund, den Verkauf zu verwerfen. */
  | { art: 'unveraendert' }

/** Der Satz nach dem Speichern; `knapp` zeigt ihn als Hinweis statt als Erfolg. */
export type VorratHinweis = { text: string; knapp: boolean }

export function vorratHinweis(
  buchung: VorratBuchung,
  produkt: { unit: string; unitSize: number | { toString(): string } | null }
): VorratHinweis {
  switch (buchung.art) {
    case 'abgezogen':
      return { text: `Verkauf eingetragen. Vorrat jetzt: ${formatMenge(buchung.vorrat, produkt.unit, produkt.unitSize)}.`, knapp: false }
    case 'auf-null':
      return { text: VORRAT_ZU_KLEIN, knapp: true }
    case 'unveraendert':
      return { text: VORRAT_NICHT_GEAENDERT, knapp: true }
  }
}

/** Der Satz unter dem Schalter: was im Vorrat ist und was abgeht — vor dem Speichern, ohne Überraschung danach. */
export function vorratSchalterText(
  an: boolean,
  produkt: { stock: number; unit: string; unitSize: number | null },
  menge: number | null | undefined
): string {
  if (!an) return 'Aus – dein Vorrat bleibt, wie er ist.'
  const bestand = `Im Vorrat: ${formatMenge(produkt.stock, produkt.unit, produkt.unitSize)}.`
  const ab = gebindeZumAbziehen(menge)
  if (produkt.stock < ab) return `${bestand} Das reicht nicht – danach steht er auf 0.`
  return `${bestand} Wir ziehen ${formatMenge(ab, produkt.unit, produkt.unitSize)} ab.`
}

/**
 * Die Einheit hinter dem Mengenfeld. Die Menge zählt Gebinde wie der Vorrat:
 * Bei einem Produkt mit Gebindegröße steht „× 0,5 kg" da, sonst nur „kg" —
 * sonst tippte der Hof 1 (kg) für zwei Halbkilo-Säcke, und vom Vorrat ginge
 * einer statt zwei ab.
 */
export function mengenEinheit(unit: string, unitSize: number | null): string {
  if (unitSize != null && unitSize !== 1) return `× ${formatZahl(unitSize)} ${einheitLabel(unit)}`
  return einheitLabel(unit)
}
