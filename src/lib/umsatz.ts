/**
 * DIE Umsatzregel des Hofs — für Heute, Verkauf und Auswertung dieselbe.
 * Rein, ohne Datenbank prüfbar (tests/umsatz.test.ts); die Abfragen dazu
 * stehen in src/server/queries/umsatz.ts.
 *
 * Umsatz eines Zeitraums =
 *   abgeholte Bestellungen, deren Abholzeitpunkt (pickedUpAt) im Zeitraum liegt,
 * + manuelle Verkäufe, deren Wiener Kalendertag im Zeitraum liegt.
 *
 * Manuelle Verkäufe tragen nur einen Tag, keine Uhrzeit (gespeichert um 12:00).
 * Zählten sie nach Zeitpunkt, fehlte ein heute eingetragener Verkauf bis
 * Mittag in „diese Woche" — deshalb zählt bei ihnen der ganze Tag.
 *
 * Tage, Wochen, Monate und Jahre in WIENER Zeit (CODING_STANDARDS §2), Geld
 * in ganzen Cent.
 */
import type { Prisma } from '@prisma/client'
import { tagVersetzt, wienKalendertag, wienWochenMontag } from '@/lib/kalender'
import { wienerMitternacht, centsAlsEuro } from '@/lib/servicegebuehr'
import { formatEuro } from '@/lib/format'
import { CHANNEL_LABELS } from '@/schemas/manual-sale'

export type Periode = 'woche' | 'monat' | 'jahr'

/** Von–bis als UTC-Zeitpunkte, beide Grenzen eingeschlossen. */
export type Umsatzfenster = { von: Date; bis: Date }

// ─── Kalender ───────────────────────────────────────────────────────────────

function mitternacht(kalendertag: string): Date {
  const zeitpunkt = wienerMitternacht(kalendertag)
  // Kann nicht fehlschlagen: Die Tage entstehen hier aus gültigen Tagen.
  if (!zeitpunkt) throw new Error(`Kein gültiger Kalendertag: ${kalendertag}`)
  return zeitpunkt
}

function zerlege(tag: string): { j: number; m: number; t: number } {
  const [j, m, t] = tag.split('-').map(Number)
  return { j, m, t }
}

function tagAus(j: number, m: number, t: number): string {
  return `${String(j).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(t).padStart(2, '0')}`
}

function monatsTage(j: number, m: number): number {
  return new Date(Date.UTC(j, m, 0)).getUTCDate()
}

function monatVersetzt(j: number, m: number, n: number): { j: number; m: number } {
  const index = j * 12 + (m - 1) + n
  return { j: Math.floor(index / 12), m: (((index % 12) + 12) % 12) + 1 }
}

/** Der erste Tag der Periode, in der `tag` liegt. */
export function periodenStart(periode: Periode, tag: string): string {
  const { j, m } = zerlege(tag)
  // Wiener Mitternacht liegt sicher im Wiener Tag — der vorhandene Wochenhelfer entscheidet.
  if (periode === 'woche') return wienWochenMontag(mitternacht(tag))
  if (periode === 'monat') return tagAus(j, m, 1)
  return tagAus(j, 1, 1)
}

/** Der Start der Periode `n` Perioden nach (oder vor) `startTag`. */
function periodeVersetzt(periode: Periode, startTag: string, n: number): string {
  const { j, m } = zerlege(startTag)
  if (periode === 'woche') return tagVersetzt(startTag, 7 * n)
  if (periode === 'monat') {
    const ziel = monatVersetzt(j, m, n)
    return tagAus(ziel.j, ziel.m, 1)
  }
  return tagAus(j + n, 1, 1)
}

function ganzePeriode(periode: Periode, startTag: string): Umsatzfenster {
  return {
    von: mitternacht(startTag),
    bis: new Date(mitternacht(periodeVersetzt(periode, startTag, 1)).getTime() - 1),
  }
}

/**
 * Derselbe Tag eine Periode früher: eine Woche, ein Monat, ein Jahr zurück.
 * Gibt es ihn nicht (31. März → Februar, 29. Februar → Vorjahr), gilt der
 * letzte Tag davor — und zwar ganz (`ganzerTag`).
 */
