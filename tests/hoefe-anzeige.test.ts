/**
 * Tests für die reine Anzeige-Logik der Karten
 * (src/lib/hoefe-anzeige.ts): die gemeinsame Auswahl-Grammatik, die drei
 * Pin-Zustände samt Stil-Stufen, die Karussell-Snap-Erkennung und seit
 * Nr. 52 die Gruppen-Pins (überlappende Pins), die Projektion der Webkarte
 * und der Merker „hat die Nutzerin den Ausschnitt bewegt?".
 */
import { describe, it, expect } from 'vitest'
import {
  KARTEN_KACHELN,
  KARTE_LAEDT,
  LEERE_LAGE,
  ausWeltPixel,
  erstelleAusschnittMerker,
  gruppenBeschriftung,
  gruppenPinMasse,
  gruppenZustand,
  gruppierePins,
  nachLeerTipp,
  nachPinTipp,
  nachZeiger,
  pinDarstellung,
  pinZustand,
  weltPixel,
  zentrierterIndex,
  zoomBisEinzeln,
  zoomZumAufloesen,
  type KartenMarke,
  type PinPunkt,
} from '@/lib/hoefe-anzeige'
import { SEED_HOEFE } from '../prisma/seed-daten'

describe('Auswahl-Grammatik', () => {
  it('Pin-Tipp setzt die Auswahl', () => {
    expect(nachPinTipp(LEERE_LAGE, 'hof-a').ausgewaehlt).toBe('hof-a')
  })

  it('Leertipp hebt die Auswahl auf', () => {
    const lage = nachLeerTipp(nachPinTipp(LEERE_LAGE, 'hof-a'))
    expect(lage.ausgewaehlt).toBeNull()
  })

  it('Zeiger-Hervorhebung ändert die Auswahl NICHT — Betreten wie Verlassen', () => {
    const gewaehlt = nachPinTipp(LEERE_LAGE, 'hof-a')
    const mitZeiger = nachZeiger(gewaehlt, 'hof-b')
    expect(mitZeiger.ausgewaehlt).toBe('hof-a')
    expect(mitZeiger.hervorgehoben).toBe('hof-b')
    const ohneZeiger = nachZeiger(mitZeiger, null)
    expect(ohneZeiger.ausgewaehlt).toBe('hof-a')
    expect(ohneZeiger.hervorgehoben).toBeNull()
  })

  it('ein neuer Pin-Tipp lässt eine bestehende Zeiger-Hervorhebung stehen', () => {
    const lage = nachPinTipp(nachZeiger(LEERE_LAGE, 'hof-b'), 'hof-a')
    expect(lage).toEqual({ ausgewaehlt: 'hof-a', hervorgehoben: 'hof-b' })
  })
})

describe('pinZustand', () => {
  it('Auswahl schlägt Zeiger, Zeiger schlägt normal', () => {
    const lage = { ausgewaehlt: 'hof-a', hervorgehoben: 'hof-b' }
    expect(pinZustand('hof-a', lage)).toBe('ausgewaehlt')
    expect(pinZustand('hof-b', lage)).toBe('hervorgehoben')
    expect(pinZustand('hof-c', lage)).toBe('normal')
  })

  it('der gewählte Pin bleibt gewählt, auch wenn der Zeiger über ihm steht', () => {
    expect(pinZustand('hof-a', { ausgewaehlt: 'hof-a', hervorgehoben: 'hof-a' })).toBe('ausgewaehlt')
  })
})

