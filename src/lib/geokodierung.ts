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
 *   3. fester Punkt je Land    → Zoom 8,  derselbe Hinweis
 *
 * ZWEI LÄNDER, ZWEI WEGE (Grenzregion Innviertel/Niederbayern):
 * - Die HOF-Geokodierung (geokodiereAdresse) folgt dem LAND DES HOFES: Sie
 *   soll eine bekannte Adresse verankern, nicht zwischen Ländern raten.
 * - Die UMKREISSUCHE der Kundin (sucheOrtspunkt) sucht in BEIDEN Ländern
 *   gleichzeitig (countrycodes=at,de): Wer „Simbach" tippt, gibt kein Land
 *   an — die Kandidatenliste nennt es dafür (kandidatenBeschriftung).
 *
 * Reine Auswertung und injizierbare Lader, damit Kaskade, Rückwärts-Übernahme
 * und Bremse ohne Netz prüfbar sind (tests/hof-standort.test.ts,
 * tests/standort-rueckwaerts.test.ts).
 */
import { SUPPORT_EMAIL } from '@/lib/support'
import {
  LAND_CODE,
  LAND_LABEL,
  UMKREIS_LAENDER_CODES,
  alsLand,
  type Land,
} from '@/lib/laender'

export type StandortKandidat = {
  lat: number
  lon: number
  anzeigeName: string
  /** Das Land des Treffers, sofern Nominatim es mitliefert („AT", „DE", …) —
   *  die Umkreissuche zeigt es an, damit „Simbach" diesseits und jenseits der
   *  Grenze unterscheidbar bleibt. */
  land?: string
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

/**
 * Der Rückfallpunkt je Land — die Karte soll in der richtigen Gegend
 * öffnen, wenn beide Geokodierungs-Stufen nichts gefunden haben. Für DE ist
 * das Südostbayern (Raum Pfarrkirchen/Eggenfelden): die Grenzregion, um die
 * es hier geht — nicht die geografische Mitte Deutschlands, die für einen
 * Innviertler Nachbarhof nutzlos wäre.
 */
export const RUECKFALL_PUNKTE: Record<Land, { lat: number; lon: number }> = {
  AT: RUECKFALL_PUNKT,
  DE: { lat: 48.43, lon: 12.94 },
}

/** Grobe Länder-Schachteln für die Plausibilisierung gespeicherter Punkte.
 *  Bewusst grob (sie streifen Nachbarländer) — sie fangen Vertipper und
 *  Datenmüll, keine Grenzverläufe. Genau deshalb überlappen AT und DE im
 *  Grenzstreifen: Ein Hof in Simbach darf sowohl als DE plausibel gelten,
 *  als auch ein Hof in Braunau als AT — die Wahrheit steht im Länderfeld. */
export const LAENDER_GRENZEN: Record<Land, { latMin: number; latMax: number; lonMin: number; lonMax: number }> = {
  AT: { latMin: 46, latMax: 49.1, lonMin: 9.5, lonMax: 17.2 },
  DE: { latMin: 47.2, latMax: 55.1, lonMin: 5.8, lonMax: 15.1 },
}

/** Die Österreich-Schachtel unter ihrem bisherigen Namen — unverändert. */
export const OESTERREICH_GRENZEN = LAENDER_GRENZEN.AT

/**
 * Liegt der Punkt grob im Gebiet des angegebenen Landes? Tritt an die Stelle
 * von istInOesterreich: Seit deutsche Höfe sich einrichten dürfen, hängt die
 * Plausibilisierung am Land des Hofes, nicht mehr an einer festen Schachtel.
 * Ein unbekannter Länderwert wird wie „AT" behandelt (alsLand).
 */
export function istImErlaubtenGebiet(lat: number, lon: number, land: Land | string): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false
  const g = LAENDER_GRENZEN[alsLand(land)]
  return lat >= g.latMin && lat <= g.latMax && lon >= g.lonMin && lon <= g.lonMax
}

