/**
 * Geokodierung der Hofadresse — serverseitig, nie aus dem Browser.
 *
 * Dienst: Nominatim (nominatim.openstreetmap.org) in BEIDE Richtungen:
 * - VORWÄRTS mit STRUKTURIERTER Abfrage (street, postalcode, city, country)
 *   statt Freitext: Die strukturierte Abfrage ankert österreichische
 *   Weiler-Adressen ohne Straßennamen über die Postleitzahl — vom Betreiber
 *   bereits erfolgreich gegen eine echte Weiler-Adresse geprüft.
 * - RÜCKWÄRTS (/reverse, zoom=18): Der geschobene Kartenpunkt wird zu
 *   Adressfeldern — die Karte im Hofprofil arbeitet in beide Richtungen.
 *
 * Pflichten laut Nominatim-Nutzungsbedingungen, hier eingehalten:
 * - aussagekräftiger User-Agent mit Kontaktadresse der Plattform
 *   (SUPPORT_EMAIL aus src/lib/support.ts — nichts neu erfunden),
 * - HÖCHSTENS EINE ANFRAGE PRO SEKUNDE: Vorwärts ist das ein Klick auf
 *   „Auf der Karte suchen" je Hof, mit maximal zwei aufeinander folgenden
 *   Anfragen (Kaskade) — weit unter der Grenze. Die Rückwärtssuche beim
 *   Kartenschieben MUSS über erstelleKartenBremse laufen (Anfrage erst nach
 *   1,2 s Ruhe und nur bei >~25 m Bewegung) — damit liegen auch dort immer
 *   mindestens 1,2 s zwischen zwei Anfragen.
 * - Timeout 5 s.
 *
 * DREISTUFIGE KASKADE vorwärts, und in KEINEM Fall eine Fehlermeldung — es
 * erscheint immer eine bedienbare Karte (ländliche Adressen scheitern oft,
 * der Bauer setzt den Punkt dann selbst):
 *   1. street+postalcode+city  → Zoom 17, „Adresse gefunden"-Hinweis
 *   2. nur postalcode+city     → Zoom 14, „selbst schieben"-Hinweis
 *   3. fester Punkt (48.1/13.5) → Zoom 8,  derselbe Hinweis
 *
 * Reine Auswertung und injizierbare Lader, damit Kaskade, Rückwärts-Übernahme
 * und Bremse ohne Netz prüfbar sind (tests/hof-standort.test.ts,
 * tests/standort-rueckwaerts.test.ts).
 */
import { SUPPORT_EMAIL } from '@/lib/support'

export type StandortKandidat = {
  lat: number
  lon: number
  anzeigeName: string
}

export type GeokodierungsErgebnis = {
  /** Bis zu drei Kandidaten aus Stufe 1 — leer ab Stufe 2. */
  kandidaten: StandortKandidat[]
  /** Wo die Karte öffnet. */
  zentrum: { lat: number; lon: number }
  stufe: 'adresse' | 'ort' | 'rueckfall'
  zoom: 17 | 14 | 8
  /** Der Hinweistext über der Karte — je Stufe ein eigener. */
  hinweis: string
}

export const HINWEIS_ADRESSE_GEFUNDEN =
  'Wir haben deine Adresse gefunden — liegt der Punkt auf deiner Hofeinfahrt?'
export const HINWEIS_SELBST_SETZEN =
  'Wir konnten die genaue Adresse nicht finden — schieb die Karte auf deine Hofeinfahrt.'
/** Startansicht der eingebetteten Karte, solange kein Punkt gespeichert ist. */
export const HINWEIS_KARTE_OHNE_PUNKT =
  'Schreib deine Adresse oben hinein — oder schieb die Karte gleich auf deine Hofeinfahrt.'
/** Die ruhige Zeile nach einer Rückwärts-Übernahme. */
export const HINWEIS_ADRESSE_UEBERNOMMEN =
  'Adresse vom Kartenpunkt übernommen — du kannst sie anpassen.'

/** Fester Rückfallpunkt der Stufe 3 (Oberösterreich). */
export const RUECKFALL_PUNKT = { lat: 48.1, lon: 13.5 }

/** Grobe Österreich-Schachtel für die Plausibilisierung gespeicherter Punkte.
 *  Bewusst grob (streift Nachbarländer) — sie fängt Vertipper und
 *  Datenmüll, keine Grenzverläufe. */
export const OESTERREICH_GRENZEN = {
  latMin: 46,
  latMax: 49.1,
  lonMin: 9.5,
  lonMax: 17.2,
}