function gleicherTagDavor(periode: Periode, heute: string): { tag: string; ganzerTag: boolean } {
  if (periode === 'woche') return { tag: tagVersetzt(heute, -7), ganzerTag: false }
  const { j, m, t } = zerlege(heute)
  const ziel = periode === 'monat' ? monatVersetzt(j, m, -1) : { j: j - 1, m }
  const letzter = monatsTage(ziel.j, ziel.m)
  return t > letzter
    ? { tag: tagAus(ziel.j, ziel.m, letzter), ganzerTag: true }
    : { tag: tagAus(ziel.j, ziel.m, t), ganzerTag: false }
}

export type Periodenfenster = {
  periode: Periode
  /** 0 = die laufende Periode, 1 = die davor, … */
  zurueck: number
  /** Heute in Wien, JJJJ-MM-TT. */
  heute: string
  startTag: string
  vergleichStartTag: string
  /** Läuft die Periode noch? Dann endet `aktuell` jetzt. */
  laufend: boolean
  /** Was gezählt wird — laufend bis jetzt, sonst die ganze Periode. */
  aktuell: Umsatzfenster
  /** Der faire Vergleich: laufend bis zum selben Zeitpunkt der Vorperiode, sonst die ganze Vorperiode. */
  vergleich: Umsatzfenster
  /** Die ganze Periode und die ganze Vorperiode — für die Balken. */
  aktuellGanz: Umsatzfenster
  vergleichGanz: Umsatzfenster
}

/**
 * Das Fenster einer Periode samt fairem Vergleich. Die laufende Periode
 * zählt bis jetzt und wird mit der Vorperiode bis zum selben Tag und zur
 * selben Uhrzeit verglichen — sonst stünde am Dienstag eine halbe Woche gegen
 * eine ganze. „Selbe Uhrzeit" ist die Zeit seit Wiener Mitternacht; nur an den
 * zwei Tagen der Zeitumstellung weicht das um eine Stunde von der Wanduhr ab.
 * Am 25-Stunden-Sonntag reichte die Vorwoche sonst in die laufende hinein —
 * deshalb endet der Vergleich spätestens dort, wo die Periode beginnt.
 */
export function umsatzfenster(periode: Periode, jetzt: Date, zurueck = 0): Periodenfenster {
  const heute = wienKalendertag(jetzt)
  const startTag = periodeVersetzt(periode, periodenStart(periode, heute), -zurueck)
  const vergleichStartTag = periodeVersetzt(periode, startTag, -1)
  const aktuellGanz = ganzePeriode(periode, startTag)
  const vergleichGanz = ganzePeriode(periode, vergleichStartTag)
  const basis = { periode, zurueck, heute, startTag, vergleichStartTag, aktuellGanz, vergleichGanz }

  if (zurueck > 0) {
    return { ...basis, laufend: false, aktuell: aktuellGanz, vergleich: vergleichGanz }
  }

  const seitMitternacht = jetzt.getTime() - mitternacht(heute).getTime()
  const gleich = gleicherTagDavor(periode, heute)
  const bisRoh = gleich.ganzerTag
    ? mitternacht(tagVersetzt(gleich.tag, 1)).getTime() - 1
    : mitternacht(gleich.tag).getTime() + seitMitternacht
  return {
    ...basis,
    laufend: true,
    aktuell: { von: aktuellGanz.von, bis: jetzt },
    vergleich: { von: vergleichGanz.von, bis: new Date(Math.min(bisRoh, vergleichGanz.bis.getTime())) },
  }
}

// ─── Zählregel ──────────────────────────────────────────────────────────────

/** Abgeholte Bestellungen zählen nach ihrem Abholzeitpunkt. */
export function zaehltBestellung(pickedUpAt: Date, fenster: Umsatzfenster): boolean {
  return pickedUpAt >= fenster.von && pickedUpAt <= fenster.bis
}

/** Manuelle Verkäufe zählen nach ihrem Wiener Kalendertag — der ganze Tag gehört dazu. */
export function zaehltVerkauf(saleDate: Date, fenster: Umsatzfenster): boolean {
  const tag = wienKalendertag(saleDate)
  return tag >= wienKalendertag(fenster.von) && tag <= wienKalendertag(fenster.bis)
}

/** Dieselbe Regel als Bedingung für die Datenbank. */
export function umsatzBestellungWhere(farmId: string, fenster: Umsatzfenster): Prisma.OrderWhereInput {
  return { farmId, status: 'PICKED_UP', pickedUpAt: { gte: fenster.von, lte: fenster.bis } }
}

