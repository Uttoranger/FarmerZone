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
import { wienerZeitpunkt } from '@/lib/fristen'
import { formatSlotTime } from '@/lib/pickup-days'
import { mitAnzahl } from '@/lib/format'
import { hofZustand } from '@/lib/mein-hof'
import { summeCent, UMSATZ_TEXT, type UmsatzBuchung } from '@/lib/umsatz'
import { onlineZahlungPausiert } from '@/lib/stripe-konto'
import type { MarkeArt } from '@/lib/marke-art'
import { BEITRAG_ANLAESSE, type BeitragAnlass } from '@/lib/beitrag-anlass'
import type { BildAusschnitt } from '@/schemas/bild-ausschnitt'

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

/**
 * Was „Braucht dich" sagt, wenn nichts ansteht (Register N11): eine leise Zeile
 * statt einer Karte — eine leere Karte trüge neben der Packliste so viel
 * Gewicht wie ein echter Auftrag.
 */
export const BRAUCHT_DICH_LEER = 'Nichts braucht dich heute.'

/**
 * Wie „Braucht dich" erscheint (Register N11, Ergänzung Freigabe Lauf 13): die
 * Karte, sobald etwas ansteht; die leise Zeile `BRAUCHT_DICH_LEER` nur, wenn
 * auch die Packliste leer ist — unter „Packliste · 2 offen" läse sie sich an
 * einem Packtag wie ein Widerspruch; sonst nichts.
 */
export function brauchtDichAnzeige(eintraege: number, packlisteLeer: boolean): 'karte' | 'zeile' | null {
  if (eintraege > 0) return 'karte'
  return packlisteLeer ? 'zeile' : null
}

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
 * heißt: BRAUCHT_DICH_LEER, wenn auch die Packliste leer ist (brauchtDichAnzeige).
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
          ? 'Noch kein Beitrag — erzähl deinen Kundinnen, was es gibt'
          : `Seit ${statusErinnerung} Tagen kein neuer Beitrag`,
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

// ─── Packliste (Gate 5, Nachtlauf Nr. 17) ──────────────────────────────────

/**
 * Die Marke einer Zeile der Packliste — Wortlaut der Mockups H3 „Heute",
 * Bedeutung als Art (Register G5): zum Packen = tun, gepackt = läuft.
 * READY heißt für den Hof „gepackt"; PENDING_CONFIRMATION wartet auf die
 * Bestätigung der Kundin (abholChip), da ist nichts zu packen — erledigt.
 */
export const PACK_MARKE: Record<AbholChip, { text: string; art: MarkeArt }> = {
  vorbereiten: { text: 'Zum Packen', art: 'tun' },
  wartet: { text: 'Wartet auf Kunde', art: 'erledigt' },
  bereit: { text: 'Gepackt', art: 'laeuft' },
}

// Was Arbeit macht, steht oben: erst packen, dann warten, zuletzt Erledigtes.
const PACK_RANG: Record<AbholChip, number> = { vorbereiten: 0, wartet: 1, bereit: 2 }

/** Eine heutige Abholung samt Betrag — den rechnet die Servergrenze in Cent (bestellSummen). */
export type PacklistenBestellung = HeutigeAbholung & { gesamtCents: number }
export type PacklistenZeile = AbholZeile & { gesamtCents: number }

/**
 * Die Packliste auf Heute: dieselben Bestellungen wie „Heute abholen" und das
 * Papier (abholWhere), offen zuerst, dann „wartet auf Kunde", dann gepackt —
 * innerhalb jeder Gruppe nach Uhrzeit (abholZeilen, stabil sortiert).
 */
export function packliste(bestellungen: readonly PacklistenBestellung[]): PacklistenZeile[] {
  const cents = new Map(bestellungen.map((b) => [b.id, b.gesamtCents]))
  return abholZeilen(bestellungen)
    .map((z) => ({ ...z, gesamtCents: cents.get(z.id) ?? 0 }))
    .toSorted((a, b) => PACK_RANG[a.chip] - PACK_RANG[b.chip])
}

export type PacklistenZahlen = { bestellungen: number; zuPacken: number }