export function istInOesterreich(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false
  const g = OESTERREICH_GRENZEN
  return lat >= g.latMin && lat <= g.latMax && lon >= g.lonMin && lon <= g.lonMax
}

/** Sechs Nachkommastellen ≈ 11 cm — mehr Genauigkeit gäbe der Karte nur Rauschen. */
export function rundeKoordinate(wert: number): number {
  return Math.round(wert * 1_000_000) / 1_000_000
}

/**
 * Wertet eine Nominatim-Antwort (format=jsonv2: Array von Treffern) aus.
 * lat/lon kommen dort als STRINGS — wer das vergisst, rechnet mit NaN.
 * Höchstens drei, in Antwort-Reihenfolge (Nominatim sortiert nach Güte).
 */
export function werteNominatimAntwortAus(json: unknown): StandortKandidat[] {
  if (!Array.isArray(json)) return []

  const kandidaten: StandortKandidat[] = []
  for (const eintrag of json) {
    if (kandidaten.length >= 3) break
    const e = eintrag as { lat?: unknown; lon?: unknown; display_name?: unknown }
    const lat = typeof e.lat === 'string' ? Number.parseFloat(e.lat) : NaN
    const lon = typeof e.lon === 'string' ? Number.parseFloat(e.lon) : NaN
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    kandidaten.push({
      lat,
      lon,
      anzeigeName: typeof e.display_name === 'string' && e.display_name ? e.display_name : 'Gefundener Ort',
    })
  }
  return kandidaten
}

/** Lädt eine strukturierte Nominatim-Suche — der eine unreine Baustein, injizierbar. */
export type NominatimLader = (parameter: Record<string, string>) => Promise<unknown>

const NOMINATIM_TIMEOUT_MS = 5_000

/** Der gemeinsame Netz-Baustein beider Richtungen: User-Agent mit
 *  Kontaktadresse und 5-s-Zeitlimit laut Nutzungsbedingungen. */
async function frageNominatim(
  pfad: '/search' | '/reverse',
  parameter: Record<string, string>
): Promise<unknown> {
  const url = new URL(`https://nominatim.openstreetmap.org${pfad}`)
  url.search = new URLSearchParams(parameter).toString()

  const antwort = await fetch(url, {
    headers: {
      'User-Agent': `FarmerZone/1.0 (https://farmerzone.at; ${SUPPORT_EMAIL})`,
    },
    signal: AbortSignal.timeout(NOMINATIM_TIMEOUT_MS),
  })
  if (!antwort.ok) throw new Error(`Nominatim antwortet ${antwort.status}`)
  return antwort.json()
}

async function ladeNominatim(parameter: Record<string, string>): Promise<unknown> {
  return frageNominatim('/search', {
    ...parameter,
    format: 'jsonv2',
    limit: '3',
    addressdetails: '1',
  })
}

/**
 * Löst eine EINGETIPPTE Postleitzahl oder einen Ortsnamen zum Kartenpunkt
 * auf — der Bezugspunkt der Umkreissuche auf /hoefe.
 *
 * Bewusst DIESELBE strukturierte Anbindung wie die Hof-Geokodierung (kein
 * zweiter Netzweg): country=at, und je nach Eingabe postalcode ODER city —
 * eine vierstellige Zahl ist in Österreich eine PLZ, alles andere ein Ort.
 * Straße wird nie mitgeschickt: Gesucht ist die Gegend, nicht die Adresse.
 *
 * DATENSPARSAMKEIT: Hier geht ausschließlich die getippte Eingabe hinaus —
 * NIEMALS eine vom Gerät gemessene Position (src/lib/hofuebersicht.ts).
 *
 * Wirft NIE: leere Antwort, Zeitüberschreitung und Dienststörung liefern
 * gleichermaßen null, die Liste bleibt dann unverändert.
 */
export async function sucheOrtspunkt(
  eingabe: string,
  lade: NominatimLader = ladeNominatim
): Promise<StandortKandidat | null> {
  const text = eingabe.trim()
  if (text.length < 2) return null

  const istPlz = /^\d{4}$/.test(text)
  try {
    const treffer = werteNominatimAntwortAus(
      await lade({ [istPlz ? 'postalcode' : 'city']: text, country: 'at' })
    )
    return treffer[0] ?? null
  } catch {
    return null
  }
}

/**
 * Die dreistufige Kaskade (siehe Kopfkommentar). Wirft NIE — jedes Scheitern
 * (leere Antwort, Zeitüberschreitung, Dienststörung) führt zur nächsten,
 * gröberen Stufe, nie zu einer Fehlermeldung.
 */