describe('pinDarstellung — drei Stufen, Haus-Stil ohne Orange', () => {
  it('ausgewählt ist am größten und im Hof-Grün gefüllt, Nummer weiß', () => {
    expect(pinDarstellung('ausgewaehlt')).toEqual({
      groesse: 34,
      hintergrund: '#2D5F3F',
      schrift: '#FFFFFF',
      rand: '#FFFFFF',
    })
  })

  it('hervorgehoben ist die Zwischenstufe auf Sandgrün', () => {
    const stil = pinDarstellung('hervorgehoben')
    expect(stil.groesse).toBe(31)
    expect(stil.hintergrund).toBe('#E8F0E2')
    expect(stil.schrift).toBe('#1F4630')
  })

  it('normal ist die weiße Scheibe mit grüner Nummer', () => {
    const stil = pinDarstellung('normal')
    expect(stil.groesse).toBe(28)
    expect(stil.hintergrund).toBe('#FFFFFF')
    expect(stil.schrift).toBe('#2D5F3F')
  })

  it('die Größen steigen streng: normal < hervorgehoben < ausgewählt', () => {
    expect(pinDarstellung('normal').groesse).toBeLessThan(pinDarstellung('hervorgehoben').groesse)
    expect(pinDarstellung('hervorgehoben').groesse).toBeLessThan(
      pinDarstellung('ausgewaehlt').groesse
    )
  })
})

describe('zentrierterIndex — die Karussell-Snap-Erkennung', () => {
  const SCHRITT = 272 // 260 Kartenbreite + 12 Abstand

  it('Anfang: Scrollposition 0 ist die erste Karte', () => {
    expect(zentrierterIndex(0, SCHRITT, 5)).toBe(0)
  })

  it('Mitte: die nächstgelegene Karte gewinnt, auch zwischen zwei Rastpunkten', () => {
    expect(zentrierterIndex(2 * SCHRITT, SCHRITT, 5)).toBe(2)
    expect(zentrierterIndex(2 * SCHRITT + 100, SCHRITT, 5)).toBe(2)
    expect(zentrierterIndex(2 * SCHRITT + 200, SCHRITT, 5)).toBe(3)
  })

  it('Ende: hinter der letzten Karte wird auf sie geklemmt', () => {
    expect(zentrierterIndex(99 * SCHRITT, SCHRITT, 5)).toBe(4)
    expect(zentrierterIndex(-50, SCHRITT, 5)).toBe(0)
  })

  it('leere Liste und Unsinn-Schritt fallen ruhig auf 0', () => {
    expect(zentrierterIndex(100, SCHRITT, 0)).toBe(0)
    expect(zentrierterIndex(100, 0, 5)).toBe(0)
  })
})

// ─── Nr. 52: Kacheln, Projektion, Gruppen-Pins ──────────────────────────────

