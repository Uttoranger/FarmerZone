/**
 * Kunden des Hofs (/customers, /customers/[kundeId] — Nachtlauf Nr. 22a, Gate 8
 * „Code ohne Mockup"). Rein: wie aus Bestellungen eine Kundin wird, ihr
 * Status, Filter, Suche, Sortierung und die Texte der Seite. Die Abfragen
 * stehen in src/server/queries/customers.ts, die Seiten zeigen nur an.
 *
 * Eine Kundin ist die Menge der Bestellungen mit derselben normalisierten
 * E-Mail (klein, ohne Rand) — es gibt keine Kunden-Tabelle und seit E8/17a
 * keine Konto-Verknüpfung (`customerId` null). Geld in ganzen Cent
 * (CODING_STANDARDS §2); die Servergrenze wandelt Decimal einmal über alsCents.
 */
import { STANDARD_RICHTUNG, type KundenFilter, type KundenAnsicht, type KundenRichtung, type KundenSortierung } from '@/schemas/hof-kunden'
import { mitAnzahl } from '@/lib/format'

/** Die Töne der StatusBadge (src/components/ui/status-badge.tsx). */
type StatusTon = 'offen' | 'fertig' | 'neutral'

export type KundenStatus = 'Stammkunde' | 'Diesen Monat aktiv' | 'Lange nicht gesehen' | 'Neu' | null

/** Eine Bestellung, wie die Abfrage sie liefert — Betrag schon in Cent, fehlende Artikel schon draußen. */
export type KundenBestellung = {
  customerEmail: string
  customerName: string
  customerPhone: string
  status: string
  betragCents: number
  createdAt: Date
  items: { productName: string; quantity: number }[]
}

export type KundenAbo = { optInEmail: boolean; optInWhatsApp: boolean } | null

export type KundenZusammenfassung = {
  customerEmail: string
  customerName: string
  customerPhone: string
  orderCount: number
  /** Warenpreis aller Bestellungen ohne Storno und Nicht-Abholung, in Cent. */
  umsatzCents: number
  firstOrderDate: string
  lastOrderDate: string
  daysSinceLastOrder: number
  /** Willigt in E-Mail- oder WhatsApp-Neuigkeiten ein. */
  isSubscribed: boolean
  topProducts: { name: string; count: number }[]
  status: KundenStatus
  isStammkunde: boolean
  isDiesenMonatAktiv: boolean
  isLangeNichtGesehen: boolean
  isNeu: boolean
}

const TAG_MS = 24 * 60 * 60 * 1000
/** Ohne Umsatz: Die Ware ging nicht über den Tresen. */
const OHNE_UMSATZ: readonly string[] = ['CANCELLED', 'NOT_PICKED_UP']

