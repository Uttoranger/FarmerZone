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

// ─── Umkreis: Entfernung, Sortierung, Stufen ────────────────────────────────
//
// DATENSPARSAMKEIT (nicht verhandelbar): Der Gerätestandort wird NIEMALS an
// einen Server geschickt — weder an uns noch an Dritte. Alles hier ist reine
// Rechnerei, die der BROWSER auf den ohnehin geladenen Hofkoordinaten
// ausführt. Nur die Postleitzahl-Variante schickt die EINGETIPPTE Eingabe an
// Nominatim (src/lib/geokodierung.ts, sucheOrtspunkt) — nie eine gemessene
// Position.

/** Der Bezugspunkt der Umkreissuche: eigener Standort oder aufgelöste PLZ. */
export type Bezugspunkt = { lat: number; lon: number; name?: string }

/** Die Stufen des Umkreis-Reglers. `null` = „egal" (Voreinstellung: Bei
 *  wenigen Höfen darf nichts versteckt werden). */
export type UmkreisStufe = 10 | 25 | 50 | null

export const UMKREIS_STUFEN: UmkreisStufe[] = [10, 25, 50, null]

const ERDRADIUS_KM = 6371

/**
 * Entfernung zweier Punkte auf der Kugel (Haversine) in Kilometern.
 * Für Österreich-Distanzen mehr als genau genug — und ohne Netz prüfbar.
 */
export function entfernungKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number {
  const bogen = (grad: number) => (grad * Math.PI) / 180
  const dLat = bogen(b.lat - a.lat)
  const dLon = bogen(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(bogen(a.lat)) * Math.cos(bogen(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * ERDRADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * „unter 0,1 km" · „0,4 km" · „1,3 km" · „12 km" · „143 km": Unter zehn
 * Kilometern zählt die erste Nachkommastelle, darüber wäre sie
 * Scheingenauigkeit (die Luftlinie ist ohnehin nicht der Fahrweg).
 *
 * Gerundet wird VOR der Entscheidung über die Darstellung — sonst stünde
 * 9,97 km als „10,0 km" da, direkt neben einem „10 km" für glatte zehn.
 * Und unter hundert Metern ist „0,0 km" keine Aussage, sondern ein Fehler
 * im Text.
 */
export function formatiereEntfernung(km: number): string {
  if (km < 0.1) return 'unter 0,1 km'
  const aufEineStelle = Math.round(km * 10) / 10
  if (aufEineStelle < 10) return `${aufEineStelle.toFixed(1).replace('.', ',')} km`
  return `${Math.round(km)} km`
}

/** Ein Hof mit berechneter Entfernung — null, wenn er (noch) keinen
 *  Kartenpunkt hat oder es keinen Bezugspunkt gibt. */
export type MitEntfernung<H> = H & { entfernungKm: number | null }

/**
 * Ordnet die Höfe nach Entfernung zum Bezugspunkt und wendet die
 * Umkreisstufe an.
 *
 * HÖFE OHNE KOORDINATEN stehen IMMER am Ende und werden von der
 * Umkreisgrenze NIE ausgeschlossen: Sie sind nicht weit weg, sie sind
 * unbekannt — ein Hof, der seinen Kartenpunkt noch nicht gesetzt hat, darf
 * dadurch nicht unsichtbar werden.
 *
 * Ohne Bezugspunkt bleibt die Reihenfolge unangetastet (Freischalt-
 * Reihenfolge der Query) und jede Entfernung ist null.
 */
export function ordneNachEntfernung<H extends { latitude: number | null; longitude: number | null }>(
  hoefe: H[],
  punkt: Bezugspunkt | null,
  stufe: UmkreisStufe = null
): MitEntfernung<H>[] {
  if (!punkt) return hoefe.map((hof) => ({ ...hof, entfernungKm: null }))

  const mitMass = hoefe.map((hof) => {
    // Number.isFinite statt bloßer null-Prüfung: latitude und longitude sind
    // unabhängig nullbar, und `double precision` kennt NaN/Infinity. Ein
    // einziger solcher Wert machte sonst die GANZE Sortierung unbrauchbar
    // (ein NaN-Vergleich liest sich für sort wie „gleich"). Unbrauchbare
    // Koordinaten zählen wie fehlende: ans Ende, nie ausgeschlossen.
    const brauchbar = Number.isFinite(hof.latitude) && Number.isFinite(hof.longitude)
    return {
      ...hof,
      entfernungKm: brauchbar
        ? entfernungKm(punkt, { lat: hof.latitude as number, lon: hof.longitude as number })
        : null,
    }
  })

  const imUmkreis =
    stufe === null
      ? mitMass
      : mitMass.filter((hof) => hof.entfernungKm === null || hof.entfernungKm <= stufe)

  return [...imUmkreis].sort((a, b) => {
    if (a.entfernungKm === null) return b.entfernungKm === null ? 0 : 1
    if (b.entfernungKm === null) return -1
    return a.entfernungKm - b.entfernungKm
  })
}
