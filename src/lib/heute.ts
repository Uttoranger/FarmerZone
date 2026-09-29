/**
 * Heute — der Startbildschirm des Hofs (/dashboard). Rein, ohne Datenbank und
 * ohne Browser prüfbar (tests/heute.test.ts); die Abfragen stehen in
 * src/server/queries/heute.ts, die Seite zeigt nur an.
 *
 * Alle Tage und Wochen in WIENER Zeit: Der Hof steht um 0:30 Uhr nicht mehr
 * im Gestern, auch wenn der Server in UTC rechnet.
 */
import type { Prisma } from '@prisma/client'
import { tagVersetzt, wienKalendertag } from '@/lib/kalender'
import { wienerMitternacht } from '@/lib/servicegebuehr'

// ─── Tage ───────────────────────────────────────────────────────────────────

/** Diese Bestellungen sind durch — sie holt niemand mehr ab. */
export const ABHOLUNG_ERLEDIGT = ['PICKED_UP', 'CANCELLED', 'NOT_PICKED_UP'] as const

export type Zeitraum = { von: Date; bis: Date }

function mitternacht(kalendertag: string): Date {
  const zeitpunkt = wienerMitternacht(kalendertag)
  // Kann nicht fehlschlagen: Der Tag kommt aus wienKalendertag/tagVersetzt.
  if (!zeitpunkt) throw new Error(`Kein gültiger Kalendertag: ${kalendertag}`)
  return zeitpunkt
}

/** Ein Wiener Kalendertag von 0:00 bis 23:59:59,999 — als UTC-Zeitpunkte für die Abfrage. */
export function wienerTag(kalendertag: string): Zeitraum {
  return {
    von: mitternacht(kalendertag),
    bis: new Date(mitternacht(tagVersetzt(kalendertag, 1)).getTime() - 1),
  }
}

/**
 * Heute und morgen in Wien — die Grundlage für „Heute abholen" und die
 * Packliste. pickupDate steht um 12:00 des Abholtags (Serverzeit, siehe
 * kalender.ts wienKalendertag) und fällt damit sicher in den Wiener Tag.
 */
export function abholtage(jetzt: Date): { heute: Zeitraum; morgen: Zeitraum } {
  const heute = wienKalendertag(jetzt)
  return { heute: wienerTag(heute), morgen: wienerTag(tagVersetzt(heute, 1)) }
}

/**
 * Die EINE Bedingung für „Heute abholen", die nächste Abholung und die
 * Packliste /orders/today/print — Bildschirm und Papier zeigen dieselben
 * Bestellungen. Abgeholte, stornierte und nicht abgeholte fallen weg.
 */
export function abholWhere(farmId: string, tag: Zeitraum): Prisma.OrderWhereInput {
  return {
    farmId,
    pickupDate: { gte: tag.von, lte: tag.bis },
    status: { notIn: [...ABHOLUNG_ERLEDIGT] },
  }
}

/**
 * „Abholung vorbei, noch offen": Abholtag vor heute (Wien), weder abgeholt
 * noch als „nicht abgeholt" markiert, nicht storniert. Der Hof bestätigt nie
 * selbst — er markiert nur abgeholt oder nicht abgeholt; genau das fehlt hier.
 */
export function ueberfaelligWhere(farmId: string, jetzt: Date): Prisma.OrderWhereInput {
  return {
    farmId,
    pickupDate: { lt: abholtage(jetzt).heute.von },
    status: { notIn: [...ABHOLUNG_ERLEDIGT] },
  }
}

// ─── Nächste Abholung ───────────────────────────────────────────────────────

/**
 * Alles, was nach dem Wiener Heute abgeholt wird und noch offen ist — die
 * früheste Bestellung davon nennt den nächsten Abholtag. Vorher zählte die
 * Zeile nur „Morgen"; an einem leeren Morgen stand da nichts, obwohl am
 * Mittwoch vier Kunden kommen.
 */
export function naechsteAbholungWhere(farmId: string, jetzt: Date): Prisma.OrderWhereInput {
  return {
    farmId,
    pickupDate: { gt: abholtage(jetzt).heute.bis },
    status: { notIn: [...ABHOLUNG_ERLEDIGT] },
  }
}

