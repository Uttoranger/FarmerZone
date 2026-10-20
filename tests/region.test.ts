/**
 * Region (Register N23, Nr. 122): die reinen Regeln aus src/lib/region.ts —
 * ohne Mock.
 *
 * Beweist:
 *  - zaehleJeStufe zählt je Stufe mit derselben Grenze (≤) wie waehleHoefeImUmkreis:
 *    genau 10, 25 und 50 km zählen mit, ein Hauch darüber nicht; und an echten
 *    Koordinaten dieselbe Zahl wie die Auswahl der Liste.
 *  - ohneStandortHinweis: ein Satz für beide Reiter, lang und kurz, Einzahl und Mehrzahl.
 *  - eigeneListenkarte: die eigene Hofkarte im Bereich, in dem die Liste den Hof
 *    zeigt (Hofladen, ein reiner Futterhof im Futter), ohne Entfernung, mit dem
 *    Schaufenster von /hoefe.
 */
import { describe, it, expect } from 'vitest'
import { STANDORT_ANKER, STANDORT_SETZEN_HREF, eigeneListenkarte, ohneStandortHinweis, zaehleJeStufe, type ListenEintrag } from '@/lib/region'
import { waehleHoefeImUmkreis, UMFELD_KM } from '@/lib/umfeld'
import { entfernungKm, type VorschauProdukt } from '@/lib/hofuebersicht'
import type { AngebotsZeile } from '@/lib/bereiche-anzeige'

describe('zaehleJeStufe — die Zahl je Stufe des Umkreises', () => {
  it('zählt einen Hof in genau 10, 25 und 50 km mit, einen Hauch darüber nicht', () => {
    expect(zaehleJeStufe([10, 25, 50])).toEqual({ 10: 1, 25: 2, 50: 3 })
    expect(zaehleJeStufe([10.0001, 25.0001, 50.0001])).toEqual({ 10: 0, 25: 1, 50: 2 })
  })

  it('ohne Höfe ist jede Stufe 0; ein Hof am eigenen Ort zählt überall', () => {
    expect(zaehleJeStufe([])).toEqual({ 10: 0, 25: 0, 50: 0 })
    expect(zaehleJeStufe([0])).toEqual({ 10: 1, 25: 1, 50: 1 })
  })

  it('an echten Koordinaten dieselbe Zahl wie die Auswahl der Liste (waehleHoefeImUmkreis)', () => {
    const mitte = { lat: 48.0, lon: 14.0 }
    // Höfe auf einem Meridian, je 0,05° (≈ 5,6 km) weiter — darunter Punkte nahe 10, 25 und 50 km.
    const hoefe = Array.from({ length: 12 }, (_, i) => ({ id: `h${i}`, latitude: mitte.lat + 0.05 * (i + 1), longitude: mitte.lon }))
    const entfernungen = hoefe.map((h) => entfernungKm(mitte, { lat: h.latitude, lon: h.longitude }))
    const zahlen = zaehleJeStufe(entfernungen)
    for (const km of UMFELD_KM) {
      expect(zahlen[km], `${km} km`).toBe(waehleHoefeImUmkreis(mitte, hoefe, km, 'eigen', Infinity).nah.length)
    }
    // Gegenprobe: Die Stufen unterscheiden sich wirklich — sonst bewiese der Vergleich nichts.
    expect(new Set(Object.values(zahlen)).size).toBe(3)
  })
})

describe('ohneStandortHinweis — ein Satz für beide Reiter', () => {
  it('lang über Liste und Karte, in Einzahl und Mehrzahl', () => {
    expect(ohneStandortHinweis(1)).toBe('1 Hof hat noch keinen Standort auf der Karte und fehlt hier.')
    expect(ohneStandortHinweis(3)).toBe('3 Höfe haben noch keinen Standort auf der Karte und fehlen hier.')
  })

  it('kurz für die Karte am Handy', () => {
    expect(ohneStandortHinweis(1, { kurz: true })).toBe('1 Hof ohne Standort fehlt hier.')
    expect(ohneStandortHinweis(3, { kurz: true })).toBe('3 Höfe ohne Standort fehlen hier.')
  })
})

