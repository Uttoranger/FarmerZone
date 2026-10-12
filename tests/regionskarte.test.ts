/**
 * Tests für die Karte der Region auf der Startseite (Nr. 59): die reine
 * Kartenlogik in src/lib/regionskarte.ts und die Geodaten in
 * src/lib/regionskarte-daten.ts — ohne Mock.
 *
 * Beweist:
 *  - Die Projektion bildet die Ecken des Ausschnitts auf die Ecken der
 *    Zeichnung ab, in beiden Formen (Browser und Handy).
 *  - Die Geodaten liegen im Ausschnitt; Straßen tragen nur Beschriftungen aus
 *    den Datenfeldern (E-Nummern), keine erfundenen A- oder B-Nummern.
 *  - Die Gruppen-Pins kommen aus gruppierePins (Nr. 52) bei der festen
 *    Zoomstufe der Zeichnung — kein eigener Algorithmus.
 *  - Die Hofkarte bleibt ganz in der Zeichnung, ihre Linie beginnt am Pin und
 *    endet unter der Karte.
 *  - Beschriftungen: Flussnamen auf ihrem Fluss und aufrecht, die
 *    Regionsnamen auf der richtigen Seite der Grenzflüsse.
 */
import { describe, expect, it } from 'vitest'
import { gruppierePins, type PinPunkt } from '@/lib/hoefe-anzeige'
import {
  HOFKARTE_ANTEIL,
  REGIONSKARTE_MASSE,
  REGIONS_AUSSCHNITT,
  REGIONS_NAMEN,
  beschrifteLinie,
  platziereHofkarte,
  liegtImAusschnitt,
  projiziere,
  zeichneMarken,
  type KartenMass,
  type SvgPunkt,
} from '@/lib/regionskarte'
import { FLUESSE, STRASSEN, type Linienzug } from '@/lib/regionskarte-daten'

const { west, ost, sued, nord } = REGIONS_AUSSCHNITT
const FORMEN = Object.entries(REGIONSKARTE_MASSE) as [keyof typeof REGIONSKARTE_MASSE, KartenMass][]

/** Erfundene Punkte im Ausschnitt — Testwerte, keine Orte. */
const pin = (slug: string, nummer: number, lat: number, lon: number): PinPunkt => ({ slug, nummer, lat, lon })

function fluss(name: string): readonly Linienzug[] {
  const gefunden = FLUESSE.find((f) => f.name === name)
  if (!gefunden) throw new Error(`Fluss ${name} fehlt in den Daten`)
  return gefunden.linien
}

/** Wo eine gezeichnete Linie die Senkrechte bei x schneidet (erster Treffer), sonst null. */
function yAufLinie(linien: readonly Linienzug[], x: number, mass: KartenMass): number | null {
  for (const linie of linien) {
    const punkte = linie.map(([lon, lat]) => projiziere({ lat, lon }, mass))
    for (let i = 1; i < punkte.length; i++) {
      const [a, b] = [punkte[i - 1], punkte[i]]
      if ((a.x - x) * (b.x - x) <= 0 && a.x !== b.x) return a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y)
    }
  }
  return null
}

/** Wo eine gezeichnete Linie die Waagrechte bei y schneidet (alle Treffer). */
function xAufLinie(linien: readonly Linienzug[], y: number, mass: KartenMass): number[] {
  const treffer: number[] = []
  for (const linie of linien) {
    const punkte = linie.map(([lon, lat]) => projiziere({ lat, lon }, mass))
    for (let i = 1; i < punkte.length; i++) {
      const [a, b] = [punkte[i - 1], punkte[i]]
      if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) treffer.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x))
    }
  }
  return treffer
}

function abstandZurLinie(p: SvgPunkt, linien: readonly Linienzug[], mass: KartenMass): number {
  let kleinster = Infinity
  for (const linie of linien) {
    const punkte = linie.map(([lon, lat]) => projiziere({ lat, lon }, mass))
    for (let i = 1; i < punkte.length; i++) {
      const [a, b] = [punkte[i - 1], punkte[i]]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)))
      kleinster = Math.min(kleinster, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy))
    }
  }
  return kleinster
}