/** „Heute abholen" und „Noch zu packen" — gezählt an derselben Liste, die die Seite zeigt. */
export function packlistenZahlen(zeilen: readonly PacklistenZeile[]): PacklistenZahlen {
  return { bestellungen: zeilen.length, zuPacken: zeilen.filter((z) => z.chip === 'vorbereiten').length }
}

// ─── Kennzahlen (freigabe.md §12 Nr. 45) ────────────────────────────────────

/**
 * „Heute abholen": Abholtag heute, weder abgeholt noch storniert noch „nicht
 * abgeholt" — dieselben Bestellungen wie die Packliste und das Papier
 * (abholWhere). EIN Wort für die Kennzahl auf Heute und den Filter in
 * Bestellungen (hof-bestellungen.ts).
 */
export const HEUTE_ABHOLEN = 'Heute abholen'

/**
 * Die drei Kennzahlen auf Heute (Register F4). Vorher „Bestellungen heute"
 * und „Umsatz heute": Waren alle Bestellungen abgeholt, stand „0" neben
 * „€ 178" — die Zahl zählt nur offene Abholungen, der Betrag dagegen die
 * heute abgeholten Bestellungen UND die Direktverkäufe (Hofladen, Markt …,
 * umsatzHeuteCent). Jetzt sagt jede Kennzahl, was sie zählt; der Zusatz steht
 * unter dem Betrag — dasselbe Wort wie die Umsatzkarte der Auswertung
 * (UMSATZ_TEXT, Nr. 53).
 */
export const KENNZAHL_TEXT = {
  abholen: HEUTE_ABHOLEN,
  packen: 'Noch zu packen',
  eingenommen: 'Heute eingenommen',
  eingenommenMit: UMSATZ_TEXT.mitHofladenKlein,
} as const

/** Der Leerzustand der Packliste — auch der des Filters „Heute abholen" in Bestellungen. */
export const HEUTE_NIEMAND = 'Heute holt niemand etwas ab.'

/** Die eine Zeile unter dem Abholfenster in „Nächste Abholung“, solange nichts bestellt ist (Register N9, eine Zeile ohne Aktion). */
export const HEUTE_KEINE_BESTELLUNGEN = 'Noch keine Bestellungen'

/**
 * Was der Hinweis „Online-Zahlung ist pausiert" braucht (Register F4) — oder
 * null, wenn er nicht steht (onlineZahlungPausiert). „Nur bar bei Abholung"
 * verspricht, dass Kunden bestellen können: Das gilt nur, solange sie den Hof
 * sehen und bei ihm bestellen können (heuteHofSichtbar) und er bar annimmt.
 * Ein wartender, stillgelegter oder pausierter Hof bekommt die zweite
 * Fassung des Satzes, der Wortlaut bleibt (Nachbesserung Runde 2).
 */
export function onlinePausiertDaten(
  hof: Parameters<typeof heuteHofSichtbar>[0] & Parameters<typeof onlineZahlungPausiert>[0] & { acceptsOnsite: boolean }
): { barMoeglich: boolean } | null {
  if (!onlineZahlungPausiert(hof)) return null
  return { barMoeglich: heuteHofSichtbar(hof) && hof.acceptsOnsite }
}

/**
 * Breite der Zeichen in Fraunces 600 (Einheit em), im Browser gemessen
 * (Nr. 45, Runde 1) — Ziffern verschieden breit, weil die Schrift keine
 * Tabellenziffern mitbringt. Unbekanntes zählt breit (EM_UNBEKANNT).
 */
const EM_ZEICHEN: Record<string, number> = {
  '0': 0.675,
  '1': 0.4685,
  '2': 0.618,
  '3': 0.565,
  '4': 0.6285,
  '5': 0.5875,
  '6': 0.6185,
  '7': 0.5275,
  '8': 0.617,
  '9': 0.6215,
  '€': 0.7075,
  ' ': 0.2175,
  '\u00a0': 0.2175,
  '\u202f': 0.1087,
  ',': 0.2815,
  '.': 0.27,
}
const EM_UNBEKANNT = 0.75
/** Spielraum für die Ersatzschrift, solange Fraunces lädt, und fürs Runden. */
const EM_SPIELRAUM = 1.04

