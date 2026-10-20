/**
 * Der Filter „Abholung" auf /hoefe (Register N22, Nr. 120): Adresse
 * `?abholung=heute|morgen|wochenende`, die Reihe als Links, die Zählung
 * „holen heute ab", die Zahlzeile und der Leerzustand mit „Morgen zeigen".
 * Gerechnet wird im Browser aus den Abholzeiten — rein, mit fester Uhr.
 *
 * Mi, 21. Okt 2026, 08:00 UTC ist 10:00 in Wien (Sommerzeit bis 25. Okt).
 */
import { describe, expect, it } from 'vitest'
import { LEERER_HOEFE_FILTER, leseHoefeFilter, schreibeHoefeFilter, type HoefeFilter } from '@/schemas/hoefe-filter'
import { berechneHofAuswahl, type AbholFenster } from '@/lib/hofuebersicht'
import {
  abholungReihe,
  aktiveFilter,
  hoefeHref,
  leerzustand,
  naechsterAbholtag,
  zaehleFilter,
  zahlZeile,
} from '@/lib/hoefe-entdecken'
import type { AngebotsProdukt } from '@/lib/bereiche-anzeige'

const JETZT = new Date('2026-10-21T08:00:00Z')
const lies = (query: string) => leseHoefeFilter(new URLSearchParams(query))

const EIER: AngebotsProdukt = {
  id: 'p1',
  name: 'Freilandeier',
  category: 'EIER',
  subcategory: null,
  labels: [],
  tiere: [],
  grundpreis: null,
  grossgebinde: null,
  price: 4.2,
  unit: 'STUECK',
  unitSize: null,
  imageUrl: null,
  bildAusschnitt: null,
}

const fenster = (dayOfWeek: number, startTime: string): AbholFenster => ({ dayOfWeek, startTime, endTime: '18:00' })

function hof(name: string, abholfenster: AbholFenster[], weiteres: { angebot?: AngebotsProdukt[]; isPaused?: boolean } = {}) {
  return {
    name,
    kategorien: ['EIER' as const],
    suchNamen: ['Freilandeier'],
    angebot: weiteres.angebot ?? [EIER],
    latitude: null,
    longitude: null,
    isPaused: weiteres.isPaused ?? false,
    abholfenster,
  }
}

// Testhof A holt heute ab, Testhof B morgen, Sonnhof am Samstag; der Pausierte und der ohne Angebot nie.
const HOEFE = [
  hof('Testhof A', [fenster(3, '15:00')]),
  hof('Testhof B', [fenster(4, '15:00')]),
  hof('Sonnhof', [fenster(6, '09:00')]),
  hof('Testhof Pause', [fenster(3, '16:00')], { isPaused: true }),
  hof('Testhof leer', [fenster(3, '16:00')], { angebot: [] }),
]

const auswahl = (filter: Partial<HoefeFilter>, jetzt = JETZT) =>
  berechneHofAuswahl(HOEFE, { ...LEERER_HOEFE_FILTER, ...filter, bezugspunkt: null, umkreis: null, jetzt })

describe('die Adresse', () => {
  it('liest heute, morgen und Wochenende; alles andere ist „alle Tage" — und schreibt sich zurück', () => {
    expect(lies('abholung=heute').abholung).toBe('heute')
    expect(lies('abholung=morgen').abholung).toBe('morgen')
    expect(lies('abholung=wochenende').abholung).toBe('wochenende')
    expect(lies('abholung=jetzt').abholung).toBeNull()
    expect(lies('').abholung).toBeNull()
    expect(schreibeHoefeFilter({ ...LEERER_HOEFE_FILTER, abholung: 'heute' })).toBe('abholung=heute')
    expect(hoefeHref({ ...LEERER_HOEFE_FILTER, abholung: null })).toBe('/hoefe')
  })

  it('die Reihe: Alle Tage · Heute · Morgen · Wochenende, eine Wahl, jeder Chip mit seinem Ziel', () => {
    const reihe = abholungReihe({ ...LEERER_HOEFE_FILTER, abholung: 'heute' })
    expect(reihe.map((c) => c.label)).toEqual(['Alle Tage', 'Heute', 'Morgen', 'Wochenende'])
    expect(reihe.filter((c) => c.aktiv).map((c) => c.label)).toEqual(['Heute'])
    expect(hoefeHref(reihe[2].ziel)).toBe('/hoefe?abholung=morgen')
    expect(hoefeHref(reihe[0].ziel)).toBe('/hoefe')
  })

  it('steht in „Aktive Filter" und zählt am Filter-Knopf', () => {
    const filter = { ...LEERER_HOEFE_FILTER, abholung: 'wochenende' as const }
    expect(aktiveFilter(filter).map((f) => f.label)).toEqual(['Abholung am Wochenende'])
    expect(aktiveFilter(filter)[0].ohne.abholung).toBeNull()
    expect(zaehleFilter(filter)).toBe(1)
    expect(zaehleFilter(LEERER_HOEFE_FILTER)).toBe(0)
  })
})