describe('projiziere', () => {
  it('bildet die vier Ecken des Ausschnitts auf die Ecken der Zeichnung ab — in beiden Formen', () => {
    for (const [form, mass] of FORMEN) {
      const ecken: [number, number, number, number][] = [
        [nord, west, 0, 0],
        [nord, ost, mass.breite, 0],
        [sued, west, 0, mass.hoehe],
        [sued, ost, mass.breite, mass.hoehe],
      ]
      for (const [lat, lon, x, y] of ecken) {
        const p = projiziere({ lat, lon }, mass)
        expect(p.x, `${form} ${lat}/${lon}`).toBeCloseTo(x, 6)
        expect(p.y, `${form} ${lat}/${lon}`).toBeCloseTo(y, 6)
      }
    }
  })

  it('Mercator wie die Webkarte: Norden oben, Osten rechts, die Höhe folgt der Breite der Zeichnung', () => {
    const [, web] = FORMEN.find(([f]) => f === 'web') ?? FORMEN[0]
    const mitte = projiziere({ lat: 48.2, lon: 13.2 }, web)
    expect(projiziere({ lat: 48.3, lon: 13.2 }, web).y).toBeLessThan(mitte.y)
    expect(projiziere({ lat: 48.2, lon: 13.3 }, web).x).toBeGreaterThan(mitte.x)
    // Der Ausschnitt ist im Mercator-Bild breiter als hoch — nie gestaucht auf ein Quadrat.
    for (const [, mass] of FORMEN) expect(mass.breite / mass.hoehe).toBeCloseTo(web.breite / web.hoehe, 6)
    expect(web.breite / web.hoehe).toBeGreaterThan(1.1)
  })

  it('liegtImAusschnitt: innen ja, knapp außerhalb nein', () => {
    expect(liegtImAusschnitt({ lat: 48.2, lon: 13.2 })).toBe(true)
    expect(liegtImAusschnitt({ lat: nord + 0.001, lon: 13.2 })).toBe(false)
    expect(liegtImAusschnitt({ lat: 48.2, lon: west - 0.001 })).toBe(false)
  })
})

describe('Geodaten aus Natural Earth', () => {
  const alle = [...FLUESSE.flatMap((f) => f.linien), ...STRASSEN.flatMap((s) => s.linien)]

  it('jeder Punkt liegt im Ausschnitt, jeder Linienzug hat mindestens zwei Punkte', () => {
    expect(alle.length).toBeGreaterThan(0)
    for (const linie of alle) {
      expect(linie.length).toBeGreaterThanOrEqual(2)
      for (const [lon, lat] of linie) expect(liegtImAusschnitt({ lat, lon }), `${lon}/${lat}`).toBe(true)
    }
  })

  it('Inn und Salzach sind da; Straßen tragen nur Beschriftungen aus den Datenfeldern', () => {
    expect(FLUESSE.map((f) => f.name).sort()).toEqual(['Inn', 'Salzach'])
    for (const strasse of STRASSEN) {
      if (strasse.beschriftung !== null) expect(strasse.beschriftung).toMatch(/^E\d+$/)
    }
    // Gegenprobe: Es gibt beschriftete Straßen — die Prüfung läuft nicht ins Leere.
    expect(STRASSEN.some((s) => s.beschriftung !== null)).toBe(true)
  })
})