/** Der Schlüssel einer Kundin — dieselbe Regel wie die Kennung (src/lib/kunden-id.ts). */
export function kundenSchluessel(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Der Status einer Kundin. Die Reihenfolge entscheidet: Stammkunde sticht
 * alles, dann Neu, dann Lange nicht gesehen, dann Diesen Monat aktiv.
 */
export function kundenStatus(anzahl: number, tageSeitLetzter: number, tageSeitErster: number): KundenStatus {
  if (anzahl >= 3) return 'Stammkunde'
  if (anzahl === 1 && tageSeitErster < 14) return 'Neu'
  if (anzahl >= 2 && tageSeitLetzter > 60) return 'Lange nicht gesehen'
  if (tageSeitLetzter <= 30) return 'Diesen Monat aktiv'
  return null
}

/**
 * Aus den Bestellungen EINER Kundin ihre Zusammenfassung. Name und Telefon
 * stammen aus der letzten Bestellung (die aktuellste Angabe).
 */
export function fasseKundinZusammen(bestellungen: readonly KundenBestellung[], abo: KundenAbo, jetzt: Date): KundenZusammenfassung {
  const sortiert = [...bestellungen].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  const erste = sortiert[0]
  const letzte = sortiert[sortiert.length - 1]

  const umsatzCents = sortiert.filter((b) => !OHNE_UMSATZ.includes(b.status)).reduce((summe, b) => summe + b.betragCents, 0)

  const mengen = new Map<string, number>()
  for (const b of sortiert) {
    if (b.status === 'CANCELLED') continue
    for (const p of b.items) mengen.set(p.productName, (mengen.get(p.productName) ?? 0) + p.quantity)
  }
  const topProducts = [...mengen.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }))

  const daysSinceLastOrder = Math.floor((jetzt.getTime() - letzte.createdAt.getTime()) / TAG_MS)
  const tageSeitErster = Math.floor((jetzt.getTime() - erste.createdAt.getTime()) / TAG_MS)
  const orderCount = sortiert.length

  return {
    customerEmail: letzte.customerEmail,
    customerName: letzte.customerName,
    customerPhone: letzte.customerPhone,
    orderCount,
    umsatzCents,
    firstOrderDate: erste.createdAt.toISOString(),
    lastOrderDate: letzte.createdAt.toISOString(),
    daysSinceLastOrder,
    isSubscribed: !!(abo?.optInEmail || abo?.optInWhatsApp),
    topProducts,
    status: kundenStatus(orderCount, daysSinceLastOrder, tageSeitErster),
    isStammkunde: orderCount >= 3,
    isDiesenMonatAktiv: daysSinceLastOrder <= 30,
    isLangeNichtGesehen: orderCount >= 2 && daysSinceLastOrder > 60,
    isNeu: orderCount === 1 && tageSeitErster < 14,
  }
}

// ─── Anzeige ────────────────────────────────────────────────────────────────

/**
 * Die Marke eines Status. Orange heißt „schau hin" (eine neue Kundin
 * begrüßen, eine verlorene zurückholen), Grün die treue Stammkundin.
 */
export function kundenMarke(status: KundenStatus): { text: string; ton: StatusTon } | null {
  switch (status) {
    case 'Stammkunde':
      return { text: status, ton: 'fertig' }
    case 'Neu':
    case 'Lange nicht gesehen':
      return { text: status, ton: 'offen' }
    case 'Diesen Monat aktiv':
      return { text: status, ton: 'neutral' }
    default:
      return null
  }
}

/** „heute bestellt" · „gestern bestellt" · „zuletzt vor 12 Tagen". */
export function zuletztText(tage: number): string {
  if (tage <= 0) return 'heute bestellt'
  if (tage === 1) return 'gestern bestellt'
  return `zuletzt vor ${tage} Tagen`
}

/** „heute" · „gestern" · „vor 12 Tagen" — für Spalten und Bestellzeilen. */
export function vorTagenText(tage: number): string {
  if (tage <= 0) return 'heute'
  if (tage === 1) return 'gestern'
  return `vor ${tage} Tagen`
}

/** Ganze Tage zwischen einem Zeitpunkt (ISO) und jetzt. */
export function tageSeit(zeitpunkt: string, jetzt: Date): number {
  return Math.floor((jetzt.getTime() - new Date(zeitpunkt).getTime()) / TAG_MS)
}

/** Zwei Buchstaben für den Kreis: „Erika Mustermann" → „EM", „Erika" → „ER"; ohne Namen „?". */
export function initialen(name: string): string {
  const teile = name.trim().split(/\s+/).filter(Boolean)
  if (teile.length === 0) return '?'
  if (teile.length === 1) return [...teile[0]].slice(0, 2).join('').toUpperCase()
  return ([...teile[0]][0] + [...teile[teile.length - 1]][0]).toUpperCase()
}

const MONAT_JAHR = new Intl.DateTimeFormat('de-AT', { month: 'long', year: 'numeric', timeZone: 'Europe/Vienna' })

/** „Kunde seit März 2026" — Monat in Wiener Zeit (CODING_STANDARDS §2). */
export function kundeSeitText(ersteBestellung: string): string {
  return `Kunde seit ${MONAT_JAHR.format(new Date(ersteBestellung))}`
}

/** Wie viele Bestellungen die Seite NICHT zeigt — gezählt an allen, nicht an den geladenen. */
export function weitereBestellungen(anzahl: number, gezeigt: number): number {
  return Math.max(0, anzahl - gezeigt)
}