describe('Standort setzen — Ziel und Anker aus einer Quelle', () => {
  it('der Knopf führt direkt zur Karte im Hofprofil', () => {
    expect(STANDORT_SETZEN_HREF).toBe(`/settings/profile#${STANDORT_ANKER}`)
  })
})

const zeile = (category: AngebotsZeile['category'], name: string): AngebotsZeile => ({
  name,
  category,
  subcategory: null,
  labels: [],
  tiere: [],
  grundpreis: null,
  grossgebinde: null,
})
const produkt = (id: string, name: string, category: VorschauProdukt['category']): VorschauProdukt => ({
  id,
  name,
  price: 4.2,
  unit: 'STUECK',
  unitSize: null,
  imageUrl: null,
  bildAusschnitt: null,
  category,
  verfuegbar: true,
})
const EINTRAG: ListenEintrag & { slug: string } = {
  slug: 'testhof-a',
  name: 'Testhof A',
  kategorien: ['EIER', 'HEU_STROH'],
  suchNamen: ['Freilandeier', 'Heu'],
  angebot: [zeile('EIER', 'Freilandeier'), zeile('HEU_STROH', 'Heu')],
  latitude: null,
  longitude: null,
  isPaused: false,
  abholfenster: [{ dayOfWeek: 3, startTime: '15:00', endTime: '18:00' }],
  produkte: [produkt('a', 'Freilandeier', 'EIER'), produkt('b', 'Heu', 'HEU_STROH'), produkt('c', 'Topfen', 'MILCH')],
  produkteJeBereich: { LEBENSMITTEL: 7, FUTTERMITTEL: 1 },
}
const JETZT = new Date('2026-10-21T08:00:00.000Z')

describe('eigeneListenkarte — so steht der eigene Hof in der Liste der Kundschaft', () => {
  it('im Hofladen: Kategorien des Bereichs, keine Entfernung, Schaufenster und „+ n weitere" wie /hoefe', () => {
    const karte = eigeneListenkarte(EINTRAG, JETZT)
    expect(karte?.bereich).toBe('LEBENSMITTEL')
    expect(karte?.hof.slug).toBe('testhof-a')
    expect(karte?.hof.kategorien).toEqual(['EIER'])
    expect(karte?.hof.entfernungKm).toBeNull()
    expect(karte?.schaufenster.produkte.map((p) => p.name)).toEqual(['Freilandeier', 'Topfen'])
    expect(karte?.schaufenster.weitere).toBe(5)
  })

  it('ein reiner Futterhof steht im Futter — dort, wo die Kundschaft ihn findet', () => {
    const futterhof = { ...EINTRAG, angebot: [zeile('HEU_STROH', 'Heu')], produkte: [produkt('b', 'Heu', 'HEU_STROH')], produkteJeBereich: { LEBENSMITTEL: 0, FUTTERMITTEL: 1 } }
    const karte = eigeneListenkarte(futterhof, JETZT)
    expect(karte?.bereich).toBe('FUTTERMITTEL')
    expect(karte?.schaufenster.produkte.map((p) => p.name)).toEqual(['Heu'])
  })

  it('ohne kaufbares Angebot steht der Hof im Hofladen wie auf /hoefe — mit leerem Schaufenster', () => {
    const leer = { ...EINTRAG, angebot: [], produkte: [], produkteJeBereich: { LEBENSMITTEL: 0, FUTTERMITTEL: 0 } }
    const karte = eigeneListenkarte(leer, JETZT)
    expect(karte?.bereich).toBe('LEBENSMITTEL')
    expect(karte?.schaufenster).toEqual({ produkte: [], weitere: 0 })
  })
})
