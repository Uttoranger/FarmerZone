/**
 * Tests für die Standort-Datengrundlage (src/lib/geokodierung.ts):
 * die Auswertung der Nominatim-Antwort, die dreistufige Kaskade (Adresse →
 * Ort → fester Punkt, je mit eigenem Zoom und Hinweistext) und die
 * Plausibilisierung der gespeicherten Koordinaten.
 *
 * Der Lader ist injizierbar — die Tests fahren die echte Kaskaden-Logik mit
 * nachgestellten Antworten (echte jsonv2-Gestalt: lat/lon als STRINGS) und
 * echten Fehlwegen (leere Antwort, Zeitüberschreitung als Rejection), ohne
 * Netz. Geprüft wird auch, WAS die Kaskade je Stufe anfragt: Stufe 2 darf
 * die Straße nicht mehr mitschicken.
 */
import { describe, it, expect } from 'vitest'
import {
  geokodiereAdresse,
  istImErlaubtenGebiet,
  rundeKoordinate,
  werteNominatimAntwortAus,
  HINWEIS_ADRESSE_GEFUNDEN,
  HINWEIS_SELBST_SETZEN,
  RUECKFALL_PUNKT,
} from '@/lib/geokodierung'

const ADRESSE = { address: 'Dorfstraße 12', postalCode: '4910', city: 'Ried im Innkreis' }

/** Ein Nominatim-jsonv2-Treffer: lat/lon kommen als Strings. */
function treffer(lat: string, lon: string, name: string) {
  return { lat, lon, display_name: name, address: {} }
}

describe('werteNominatimAntwortAus', () => {
  it('liest die String-Koordinaten als Zahlen und übernimmt den Anzeigenamen', () => {
    const [k] = werteNominatimAntwortAus([
      treffer('48.21', '13.49', 'Dorfstraße 12, 4910 Ried im Innkreis, Österreich'),
    ])

    expect(k.lat).toBe(48.21)
    expect(k.lon).toBe(13.49)
    expect(k.anzeigeName).toBe('Dorfstraße 12, 4910 Ried im Innkreis, Österreich')
  })

  it('deckelt bei drei Kandidaten und überspringt Unlesbares', () => {
    const antwort = [
      treffer('48.21', '13.49', 'Erster'),
      { lat: 'kaputt', lon: '13.0', display_name: 'Unlesbar' },
      treffer('47.8', '13.0', 'Zweiter'),
      treffer('48.3', '14.3', 'Dritter'),
      treffer('47.1', '15.4', 'Vierter'),
    ]

    const kandidaten = werteNominatimAntwortAus(antwort)
    expect(kandidaten.map((k) => k.anzeigeName)).toEqual(['Erster', 'Zweiter', 'Dritter'])
  })

  it('macht aus Müll eine leere Liste, keinen Fehler', () => {
    expect(werteNominatimAntwortAus(null)).toEqual([])
    expect(werteNominatimAntwortAus({})).toEqual([])
    expect(werteNominatimAntwortAus([{}])).toEqual([])
  })
})