export function umsatzVerkaufWhere(farmId: string, fenster: Umsatzfenster): Prisma.ManualSaleWhereInput {
  return {
    farmId,
    saleDate: {
      gte: mitternacht(wienKalendertag(fenster.von)),
      lt: mitternacht(tagVersetzt(wienKalendertag(fenster.bis), 1)),
    },
  }
}

export type UmsatzBuchung =
  | { quelle: 'bestellung'; zeitpunkt: Date; cent: number }
  | { quelle: 'verkauf'; zeitpunkt: Date; cent: number; kanal: string }

export function zaehlt(buchung: UmsatzBuchung, fenster: Umsatzfenster): boolean {
  return buchung.quelle === 'bestellung'
    ? zaehltBestellung(buchung.zeitpunkt, fenster)
    : zaehltVerkauf(buchung.zeitpunkt, fenster)
}

export function summeCent(buchungen: UmsatzBuchung[], fenster: Umsatzfenster): number {
  return buchungen.reduce((summe, b) => (zaehlt(b, fenster) ? summe + b.cent : summe), 0)
}

/** Der Kanal einer Buchung — Bestellungen laufen über die Plattform. */
export function kanalVon(buchung: UmsatzBuchung): string {
  return buchung.quelle === 'bestellung' ? 'PLATFORM' : buchung.kanal
}

// ─── Balken ─────────────────────────────────────────────────────────────────

export type Eimer = { label: string; vonTag: string; bisTag: string }

