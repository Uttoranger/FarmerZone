/**
 * Tests für die Rückwärts-Geokodierung (Kartenpunkt → Adressfelder) und die
 * Karten-Bremse (src/lib/geokodierung.ts).
 *
 * Unter Prüfung steht die ÜBERNAHME-REGEL: Das Rückwärts-Ergebnis füllt NUR
 * Felder mit tatsächlichem Wert — ein ausgefülltes Feld wird nie mit leerem
 * Wert überschrieben (ländliche Antworten kommen oft ohne Hausnummer). Die
 * Bremse ist reine Logik mit unechten Zeitgebern: Anfrage erst nach 1,2 s
 * Karten-Ruhe und nur bei mehr als ~25 m Bewegung seit der letzten Anfrage.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  erstelleKartenBremse,
  rueckwaertsGeokodiere,
  uebernehmeAdresse,
  werteRueckwaertsAntwortAus,
} from '@/lib/geokodierung'

const BISHER = { address: 'Dorfstraße 12', postalCode: '4910', city: 'Ried im Innkreis' }

describe('werteRueckwaertsAntwortAus', () => {
  it('liest Straße, Hausnummer, PLZ und Ort aus einer vollen Antwort', () => {
    expect(
      werteRueckwaertsAntwortAus({
        lat: '48.21',
        lon: '13.49',
        display_name: 'Hofmark 4, 4921 Hohenzell, Österreich',
        address: { road: 'Hofmark', house_number: '4', postcode: '4921', village: 'Hohenzell' },
      })
    ).toEqual({ strasse: 'Hofmark', hausnummer: '4', plz: '4921', ort: 'Hohenzell' })
  })

  it('nimmt für den Ort die feinste vorhandene Stufe', () => {
    expect(werteRueckwaertsAntwortAus({ address: { town: 'Ried', city: 'Groß' } })?.ort).toBe('Ried')
    expect(werteRueckwaertsAntwortAus({ address: { municipality: 'Hohenzell' } })?.ort).toBe('Hohenzell')
  })

  it('macht aus Müll, Fehlern und Leerem null — nie einen Fehler', () => {
    expect(werteRueckwaertsAntwortAus(null)).toBeNull()
    expect(werteRueckwaertsAntwortAus('kaputt')).toBeNull()
    expect(werteRueckwaertsAntwortAus({ error: 'Unable to geocode' })).toBeNull()
    expect(werteRueckwaertsAntwortAus({ address: {} })).toBeNull()
    expect(werteRueckwaertsAntwortAus({ address: { road: '   ' } })).toBeNull()
  })
})

describe('uebernehmeAdresse — die Übernahme-Regel', () => {
  it('eine vollständige Antwort füllt alle drei Felder', () => {
    expect(
      uebernehmeAdresse(BISHER, { strasse: 'Hofmark', hausnummer: '4', plz: '4921', ort: 'Hohenzell' })
    ).toEqual({ address: 'Hofmark 4', postalCode: '4921', city: 'Hohenzell' })
  })

  it('ohne Hausnummer bleibt die von Hand eingetragene stehen', () => {
    // Der Punkt liegt auf dem Feld: Nominatim kennt dort die Straße, aber
    // keine Hausnummer — die eingetragene 12 darf nicht verlorengehen.
    expect(uebernehmeAdresse(BISHER, { strasse: 'Dorfstraße', ort: 'Ried im Innkreis' })).toEqual({
      address: 'Dorfstraße 12',
      postalCode: '4910',
      city: 'Ried im Innkreis',
    })
  })

  it('eine leere Antwort ändert kein einziges Feld', () => {
    expect(uebernehmeAdresse(BISHER, {})).toEqual(BISHER)
  })

  it('überschreibt nie Gefülltes mit Leerem — ohne PLZ bleibt die alte stehen', () => {
    expect(uebernehmeAdresse(BISHER, { strasse: 'Hofmark', hausnummer: '4' })).toEqual({
      address: 'Hofmark 4',
      postalCode: '4910',
      city: 'Ried im Innkreis',
    })
  })

  it('ohne Straße bleibt das Adressfeld unangetastet — eine nackte Hausnummer nützt nichts', () => {
    expect(uebernehmeAdresse(BISHER, { hausnummer: '99', plz: '4921' }).address).toBe('Dorfstraße 12')
  })

  it('versteht zusammengesetzte Hausnummern wie 3/1 und 12a', () => {
    expect(uebernehmeAdresse({ ...BISHER, address: 'Hofmark 3/1' }, { strasse: 'Hofmark' }).address).toBe('Hofmark 3/1')
    expect(uebernehmeAdresse({ ...BISHER, address: 'Dorfstraße 12a' }, { strasse: 'Feldweg' }).address).toBe('Feldweg 12a')
  })
})

describe('rueckwaertsGeokodiere', () => {
  it('reicht den Kartenpunkt an den Lader durch und wertet die Antwort aus', async () => {
    const angefragt: Array<[number, number]> = []
    const ergebnis = await rueckwaertsGeokodiere(48.21, 13.49, async (lat, lon) => {
      angefragt.push([lat, lon])
      return { address: { road: 'Hofmark', postcode: '4921', village: 'Hohenzell' } }
    })

    expect(angefragt).toEqual([[48.21, 13.49]])
    expect(ergebnis).toEqual({ strasse: 'Hofmark', plz: '4921', ort: 'Hohenzell' })
  })

  it('wird bei Zeitüberschreitung leise null — nie ein Fehler', async () => {
    await expect(
      rueckwaertsGeokodiere(48.21, 13.49, async () => {
        throw new Error('TimeoutError')
      })
    ).resolves.toBeNull()
  })
})

describe('erstelleKartenBremse', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const START = { lat: 48.2, lon: 13.5 }
  /** ~55 m nördlich — deutlich über der 25-m-Schwelle. */
  const WEIT = { lat: 48.2005, lon: 13.5 }
  /** ~11 m nördlich — deutlich darunter. */
  const NAH = { lat: 48.2001, lon: 13.5 }

  function aufgebaut() {
    const anfragen: Array<[number, number]> = []
    const bremse = erstelleKartenBremse((lat, lon) => anfragen.push([lat, lon]))
    bremse.setzeBezugspunkt(START.lat, START.lon)
    return { anfragen, bremse }
  }

  it('unter ~25 m Bewegung: keine Anfrage, auch nach beliebiger Wartezeit', () => {
    const { anfragen, bremse } = aufgebaut()
    bremse.mitteBewegt(NAH.lat, NAH.lon)
    vi.advanceTimersByTime(60_000)
    expect(anfragen).toEqual([])
  })

  it('über ~25 m: die Anfrage kommt erst nach 1,2 s Ruhe, nicht sofort', () => {
    const { anfragen, bremse } = aufgebaut()
    bremse.mitteBewegt(WEIT.lat, WEIT.lon)
    vi.advanceTimersByTime(1_199)
    expect(anfragen).toEqual([])
    vi.advanceTimersByTime(1)
    expect(anfragen).toEqual([[WEIT.lat, WEIT.lon]])
  })

  it('schnelle Folge-Bewegungen münden in genau EINER Anfrage — für die letzte Position', () => {
    const { anfragen, bremse } = aufgebaut()
    bremse.mitteBewegt(48.201, 13.5)
    vi.advanceTimersByTime(300)
    bremse.mitteBewegt(48.202, 13.5)
    vi.advanceTimersByTime(300)
    bremse.mitteBewegt(48.203, 13.5)
    vi.advanceTimersByTime(1_200)
    expect(anfragen).toEqual([[48.203, 13.5]])
  })

  it('nach einer Anfrage zählt der Abstand ab dem angefragten Punkt', () => {
    const { anfragen, bremse } = aufgebaut()
    bremse.mitteBewegt(WEIT.lat, WEIT.lon)
    vi.advanceTimersByTime(1_200)
    expect(anfragen).toHaveLength(1)
    // Zurückruckeln um ~11 m: zu wenig für eine zweite Anfrage.
    bremse.mitteBewegt(WEIT.lat - 0.0001, WEIT.lon)
    vi.advanceTimersByTime(60_000)
    expect(anfragen).toHaveLength(1)
  })

  it('setzeBezugspunkt (programmatischer Sprung) verwirft Wartendes und löst nichts aus', () => {
    const { anfragen, bremse } = aufgebaut()
    bremse.mitteBewegt(WEIT.lat, WEIT.lon)
    bremse.setzeBezugspunkt(47.8, 13.0)
    vi.advanceTimersByTime(60_000)
    expect(anfragen).toEqual([])
    // Ein kleiner Ruck nach dem Sprung liegt unter der Schwelle des NEUEN Bezugspunkts.
    bremse.mitteBewegt(47.8001, 13.0)
    vi.advanceTimersByTime(60_000)
    expect(anfragen).toEqual([])
  })
})
