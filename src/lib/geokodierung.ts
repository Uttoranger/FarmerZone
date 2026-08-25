/**
 * Geokodierung der Hofadresse — serverseitig, nie aus dem Browser.
 *
 * Dienst: Photon (photon.komoot.io), begründet gegen Nominatim: Photon hat
 * liberale Fair-Use-Bedingungen für gelegentliche Anfragen und keine harte
 * 1-Anfrage-pro-Sekunde-Auflage wie die Nominatim-Policy; die Antwort ist
 * GeoJSON mit sauberen Feldern, und deutschsprachige Anzeigenamen kommen per
 * lang=de. Unser Aufkommen (ein Aufruf je Profil-Speichern mit geänderter
 * Adresse) liegt weit unter jeder Grenze — trotzdem läuft jede Anfrage mit
 * aussagekräftigem User-Agent, wie es beide Dienste verlangen.
 *
 * FEHLERTOLERANZ-REGEL (bewusst, ländliche Adressen scheitern oft): Kein
 * Treffer oder Zeitüberschreitung ist KEIN Fehlerfall für den Bauern. Statt
 * einer Meldung öffnet die Karte auf dem Zentrum der eingegebenen
 * Postleitzahl (zweiter, gröberer Versuch); ist auch das unbekannt, auf
 * einem festen Punkt in Oberösterreich. Der Bauer setzt den Punkt dann
 * selbst — das muss er für die Hofeinfahrt ohnehin.
 *
 * Reine Auswertung und injizierbarer Lader, damit alles ohne Netz prüfbar
 * ist (tests/hof-standort.test.ts).
 */

export type StandortKandidat = {
  lat: number
  lon: number
  anzeigeName: string
}

export type GeokodierungsErgebnis = {
  /** Bis zu drei Kandidaten der Adresssuche — leer, wenn nur der Rückfall trug. */
  kandidaten: StandortKandidat[]
  /** Wo die Karte öffnet. */
  zentrum: { lat: number; lon: number }
  /** Woher das Zentrum stammt — steuert die Start-Zoomstufe der Karte. */
  quelle: 'adresse' | 'plz' | 'rueckfall'
}

/** Fester Rückfallpunkt, wenn weder Adresse noch PLZ etwas hergeben: Linz. */
export const RUECKFALL_OBEROESTERREICH = { lat: 48.3069, lon: 14.2858 }

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
 * Wertet eine Photon-Antwort (GeoJSON FeatureCollection) aus.
 *
 * Nur Treffer in Österreich zählen — die Suche läuft zwar mit „Österreich"
 * im Text, aber Photon streut trotzdem gern über die Grenze. Höchstens drei,
 * in Antwort-Reihenfolge (Photon sortiert nach Relevanz).
 */
export function wertePhotonAntwortAus(json: unknown): StandortKandidat[] {
  if (typeof json !== 'object' || json === null) return []
  const features = (json as { features?: unknown }).features
  if (!Array.isArray(features)) return []

  const kandidaten: StandortKandidat[] = []
  for (const feature of features) {
    if (kandidaten.length >= 3) break
    const f = feature as {
      geometry?: { coordinates?: unknown }
      properties?: Record<string, unknown>
    }
    const koordinaten = f.geometry?.coordinates
    if (!Array.isArray(koordinaten) || koordinaten.length < 2) continue
    const [lon, lat] = koordinaten
    if (typeof lat !== 'number' || typeof lon !== 'number') continue

    const p = f.properties ?? {}
    if (p.countrycode !== 'AT') continue

    const teile = [
      [p.name, p.street].find((w) => typeof w === 'string' && w) as string | undefined,
      typeof p.housenumber === 'string' ? p.housenumber : undefined,
    ]
      .filter(Boolean)
      .join(' ')
    const ort = [p.postcode, p.city].filter((w) => typeof w === 'string' && w).join(' ')
    const anzeigeName = [teile, ort].filter(Boolean).join(', ') || 'Gefundener Ort'

    kandidaten.push({ lat, lon, anzeigeName })
  }
  return kandidaten
}

/** Lädt eine Photon-Suche als JSON — der eine unreine Baustein, injizierbar. */
export type PhotonLader = (query: string) => Promise<unknown>

const PHOTON_TIMEOUT_MS = 5_000

async function ladePhoton(query: string): Promise<unknown> {
  const url = `https://photon.komoot.io/api?q=${encodeURIComponent(query)}&limit=3&lang=de`
  const antwort = await fetch(url, {
    headers: {
      // Fair-Use beider Geokodierer: Der Betreiber muss erkennbar sein.
      'User-Agent': 'FarmerZone/1.0 (https://farmerzone.at; kontakt@farmerzone.at)',
    },
    signal: AbortSignal.timeout(PHOTON_TIMEOUT_MS),
  })
  if (!antwort.ok) throw new Error(`Photon antwortet ${antwort.status}`)
  return antwort.json()
}

/**
 * Geokodiert eine Hofadresse mit gestuftem Rückfall (siehe Kopfkommentar):
 * volle Adresse → nur PLZ → fester Punkt. Wirft NIE — jedes Scheitern wird
 * zu einem gröberen Zentrum, nie zu einer Fehlermeldung.
 */
export async function geokodiereAdresse(
  adresse: { address: string; postalCode: string; city: string },
  lade: PhotonLader = ladePhoton
): Promise<GeokodierungsErgebnis> {
  try {
    const kandidaten = wertePhotonAntwortAus(
      await lade(`${adresse.address}, ${adresse.postalCode} ${adresse.city}, Österreich`)
    )
    if (kandidaten.length > 0) {
      return { kandidaten, zentrum: { lat: kandidaten[0].lat, lon: kandidaten[0].lon }, quelle: 'adresse' }
    }
  } catch {
    // Zeitüberschreitung oder Dienststörung — weiter zum PLZ-Versuch.
  }

  try {
    const plzTreffer = wertePhotonAntwortAus(await lade(`${adresse.postalCode} Österreich`))
    if (plzTreffer.length > 0) {
      return {
        kandidaten: [],
        zentrum: { lat: plzTreffer[0].lat, lon: plzTreffer[0].lon },
        quelle: 'plz',
      }
    }
  } catch {
    // Auch das scheiterte — der feste Punkt bleibt.
  }

  return { kandidaten: [], zentrum: RUECKFALL_OBEROESTERREICH, quelle: 'rueckfall' }
}