export async function geokodiereAdresse(
  adresse: { address: string; postalCode: string; city: string },
  lade: NominatimLader = ladeNominatim
): Promise<GeokodierungsErgebnis> {
  try {
    const kandidaten = werteNominatimAntwortAus(
      await lade({
        street: adresse.address,
        postalcode: adresse.postalCode,
        city: adresse.city,
        country: 'at',
      })
    )
    if (kandidaten.length > 0) {
      return {
        kandidaten,
        zentrum: { lat: kandidaten[0].lat, lon: kandidaten[0].lon },
        stufe: 'adresse',
        zoom: 17,
        hinweis: HINWEIS_ADRESSE_GEFUNDEN,
      }
    }
  } catch {
    // Zeitüberschreitung oder Dienststörung — weiter zur Orts-Stufe.
  }

  try {
    const ortsTreffer = werteNominatimAntwortAus(
      await lade({ postalcode: adresse.postalCode, city: adresse.city, country: 'at' })
    )
    if (ortsTreffer.length > 0) {
      return {
        kandidaten: [],
        zentrum: { lat: ortsTreffer[0].lat, lon: ortsTreffer[0].lon },
        stufe: 'ort',
        zoom: 14,
        hinweis: HINWEIS_SELBST_SETZEN,
      }
    }
  } catch {
    // Auch das scheiterte — der feste Punkt bleibt.
  }

  return {
    kandidaten: [],
    zentrum: RUECKFALL_PUNKT,
    stufe: 'rueckfall',
    zoom: 8,
    hinweis: HINWEIS_SELBST_SETZEN,
  }
}

// ─── Rückwärts: Kartenpunkt → Adressfelder ──────────────────────────────────

/** Was die Rückwärtssuche liefert — ausschließlich Felder mit tatsächlichem Wert. */
export type RueckwaertsAdresse = {
  strasse?: string
  hausnummer?: string
  plz?: string
  ort?: string
}

/**
 * Wertet eine /reverse-Antwort (format=jsonv2: EIN Objekt mit `address`) aus.
 * null heißt: nichts Brauchbares — auch bei Nominatims eigenem
 * `{"error": "Unable to geocode"}` mitten im Meer.
 */
export function werteRueckwaertsAntwortAus(json: unknown): RueckwaertsAdresse | null {
  if (typeof json !== 'object' || json === null) return null
  const adresse = (json as { address?: unknown }).address
  if (typeof adresse !== 'object' || adresse === null) return null
  const a = adresse as Record<string, unknown>

  const text = (wert: unknown): string | undefined =>
    typeof wert === 'string' && wert.trim() ? wert.trim() : undefined

  const ergebnis: RueckwaertsAdresse = {
    strasse: text(a.road),
    hausnummer: text(a.house_number),
    plz: text(a.postcode),
    // Die feinste vorhandene Orts-Stufe gewinnt — auf dem Land ist das
    // meist `village`, notfalls die Gemeinde.
    ort: text(a.village) ?? text(a.town) ?? text(a.city) ?? text(a.municipality),
  }
  return Object.values(ergebnis).some((wert) => wert !== undefined) ? ergebnis : null
}

/**
 * ÜBERNAHME-REGEL (kritisch): Das Rückwärts-Ergebnis füllt NUR Felder, für
 * die es einen tatsächlichen Wert hat — ein ausgefülltes Feld wird NIE mit
 * einem leeren Wert überschrieben. Die ländliche Rückwärtssuche liefert oft
 * keine Hausnummer; die von Hand eingetragene bleibt dann stehen, denn die
 * Adresse steht öffentlich auf der Hofseite, und eine verschwundene
 * Hausnummer fiele erst den Kundinnen auf.
 */
export function uebernehmeAdresse(
  bisher: { address: string; postalCode: string; city: string },
  punkt: RueckwaertsAdresse
): { address: string; postalCode: string; city: string } {
  let address = bisher.address
  if (punkt.strasse) {
    // Ohne Straße bleibt das Adressfeld ganz unangetastet — eine nackte
    // Hausnummer wäre kein tatsächlicher Wert.
    const hausnummer = punkt.hausnummer ?? extrahiereHausnummer(bisher.address)
    address = hausnummer ? `${punkt.strasse} ${hausnummer}` : punkt.strasse
  }
  return {
    address,
    postalCode: punkt.plz ?? bisher.postalCode,
    city: punkt.ort ?? bisher.city,
  }
}

/** Die abschließende Hausnummer aus „Dorfstraße 12a" oder „Hofmark 3/1" —
 *  das letzte Wort, sofern es mit einer Ziffer beginnt. */