describe('geokodiereAdresse — die dreistufige Kaskade', () => {
  it('Stufe 1: Adress-Treffer → Zoom 17, Adress-Hinweis, Kandidaten dabei', async () => {
    const angefragt: Record<string, string>[] = []
    const ergebnis = await geokodiereAdresse(ADRESSE, 'AT', async (parameter) => {
      angefragt.push(parameter)
      return [treffer('48.21', '13.49', 'Dorfstraße 12'), treffer('48.22', '13.5', 'Dorfstraße 12b')]
    })

    expect(ergebnis.stufe).toBe('adresse')
    expect(ergebnis.zoom).toBe(17)
    expect(ergebnis.hinweis).toBe(HINWEIS_ADRESSE_GEFUNDEN)
    expect(ergebnis.kandidaten).toHaveLength(2)
    expect(ergebnis.zentrum).toEqual({ lat: 48.21, lon: 13.49 })
    // Die erste Anfrage ist die volle strukturierte Adresse
    expect(angefragt[0]).toMatchObject({
      street: ADRESSE.address,
      postalcode: ADRESSE.postalCode,
      city: ADRESSE.city,
      country: 'at',
    })
  })

  it('Stufe 2: kein Adress-Treffer → Anfrage OHNE Straße, Zoom 14, Selbst-setzen-Hinweis', async () => {
    // Der Weiler ohne Straßennamen: Die strukturierte Orts-Anfrage ankert
    // über die Postleitzahl.
    const angefragt: Record<string, string>[] = []
    const ergebnis = await geokodiereAdresse(ADRESSE, 'AT', async (parameter) => {
      angefragt.push(parameter)
      return 'street' in parameter ? [] : [treffer('48.2', '13.5', 'Ried im Innkreis')]
    })

    expect(ergebnis.stufe).toBe('ort')
    expect(ergebnis.zoom).toBe(14)
    expect(ergebnis.hinweis).toBe(HINWEIS_SELBST_SETZEN)
    expect(ergebnis.kandidaten).toEqual([])
    expect(ergebnis.zentrum).toEqual({ lat: 48.2, lon: 13.5 })
    expect(angefragt).toHaveLength(2)
    expect(angefragt[1]).not.toHaveProperty('street')
    expect(angefragt[1]).toMatchObject({ postalcode: ADRESSE.postalCode, city: ADRESSE.city })
  })

  it('behandelt eine Zeitüberschreitung wie eine leere Antwort', async () => {
    // In KEINEM Fall eine Fehlermeldung — es erscheint immer eine bedienbare
    // Karte, nur eben eine Stufe gröber.
    const ergebnis = await geokodiereAdresse(ADRESSE, 'AT', async (parameter) => {
      if ('street' in parameter) throw new Error('TimeoutError')
      return [treffer('48.2', '13.5', 'Ried im Innkreis')]
    })

    expect(ergebnis.stufe).toBe('ort')
    expect(ergebnis.zoom).toBe(14)
  })

  it('Stufe 3: gar nichts trägt → fester Punkt, Zoom 8, Selbst-setzen-Hinweis', async () => {
    const ergebnis = await geokodiereAdresse(ADRESSE, 'AT', async () => {
      throw new Error('TimeoutError')
    })

    expect(ergebnis.stufe).toBe('rueckfall')
    expect(ergebnis.zoom).toBe(8)
    expect(ergebnis.hinweis).toBe(HINWEIS_SELBST_SETZEN)
    expect(ergebnis.kandidaten).toEqual([])
    expect(ergebnis.zentrum).toEqual(RUECKFALL_PUNKT)
    expect(RUECKFALL_PUNKT).toEqual({ lat: 48.1, lon: 13.5 })
  })
})

describe('istImErlaubtenGebiet — die grobe Plausibilisierung je Land', () => {
  it('nimmt Punkte in Österreich an', () => {
    expect(istImErlaubtenGebiet(48.3069, 14.2858, 'AT')).toBe(true) // Linz
    expect(istImErlaubtenGebiet(48.1, 13.5, 'AT')).toBe(true) //       Rückfallpunkt selbst
  })

  it('lehnt Punkte außerhalb ab — Italien, Null-Insel, Unsinn', () => {
    expect(istImErlaubtenGebiet(41.9, 12.5, 'AT')).toBe(false) //  Rom
    expect(istImErlaubtenGebiet(0, 0, 'AT')).toBe(false) //        Null-Insel (verrutschte Karte)
    expect(istImErlaubtenGebiet(NaN, 14, 'AT')).toBe(false)
    expect(istImErlaubtenGebiet(48, Infinity, 'AT')).toBe(false)
  })
})

describe('rundeKoordinate', () => {
  it('rundet auf sechs Nachkommastellen — mehr wäre Rauschen', () => {
    expect(rundeKoordinate(48.123456789)).toBe(48.123457)
    expect(rundeKoordinate(13.4)).toBe(13.4)
    expect(rundeKoordinate(-1.0000004)).toBe(-1)
  })
})