const WOCHENTAG = new Intl.DateTimeFormat('de-AT', { timeZone: 'Europe/Vienna', weekday: 'long' })
const WOCHENTAG_DATUM = new Intl.DateTimeFormat('de-AT', {
  timeZone: 'Europe/Vienna',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

/**
 * Wie die Zeile den nächsten Abholtag nennt, gesehen vom Wiener Heute:
 * „Morgen" · innerhalb der nächsten Woche der Wochentag („Mittwoch") ·
 * weiter weg der Wochentag mit Datum („Mittwoch, 14. Oktober"). Ab sechs
 * Tagen wäre der bloße Wochentag zweideutig — „Montag" hieße sonst heute in
 * einer Woche oder übermorgen.
 */
export function abholtagName(heuteKalendertag: string, abholKalendertag: string): string {
  if (abholKalendertag === tagVersetzt(heuteKalendertag, 1)) return 'Morgen'
  const zeitpunkt = mitternacht(abholKalendertag)
  for (let tage = 2; tage <= 5; tage++) {
    if (abholKalendertag === tagVersetzt(heuteKalendertag, tage)) return WOCHENTAG.format(zeitpunkt)
  }
  return WOCHENTAG_DATUM.format(zeitpunkt)
}

export type NaechsteAbholung = {
  /** Der Kalendertag (JJJJ-MM-TT, Wien) — die Abfrage zählt damit die Bestellungen des Tags. */
  tag: string
  /** „Morgen", „Mittwoch" oder „Mittwoch, 14. Oktober". */
  name: string
  anzahl: number
}

/** Die schmale Zeile unter „Heute abholen": „Morgen: 3 Bestellungen". */
export function naechsteAbholungText(a: NaechsteAbholung): string {
  return `${a.name}: ${a.anzahl} ${a.anzahl === 1 ? 'Bestellung' : 'Bestellungen'}`
}

// ─── Heute abholen ──────────────────────────────────────────────────────────

/** „Anna Beispiel" → „Anna B." — genug zum Erkennen, mehr steht auf dem Handy nicht offen herum. */
export function kurzname(name: string): string {
  const teile = name.trim().split(/\s+/).filter(Boolean)
  if (teile.length === 0) return 'Kunde'
  if (teile.length === 1) return teile[0]
  return `${teile[0]} ${teile[teile.length - 1][0].toUpperCase()}.`
}

/** „2× Eier, 1× Bauernbrot +2" — die ersten Positionen, der Rest als Zahl. */
export function positionenKurz(items: readonly { productName: string; quantity: number }[], hoechstens = 2): string {
  const gezeigt = items.slice(0, hoechstens).map((i) => `${i.quantity}× ${i.productName}`)
  const rest = items.length - gezeigt.length
  return rest > 0 ? `${gezeigt.join(', ')} +${rest}` : gezeigt.join(', ')
}

export type AbholChip = 'bereit' | 'vorbereiten' | 'wartet'

export const ABHOL_CHIP_TEXT: Record<AbholChip, string> = {
  bereit: 'bereit',
  vorbereiten: 'vorbereiten',
  wartet: 'wartet auf Kunde',
}

/**
 * Der Chip einer heutigen Abholung. PENDING_CONFIRMATION heißt: Die Kundin
 * hat die Bestellung noch nicht per Mail bestätigt — „vorbereiten" wäre dort
 * eine falsche Aufforderung.
 */
export function abholChip(status: string): AbholChip {
  if (status === 'READY') return 'bereit'
  if (status === 'PENDING_CONFIRMATION') return 'wartet'
  return 'vorbereiten'
}

const ZAHLART_KURZ: Record<string, string> = {
  ONLINE: 'Online',
  ONSITE_CASH: 'Bar vor Ort',
  ONSITE_CARD: 'Karte vor Ort',
}

export type HeutigeAbholung = {
  id: string
  customerName: string
  pickupTimeStart: string
  pickupTimeEnd: string
  paymentMethod: string
  status: string
  items: { productName: string; quantity: number }[]
}

export type AbholZeile = {
  id: string
  uhrzeit: string
  kunde: string
  positionen: string
  zahlart: string
  chip: AbholChip
}

/** Die Zeilen von „Heute abholen", nach Uhrzeit — erledigte fallen weg. */
export function abholZeilen(bestellungen: readonly HeutigeAbholung[]): AbholZeile[] {
  const erledigt: readonly string[] = ABHOLUNG_ERLEDIGT
  return bestellungen
    .filter((b) => !erledigt.includes(b.status))
    .toSorted((a, b) => a.pickupTimeStart.localeCompare(b.pickupTimeStart) || a.customerName.localeCompare(b.customerName))
    .map((b) => ({
      id: b.id,
      uhrzeit: `${b.pickupTimeStart}–${b.pickupTimeEnd}`,
      kunde: kurzname(b.customerName),
      positionen: positionenKurz(b.items),
      zahlart: ZAHLART_KURZ[b.paymentMethod] ?? b.paymentMethod,
      chip: abholChip(b.status),
    }))
}

// ─── Braucht dich ───────────────────────────────────────────────────────────

/** So viele ausverkaufte Produkte einzeln, dann „und n weitere". */
export const BRAUCHT_DICH_EINZELN = 3

/** So viele überfällige Abholungen mit eigenem Link, dann „und n weitere". */
export const UEBERFAELLIG_EINZELN = 5

export type BrauchtDichEintrag = {
  art: 'ueberfaellig' | 'ausverkauft' | 'ohne-kategorie' | 'status'
  text: string
  href: string
  /** Überfällige Abholungen: jede Bestellung mit eigenem Link. */
  unterpunkte?: { text: string; href: string }[]
}

export type BrauchtDichDaten = {
  /**
   * Abholtag vor heute (Wien), weder abgeholt noch „nicht abgeholt", nicht
   * storniert: die Anzahl und die jüngsten davon (höchstens UEBERFAELLIG_EINZELN).
   */
  ueberfaellig: { anzahl: number; juengste: { id: string; customerName: string; pickupDate: Date }[] }
  /** Im Shop, Bestand 0. */
  ausverkauft: { id: string; name: string }[]
  ohneKategorie: { id: string; name: string }[]
  /** statusReminder (dashboard-hints.ts): null = nicht fällig. */
  statusErinnerung: number | 'never' | null
}

const TAG_KURZ = new Intl.DateTimeFormat('de-AT', {
  timeZone: 'Europe/Vienna',
  weekday: 'short',
  day: 'numeric',
  month: 'numeric',
})

function mehrzahl(n: number, eins: string, viele: string): string {
  return n === 1 ? eins : viele
}

/**
 * Nur, was eine Handlung verlangt — jede Zeile führt genau dorthin. Leer
 * heißt: „Alles erledigt."
 */
export function brauchtDich(daten: BrauchtDichDaten): BrauchtDichEintrag[] {
  const eintraege: BrauchtDichEintrag[] = []

  const { anzahl, juengste } = daten.ueberfaellig
  if (anzahl > 0) {
    const einzeln = juengste.slice(0, UEBERFAELLIG_EINZELN)
    const rest = anzahl - einzeln.length
    eintraege.push({
      art: 'ueberfaellig',
      text: `${anzahl} ${mehrzahl(anzahl, 'Abholung', 'Abholungen')} vorbei, noch offen — als abgeholt oder nicht abgeholt markieren`,
      href: anzahl === 1 && einzeln.length === 1 ? `/orders/${einzeln[0].id}` : '/orders',
      unterpunkte: [
        ...einzeln.map((b) => ({
          text: `${kurzname(b.customerName)} · ${TAG_KURZ.format(b.pickupDate)}`,
          href: `/orders/${b.id}`,
        })),
        ...(rest > 0 ? [{ text: `und ${rest} weitere`, href: '/orders' }] : []),
      ],
    })
  }

  const { ausverkauft } = daten
  for (const p of ausverkauft.slice(0, BRAUCHT_DICH_EINZELN)) {
    eintraege.push({ art: 'ausverkauft', text: `${p.name} ist ausverkauft`, href: `/products?edit=${p.id}` })
  }
  if (ausverkauft.length > BRAUCHT_DICH_EINZELN) {
    eintraege.push({
      art: 'ausverkauft',
      text: `und ${ausverkauft.length - BRAUCHT_DICH_EINZELN} weitere ausverkauft`,
      href: '/products',
    })
  }

  const { ohneKategorie } = daten
  if (ohneKategorie.length === 1) {
    eintraege.push({
      art: 'ohne-kategorie',
      text: `${ohneKategorie[0].name} hat keine Kategorie`,
      href: `/products?edit=${ohneKategorie[0].id}`,
    })
  } else if (ohneKategorie.length > 1) {
    eintraege.push({ art: 'ohne-kategorie', text: `${ohneKategorie.length} Produkte ohne Kategorie`, href: '/products' })
  }

  const { statusErinnerung } = daten
  if (statusErinnerung !== null) {
    eintraege.push({
      art: 'status',
      text:
        statusErinnerung === 'never'
          ? 'Noch kein Status — erzähl deinen Kunden, was es gibt'
          : `Seit ${statusErinnerung} Tagen kein neuer Status`,
      href: '/status/new',
    })
  }

  return eintraege
}

// ─── Diese Woche ────────────────────────────────────────────────────────────

// Die Fenster (diese Woche bis jetzt, Vorwoche bis zum selben Zeitpunkt)
// kommen aus der gemeinsamen Umsatzregel: umsatzfenster in src/lib/umsatz.ts.

export type Wochenvergleich = {
  dieseWocheCent: number
  vorwocheCent: number
  /** Gerundete Veränderung in Prozent; null ohne Umsatz in der Vorwoche (kein Vergleich möglich). */
  prozent: number | null
}

/** Umsatz in ganzen Cent (CODING_STANDARDS §2 Geld) — die Servergrenze wandelt Decimal einmal. */
export function wochenvergleich(dieseWocheCent: number, vorwocheCent: number): Wochenvergleich {
  return {
    dieseWocheCent,
    vorwocheCent,
    prozent: vorwocheCent > 0 ? Math.round(((dieseWocheCent - vorwocheCent) / vorwocheCent) * 100) : null,
  }
}

// ─── Kopf ───────────────────────────────────────────────────────────────────

function wienStunde(jetzt: Date): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Vienna', hour: 'numeric', hourCycle: 'h23' }).format(jetzt))
}

/** Gruß nach der Wiener Uhrzeit. */
export function begruessung(jetzt: Date): string {
  const stunde = wienStunde(jetzt)
  return stunde < 12 ? 'Guten Morgen' : stunde < 18 ? 'Guten Tag' : 'Guten Abend'
}

/** „Montag, 28. September 2026" — in Wien. */
export function datumLang(jetzt: Date): string {
  return new Intl.DateTimeFormat('de-AT', {
    timeZone: 'Europe/Vienna',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(jetzt)
}

/** „bis Montag, 14:30" — wie weit die Vorwoche zählt. */
export function vorwocheBis(jetzt: Date): string {
  const teile = new Intl.DateTimeFormat('de-AT', {
    timeZone: 'Europe/Vienna',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(jetzt)
  const wert = (typ: string) => teile.find((t) => t.type === typ)?.value ?? ''
  return `bis ${wert('weekday')}, ${wert('hour')}:${wert('minute')}`
}

/** „+20 % gegenüber der Vorwoche bis Dienstag, 14:30" — ohne Vorwochenumsatz kein Prozent. */
export function vergleichText(prozent: number | null, jetzt: Date): string {
  const bis = vorwocheBis(jetzt)
  if (prozent === null) return `Vorwoche ${bis}: noch kein Umsatz`
  const zahl = prozent > 0 ? `+${prozent}` : prozent < 0 ? `−${Math.abs(prozent)}` : '±0'
  return `${zahl} % gegenüber der Vorwoche ${bis}`
}