/**
 * Wie breit ein Kennzahl-Wert in seiner eigenen Schriftgröße ist (em). Die
 * Karte setzt daraus `font-size: max(12px, min(22px, 100cqw / em))`: Ein
 * Betrag wird nie gekürzt, er wird in einer schmalen Karte kleiner (drei
 * Spalten bei 360 px, freigabe.md §12 Nr. 45), aber nie kleiner als 12 px.
 * Passt er dann noch immer nicht — Nur-Text-Zoom, Mindestschriftgröße,
 * breitere Ersatzschrift, ein absurder Betrag —, bricht er um, statt über den
 * Kartenrand zu laufen (Runde 2). Lieber etwas zu breit geschätzt als zu schmal.
 */
export function kennzahlBreiteEm(wert: string): number {
  const summe = [...wert].reduce((em, zeichen) => em + (EM_ZEICHEN[zeichen] ?? EM_UNBEKANNT), 0)
  return Math.ceil(summe * EM_SPIELRAUM * 1000) / 1000
}

/**
 * Weiche Trennstellen (U+00AD) für Wörter, die in einer schmalen Kennzahl-Karte
 * nicht in eine Zeile passen: „Heute einge-/nommen" statt „eingenomme/n" —
 * bei 360 px ist „eingenommen" breiter als die Karte. Alle Silben, damit auch
 * 320 px sauber trennen. Das Wort bleibt für Vorleser und Kopieren dasselbe.
 */
const TRENNSTELLEN: Record<string, string> = { eingenommen: 'ein\u00adge\u00adnom\u00admen' }

export function mitTrennstellen(text: string): string {
  return text.replace(/\p{L}+/gu, (wort) => TRENNSTELLEN[wort] ?? wort)
}

// ─── Abholfenster ───────────────────────────────────────────────────────────

/** Ein wöchentliches Abholfenster, wie der Hof es eingetragen hat (dayOfWeek 0 = Sonntag). */
export type HeuteFenster = { dayOfWeek: number; startTime: string; endTime: string; isActive?: boolean }

function aktiveAm(slots: readonly HeuteFenster[], kalendertag: string): HeuteFenster[] {
  const [j, m, t] = kalendertag.split('-').map(Number)
  const wochentag = new Date(Date.UTC(j, m - 1, t)).getUTCDay()
  return slots
    .filter((s) => s.isActive !== false && s.dayOfWeek === wochentag)
    .toSorted((a, b) => a.startTime.localeCompare(b.startTime))
}

/** „15–18 Uhr", mehrere Fenster nach Beginn: „9–12:30 · 15–18 Uhr" — Schreibweise der Hofseite (formatSlotTime). */
export function fensterText(slots: readonly HeuteFenster[]): string {
  const zeiten = slots
    .toSorted((a, b) => a.startTime.localeCompare(b.startTime))
    .map((s) => `${formatSlotTime(s.startTime)}–${formatSlotTime(s.endTime)}`)
  return `${zeiten.join(' · ')} Uhr`
}

/**
 * Ist heute (Wiener Tag) ein Abholtag? Dann die Zeiten, sonst null. Ganzer
 * Tag: Auch nach dem letzten Fenster bleibt es ein Abholtag — die Teilen-Karte
 * springt nicht nachmittags auf groß.
 */
export function abholfensterHeute(slots: readonly HeuteFenster[], jetzt: Date): string | null {
  const heute = aktiveAm(slots, wienKalendertag(jetzt))
  return heute.length > 0 ? fensterText(heute) : null
}

export type NaechstesFenster = {
  /** Kalendertag JJJJ-MM-TT (Wien). */
  tag: string
  /** „Heute", „Morgen", „Samstag" oder „Dienstag, 13. Oktober" (abholtagName). */
  name: string
  zeit: string
}

/**
 * Das nächste Abholfenster laut Abholzeiten: heute, solange eines davon noch
 * nicht vorbei ist (Ende in Wiener Zeit), sonst der nächste Tag mit Fenster
 * innerhalb einer Woche. Ohne aktive Fenster null.
 */