describe('zeichneMarken — Gruppierung aus Nr. 52', () => {
  const PINS = [pin('a', 1, 48.2, 13.1), pin('b', 2, 48.2005, 13.1005), pin('c', 3, 48.05, 13.45)]

  it('übernimmt gruppierePins bei der festen Zoomstufe der Zeichnung', () => {
    for (const [, mass] of FORMEN) {
      const erwartet = gruppierePins(PINS, mass.zoom)
      const marken = zeichneMarken(PINS, mass, null)
      expect(marken.map((m) => m.schluessel)).toEqual(erwartet.map((m) => (m.art === 'pin' ? m.pin.slug : m.schluessel)))
      expect(marken.map((m) => m.anzahl)).toEqual(erwartet.map((m) => (m.art === 'pin' ? 1 : m.mitglieder.length)))
      for (const [i, m] of marken.entries()) {
        const p = projiziere(erwartet[i], mass)
        expect(m.x).toBeCloseTo(p.x, 6)
        expect(m.y).toBeCloseTo(p.y, 6)
      }
    }
  })

  it('zwei nahe Höfe werden ein Gruppen-Pin mit Zahl, ein ferner bleibt allein', () => {
    const marken = zeichneMarken(PINS, REGIONSKARTE_MASSE.web, null)
    expect(marken).toHaveLength(2)
    expect(marken[0]).toMatchObject({ art: 'gruppe', anzahl: 2 })
    expect(marken[1]).toMatchObject({ art: 'pin', schluessel: 'c', anzahl: 1 })
  })

  it('hervorgehoben ist der Pin des Hofs oder die Gruppe, in der er steckt — sonst nichts', () => {
    const web = REGIONSKARTE_MASSE.web
    expect(zeichneMarken(PINS, web, 'c').map((m) => m.hervorgehoben)).toEqual([false, true])
    expect(zeichneMarken(PINS, web, 'b').map((m) => m.hervorgehoben)).toEqual([true, false])
    expect(zeichneMarken(PINS, web, null).some((m) => m.hervorgehoben)).toBe(false)
  })
})

describe('platziereHofkarte — die Hofkarte neben ihrem Pin', () => {
  const stellen = (mass: KartenMass): SvgPunkt[] =>
    [
      [0.02, 0.02],
      [0.98, 0.02],
      [0.02, 0.98],
      [0.98, 0.98],
      [0.5, 0.5],
      [0.3, 0.7],
    ].map(([x, y]) => ({ x: x * mass.breite, y: y * mass.hoehe }))

  it('die Karte bleibt ganz in der Zeichnung, in jeder Ecke und in der Mitte', () => {
    for (const [form, mass] of FORMEN) {
      const breite = HOFKARTE_ANTEIL[form] * 100
      for (const stelle of stellen(mass)) {
        const lage = platziereHofkarte(stelle, mass, HOFKARTE_ANTEIL[form])
        expect(lage.links).toBeGreaterThanOrEqual(0)
        expect(lage.links + breite).toBeLessThanOrEqual(100)
        expect(lage.senkrecht.abstand).toBeGreaterThanOrEqual(0)
        expect(lage.senkrecht.abstand).toBeLessThanOrEqual(100)
      }
    }
  })

  it('oben hängt die Karte unter dem Pin, unten steht sie darüber', () => {
    const web = REGIONSKARTE_MASSE.web
    expect(platziereHofkarte({ x: 100, y: 0.2 * web.hoehe }, web, HOFKARTE_ANTEIL.web).senkrecht.kante).toBe('oben')
    expect(platziereHofkarte({ x: 100, y: 0.8 * web.hoehe }, web, HOFKARTE_ANTEIL.web).senkrecht.kante).toBe('unten')
  })

  it('die Linie beginnt am Pin und endet unter der Karte', () => {
    for (const [form, mass] of FORMEN) {
      const anteil = HOFKARTE_ANTEIL[form]
      for (const stelle of stellen(mass)) {
        const { links, senkrecht, linie } = platziereHofkarte(stelle, mass, anteil)
        expect(linie.x1).toBe(stelle.x)
        expect(linie.y1).toBe(stelle.y)
        // Waagrecht innerhalb der Karte …
        expect(linie.x2).toBeGreaterThanOrEqual((links / 100) * mass.breite)
        expect(linie.x2).toBeLessThanOrEqual(((links + anteil * 100) / 100) * mass.breite)
        // … und senkrecht knapp hinter ihrer Kante, also unter ihr verborgen.
        if (senkrecht.kante === 'oben') expect(linie.y2).toBeGreaterThan((senkrecht.abstand / 100) * mass.hoehe)
        else expect(linie.y2).toBeLessThan(((100 - senkrecht.abstand) / 100) * mass.hoehe)
      }
    }
  })
})

