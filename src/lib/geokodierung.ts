/**
 * Geokodierung der Hofadresse — serverseitig, nie aus dem Browser.
 *
 * Dienst: Nominatim (nominatim.openstreetmap.org) mit STRUKTURIERTER Abfrage
 * (street, postalcode, city, country) statt Freitext: Die strukturierte
 * Abfrage ankert österreichische Weiler-Adressen ohne Straßennamen über die
 * Postleitzahl — vom Betreiber bereits erfolgreich gegen eine echte
 * Weiler-Adresse geprüft.
 *
 * Pflichten laut Nominatim-Nutzungsbedingungen, hier eingehalten:
 * - aussagekräftiger User-Agent mit Kontaktadresse der Plattform
 *   (SUPPORT_EMAIL aus src/lib/support.ts — nichts neu erfunden),
 * - HÖCHSTENS EINE ANFRAGE PRO SEKUNDE: Unser Aufkommen ist ein Klick auf
 *   „Standort auf der Karte prüfen" je Hof, mit maximal zwei aufeinander
 *   folgenden Anfragen (Kaskade) — weit unter der Grenze. Sollte je etwas
 *   Automatisches auf diese Funktion aufsetzen, MUSS es diese Rate drosseln.
 * - Timeout 5 s.
 *
 * DREISTUFIGE KASKADE, und in KEINEM Fall eine Fehlermeldung — es erscheint
 * immer eine bedienbare Karte (ländliche Adressen scheitern oft, der Bauer
 * setzt den Punkt dann selbst):
 *   1. street+postalcode+city  → Zoom 17, „Adresse gefunden"-Hinweis
 *   2. nur postalcode+city     → Zoom 14, „selbst schieben"-Hinweis
 *   3. fester Punkt (48.1/13.5) → Zoom 8,  derselbe Hinweis
 *
 * Reine Auswertung und injizierbarer Lader, damit die Kaskade ohne Netz
 * prüfbar ist (tests/hof-standort.test.ts).
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

async function ladeNominatim(parameter: Record<string, string>): Promise<unknown> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.search = new URLSearchParams({
    ...parameter,
    format: 'jsonv2',
    limit: '3',
    addressdetails: '1',
  }).toString()

  const antwort = await fetch(url, {
    headers: {
      'User-Agent': `FarmerZone/1.0 (https://farmerzone.at; ${SUPPORT_EMAIL})`,
    },
    signal: AbortSignal.timeout(NOMINATIM_TIMEOUT_MS),
  })
  if (!antwort.ok) throw new Error(`Nominatim antwortet ${antwort.status}`)
  return antwort.json()
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