export function naechstesAbholfenster(slots: readonly HeuteFenster[], jetzt: Date): NaechstesFenster | null {
  const heute = wienKalendertag(jetzt)
  for (let versatz = 0; versatz <= 7; versatz++) {
    const tag = tagVersetzt(heute, versatz)
    let fenster = aktiveAm(slots, tag)
    if (versatz === 0) {
      fenster = fenster.filter((s) => {
        const ende = wienerZeitpunkt(tag, s.endTime)
        return ende !== null && ende.getTime() > jetzt.getTime()
      })
    }
    if (fenster.length === 0) continue
    return { tag, name: versatz === 0 ? 'Heute' : abholtagName(heute, tag), zeit: fensterText(fenster) }
  }
  return null
}

/**
 * Wie viele Bestellungen auf das nächste Fenster warten: liegt es heute, die
 * Packliste (ohne Abgeholte, Stornierte, Nicht-Abgeholte — packliste); liegt
 * es später, die Zahl des nächsten Abholtags mit Bestellungen, aber nur, wenn
 * das genau dieser Tag ist. Sonst 0 — nie die Bestellungen eines anderen Tags.
 */
export function fensterAnzahl(
  fenster: NaechstesFenster | null,
  heuteKalendertag: string,
  heutige: readonly PacklistenZeile[],
  naechsteAbholung: NaechsteAbholung | null
): number {
  if (!fenster) return 0
  if (fenster.tag === heuteKalendertag) return heutige.length
  return naechsteAbholung?.tag === fenster.tag ? naechsteAbholung.anzahl : 0
}

// ─── Umsatz heute ───────────────────────────────────────────────────────────

/**
 * „Umsatz heute": von Wiener Mitternacht bis jetzt, nach der gemeinsamen
 * Umsatzregel (summeCent — Abholungen nach pickedUpAt, manuelle Verkäufe mit
 * ihrem ganzen Wiener Tag). Welche Bestellungen Buchungen sind (nur
 * PICKED_UP), entscheidet umsatzBestellungWhere in der Abfrage.
 */
export function umsatzHeuteCent(buchungen: UmsatzBuchung[], jetzt: Date): number {
  return summeCent(buchungen, { von: abholtage(jetzt).heute.von, bis: jetzt })
}

// ─── Teilen-Zeile ───────────────────────────────────────────────────────────

/**
 * Sehen Kunden den Hof und können sie bei ihm bestellen? Nur im Zustand
 * „sichtbar" (hofZustand). Pausiert ist die Hofseite zwar öffentlich, aber
 * Kunden können gerade nicht bestellen — Teilen und „Ab jetzt können Kunden
 * bei dir bestellen" wären dort falsch.
 */
export function heuteHofSichtbar(hof: {
  isActive: boolean
  isPaused: boolean
  approvedAt: Date | null
  archivedAt: Date | null
}): boolean {
  return hofZustand(hof).art === 'sichtbar'
}

/**
 * „Abholung Samstag, 9–12 Uhr" — mitten im Satz klein: „Abholung heute, …",
 * „Abholung morgen, …"; Wochentage bleiben groß. Ohne Fenster leer.
 */
export function abholungText(fenster: NaechstesFenster | null): string {
  if (!fenster) return ''
  const tag = fenster.name === 'Heute' || fenster.name === 'Morgen' ? fenster.name.toLowerCase() : fenster.name
  return `Abholung ${tag}, ${fenster.zeit}`
}

/** „Eier, Erdäpfel, Heu – Abholung Samstag, 9–12 Uhr" — was es gibt und wann man es holt. */
export function teilenSatz(angebot: readonly string[], fenster: NaechstesFenster | null): string {
  const was = angebot.join(', ')
  const wann = abholungText(fenster)
  if (was && wann) return `${was} – ${wann}`
  return was || wann || 'Erzähl deinen Kunden, was es bei dir gibt.'
}

// ─── Aufbau ─────────────────────────────────────────────────────────────────

