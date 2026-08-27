/**
 * Reine Datenlogik der öffentlichen Hofübersicht (/hoefe) — ohne Datenbank
 * und ohne Browser prüfbar (tests/hofuebersicht.test.ts).
 *
 * Hier lebt alles, was die Übersicht aus den Rohdaten der Query macht:
 * Kategorien einsammeln (distinct, ohne null), den nächsten anstehenden
 * Abholtermin bestimmen (wöchentlich wiederkehrende Fenster) und die
 * clientseitige Kategorie-Filterung.
 *
 * ZEITZONE: Die Abholfenster sind österreichische Ortszeiten („14:00"),
 * der Server läuft aber in UTC. Deshalb rechnen die Funktionen nie mit
 * `Date` selbst, sondern bekommen „jetzt" als bereits nach Europe/Vienna
 * aufgelösten Wochentag + Uhrzeit — die Auflösung macht wienJetzt().
 */
import type { ProductCategoryValue } from '@/schemas/product'
import { DAY_NAMES } from '@/lib/pickup-slot-rules'

export type AbholFenster = {
  /** 0=Sonntag … 6=Samstag — wie PickupSlot.dayOfWeek und JS getDay(). */
  dayOfWeek: number
  startTime: string
  endTime: string
}

/** „Jetzt" in österreichischer Ortszeit: Wochentag (0=So) + „HH:MM". */
export type OrtsZeit = { wochentag: number; uhrzeit: string }

/** Löst den Moment in Europe/Vienna auf — der eine unreine Baustein. */
export function wienJetzt(moment: Date = new Date()): OrtsZeit {
  const teile = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Vienna',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(moment)
  const wert = (typ: string) => teile.find((t) => t.type === typ)?.value ?? ''
  const wochentage = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return {
    wochentag: Math.max(0, wochentage.indexOf(wert('weekday'))),
    uhrzeit: `${wert('hour')}:${wert('minute')}`,
  }
}

/** Distinct-Kategorien in der festen Reihenfolge des Produkt-Schemas;
 *  null (keine Angabe) fällt weg. Die Query liefert nur verfügbare Produkte —
 *  hier wird trotzdem noch einmal entdoppelt, Gürtel und Hosenträger. */
export function sammleKategorien(
  produkte: Array<{ category: ProductCategoryValue | null }>,
  reihenfolge: readonly ProductCategoryValue[]
): ProductCategoryValue[] {
  const vorhanden = new Set<ProductCategoryValue>()
  for (const p of produkte) {
    if (p.category) vorhanden.add(p.category)
  }
  return reihenfolge.filter((k) => vorhanden.has(k))
}

export type NaechsteAbholung = AbholFenster & {
  /** 0 = heute, 1 = morgen, … 6; 7 = das heutige Fenster ist schon vorbei
   *  und kommt erst in einer Woche wieder. */
  tageVoraus: number
}

/**
 * Der nächste ANSTEHENDE Abholtermin: Vergangene Fenster werden übersprungen —
 * ein Fenster zählt heute noch, solange sein Ende nicht erreicht ist (wer um
 * 14:30 schaut, kann um 15:00 im 14–16-Fenster abholen). Ohne Fenster: null.
 * „HH:MM"-Strings vergleichen sich lexikografisch korrekt.
 */
export function naechsteAbholung(
  fenster: AbholFenster[],
  jetzt: OrtsZeit
): NaechsteAbholung | null {
  let beste: NaechsteAbholung | null = null
  for (const f of fenster) {
    let tageVoraus = (f.dayOfWeek - jetzt.wochentag + 7) % 7
    if (tageVoraus === 0 && f.endTime <= jetzt.uhrzeit) tageVoraus = 7
    if (
      beste === null ||
      tageVoraus < beste.tageVoraus ||
      (tageVoraus === beste.tageVoraus && f.startTime < beste.startTime)
    ) {
      beste = { ...f, tageVoraus }
    }
  }
  return beste
}

/** „Heute 14:00–16:00", „Morgen …", sonst „Freitag 14:00–16:00". Bei
 *  tageVoraus 7 wäre der nackte Wochentagsname der HEUTIGE — das läse sich
 *  wie das bereits vorbeie Fenster, deshalb ausdrücklich „in einer Woche". */
export function formatiereAbholung(a: NaechsteAbholung): string {
  if (a.tageVoraus === 0) return `Heute ${a.startTime}–${a.endTime}`
  if (a.tageVoraus === 1) return `Morgen ${a.startTime}–${a.endTime}`
  if (a.tageVoraus === 7) return `${DAY_NAMES[a.dayOfWeek]} in einer Woche, ${a.startTime}–${a.endTime}`
  return `${DAY_NAMES[a.dayOfWeek]} ${a.startTime}–${a.endTime}`
}

/** Höchstens so viele Fotos trägt ein Streifen — mehr wäre Ballast im
 *  Payload und niemand blättert weiter. */
export const FOTOSTREIFEN_DECKEL = 5

/**
 * Baut den Fotostreifen einer Hofkarte: Titelbild zuerst (NUR wenn
 * bannerType ein echtes Bild ist — GRADIENT ist Farbe, kein Foto), dann die
 * Galerie (bereits nach sortOrder), dann Produktfotos. Duplikate fallen weg
 * (dasselbe Foto kann Titelbild UND Galerie-Eintrag sein), Deckel bei 5.
 * Ein Hof ohne Fotos bekommt die leere Liste — und behält seine kompakte
 * Karte.
 */
export function baueFotostreifen(eingabe: {
  bannerUrl: string | null
  bannerType: string
  galerie: string[]
  produktFotos: string[]
}): string[] {
  const fotos: string[] = []
  if (eingabe.bannerType === 'PHOTO' && eingabe.bannerUrl) fotos.push(eingabe.bannerUrl)
  fotos.push(...eingabe.galerie, ...eingabe.produktFotos)
  return [...new Set(fotos)].slice(0, FOTOSTREIFEN_DECKEL)
}

/**
 * Kategorie-Filter der Übersicht — Mehrfachauswahl als ODER: Ein Hof bleibt,
 * wenn er MINDESTENS EINE der gewählten Kategorien führt. Leere Auswahl
 * zeigt alle. Rein clientseitig auf den geladenen Daten.
 */
export function filtereHoefe<H extends { kategorien: ProductCategoryValue[] }>(
  hoefe: H[],
  gewaehlt: ProductCategoryValue[]
): H[] {
  if (gewaehlt.length === 0) return hoefe
  const auswahl = new Set(gewaehlt)
  return hoefe.filter((h) => h.kategorien.some((k) => auswahl.has(k)))
}