describe('Kachelquelle und Texte aus einer Quelle', () => {
  it('die Kachelquelle bleibt OSM mit sichtbarer Attribution (Register O6)', () => {
    expect(KARTEN_KACHELN.url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png')
    expect(KARTEN_KACHELN.maxZoom).toBe(19)
    expect(KARTEN_KACHELN.attribution).toContain('href="https://www.openstreetmap.org/copyright"')
    expect(KARTEN_KACHELN.attribution).toContain('OpenStreetMap</a>-Mitwirkende')
    // Ein Link im Text braucht mehr als die Farbe (Axe „link-in-text-block").
    expect(KARTEN_KACHELN.attribution).toContain('style="text-decoration:underline"')
  })

  it('der Platzhalter sagt, was passiert', () => {
    expect(KARTE_LAEDT).toBe('Karte lädt …')
  })
})

describe('weltPixel — die Projektion der Webkarte (wie Leaflet, EPSG:3857)', () => {
  it('Nullpunkt und Datumsgrenze bei Zoomstufe 0 (256 px Welt)', () => {
    expect(weltPixel(0, 0, 0)).toEqual({ x: 128, y: 128 })
    expect(weltPixel(0, 180, 0).x).toBe(256)
    expect(weltPixel(0, -180, 0).x).toBe(0)
  })

  it('trifft die bekannte Kachel von Wien bei Zoomstufe 10 (x 558, y 355)', () => {
    const p = weltPixel(48.2082, 16.3738, 10)
    expect(Math.floor(p.x / 256)).toBe(558)
    expect(Math.floor(p.y / 256)).toBe(355)
  })

  it('jede Zoomstufe verdoppelt die Abstände', () => {
    const a = weltPixel(48.25, 13.04, 9)
    const b = weltPixel(48.25, 13.04, 10)
    expect(b.x).toBeCloseTo(a.x * 2, 9)
    expect(b.y).toBeCloseTo(a.y * 2, 9)
  })

  it('ausWeltPixel kehrt sie um', () => {
    for (const [lat, lon] of [[48.2563, 13.0434], [-33.9, 18.4], [0, 0], [64.1, -21.9]]) {
      const zurueck = ausWeltPixel(weltPixel(lat, lon, 13).x, weltPixel(lat, lon, 13).y, 13)
      expect(zurueck.lat).toBeCloseTo(lat, 9)
      expect(zurueck.lon).toBeCloseTo(lon, 9)
    }
  })

  it('Pole werden wie bei Leaflet auf ±85,0511° geklemmt, statt unendlich zu werden', () => {
    expect(Number.isFinite(weltPixel(90, 0, 3).y)).toBe(true)
    expect(weltPixel(90, 0, 0).y).toBeCloseTo(0, 6)
    expect(weltPixel(-90, 0, 0).y).toBeCloseTo(256, 6)
  })
})

/** Pins in einem kleinen Gebiet; der Abstand in Pixeln hängt an der Zoomstufe. */
function pin(nummer: number, lat: number, lon: number): PinPunkt {
  return { slug: `hof-${nummer}`, nummer, lat, lon }
}

/** Ein Punkt, der bei Zoomstufe `zoom` genau `dx`/`dy` Pixel neben `basis` liegt. */
function daneben(basis: PinPunkt, nummer: number, dx: number, dy: number, zoom: number): PinPunkt {
  const p = weltPixel(basis.lat, basis.lon, zoom)
  const q = ausWeltPixel(p.x + dx, p.y + dy, zoom)
  return pin(nummer, q.lat, q.lon)
}

const BASIS = pin(1, 48.25, 13.04)

/** Wie viel Platz eine Marke auf der Karte einnimmt — die Maße der Darstellung. */
function flaeche(m: KartenMarke, zoom: number) {
  const p = weltPixel(m.lat, m.lon, zoom)
  if (m.art === 'pin') {
    // Ein Pin zählt mit seiner größten Stufe: Auch ausgewählt überdeckt er nichts.
    const d = pinDarstellung('ausgewaehlt').groesse
    return { x: p.x, y: p.y, breite: d, hoehe: d, rund: true }
  }
  const masse = gruppenPinMasse(m.mitglieder.length)
  return { x: p.x, y: p.y, breite: masse.breite, hoehe: masse.hoehe, rund: false }
}

/** Überdecken sich zwei Marken (oder berühren sie sich bis auf 1 px)? */
function ueberdecken(a: ReturnType<typeof flaeche>, b: ReturnType<typeof flaeche>): boolean {
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y)
  if (a.rund && b.rund) return Math.hypot(dx, dy) < (a.breite + b.breite) / 2 + 1
  return dx < (a.breite + b.breite) / 2 + 1 && dy < (a.hoehe + b.hoehe) / 2 + 1
}

function paareDieSichUeberdecken(marken: KartenMarke[], zoom: number): string[] {
  const f = marken.map((m) => flaeche(m, zoom))
  const name = (m: KartenMarke) => (m.art === 'pin' ? String(m.pin.nummer) : gruppenBeschriftung(m.mitglieder.length))
  const paare: string[] = []
  for (let i = 0; i < f.length; i++) for (let j = i + 1; j < f.length; j++) if (ueberdecken(f[i], f[j])) paare.push(`${name(marken[i])}/${name(marken[j])}`)
  return paare
}

const nummern = (marken: KartenMarke[]) =>
  marken.flatMap((m) => (m.art === 'pin' ? [m.pin.nummer] : m.mitglieder.map((p) => p.nummer))).sort((a, b) => a - b)