const WOCHENTAGE_KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
// Österreichisch: Jänner. Kurz und ohne Punkt, damit zwölf Beschriftungen auf 375 px passen.
const MONATE_KURZ = ['Jän', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

/**
 * Die Balken einer Periode: Woche → sieben Tage, Monat → fünf Abschnitte nach
 * Tag im Monat (1.–7., 8.–14., …, ab 29.), Jahr → zwölf Monate. Der Monat
 * geht nach Tag im Monat, nicht nach Kalenderwoche — so steht der 8.–14.
 * September neben dem 8.–14. August, und jeder Monat hat dieselben Balken.
 */
export function eimerDerPeriode(periode: Periode, startTag: string): Eimer[] {
  const { j, m } = zerlege(startTag)
  if (periode === 'woche') {
    return WOCHENTAGE_KURZ.map((label, i) => {
      const tag = tagVersetzt(startTag, i)
      return { label, vonTag: tag, bisTag: tag }
    })
  }
  if (periode === 'monat') {
    const letzter = monatsTage(j, m)
    return [1, 8, 15, 22, 29].map((von) => {
      const bis = von === 29 ? letzter : von + 6
      return {
        label: von === 29 ? 'ab 29.' : `${von}.–${bis}.`,
        vonTag: tagAus(j, m, Math.min(von, letzter)),
        // Im Februar ohne Schalttag bleibt „ab 29." leer: vonTag > bisTag.
        bisTag: von > letzter ? tagAus(j, m, letzter - 1) : tagAus(j, m, bis),
      }
    })
  }
  return MONATE_KURZ.map((label, i) => ({
    label,
    vonTag: tagAus(j, i + 1, 1),
    bisTag: tagAus(j, i + 1, monatsTage(j, i + 1)),
  }))
}

function eimerIndex(eimer: Eimer[], tag: string): number {
  return eimer.findIndex((e) => tag >= e.vonTag && tag <= e.bisTag)
}

// ─── Auswertung ─────────────────────────────────────────────────────────────

export type KanalAnteil = { kanal: string; label: string; cent: number; anteilProzent: number }
export type Balken = { label: string; cent: number; vergleichCent: number }

export type Auswertung = {
  summeCent: number
  vergleichCent: number
  balken: Balken[]
  kanaele: KanalAnteil[]
  /** Umsatz je Tag (Woche, Monat) bzw. je Monat JJJJ-MM (Jahr) — für die Einsicht. */
  spitzen: { schluessel: string; cent: number }[]
}

export function auswerten(buchungen: UmsatzBuchung[], pf: Periodenfenster): Auswertung {
  const eimer = eimerDerPeriode(pf.periode, pf.startTag)
  const vergleichEimer = eimerDerPeriode(pf.periode, pf.vergleichStartTag)
  const balken: Balken[] = eimer.map((e) => ({ label: e.label, cent: 0, vergleichCent: 0 }))
  const kanalCent = new Map<string, number>()
  const spitzen = new Map<string, number>()

  for (const b of buchungen) {
    const tag = wienKalendertag(b.zeitpunkt)
    if (zaehlt(b, pf.aktuell)) {
      const i = eimerIndex(eimer, tag)
      if (i >= 0) balken[i].cent += b.cent
      const kanal = kanalVon(b)
      kanalCent.set(kanal, (kanalCent.get(kanal) ?? 0) + b.cent)
      const schluessel = pf.periode === 'jahr' ? tag.slice(0, 7) : tag
      spitzen.set(schluessel, (spitzen.get(schluessel) ?? 0) + b.cent)
    }
    // Die blassen Balken zeigen die GANZE Vorperiode — als Rahmen, wohin es
    // gehen kann. Die Zahl oben vergleicht fair bis zum selben Zeitpunkt.
    if (zaehlt(b, pf.vergleichGanz)) {
      const i = eimerIndex(vergleichEimer, tag)
      if (i >= 0) balken[i].vergleichCent += b.cent
    }
  }

  const summe = [...kanalCent.values()].reduce((s, c) => s + c, 0)
  const kanaele = [...kanalCent.entries()]
    .map(([kanal, cent]) => ({
      kanal,
      label: CHANNEL_LABELS[kanal] ?? kanal,
      cent,
      anteilProzent: summe > 0 ? Math.round((cent * 100) / summe) : 0,
    }))
    .sort((a, b) => b.cent - a.cent || a.label.localeCompare(b.label, 'de'))

  return {
    summeCent: summe,
    vergleichCent: summeCent(buchungen, pf.vergleich),
    balken,
    kanaele,
    spitzen: [...spitzen.entries()]
      .map(([schluessel, cent]) => ({ schluessel, cent }))
      .sort((a, b) => a.schluessel.localeCompare(b.schluessel)),
  }
}

// ─── Sätze ──────────────────────────────────────────────────────────────────

function datumAusTag(tag: string): Date {
  const { j, m, t } = zerlege(tag)
  return new Date(Date.UTC(j, m - 1, t, 12))
}

function monatsname(tag: string): string {
  return new Intl.DateTimeFormat('de-AT', { month: 'long', timeZone: 'UTC' }).format(datumAusTag(tag))
}

/** „Diese Woche", „Letzte Woche", „14.–20. Sep", „September 2026", „2026". */
export function zeitraumName(pf: Periodenfenster): string {
  const { j } = zerlege(pf.startTag)
  if (pf.periode === 'jahr') return String(j)
  if (pf.periode === 'monat') return `${monatsname(pf.startTag)} ${j}`
  if (pf.zurueck === 0) return 'Diese Woche'
  if (pf.zurueck === 1) return 'Letzte Woche'
  const ende = tagVersetzt(pf.startTag, 6)
  // Feste Kürzel statt Intl: je nach ICU-Stand käme „Sep" oder „Sep." heraus.
  const kurz = (tag: string) => MONATE_KURZ[zerlege(tag).m - 1]
  const a = zerlege(pf.startTag)
  const b = zerlege(ende)
  const jahr = b.j !== zerlege(pf.heute).j ? ` ${b.j}` : ''
  return a.m === b.m
    ? `${a.t}.–${b.t}. ${kurz(ende)}${jahr}`
    : `${a.t}. ${kurz(pf.startTag)} – ${b.t}. ${kurz(ende)}${jahr}`
}

/** Kurzname der Vorperiode für die Legende der blassen Balken: „Woche davor", „August", „2025". */
export function vergleichLabel(pf: Periodenfenster): string {
  if (pf.periode === 'woche') return 'Woche davor'
  if (pf.periode === 'monat') return monatsname(pf.vergleichStartTag)
  return String(zerlege(pf.vergleichStartTag).j)
}

function vergleichName(pf: Periodenfenster): string {
  if (pf.periode === 'woche') return pf.laufend ? 'letzte Woche' : 'in der Woche davor'
  if (pf.periode === 'monat') return `im ${monatsname(pf.vergleichStartTag)}`
  return String(zerlege(pf.vergleichStartTag).j)
}

const OHNE_VERGLEICH: Record<Periode, string> = {
  woche: 'Noch keine Vorwoche zum Vergleich',
  monat: 'Noch kein Vormonat zum Vergleich',
  jahr: 'Noch kein Vorjahr zum Vergleich',
}

export type Vergleichssatz = { richtung: 'mehr' | 'weniger' | 'gleich' | 'keiner'; text: string }

/** „▲ 12 % mehr als im August" — gegen die Vorperiode bis zum selben Zeitpunkt. */
export function vergleichssatz(pf: Periodenfenster, summe: number, vergleich: number): Vergleichssatz {
  if (vergleich <= 0) return { richtung: 'keiner', text: OHNE_VERGLEICH[pf.periode] }
  const name = vergleichName(pf)
  if (summe === vergleich) return { richtung: 'gleich', text: `Genauso viel wie ${name}` }
  const prozent = Math.round((Math.abs(summe - vergleich) * 100) / vergleich)
  if (prozent === 0) return { richtung: 'gleich', text: `Etwa gleich viel wie ${name}` }
  return summe > vergleich
    ? { richtung: 'mehr', text: `▲ ${prozent} % mehr als ${name}` }
    : { richtung: 'weniger', text: `▼ ${prozent} % weniger als ${name}` }
}

const KANAL_UEBER: Record<string, string> = {
  PLATFORM: 'die Plattform',
  HOFLADEN: 'den Hofladen',
  MARKT: 'den Markt',
  WHATSAPP: 'WhatsApp',
  BUSINESS: 'Geschäftskunden',
  OTHER: 'sonstige Wege',
}

function spitzenName(periode: Periode, schluessel: string): string {
  if (periode === 'jahr') return `der stärkste Monat war der ${monatsname(`${schluessel}-01`)}`
  if (periode === 'woche') {
    const tag = new Intl.DateTimeFormat('de-AT', { weekday: 'long', timeZone: 'UTC' }).format(datumAusTag(schluessel))
    return `der stärkste Tag war der ${tag}`
  }
  return `der stärkste Tag war der ${zerlege(schluessel).t}. ${monatsname(schluessel)}`
}

/**
 * Ein Satz, was auffällt — regelbasiert: der stärkste Kanal mit Anteil, dazu
 * der beste Tag (Woche, Monat) bzw. Monat (Jahr). Den besten Tag nennt er nur,
 * wenn es mindestens zwei Tage mit Umsatz gab — sonst wäre er kein Befund.
 */
export function einsichtSatz(periode: Periode, auswertung: Pick<Auswertung, 'summeCent' | 'kanaele' | 'spitzen'>): string | null {
  const { summeCent: summe, kanaele, spitzen } = auswertung
  if (summe <= 0 || kanaele.length === 0) return null
  const staerkster = kanaele[0]
  const ueber = KANAL_UEBER[staerkster.kanal] ?? staerkster.label
  const kanalTeil =
    kanaele.length === 1 ? `Alles kam über ${ueber}` : `Am meisten kam über ${ueber} (${staerkster.anteilProzent} %)`

  const mitUmsatz = spitzen.filter((s) => s.cent > 0)
  if (mitUmsatz.length < 2) return `${kanalTeil}.`
  // Bei Gleichstand der frühere — die Liste ist nach Tag sortiert.
  const beste = mitUmsatz.reduce((a, b) => (b.cent > a.cent ? b : a))
  return `${kanalTeil}, ${spitzenName(periode, beste.schluessel)} mit ${formatEuro(centsAlsEuro(beste.cent))}.`
}

// ─── Top-Produkte ───────────────────────────────────────────────────────────

/** Name, unter dem ein Verkauf ohne Produktangabe gespeichert wird (productName ist Pflicht im Schema). */
export const OHNE_PRODUKT = 'Ohne Angabe'

export type ProduktPosten = {
  /** productId, bei freiem Namen der Name selbst. */
  schluessel: string
  name: string
  cent: number
  /** In der Grundeinheit des Produkts (kg, Stück, …) — Anzeige, keine Abrechnung. */
  menge: number
  einheit: string | null
}

export type TopProdukt = { name: string; cent: number; menge: number; einheit: string | null }

export function topProdukte(posten: ProduktPosten[], anzahl = 3): TopProdukt[] {
  const gruppen = new Map<string, TopProdukt>()
  for (const p of posten) {
    const bisher = gruppen.get(p.schluessel)
    gruppen.set(p.schluessel, {
      name: bisher?.name ?? p.name,
      cent: (bisher?.cent ?? 0) + p.cent,
      menge: (bisher?.menge ?? 0) + p.menge,
      einheit: bisher?.einheit ?? p.einheit,
    })
  }
  return [...gruppen.values()]
    .sort((a, b) => b.cent - a.cent || a.name.localeCompare(b.name, 'de'))
    .slice(0, anzahl)
}