describe('Beschriftungen', () => {
  it('Flussnamen stehen an ihrem Fluss, aufrecht lesbar und nicht am Rand', () => {
    for (const [form, mass] of FORMEN) {
      for (const { name, linien } of FLUESSE) {
        const b = beschrifteLinie(name, linien, mass, { abstand: 6 })
        expect(b, `${form} ${name}`).not.toBeNull()
        if (!b) continue
        expect(b.text).toBe(name)
        expect(abstandZurLinie(b, linien, mass)).toBeLessThanOrEqual(6.01)
        expect(b.winkel).toBeGreaterThan(-90)
        expect(b.winkel).toBeLessThanOrEqual(90)
        expect(Math.min(b.x, mass.breite - b.x, b.y, mass.hoehe - b.y)).toBeGreaterThanOrEqual(12)
      }
    }
  })

  it('ohne Platz im Bild keine Beschriftung — lieber keine als eine abgeschnittene', () => {
    const amRand: Linienzug = [
      [west + 0.1, sued + 0.001],
      [west + 0.2, sued + 0.001],
    ]
    expect(beschrifteLinie('E1', [amRand], REGIONSKARTE_MASSE.web)).toBeNull()
  })

  it('ein Name weicht schon Gesetztem aus (Pins, andere Namen) — oder steht gar nicht da', () => {
    const web = REGIONSKARTE_MASSE.web
    const { linien } = FLUESSE[0]
    const frei = beschrifteLinie('Fluss', linien, web)
    expect(frei).not.toBeNull()
    if (!frei) return
    const ausgewichen = beschrifteLinie('Fluss', linien, web, { besetzt: [frei] })
    if (ausgewichen) expect(Math.hypot(ausgewichen.x - frei.x, ausgewichen.y - frei.y)).toBeGreaterThanOrEqual(40)
    // Rundum besetzt: keine Stelle frei, also keine Beschriftung.
    const ueberall = linien.flatMap((l) => l.map(([lon, lat]) => projiziere({ lat, lon }, web)))
    expect(beschrifteLinie('Fluss', linien, web, { besetzt: ueberall })).toBeNull()
  })

  it('BAYERN liegt links der Grenzflüsse, INNVIERTEL rechts davon', () => {
    const inn = fluss('Inn')
    const salzach = fluss('Salzach')
    for (const [form, mass] of FORMEN) {
      const name = (text: string) => {
        const gefunden = REGIONS_NAMEN.find((n) => n.text === text)
        if (!gefunden) throw new Error(`${text} fehlt`)
        return { x: gefunden.x * mass.breite, y: gefunden.y * mass.hoehe }
      }
      const bayern = name('BAYERN')
      const innUnterBayern = yAufLinie(inn, bayern.x, mass)
      expect(innUnterBayern, form).not.toBeNull()
      expect(bayern.y, form).toBeLessThan(innUnterBayern ?? 0)

      const innviertel = name('INNVIERTEL')
      // Rechts vom Inn heißt: unter ihm, oder dort, wo er die Zeichnung schon oben verlassen hat.
      const innUeber = yAufLinie(inn, innviertel.x, mass)
      if (innUeber !== null) expect(innviertel.y, form).toBeGreaterThan(innUeber)
      for (const x of xAufLinie(salzach, innviertel.y, mass)) expect(innviertel.x, form).toBeGreaterThan(x)
    }
  })
})