export type HeuteBlock = 'postfach' | 'stripe' | 'packliste' | 'beitrag' | 'teilen' | 'braucht-dich' | 'zu-tun' | 'naechste-abholung' | 'woche'

/**
 * Welche Blöcke wo stehen (freigabe.md §12 Nr. 45). Oben höchstens EIN Kasten
 * von Heute: der Stripe-Hinweis — „pausiert" (Notbremse) oder „einrichten"
 * (Register Z1); bis er erledigt ist, können Kunden nicht online zahlen. Den
 * Balken der Shell („wartet auf Freischaltung", „stillgelegt") zeigt das
 * Layout auf jeder Seite; er zählt nicht mit (Entscheidung zur Prüfung,
 * Runde 1). Die Hauptspalte beginnt immer mit der Packliste (Gate 5:
 * „Packliste zuerst"), dann „Braucht dich", zuletzt die kompakte Teilen-Zeile
 * — nur bei sichtbarem Hof (heuteHofSichtbar). Dringend steht vor freiwillig
 * (Register N11): Was eine Handlung verlangt, steht nicht hinter einer
 * Einladung zum Teilen. Die Seitenspalte
 * steht am Handy unter der ganzen Hauptspalte (nach der Teilen-Zeile, ohne sie
 * nach „Braucht dich") und beginnt mit „Zu tun" (Nr. 53): EINE Liste statt
 * „Erste Schritte" oben und „Deine Hofseite" unten — was noch einzurichten
 * ist, danach die Zahlen.
 *
 * „Dein Beitrag“ (Register E12, Ergänzung Nr. 129) steht in der Hauptspalte
 * nach Packliste und „Braucht dich“, vor der Teilen-Zeile — nie oben, ohne
 * Punkt an der Glocke: Das Tagesgeschäft und was eine Handlung verlangt,
 * gehen vor (N11).
 */
export function heuteAufbau({
  stripeHinweis,
  teilen,
  zuTun,
  postfach,
  beitrag = false,
}: {
  stripeHinweis: boolean
  teilen: boolean
  zuTun: boolean
  /** Ungelesenes vom Team im Postfach (Register N12, Nr. 87): Die Karte steht dann als erster Block der Hauptspalte. */
  postfach: boolean
  /** „Dein Beitrag“ oder der Anstoß (beitragBlock) — dann der Block 'beitrag'. */
  beitrag?: boolean
}): { oben: HeuteBlock[]; haupt: HeuteBlock[]; seite: HeuteBlock[] } {
  const oben: HeuteBlock[] = stripeHinweis ? ['stripe'] : []
  const haupt: HeuteBlock[] = ['packliste', 'braucht-dich']
  if (beitrag) haupt.push('beitrag')
  if (teilen) haupt.push('teilen')
  if (postfach) haupt.unshift('postfach')
  const seite: HeuteBlock[] = zuTun ? ['zu-tun', 'naechste-abholung', 'woche'] : ['naechste-abholung', 'woche']
  return { oben, haupt, seite }
}

// ─── Online-Zahlung einrichten (Register Z1) ────────────────────────────────

/**
 * Ein freigeschalteter Hof ohne fertiges Stripe-Konto sieht auf Heute deutlich
 * „Online-Zahlung einrichten" (Z1). Er bleibt online — keine Abschaltung, keine
 * Sperre, nur der Hinweis mit dem Weg in die Zahlungs-Einstellungen. Das gilt
 * auch für einen Bestandshof mit `acceptsOnline` false: Er wird aufgefordert,
 * an seinen Daten ändert sich nichts.
 *
 * Greift die Notbremse (onlineZahlungPausiert: Konto da, Stripe lässt es
 * gerade nicht zu), steht stattdessen „Online-Zahlung ist pausiert" — nie
 * beide. Wartende Höfe führt Einrichten, stillgelegte sind vom Netz.
 */
export function stripeEinrichtenHinweis(hof: {
  approvedAt: Date | null
  archivedAt: Date | null
  stripeAccountReady: boolean
  acceptsOnline: boolean
  stripeAccountId: string | null
}): boolean {
  return hof.approvedAt !== null && hof.archivedAt === null && !hof.stripeAccountReady && !onlineZahlungPausiert(hof)
}