/** „3 Personen · 1 Stammkunde". */
export function kundenKopfzeile(kunden: readonly Pick<KundenZusammenfassung, 'isStammkunde'>[]): string {
  const stamm = kunden.filter((k) => k.isStammkunde).length
  return `${mitAnzahl(kunden.length, 'Person', 'Personen')} · ${mitAnzahl(stamm, 'Stammkunde', 'Stammkunden')}`
}

/** Ab so vielen Kundinnen, die lange nicht bestellt haben, steht der Tipp über der Liste. */
export const ZURUECKHOLEN_AB = 3

// ─── Filter, Suche, Sortierung ──────────────────────────────────────────────

export const KUNDEN_FILTER_LABEL: Record<KundenFilter, string> = {
  alle: 'Alle',
  stammkunden: 'Stammkunden',
  aktiv: 'Diesen Monat',
  lange: 'Lange weg',
  neu: 'Neu',
}

/**
 * Höchstens zwei Filter stehen als Chips da (freigabe.md §12 Nr. 45): „Alle"
 * und „Stammkunden". Die übrigen Filter erreicht nur ein Link — der Tipp
 * „Diese Kunden ansehen" (?filter=lange) oder ein altes Lesezeichen; ist einer
 * davon gewählt, steht er an der Stelle von „Stammkunden", damit man sieht,
 * was gerade gilt. Neue und Lange-weg-Kundinnen tragen ihre Marke in der
 * Zeile, und „Sortieren" bringt sie nach vorn (Kunde seit, Letzte Bestellung).
 */
export const KUNDEN_FILTER_SICHTBAR: readonly KundenFilter[] = ['alle', 'stammkunden']

export function sichtbareKundenFilter(aktiv: KundenFilter): KundenFilter[] {
  return KUNDEN_FILTER_SICHTBAR.includes(aktiv) ? [...KUNDEN_FILTER_SICHTBAR] : [KUNDEN_FILTER_SICHTBAR[0], aktiv]
}

/** Der Knopf, hinter dem die Sortierung steht (freigabe.md §12 Nr. 45) — und der Titel des Blatts. */
export const SORTIEREN_TEXT = 'Sortieren'

/** Wonach sortiert wird — ohne Richtung; die nennt der Umschalter (`richtungText`). */
export const KUNDEN_SORTIERUNG_LABEL: Record<KundenSortierung, string> = {
  bestellungen: 'Anzahl Bestellungen',
  umsatz: 'Umsatz',
  zuletzt: 'Letzte Bestellung',
  name: 'Name',
  neueste: 'Kunde seit',
}

const RICHTUNG_TEXT: Record<KundenSortierung, Record<KundenRichtung, string>> = {
  bestellungen: { ab: 'Meiste zuerst', auf: 'Wenigste zuerst' },
  umsatz: { ab: 'Höchster zuerst', auf: 'Niedrigster zuerst' },
  zuletzt: { ab: 'Zuletzt bestellt zuerst', auf: 'Am längsten her zuerst' },
  name: { auf: 'A bis Z', ab: 'Z bis A' },
  neueste: { ab: 'Neueste zuerst', auf: 'Älteste zuerst' },
}

/** „Meiste zuerst", „Z bis A" — was die gewählte Richtung bei dieser Sortierung heißt. */
export function richtungText(sortierung: KundenSortierung, richtung: KundenRichtung): string {
  return RICHTUNG_TEXT[sortierung][richtung]
}

export function andereRichtung(richtung: KundenRichtung): KundenRichtung {
  return richtung === 'auf' ? 'ab' : 'auf'
}

/** „Anzahl Bestellungen – Meiste zuerst": was gerade gilt, für den Screenreader am Knopf „Sortieren". */
export function sortierungBeschreibung(sortierung: KundenSortierung, richtung: KundenRichtung): string {
  return `${KUNDEN_SORTIERUNG_LABEL[sortierung]} – ${richtungText(sortierung, richtung)}`
}

type FilterKunde = Pick<KundenZusammenfassung, 'isStammkunde' | 'isDiesenMonatAktiv' | 'isLangeNichtGesehen' | 'isNeu'>

