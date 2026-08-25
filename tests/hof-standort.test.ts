/**
 * Tests für die Standort-Datengrundlage (src/lib/geokodierung.ts):
 * die Auswertung der Photon-Antwort, den gestuften Rückfall (Adresse → PLZ →
 * fester Punkt) und die Plausibilisierung der gespeicherten Koordinaten.
 *
 * Der Lader ist injizierbar — die Tests fahren die echte Rückfall-Logik mit
 * nachgestellten Antworten (echte GeoJSON-Gestalt) und echten Fehlwegen
 * (leere Antwort, Zeitüberschreitung als Rejection), ohne Netz.
 */
import { describe, it, expect } from 'vitest'
import {
  geokodiereAdresse,
  istInOesterreich,
  rundeKoordinate,
  wertePhotonAntwortAus,
  RUECKFALL_OBEROESTERREICH,
} from '@/lib/geokodierung'

const ADRESSE = { address: 'Dorfstraße 12', postalCode: '4910', city: 'Ried im Innkreis' }

/** Ein Photon-Feature in echter GeoJSON-Gestalt. */
function feature(lat: number, lon: number, props: Record<string, unknown>) {
  return { geometry: { coordinates: [lon, lat] }, properties: props }
}

const TREFFER_RIED = feature(48.21, 13.49, {
  countrycode: 'AT',
  name: 'Dorfstraße',
  housenumber: '12',
  postcode: '4910',
  city: 'Ried im Innkreis',
})

describe('wertePhotonAntwortAus', () => {
  it('liest Koordinaten und baut einen lesbaren Anzeigenamen', () => {
    const [k] = wertePhotonAntwortAus({ features: [TREFFER_RIED] })

    expect(k.lat).toBe(48.21)
    expect(k.lon).toBe(13.49)
    expect(k.anzeigeName).toBe('Dorfstraße 12, 4910 Ried im Innkreis')
  })

  it('lässt ausländische Treffer weg und deckelt bei drei', () => {
    // Die Suche läuft mit „Österreich" im Text — Photon streut trotzdem.
    const antwort = {
      features: [
        TREFFER_RIED,
        feature(48.2, 11.5, { countrycode: 'DE', name: 'Dorfstraße', city: 'München' }),
        feature(47.8, 13.0, { countrycode: 'AT', name: 'Salzburg' }),
        feature(48.3, 14.3, { countrycode: 'AT', name: 'Linz' }),
        feature(47.1, 15.4, { countrycode: 'AT', name: 'Graz' }),
      ],
    }

    const kandidaten = wertePhotonAntwortAus(antwort)
    expect(kandidaten).toHaveLength(3)
    expect(kandidaten.map((k) => k.anzeigeName)).toEqual([
      'Dorfstraße 12, 4910 Ried im Innkreis',
      'Salzburg',
      'Linz',
    ])
  })

  it('macht aus Müll eine leere Liste, keinen Fehler', () => {
    expect(wertePhotonAntwortAus(null)).toEqual([])
    expect(wertePhotonAntwortAus({})).toEqual([])
    expect(wertePhotonAntwortAus({ features: [{}] })).toEqual([])
  })
})

describe('geokodiereAdresse — der gestufte Rückfall', () => {
  it('liefert bei einem Adress-Treffer die Kandidaten und zentriert auf dem ersten', async () => {
    const ergebnis = await geokodiereAdresse(ADRESSE, async () => ({ features: [TREFFER_RIED] }))

    expect(ergebnis.quelle).toBe('adresse')
    expect(ergebnis.kandidaten).toHaveLength(1)
    expect(ergebnis.zentrum).toEqual({ lat: 48.21, lon: 13.49 })
  })

  it('fällt bei leerer Adress-Antwort auf das PLZ-Zentrum zurück', async () => {
    // Der Weiler ohne Straßennamen: Adresse unbekannt, aber die PLZ trägt.
    const ergebnis = await geokodiereAdresse(ADRESSE, async (query) =>
      query.startsWith(ADRESSE.postalCode)
        ? { features: [feature(48.2, 13.5, { countrycode: 'AT', name: 'Ried im Innkreis' })] }
        : { features: [] }
    )

    expect(ergebnis.quelle).toBe('plz')
    expect(ergebnis.kandidaten).toEqual([])
    expect(ergebnis.zentrum).toEqual({ lat: 48.2, lon: 13.5 })
  })

  it('behandelt eine Zeitüberschreitung wie eine leere Antwort', async () => {
    // FEHLERTOLERANZ-REGEL: ländliche Adressen scheitern oft — nie eine
    // Fehlermeldung, immer ein gröberes Zentrum.
    const ergebnis = await geokodiereAdresse(ADRESSE, async (query) => {
      if (!query.startsWith(ADRESSE.postalCode)) throw new Error('TimeoutError')
      return { features: [feature(48.2, 13.5, { countrycode: 'AT', name: 'Ried' })] }
    })

    expect(ergebnis.quelle).toBe('plz')
    expect(ergebnis.zentrum).toEqual({ lat: 48.2, lon: 13.5 })
  })

  it('endet auf dem festen Punkt in Oberösterreich, wenn gar nichts trägt', async () => {
    const ergebnis = await geokodiereAdresse(ADRESSE, async () => {
      throw new Error('TimeoutError')
    })

    expect(ergebnis.quelle).toBe('rueckfall')
    expect(ergebnis.kandidaten).toEqual([])
    expect(ergebnis.zentrum).toEqual(RUECKFALL_OBEROESTERREICH)
  })
})

describe('istInOesterreich — die grobe Plausibilisierung', () => {
  it('nimmt Punkte in Österreich an', () => {
    expect(istInOesterreich(48.3069, 14.2858)).toBe(true) // Linz
    expect(istInOesterreich(48.21, 13.49)).toBe(true) //     Innviertel
  })

  it('lehnt Punkte außerhalb ab — Italien, Null-Insel, Unsinn', () => {
    expect(istInOesterreich(41.9, 12.5)).toBe(false) //  Rom
    expect(istInOesterreich(0, 0)).toBe(false) //        Null-Insel (verrutschte Karte)
    expect(istInOesterreich(NaN, 14)).toBe(false)
    expect(istInOesterreich(48, Infinity)).toBe(false)
  })
})

describe('rundeKoordinate', () => {
  it('rundet auf sechs Nachkommastellen — mehr wäre Rauschen', () => {
    expect(rundeKoordinate(48.123456789)).toBe(48.123457)
    expect(rundeKoordinate(13.4)).toBe(13.4)
    expect(rundeKoordinate(-1.0000004)).toBe(-1)
  })
})