describe('gruppierePins — Pins, die sich überdecken, werden ein Gruppen-Pin', () => {
  const ZOOM = 12

  it('weit auseinander: jeder Hof bleibt ein eigener Pin an seiner Stelle, mit seiner Nummer', () => {
    const marken = gruppierePins([BASIS, daneben(BASIS, 2, 120, 0, ZOOM)], ZOOM)
    expect(marken.map((m) => m.art)).toEqual(['pin', 'pin'])
    expect(marken[0]).toMatchObject({ art: 'pin', pin: BASIS, lat: BASIS.lat, lon: BASIS.lon })
  })

  it('übereinander: ein Gruppen-Pin mit beiden Höfen, die Nummern der Liste bleiben', () => {
    const marken = gruppierePins([BASIS, daneben(BASIS, 2, 10, 5, ZOOM)], ZOOM)
    expect(marken).toHaveLength(1)
    const gruppe = marken[0]
    expect(gruppe.art).toBe('gruppe')
    if (gruppe.art !== 'gruppe') return
    expect(gruppe.mitglieder.map((p) => p.nummer)).toEqual([1, 2])
  })

  it('der Gruppen-Pin liegt in der Mitte seiner Höfe', () => {
    const zweiter = daneben(BASIS, 2, 20, 0, ZOOM)
    const [gruppe] = gruppierePins([BASIS, zweiter], ZOOM)
    const mitte = weltPixel(gruppe.lat, gruppe.lon, ZOOM)
    const a = weltPixel(BASIS.lat, BASIS.lon, ZOOM)
    expect(mitte.x).toBeCloseTo(a.x + 10, 6)
    expect(mitte.y).toBeCloseTo(a.y, 6)
  })

  it('die Grenze: 36 px Mittenabstand berühren sich nicht mehr, 35 px schon (34 px Pin plus 2 px Luft)', () => {
    expect(gruppierePins([BASIS, daneben(BASIS, 2, 36.5, 0, ZOOM)], ZOOM)).toHaveLength(2)
    expect(gruppierePins([BASIS, daneben(BASIS, 2, 35, 0, ZOOM)], ZOOM)).toHaveLength(1)
  })

  it('schräg daneben zählt der echte Abstand der runden Pins, nicht ein Kasten darum', () => {
    // 27 px waagrecht und senkrecht sind 38 px Luftlinie — zwei Scheiben berühren sich nicht.
    expect(gruppierePins([BASIS, daneben(BASIS, 2, 27, 27, ZOOM)], ZOOM)).toHaveLength(2)
  })

  it('eine Gruppe ist breiter als ein Pin: Ein Nachbar, den sie überdeckt, kommt dazu', () => {
    // 1 und 2 liegen übereinander; 3 steht 40 px rechts von ihrer Mitte —
    // neben einem Pin wäre Platz, neben dem breiteren Gruppen-Pin nicht.
    const zwei = daneben(BASIS, 2, 0, 0, ZOOM)
    const drei = daneben(BASIS, 3, 40, 0, ZOOM)
    expect(gruppierePins([BASIS, drei], ZOOM)).toHaveLength(2)
    const marken = gruppierePins([BASIS, zwei, drei], ZOOM)
    expect(marken).toHaveLength(1)
    expect(nummern(marken)).toEqual([1, 2, 3])
  })

  it('jeder Hof erscheint genau einmal — als Pin oder in einer Gruppe', () => {
    const pins = [BASIS, daneben(BASIS, 2, 5, 5, ZOOM), daneben(BASIS, 3, 200, 0, ZOOM), daneben(BASIS, 4, 205, 3, ZOOM), daneben(BASIS, 5, -300, 90, ZOOM)]
    const marken = gruppierePins(pins, ZOOM)
    expect(nummern(marken)).toEqual([1, 2, 3, 4, 5])
    expect(marken.map((m) => m.art)).toEqual(['gruppe', 'gruppe', 'pin'])
  })

  it('die Reihenfolge der Eingabe ändert nichts — Gruppen und Reihenfolge folgen den Nummern', () => {
    const pins = [BASIS, daneben(BASIS, 2, 5, 5, ZOOM), daneben(BASIS, 3, 200, 0, ZOOM), daneben(BASIS, 4, 205, 3, ZOOM)]
    expect(gruppierePins([...pins].reverse(), ZOOM)).toEqual(gruppierePins(pins, ZOOM))
  })

  it('ohne Pins keine Marke', () => {
    expect(gruppierePins([], ZOOM)).toEqual([])
  })

  it('bei maximaler Zoomstufe gibt es keine Gruppe mehr: Höfe am selben Punkt werden leicht aufgefächert', () => {
    const max = KARTEN_KACHELN.maxZoom
    const gleich = [BASIS, pin(2, BASIS.lat, BASIS.lon), pin(3, BASIS.lat, BASIS.lon)]
    const marken = gruppierePins(gleich, max)
    expect(marken.map((m) => m.art)).toEqual(['pin', 'pin', 'pin'])
    expect(nummern(marken)).toEqual([1, 2, 3])
    expect(paareDieSichUeberdecken(marken, max)).toEqual([])
    // „Leicht": jeder bleibt nah an seinem Punkt.
    const mitte = weltPixel(BASIS.lat, BASIS.lon, max)
    for (const m of marken) {
      const p = weltPixel(m.lat, m.lon, max)
      expect(Math.hypot(p.x - mitte.x, p.y - mitte.y)).toBeLessThan(40)
    }
  })

  it('über der maximalen Zoomstufe gilt dieselbe Auffächerung', () => {
    const gleich = [BASIS, pin(2, BASIS.lat, BASIS.lon)]
    expect(gruppierePins(gleich, 22).map((m) => m.art)).toEqual(['pin', 'pin'])
  })
})