/**
 * Eine vier- ODER fünfstellige Zahl gilt als Postleitzahl (AT hat vier
 * Stellen, DE fünf), alles andere als Ortsname. Bewusst eine reine Funktion:
 * An ihr hängt, ob Nominatim `postalcode` oder `city` bekommt — eine
 * falsche Einordnung liefert stumm den falschen Ort.
 */
export function istPostleitzahl(eingabe: string): boolean {
  return /^\d{4,5}$/.test(eingabe.trim())
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
    const e = eintrag as { lat?: unknown; lon?: unknown; display_name?: unknown; address?: unknown }
    const lat = typeof e.lat === 'string' ? Number.parseFloat(e.lat) : NaN
    const lon = typeof e.lon === 'string' ? Number.parseFloat(e.lon) : NaN
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    // `address.country_code` kommt mit addressdetails=1 und in
    // Kleinschreibung („at"/„de") — hier großgeschrieben wie unser
    // Länderfeld. Fehlt er, bleibt das Feld weg statt zu raten.
    const adresse = typeof e.address === 'object' && e.address !== null ? (e.address as Record<string, unknown>) : null
    const code = typeof adresse?.country_code === 'string' ? adresse.country_code.toUpperCase() : undefined
    kandidaten.push({
      lat,
      lon,
      anzeigeName: typeof e.display_name === 'string' && e.display_name ? e.display_name : 'Gefundener Ort',
      ...(code ? { land: code } : {}),
    })
  }
  return kandidaten
}

/**
 * Der Anzeigetext eines Kandidaten in der Auswahlliste: der Nominatim-Name,
 * dem das Land vorangestellt wird, wenn er es nicht ohnehin schon nennt.
 * Nominatims `display_name` endet in aller Regel auf „…, Österreich" bzw.
 * „…, Deutschland" — dann wäre eine zweite Landangabe nur Lärm.
 */
/**
 * Wirft Treffer weg, die für die Kundin NICHT unterscheidbar wären.
 *
 * Nominatim liefert für eine einzelne österreichische Postleitzahl gern
 * mehrere Zeilen desselben Ortes (Gemeinde, Katastralgemeinde, Ortschaft).
 * Ohne diese Stufe würde daraus eine Rückfrage mit zwei gleich aussehenden
 * Zeilen — ein Zusatzklick ohne jede Erkenntnis, und zwar ausgerechnet auf
 * dem HÄUFIGEN österreichischen Weg, der vor diesem Sprint einstufig war.
 *
 * Zwei Treffer gelten als derselbe Ort, wenn ihre Beschriftung gleich ist
 * ODER sie IM SELBEN LAND weniger als `minAbstandKm` auseinanderliegen.
 * Der erste gewinnt (Nominatim sortiert nach Güte).
 *
 * Das Land ist die entscheidende Bedingung, nicht bloß Beiwerk: Simbach am
 * Inn und Braunau am Inn trennt eine Brücke — rund 1,3 km. Eine reine
 * Abstandsregel würfe ausgerechnet das Paar zusammen, dessentwegen es diese
 * Rückfrage überhaupt gibt.
 */
export function entdoppleTreffer(
  treffer: StandortKandidat[],
  minAbstandKm = 2
): StandortKandidat[] {
  const behalten: StandortKandidat[] = []
  for (const kandidat of treffer) {
    const schonDa = behalten.some(
      (b) =>
        b.anzeigeName === kandidat.anzeigeName ||
        (b.land === kandidat.land &&
          // Grobe Näherung genügt für „derselbe Ort" (Breitengrad ≈ 111 km,
          // Längengrad mit cos gestaucht) — hier wird nichts vermessen.
          Math.hypot(
            (b.lat - kandidat.lat) * 111,
            (b.lon - kandidat.lon) * 111 * Math.cos((b.lat * Math.PI) / 180)
          ) < minAbstandKm)
    )
    if (!schonDa) behalten.push(kandidat)
  }
  return behalten
}

