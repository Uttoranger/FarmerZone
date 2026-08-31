/**
 * Tests für die Umkreissuche der Hofübersicht: die reine Entfernungs- und
 * Ordnungslogik (src/lib/hofuebersicht.ts) und die Auflösung einer
 * eingetippten Postleitzahl über die BESTEHENDE Nominatim-Anbindung
 * (src/lib/geokodierung.ts, injizierbarer Lader — kein Netz).
 *
 * Der gemessene Gerätestandort taucht hier bewusst nirgends auf: Er verlässt
 * den Browser nie, es gibt also auch keinen Server-Pfad zu prüfen.
 */
import { describe, it, expect } from 'vitest'
import {
  entfernungKm,
  formatiereEntfernung,
  ordneNachEntfernung,
  UMKREIS_STUFEN,
} from '@/lib/hofuebersicht'
import { sucheOrtspunkt } from '@/lib/geokodierung'

describe('entfernungKm — Haversine', () => {
  it('Linz → Wien sind rund 154 km Luftlinie', () => {
    // Amtliche Punkte: Linz 48.3069/14.2858, Wien 48.2082/16.3738.
    const km = entfernungKm({ lat: 48.3069, lon: 14.2858 }, { lat: 48.2082, lon: 16.3738 })
    expect(km).toBeGreaterThan(154 * 0.99)
    expect(km).toBeLessThan(154 * 1.01)
  })

  it('Salzburg → Innsbruck sind rund 137,7 km Luftlinie', () => {
    // Der Wert ist die LUFTLINIE (Großkreis), nicht die Fahrstrecke — mit
    // dem sphärischen Kosinussatz unabhängig gegengerechnet.
    const km = entfernungKm({ lat: 47.8095, lon: 13.055 }, { lat: 47.2692, lon: 11.4041 })
    expect(km).toBeGreaterThan(137.7 * 0.99)
    expect(km).toBeLessThan(137.7 * 1.01)
  })

  it('derselbe Punkt hat Abstand null, und die Richtung ist egal', () => {
    const a = { lat: 48.21, lon: 13.49 }
    const b = { lat: 48.3, lon: 14.28 }
    expect(entfernungKm(a, a)).toBe(0)
    expect(entfernungKm(a, b)).toBeCloseTo(entfernungKm(b, a), 9)
  })
})

describe('formatiereEntfernung', () => {
  it('unter zehn Kilometern mit einer Nachkommastelle, darüber ganzzahlig', () => {
    expect(formatiereEntfernung(0.4)).toBe('0,4 km')
    expect(formatiereEntfernung(1.25)).toBe('1,3 km')
    expect(formatiereEntfernung(12.4)).toBe('12 km')
    expect(formatiereEntfernung(143)).toBe('143 km')
  })

  it('an der Zehner-Grenze kippt die Darstellung — auch im Rundungsfenster', () => {
    expect(formatiereEntfernung(9.94)).toBe('9,9 km')
    // 9,96 rundet auf 10,0 — dann gilt schon die ganzzahlige Darstellung,
    // sonst stünden „10,0 km" und „10 km" untereinander in derselben Liste.
    expect(formatiereEntfernung(9.96)).toBe('10 km')
    expect(formatiereEntfernung(9.999)).toBe('10 km')
    expect(formatiereEntfernung(10)).toBe('10 km')
    expect(formatiereEntfernung(10.2)).toBe('10 km')
  })

  it('unter hundert Metern sagt es „unter 0,1 km" statt „0,0 km"', () => {
    expect(formatiereEntfernung(0.04)).toBe('unter 0,1 km')
    expect(formatiereEntfernung(0)).toBe('unter 0,1 km')
    expect(formatiereEntfernung(0.1)).toBe('0,1 km')
  })

  it('an der Hunderter-Grenze bleibt es ganzzahlig', () => {
    expect(formatiereEntfernung(99.6)).toBe('100 km')
    expect(formatiereEntfernung(100)).toBe('100 km')
  })
})

/** Bezugspunkt für die Ordnungs-Tests: Linz. */
const LINZ = { lat: 48.3069, lon: 14.2858 }