// ─── Wochenbalken ───────────────────────────────────────────────────────────

export type WochenBalken = { label: string; cent: number; heute: boolean; hoeheProzent: number }

/**
 * Die sieben Balken Mo–So aus der gemeinsamen Umsatzregel (auswerten), der
 * Wiener Heute-Tag markiert, Höhe relativ zum besten Tag der Woche.
 */
export function wochenBalken(balken: readonly { label: string; cent: number }[], jetzt: Date): WochenBalken[] {
  const [j, m, t] = wienKalendertag(jetzt).split('-').map(Number)
  const heuteIndex = (new Date(Date.UTC(j, m - 1, t)).getUTCDay() + 6) % 7
  const hoechster = Math.max(0, ...balken.map((b) => b.cent))
  return balken.map((b, i) => ({
    label: b.label,
    cent: b.cent,
    heute: i === heuteIndex,
    hoeheProzent: hoechster > 0 ? Math.round((Math.max(0, b.cent) * 100) / hoechster) : 0,
  }))
}

// ─── „Dein Beitrag“ (Register E12, Ergänzung Nr. 129) ───────────────────────

/** Ohne Beitrag in so vielen Tagen (und mit Produkten im Shop) kommt der Anstoß. */
export const ANSTOSS_NACH_TAGEN = 14

/** Wohin „Neuer Beitrag“ führt — mit Anlass vorgewählt über `?anlass=` (/status/new liest ihn mit Zod). */
export const NEUER_BEITRAG_HREF = '/status/new'

export function neuerBeitragHref(anlass?: BeitragAnlass): string {
  return anlass ? `${NEUER_BEITRAG_HREF}?anlass=${anlass}` : NEUER_BEITRAG_HREF
}

/** Die Wörter der Karte und des Anstoßes — Board system-k2-beitraege-v2, Abschnitt 5. */
export const DEIN_BEITRAG_TEXT = {
  titel: 'Dein Beitrag',
  wo: 'steht oben auf deiner Hofseite',
  ansehen: 'Ansehen',
  neu: 'Neuer Beitrag',
  ohneEnde: 'ohne Ende',
  email: (n: number): string => `per E-Mail an ${n}`,
  whatsapp: (n: number): string => `per WhatsApp an ${n} geschickt`,
  anstossTitel: 'Was gibt’s Neues am Hof?',
  anstossSatz: 'Ein kurzer Beitrag steht oben auf deiner Hofseite. Auf Wunsch schickst du ihn auch an deine Abonnenten.',
} as const

/** Der laufende Beitrag für die Karte — Zeitpunkte als ISO-Text, Zahlen nur, die es schon gibt. */
export type DeinBeitrag = {
  id: string
  titel: string
  anlass: BeitragAnlass
  foto: string | null
  /** Ausschnitt und Filter des Fotos (Register N17) — schon geprüft; null = das Foto steht ganz wie heute. Heute zeigt dasselbe wie die Hofseite (Nr. 134). */
  fotoAusschnitt: BildAusschnitt | null
  veroeffentlicht: string
  endet: string | null
  /** An wie viele Abonnentinnen die Mail ging (emailRecipientCount). */
  emailAnzahl: number
  /** Wie viele Personen die WhatsApp geöffnet bekamen (Länge von whatsappGetippt, Register W1). */
  whatsappAnzahl: number
}

const STUNDE_MS = 60 * 60_000

/** „seit 2 Stunden“, „seit 1 Tag“, „seit wenigen Minuten“ — gerechnet mit dem Zeitpunkt der Seite. */
export function seitWannText(veroeffentlicht: string, jetzt: Date): string {
  const stunden = Math.floor((jetzt.getTime() - Date.parse(veroeffentlicht)) / STUNDE_MS)
  if (stunden < 1) return 'seit wenigen Minuten'
  if (stunden < 24) return `seit ${mitAnzahl(stunden, 'Stunde', 'Stunden')}`
  return `seit ${mitAnzahl(Math.floor(stunden / 24), 'Tag', 'Tagen')}`
}