describe('Seed-Daten: in keiner Zoomstufe überdecken sich Pins oder Gruppen', () => {
  const PINS = SEED_HOEFE.filter((h) => h.breite != null && h.laenge != null).map((h, i) => ({
    slug: h.slug,
    nummer: i + 1,
    lat: h.breite as number,
    lon: h.laenge as number,
  }))

  it('der Datensatz hat Pins, die sich ohne Gruppen überdecken (Gegenprobe)', () => {
    expect(PINS.length).toBeGreaterThan(20)
    const alsEinzelne: KartenMarke[] = PINS.map((p) => ({ art: 'pin', pin: p, lat: p.lat, lon: p.lon }))
    expect(paareDieSichUeberdecken(alsEinzelne, 10).length).toBeGreaterThan(0)
  })

  for (let zoom = 5; zoom <= 19; zoom++) {
    it(`Zoomstufe ${zoom}`, () => {
      const marken = gruppierePins(PINS, zoom)
      expect(paareDieSichUeberdecken(marken, zoom)).toEqual([])
      expect(nummern(marken)).toEqual(PINS.map((p) => p.nummer))
    })
  }
})

describe('zoomZumAufloesen — ein Tipp auf den Gruppen-Pin zoomt hinein', () => {
  it('genau so weit, bis die Gruppe zerfällt', () => {
    const zwei = daneben(BASIS, 2, 20, 0, 12)
    // 20 px bei 12 sind 40 px bei 13: Dort berühren sich die Pins nicht mehr.
    expect(gruppierePins([BASIS, zwei], 12)).toHaveLength(1)
    expect(zoomZumAufloesen([BASIS, zwei], 12)).toBe(13)
  })

  it('weiter, wenn eine Stufe nicht reicht', () => {
    const zwei = daneben(BASIS, 2, 5, 0, 12)
    expect(zoomZumAufloesen([BASIS, zwei], 12)).toBe(15)
  })

  it('Höfe am selben Punkt: bis zur maximalen Zoomstufe, dort fächert die Karte sie auf', () => {
    expect(zoomZumAufloesen([BASIS, pin(2, BASIS.lat, BASIS.lon)], 12)).toBe(KARTEN_KACHELN.maxZoom)
    expect(zoomZumAufloesen([BASIS, pin(2, BASIS.lat, BASIS.lon)], 19)).toBe(19)
  })
})