/** Höfe in wachsender Entfernung von Linz plus einer ohne Kartenpunkt. */
const NAH = { slug: 'nah', latitude: 48.32, longitude: 14.3 } //      ~2 km
const MITTEL = { slug: 'mittel', latitude: 48.4, longitude: 14.35 } // ~12 km
const FERN = { slug: 'fern', latitude: 48.2082, longitude: 16.3738 } // ~154 km (Wien)
const OHNE = { slug: 'ohne', latitude: null, longitude: null }

describe('ordneNachEntfernung', () => {
  it('ohne Bezugspunkt bleibt die Reihenfolge, jede Entfernung ist null', () => {
    const geordnet = ordneNachEntfernung([FERN, NAH, OHNE], null)
    expect(geordnet.map((h) => h.slug)).toEqual(['fern', 'nah', 'ohne'])
    expect(geordnet.every((h) => h.entfernungKm === null)).toBe(true)
  })

  it('sortiert aufsteigend und trägt die Entfernung je Hof', () => {
    const geordnet = ordneNachEntfernung([FERN, MITTEL, NAH], LINZ)
    expect(geordnet.map((h) => h.slug)).toEqual(['nah', 'mittel', 'fern'])
    expect(geordnet[0].entfernungKm).toBeLessThan(geordnet[1].entfernungKm!)
  })

  it('Höfe OHNE Koordinaten stehen immer am Ende — in jeder Umkreisstufe', () => {
    for (const stufe of UMKREIS_STUFEN) {
      const geordnet = ordneNachEntfernung([OHNE, NAH], LINZ, stufe)
      expect(geordnet[geordnet.length - 1].slug).toBe('ohne')
      expect(geordnet[geordnet.length - 1].entfernungKm).toBeNull()
    }
  })

  it('Umkreis 10 km schließt den 12-km-Hof aus, behält aber den Hof ohne Koordinaten', () => {
    const geordnet = ordneNachEntfernung([NAH, MITTEL, FERN, OHNE], LINZ, 10)
    expect(geordnet.map((h) => h.slug)).toEqual(['nah', 'ohne'])
  })

  it('„egal" (null) versteckt nichts — auch den fernen Hof nicht', () => {
    const geordnet = ordneNachEntfernung([NAH, MITTEL, FERN, OHNE], LINZ, null)
    expect(geordnet.map((h) => h.slug)).toEqual(['nah', 'mittel', 'fern', 'ohne'])
  })

  it('ein Hof mit nur EINER Koordinate zählt wie ohne — ans Ende, nie ausgeschlossen', () => {
    // latitude und longitude sind unabhängig nullbar; eine halbe Koordinate
    // ergibt keine Entfernung, darf den Hof aber nicht verstecken.
    const HALB = { slug: 'halb', latitude: 48.3, longitude: null }
    const geordnet = ordneNachEntfernung([HALB, NAH], LINZ, 10)
    expect(geordnet.map((h) => h.slug)).toEqual(['nah', 'halb'])
    expect(geordnet[1].entfernungKm).toBeNull()
  })

  it('unbrauchbare Koordinaten (NaN) kippen die Ordnung nicht', () => {
    const KAPUTT = { slug: 'kaputt', latitude: Number.NaN, longitude: 14.3 }
    const geordnet = ordneNachEntfernung([FERN, KAPUTT, NAH, MITTEL], LINZ)
    expect(geordnet.map((h) => h.slug)).toEqual(['nah', 'mittel', 'fern', 'kaputt'])
    expect(geordnet[3].entfernungKm).toBeNull()
  })

  it('die Umkreisgrenze trennt dicht daneben richtig: 9,99 km bleibt, 10,01 km fällt', () => {
    // Ein Breitengrad ist auf der verwendeten Kugel (6371 km) π·6371/180 =
    // 111,195 km lang — damit lassen sich Punkte auf den Meter genau setzen.
    // (Genau 10,000000 km zu treffen wäre Fließkomma-Glückssache und für
    // niemanden beobachtbar; die Trennschärfe daneben ist das, was zählt.)
    const KM_JE_BREITENGRAD = (Math.PI * 6371) / 180
    const nordlich = (km: number, slug: string) => ({
      slug,
      latitude: LINZ.lat + km / KM_JE_BREITENGRAD,
      longitude: LINZ.lon,
    })
    const knappDrinnen = nordlich(9.99, 'drinnen')
    const knappDraussen = nordlich(10.01, 'draussen')

    expect(ordneNachEntfernung([knappDrinnen], LINZ)[0].entfernungKm).toBeCloseTo(9.99, 3)
    expect(ordneNachEntfernung([knappDraussen], LINZ)[0].entfernungKm).toBeCloseTo(10.01, 3)
    expect(
      ordneNachEntfernung([knappDraussen, knappDrinnen], LINZ, 10).map((h) => h.slug)
    ).toEqual(['drinnen'])
  })

  it('lässt die Eingabeliste unangetastet', () => {
    const eingabe = [FERN, NAH, OHNE]
    ordneNachEntfernung(eingabe, LINZ, 25)
    expect(eingabe.map((h) => h.slug)).toEqual(['fern', 'nah', 'ohne'])
    expect(eingabe[0]).not.toHaveProperty('entfernungKm')
  })
})