/** „läuft noch 6 Tage“, „läuft noch 3 Stunden“ bzw. „ohne Ende“ — abgerundet, nie mehr versprochen, als bleibt. */
export function laeuftNochText(endet: string | null, jetzt: Date): string {
  if (endet === null) return DEIN_BEITRAG_TEXT.ohneEnde
  const stunden = Math.floor((Date.parse(endet) - jetzt.getTime()) / STUNDE_MS)
  if (stunden < 1) return 'läuft noch unter 1 Stunde'
  if (stunden < 24) return `läuft noch ${mitAnzahl(stunden, 'Stunde', 'Stunden')}`
  return `läuft noch ${mitAnzahl(Math.floor(stunden / 24), 'Tag', 'Tage')}`
}

/** Die Zeile unter dem Titel: „Neue Saison · seit 2 Stunden · läuft noch 6 Tage“. */
export function deinBeitragZeile(beitrag: Pick<DeinBeitrag, 'veroeffentlicht' | 'endet'>, anlassWort: string, jetzt: Date): string {
  return [anlassWort, seitWannText(beitrag.veroeffentlicht, jetzt), laeuftNochText(beitrag.endet, jetzt)].join(' · ')
}

/** E-Mail- und WhatsApp-Zahl — je nur, wenn sie größer als null ist. */
export function versandZeilen(beitrag: Pick<DeinBeitrag, 'emailAnzahl' | 'whatsappAnzahl'>): { art: 'email' | 'whatsapp'; text: string }[] {
  const zeilen: { art: 'email' | 'whatsapp'; text: string }[] = []
  if (beitrag.emailAnzahl > 0) zeilen.push({ art: 'email', text: DEIN_BEITRAG_TEXT.email(beitrag.emailAnzahl) })
  if (beitrag.whatsappAnzahl > 0) zeilen.push({ art: 'whatsapp', text: DEIN_BEITRAG_TEXT.whatsapp(beitrag.whatsappAnzahl) })
  return zeilen
}

/**
 * Was der Block 'beitrag' zeigt: mit laufendem Beitrag (AKTIVER_BEITRAG, also
 * auch „Auf der Hofseite zeigen“ — die Karte sagt „steht oben auf deiner
 * Hofseite“) die Karte; ohne, wenn 14 Tage kein Beitrag veröffentlicht wurde
 * (oder nie) und der Hof Produkte im Shop hat, den Anstoß; sonst nichts.
 * „Nicht jetzt“ entfällt (Freigabe §1, Abweichung 2: bräuchte eine Spalte).
 */
export function beitragBlock(daten: { aktiv: DeinBeitrag | null; beitragInFrist: boolean; produkteImShop: boolean }): 'karte' | 'anstoss' | null {
  if (daten.aktiv) return 'karte'
  return !daten.beitragInFrist && daten.produkteImShop ? 'anstoss' : null
}

/**
 * Steht der Anstoß für einen Beitrag, entfällt in „Braucht dich“ die Erinnerung
 * an einen Beitrag (Register N11, Ergänzung Nr. 134): Es gibt nie zwei
 * Erinnerungen an dieselbe Sache. Zwischen 6 und 14 Tagen ohne Beitrag steht noch
 * kein Anstoß, dort bleibt die Erinnerung, wie sie ist; ebenso neben der Karte
 * mit dem laufenden Beitrag. `brauchtDich` wird in der Abfrage gebaut,
 * `beitragBlock` erst auf der Seite — darum eine eigene Funktion dazwischen.
 */
export function entferneBeitragErinnerung(eintraege: readonly BrauchtDichEintrag[], beitragArt: 'karte' | 'anstoss' | null): BrauchtDichEintrag[] {
  return beitragArt === 'anstoss' ? eintraege.filter((e) => e.art !== 'status') : [...eintraege]
}

/** Die vier Anlässe des Anstoßes als Links auf „Neuer Beitrag“, in der Reihenfolge des Assistenten. */
export function anstossLinks(): { anlass: BeitragAnlass; href: string }[] {
  return BEITRAG_ANLAESSE.map((anlass) => ({ anlass, href: neuerBeitragHref(anlass) }))
}