function extrahiereHausnummer(address: string): string | undefined {
  const treffer = address.trim().match(/(\d[\w/-]*)$/)
  return treffer ? treffer[1] : undefined
}

/** Lädt eine Rückwärtssuche zum Kartenpunkt — ebenfalls injizierbar. Bewusst
 *  eine EIGENE Lader-Gestalt: Die Vorwärts-Signatur (NominatimLader) bleibt
 *  unverändert, samt der Tests, die auf ihr fahren. */
export type RueckwaertsLader = (lat: number, lon: number) => Promise<unknown>

async function ladeNominatimRueckwaerts(lat: number, lon: number): Promise<unknown> {
  return frageNominatim('/reverse', {
    lat: String(lat),
    lon: String(lon),
    format: 'jsonv2',
    addressdetails: '1',
    // zoom=18 = Gebäudeebene: gröber fände nur den Ort, feiner gibt es nicht.
    zoom: '18',
  })
}

/** Wirft NIE — jedes Scheitern (Zeitüberschreitung, Dienststörung, leere
 *  Antwort) wird zu null: Die Adressfelder bleiben dann unverändert, die
 *  Koordinaten gelten trotzdem. */
export async function rueckwaertsGeokodiere(
  lat: number,
  lon: number,
  lade: RueckwaertsLader = ladeNominatimRueckwaerts
): Promise<RueckwaertsAdresse | null> {
  try {
    return werteRueckwaertsAntwortAus(await lade(lat, lon))
  } catch {
    return null
  }
}

// ─── Die Karten-Bremse ──────────────────────────────────────────────────────

export type KartenBremse = {
  /** Jede vom Nutzer herbeigeführte Ruheposition der Kartenmitte. */
  mitteBewegt(lat: number, lon: number): void
  /** Programmatische Sprünge (Startansicht, Vorwärts-Suche, Kandidatenwahl):
   *  neuer Bezugspunkt OHNE Anfrage. */
  setzeBezugspunkt(lat: number, lon: number): void
  /** Beim Abbau der Karte: ein offener Zeitgeber wird verworfen. */
  aufloesen(): void
}

/** Näherung in Metern (Breitengrad ≈ 111 320 m, Längengrad mit cos gestaucht)
 *  — für die 25-m-Schwelle mehr als genau genug. */
function meterAbstand(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = (a.lat - b.lat) * 111_320
  const dLon = (a.lon - b.lon) * 111_320 * Math.cos((a.lat * Math.PI) / 180)
  return Math.hypot(dLat, dLon)
}

/**
 * Bremst die Rückwärtssuche beim Kartenschieben: Eine Anfrage geht erst
 * `ruheMs` (1,2 s) nach der letzten Bewegung raus, und nur, wenn die
 * Kartenmitte seit der LETZTEN ANFRAGE um mehr als `minMeter` (~25 m)
 * gewandert ist. Damit bleibt die Rate sicher unter der Nominatim-Grenze von
 * HÖCHSTENS EINER ANFRAGE PRO SEKUNDE: Zwischen zwei Anfragen liegen immer
 * mindestens 1,2 s Ruhe. Reine, mit unechten Zeitgebern prüfbare Logik.
 */
export function erstelleKartenBremse(
  onAnfrage: (lat: number, lon: number) => void,
  einstellungen: { ruheMs?: number; minMeter?: number } = {}
): KartenBremse {
  const ruheMs = einstellungen.ruheMs ?? 1_200
  const minMeter = einstellungen.minMeter ?? 25
  let bezugspunkt: { lat: number; lon: number } | null = null
  let zeitgeber: ReturnType<typeof setTimeout> | null = null

  const verwerfen = () => {
    if (zeitgeber !== null) {
      clearTimeout(zeitgeber)
      zeitgeber = null
    }
  }

  return {
    mitteBewegt(lat, lon) {
      // Jede neue Bewegung setzt die Ruhe-Uhr zurück — schnelle
      // Folge-Bewegungen münden so in genau EINER Anfrage am Ende.
      verwerfen()
      if (bezugspunkt && meterAbstand({ lat, lon }, bezugspunkt) < minMeter) return
      zeitgeber = setTimeout(() => {
        zeitgeber = null
        bezugspunkt = { lat, lon }
        onAnfrage(lat, lon)
      }, ruheMs)
    },
    setzeBezugspunkt(lat, lon) {
      verwerfen()
      bezugspunkt = { lat, lon }
    },
    aufloesen: verwerfen,
  }
}