describe('sucheOrtspunkt — die Ortsauflösung über die Grenze', () => {
  const TREFFER = [
    { lat: '48.21', lon: '13.49', display_name: '4910 Ried im Innkreis', address: { country_code: 'at' } },
  ]

  it('eine VIERstellige Zahl fragt als POSTLEITZAHL — in AT und DE, ohne Straße', async () => {
    const angefragt: Record<string, string>[] = []
    const punkte = await sucheOrtspunkt('4910', async (parameter) => {
      angefragt.push(parameter)
      return TREFFER
    })

    expect(angefragt[0]).toEqual({ postalcode: '4910', countrycodes: 'at,de' })
    expect(punkte[0]).toMatchObject({ lat: 48.21, lon: 13.49, land: 'AT' })
  })

  it('auch eine FÜNFstellige Zahl ist eine Postleitzahl — deutsche PLZ haben fünf Stellen', async () => {
    const angefragt: Record<string, string>[] = []
    await sucheOrtspunkt('84359', async (parameter) => {
      angefragt.push(parameter)
      return TREFFER
    })

    expect(angefragt[0]).toEqual({ postalcode: '84359', countrycodes: 'at,de' })
  })

  it('alles andere fragt als ORT', async () => {
    const angefragt: Record<string, string>[] = []
    await sucheOrtspunkt('Simbach am Inn', async (parameter) => {
      angefragt.push(parameter)
      return TREFFER
    })

    expect(angefragt[0]).toEqual({ city: 'Simbach am Inn', countrycodes: 'at,de' })
  })

  it('liefert MEHRERE Kandidaten samt Land — „Simbach" gibt es beiderseits der Grenze', async () => {
    const punkte = await sucheOrtspunkt('Simbach', async () => [
      { lat: '48.27', lon: '13.02', display_name: 'Simbach am Inn, Bayern, Deutschland', address: { country_code: 'de' } },
      { lat: '48.25', lon: '13.03', display_name: 'Braunau am Inn, Oberösterreich, Österreich', address: { country_code: 'at' } },
    ])

    expect(punkte).toHaveLength(2)
    expect(punkte.map((k) => k.land)).toEqual(['DE', 'AT'])
  })

  it('leeres Ergebnis liefert eine leere Liste — der Zustand der Seite bleibt unverändert', async () => {
    expect(await sucheOrtspunkt('4910', async () => [])).toEqual([])
  })

  it('eine Zeitüberschreitung wird zur leeren Liste, nie zu einem Fehler', async () => {
    await expect(
      sucheOrtspunkt('4910', async () => {
        throw new Error('TimeoutError')
      })
    ).resolves.toEqual([])
  })

  it('fragt bei zu kurzer Eingabe gar nicht erst an', async () => {
    let angefragt = 0
    expect(
      await sucheOrtspunkt('  ', async () => {
        angefragt++
        return TREFFER
      })
    ).toEqual([])
    expect(angefragt).toBe(0)
  })
})