describe('zoomBisEinzeln — ein angefahrener Hof steht als eigener Pin da', () => {
  const zwei = daneben(BASIS, 2, 5, 0, 12)
  const fern = daneben(BASIS, 3, 400, 0, 12)

  it('steht er schon allein, bleibt die Zoomstufe', () => {
    expect(zoomBisEinzeln([BASIS, zwei, fern], 'hof-3', 12)).toBe(12)
  })

  it('steckt er in einer Gruppe, die erste Stufe, auf der er allein steht', () => {
    expect(zoomBisEinzeln([BASIS, zwei, fern], 'hof-1', 12)).toBe(15)
  })

  it('am selben Punkt wie ein anderer: die maximale Zoomstufe (dort aufgefächert)', () => {
    expect(zoomBisEinzeln([BASIS, pin(2, BASIS.lat, BASIS.lon)], 'hof-2', 12)).toBe(KARTEN_KACHELN.maxZoom)
  })

  it('ein unbekannter Hof ändert nichts', () => {
    expect(zoomBisEinzeln([BASIS, zwei], 'gibt-es-nicht', 11)).toBe(11)
  })
})

describe('Gruppen-Pin: Zustand, Name und Maße', () => {
  const mitglieder = [BASIS, pin(2, 48.26, 13.05), pin(3, 48.27, 13.06)]

  it('steckt der gewählte Hof darin, ist die Gruppe ausgewählt — Auswahl schlägt Zeiger', () => {
    expect(gruppenZustand(mitglieder, { ausgewaehlt: 'hof-2', hervorgehoben: 'hof-3' })).toBe('ausgewaehlt')
    expect(gruppenZustand(mitglieder, { ausgewaehlt: 'hof-9', hervorgehoben: 'hof-3' })).toBe('hervorgehoben')
    expect(gruppenZustand(mitglieder, LEERE_LAGE)).toBe('normal')
  })

  it('heißt für Screenreader „3 Höfe" — und einzeln „1 Hof"', () => {
    expect(gruppenBeschriftung(3)).toBe('3 Höfe')
    expect(gruppenBeschriftung(12)).toBe('12 Höfe')
    expect(gruppenBeschriftung(1)).toBe('1 Hof')
  })

  it('ist breit genug für die Anzahl und so hoch wie ein Pin dazwischen', () => {
    expect(gruppenPinMasse(3)).toEqual({ breite: 58, hoehe: 30 })
    expect(gruppenPinMasse(12).breite).toBeGreaterThan(gruppenPinMasse(9).breite)
    expect(gruppenPinMasse(120).breite).toBeGreaterThan(gruppenPinMasse(99).breite)
    expect(gruppenPinMasse(3).hoehe).toBeGreaterThan(pinDarstellung('normal').groesse)
    expect(gruppenPinMasse(3).hoehe).toBeLessThan(pinDarstellung('ausgewaehlt').groesse)
  })
})

describe('Ausschnitt-Merker — hat die Nutzerin verschoben oder gezoomt?', () => {
  it('am Anfang nicht', () => {
    expect(erstelleAusschnittMerker().nutzerinHatBewegt).toBe(false)
  })

  it('eine Bewegung außerhalb von still() zählt (Ziehen, Zoomen, ein angefahrener Hof)', () => {
    const merker = erstelleAusschnittMerker()
    merker.bewegungBeginnt()
    expect(merker.nutzerinHatBewegt).toBe(true)
  })

  it('eigene Bewegungen der Karte in still() zählen nicht — auch verschachtelt', () => {
    const merker = erstelleAusschnittMerker()
    merker.still(() => {
      merker.bewegungBeginnt()
      merker.still(() => merker.bewegungBeginnt())
      merker.bewegungBeginnt()
      expect(merker.istStill).toBe(true)
    })
    expect(merker.istStill).toBe(false)
    expect(merker.nutzerinHatBewegt).toBe(false)
  })

  it('still() gibt den Wert zurück und hebt sich auch bei einem Fehler auf', () => {
    const merker = erstelleAusschnittMerker()
    expect(merker.still(() => 7)).toBe(7)
    expect(() =>
      merker.still(() => {
        throw new Error('kaputt')
      })
    ).toThrow('kaputt')
    expect(merker.istStill).toBe(false)
    merker.bewegungBeginnt()
    expect(merker.nutzerinHatBewegt).toBe(true)
  })

  it('die eingepasste Übersicht setzt ihn zurück', () => {
    const merker = erstelleAusschnittMerker()
    merker.bewegungBeginnt()
    merker.uebersichtGezeigt()
    expect(merker.nutzerinHatBewegt).toBe(false)
  })
})