describe('berechneHofAuswahl mit Abholung', () => {
  it('„Heute" lässt nur Höfe, bei denen man heute noch bestellen kann — Reihenfolge bleibt', () => {
    expect(auswahl({ abholung: 'heute' }).gefiltert.map((h) => h.name)).toEqual(['Testhof A'])
    expect(auswahl({ abholung: 'morgen' }).gefiltert.map((h) => h.name)).toEqual(['Testhof B'])
    expect(auswahl({ abholung: 'wochenende' }).gefiltert.map((h) => h.name)).toEqual(['Sonnhof'])
    // Ohne Abholung: alle, auch die nicht bestellbaren, an ihrem Platz (AGB §3, O4).
    expect(auswahl({}).gefiltert.map((h) => h.name)).toEqual(HOEFE.map((h) => h.name))
  })

  it('leert erst die Abholung die Liste, sagt es abholungLeertDieListe — sonst nicht', () => {
    const spaet = new Date('2026-10-21T17:30:00Z') // Mi 19:30 in Wien
    const leer = auswahl({ abholung: 'heute' }, spaet)
    expect(leer.gefiltert).toEqual([])
    expect(leer.abholungLeertDieListe).toBe(true)
    expect(leer.abholBasis).toHaveLength(HOEFE.length)
    expect(auswahl({ abholung: 'heute' }).abholungLeertDieListe).toBe(false)
    expect(auswahl({ abholung: 'heute', kategorien: ['FISCH'] }, spaet).abholungLeertDieListe).toBe(false)
  })
})

describe('Zahlzeile', () => {
  const zeile = (eingabe: Partial<Parameters<typeof zahlZeile>[0]>) =>
    zahlZeile({ filter: LEERER_HOEFE_FILTER, anzahl: 5, holenHeute: 2, mitBezugspunkt: true, jetzt: JETZT, ...eingabe })

  it('„5 Höfe · 2 holen heute ab · nach Entfernung", ohne Bezugspunkt „nach Freischaltung"', () => {
    expect(zeile({})).toBe('5 Höfe · 2 holen heute ab · nach Entfernung')
    expect(zeile({ mitBezugspunkt: false, holenHeute: 1 })).toBe('5 Höfe · 1 holt heute ab · nach Freischaltung')
    expect(zeile({ holenHeute: 0 })).toBe('5 Höfe · nach Entfernung')
  })

  it('mit gewählter Abholung „2 Höfe holen heute ab", leer nach „Heute" mit der Uhrzeit', () => {
    expect(zeile({ filter: { ...LEERER_HOEFE_FILTER, abholung: 'heute' }, anzahl: 2 })).toBe('2 Höfe holen heute ab · nach Entfernung')
    expect(zeile({ filter: { ...LEERER_HOEFE_FILTER, abholung: 'wochenende' }, anzahl: 1 })).toBe('1 Hof holt am Wochenende ab · nach Entfernung')
    const spaet = new Date('2026-10-21T17:30:00Z')
    expect(zeile({ filter: { ...LEERER_HOEFE_FILTER, abholung: 'heute' }, anzahl: 0, jetzt: spaet })).toBe('Kein Hof holt heute noch ab · 19:30 Uhr')
  })

  it('Produkte (Suche, Futter) zählen wie bisher', () => {
    expect(zeile({ filter: { ...LEERER_HOEFE_FILTER, suchtext: 'Eier' }, anzahl: 3 })).toBe('3 Treffer')
  })
})

describe('Leerzustand „Heute holt hier kein Hof mehr ab"', () => {
  const spaet = new Date('2026-10-21T17:30:00Z') // Mi 19:30 in Wien
  const heute = { ...LEERER_HOEFE_FILTER, abholung: 'heute' as const }

  it('nennt morgen mit der Zahl der Höfe und führt mit „Morgen zeigen" dorthin', () => {
    const naechster = naechsterAbholtag(HOEFE, spaet)
    expect(naechster).toEqual({ versatz: 1, kalendertag: '2026-10-22', anzahl: 1 })
    const leer = leerzustand({ sucheLeertDieListe: false, umkreis: null, filter: heute, abholung: { naechster } })
    expect(leer.titel).toBe('Heute holt hier kein Hof mehr ab')
    expect(leer.satz).toBe('Morgen holt 1 Hof in deiner Nähe ab – du kannst schon jetzt bestellen.')
    expect(leer.ausweg).toEqual({ art: 'link', label: 'Morgen zeigen', ziel: { ...heute, abholung: 'morgen' } })
  })

  it('holt auch morgen keiner ab, nennt sie den nächsten Tag mit Abholung und führt zu „Alle Tage"', () => {
    const nurSamstag = [hof('Sonnhof', [fenster(6, '09:00')])]
    const naechster = naechsterAbholtag(nurSamstag, spaet)
    expect(naechster).toEqual({ versatz: 3, kalendertag: '2026-10-24', anzahl: 1 })
    const leer = leerzustand({ sucheLeertDieListe: false, umkreis: null, filter: heute, abholung: { naechster } })
    expect(leer.satz).toBe('Am Samstag holt 1 Hof in deiner Nähe ab – du kannst schon jetzt bestellen.')
    expect(leer.ausweg).toMatchObject({ art: 'link', label: 'Alle Tage', ziel: { abholung: null } })
  })

  it('ohne jeden Tag mit Abholung bleibt der Ausweg „Alle Tage"', () => {
    const leer = leerzustand({ sucheLeertDieListe: false, umkreis: null, filter: heute, abholung: { naechster: naechsterAbholtag([], spaet) } })
    expect(leer.ausweg).toMatchObject({ label: 'Alle Tage' })
  })

  it('Gegenprobe: ohne Abholung-Leere bleibt es beim bisherigen Leerzustand', () => {
    expect(leerzustand({ sucheLeertDieListe: false, umkreis: null, filter: heute }).titel).toBe('Kein Hof führt gerade etwas aus dieser Auswahl')
  })
})