export function passtZuKundenFilter(k: FilterKunde, filter: KundenFilter): boolean {
  switch (filter) {
    case 'stammkunden':
      return k.isStammkunde
    case 'aktiv':
      return k.isDiesenMonatAktiv
    case 'lange':
      return k.isLangeNichtGesehen
    case 'neu':
      return k.isNeu
    default:
      return true
  }
}

export function zaehleKundenFilter(kunden: readonly FilterKunde[]): Record<KundenFilter, number> {
  const zahl = (f: KundenFilter) => kunden.filter((k) => passtZuKundenFilter(k, f)).length
  return { alle: kunden.length, stammkunden: zahl('stammkunden'), aktiv: zahl('aktiv'), lange: zahl('lange'), neu: zahl('neu') }
}

/** Suche in Name, Telefon und E-Mail — ohne Rücksicht auf Groß-/Kleinschreibung. */
export function passtZurKundenSuche(
  k: Pick<KundenZusammenfassung, 'customerName' | 'customerPhone' | 'customerEmail'>,
  suche: string
): boolean {
  const s = suche.trim().toLocaleLowerCase('de')
  if (s === '') return true
  return [k.customerName, k.customerPhone, k.customerEmail].some((feld) => feld.toLocaleLowerCase('de').includes(s))
}

export function filtereKunden<T extends FilterKunde & Pick<KundenZusammenfassung, 'customerName' | 'customerPhone' | 'customerEmail'>>(
  kunden: readonly T[],
  ansicht: Pick<KundenAnsicht, 'filter' | 'suche'>
): T[] {
  return kunden.filter((k) => passtZuKundenFilter(k, ansicht.filter) && passtZurKundenSuche(k, ansicht.suche))
}

type SortierKunde = Pick<KundenZusammenfassung, 'orderCount' | 'umsatzCents' | 'lastOrderDate' | 'firstOrderDate' | 'customerName'>

/**
 * Eine sortierte Kopie — die Eingabe bleibt, wie sie ist. Ohne Richtung die
 * Standardrichtung der Sortierung (STANDARD_RICHTUNG). Gleichstand behält die
 * Reihenfolge der Eingabe (sort ist stabil), in beiden Richtungen.
 */
export function sortiereKunden<T extends SortierKunde>(
  kunden: readonly T[],
  sortierung: KundenSortierung,
  richtung: KundenRichtung = STANDARD_RICHTUNG[sortierung]
): T[] {
  const zeit = (iso: string) => new Date(iso).getTime()
  const aufsteigend = (a: T, b: T): number => {
    switch (sortierung) {
      case 'umsatz':
        return a.umsatzCents - b.umsatzCents
      case 'zuletzt':
        return zeit(a.lastOrderDate) - zeit(b.lastOrderDate)
      case 'name':
        return a.customerName.localeCompare(b.customerName, 'de')
      case 'neueste':
        return zeit(a.firstOrderDate) - zeit(b.firstOrderDate)
      default:
        return a.orderCount - b.orderCount
    }
  }
  return [...kunden].sort((a, b) => (richtung === 'auf' ? aufsteigend(a, b) : aufsteigend(b, a)))
}

/**
 * Die Adresse der Ansicht — Standardwerte bleiben draußen, die Suche bereinigt.
 * Ohne Richtung gilt die Standardrichtung der Sortierung.
 */
export function kundenAdresse(ansicht: Omit<KundenAnsicht, 'richtung'> & { richtung?: KundenRichtung }): string {
  const parameter = new URLSearchParams()
  if (ansicht.filter !== 'alle') parameter.set('filter', ansicht.filter)
  if (ansicht.suche.trim()) parameter.set('suche', ansicht.suche.trim())
  if (ansicht.sortierung !== 'bestellungen') parameter.set('sortierung', ansicht.sortierung)
  if (ansicht.richtung && ansicht.richtung !== STANDARD_RICHTUNG[ansicht.sortierung]) parameter.set('richtung', ansicht.richtung)
  const rest = parameter.toString()
  return `/customers${rest ? `?${rest}` : ''}`
}