/** „Zwei Orte passen …" — die Ansage nennt die Anzahl, damit sie auch
 *  vorgelesen etwas aussagt. */
export function hinweisMehrere(anzahl: number): string {
  const wort = anzahl === 2 ? 'Zwei' : anzahl === 3 ? 'Drei' : String(anzahl)
  return `${wort} Orte passen — welchen meinst du?`
}

export function kandidatenBeschriftung(kandidat: StandortKandidat): string {
  const land = kandidat.land === 'AT' || kandidat.land === 'DE' ? LAND_LABEL[kandidat.land] : null
  if (!land) return kandidat.anzeigeName
  return kandidat.anzeigeName.includes(land)
    ? kandidat.anzeigeName
    : `${kandidat.anzeigeName} (${land})`
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
 * zweiter Netzweg), und je nach Eingabe postalcode ODER city
 * (istPostleitzahl). Straße wird nie mitgeschickt: Gesucht ist die Gegend,
 * nicht die Adresse.
 *
 * ÜBER DIE GRENZE: `countrycodes=at,de` statt `country=at`. Im Innviertel
 * liegt Bayern näher als halb Oberösterreich — wer „Simbach" oder „84359"
 * eintippt, sucht denselben Umkreis wie mit „Braunau". Gesucht wird in
 * beiden Ländern gleichzeitig; welches gemeint war, entscheidet die Kundin
 * an der Kandidatenliste (kandidatenBeschriftung).
 *
 * NUR HIER beide Länder: Die Hof-Geokodierung (geokodiereAdresse) folgt dem
 * Land des Hofes — sie soll eine Adresse verankern, nicht raten.
 *
 * DATENSPARSAMKEIT: Hier geht ausschließlich die getippte Eingabe hinaus —
 * NIEMALS eine vom Gerät gemessene Position (src/lib/hofuebersicht.ts).
 *
 * Wirft NIE: leere Antwort, Zeitüberschreitung und Dienststörung liefern
 * gleichermaßen eine leere Liste, die Hofliste bleibt dann unverändert.
 */
export async function sucheOrtspunkt(
  eingabe: string,
  lade: NominatimLader = ladeNominatim
): Promise<StandortKandidat[]> {
  const text = eingabe.trim()
  if (text.length < 2) return []

  try {
    return werteNominatimAntwortAus(
      await lade({
        [istPostleitzahl(text) ? 'postalcode' : 'city']: text,
        countrycodes: UMKREIS_LAENDER_CODES,
      })
    )
  } catch {
    return []
  }
}

/**
 * Die dreistufige Kaskade (siehe Kopfkommentar). Wirft NIE — jedes Scheitern
 * (leere Antwort, Zeitüberschreitung, Dienststörung) führt zur nächsten,
 * gröberen Stufe, nie zu einer Fehlermeldung.
 *
 * `land` steuert ALLE drei Stufen: den Länder-Anker beider Nominatim-Stufen
 * und den Rückfallpunkt der dritten (RUECKFALL_PUNKTE) — eine deutsche
 * Adresse, die nichts findet, öffnet in Südostbayern statt im Innviertel.
 * Zoom-Stufen und Hinweistexte bleiben unverändert.
 */
export async function geokodiereAdresse(
  adresse: { address: string; postalCode: string; city: string },
  land: Land | string = 'AT',
  lade: NominatimLader = ladeNominatim
): Promise<GeokodierungsErgebnis> {
  const hofLand = alsLand(land)
  const code = LAND_CODE[hofLand]

  try {
    const kandidaten = werteNominatimAntwortAus(
      await lade({
        street: adresse.address,
        postalcode: adresse.postalCode,
        city: adresse.city,
        country: code,
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
      await lade({ postalcode: adresse.postalCode, city: adresse.city, country: code })
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
    zentrum: RUECKFALL_PUNKTE[hofLand],
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
