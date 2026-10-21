/**
 * Tests für die reine Anzeige-Logik der Karten
 * (src/lib/hoefe-anzeige.ts): die gemeinsame Auswahl-Grammatik, die drei
 * Pin-Zustände samt Stil-Stufen, die Karussell-Snap-Erkennung und seit
 * Nr. 52 die Gruppen-Pins (Pins, deren Trefferflächen sich überdecken), die
 * Projektion der Webkarte und der Merker „hat die Nutzerin den Ausschnitt
 * bewegt?".
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  KARTEN_KACHELN,
  PIN_FOKUS,
  PIN_GRUEN,
  UMKREIS_KREIS,
  KARTE_LAEDT,
  LEERE_LAGE,
  TREFFERFLAECHE,
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
  trefferMasse,
  weltPixel,
  zentrierterIndex,
  zoomBisEinzeln,
  zoomZumAufloesen,
  PIN_NAME_MAX,
  hofIllustrationen,
  kartenpunktHinweis,
  pinBeschriftung,
  pinName,
  pinNamenMasse,
  zeigePinNamen,
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

// Nr. 127 (Nacharbeit 120): Das Grün der Pins ist EINE benannte Konstante. Es meint das Karten-Grün auf den hellen
// Kacheln (folgt dem Modus nicht); die Foto-Knöpfe im Kopf und das Teilen-Bild meinen die Markenfarbe, auch wenn
// der Wert heute gleich ist — sie tragen ihr eigenes Token bzw. ihre eigene Ausnahme.
describe('das Grün der Pins — eine Konstante', () => {
  it('Scheibe, Rand, Nummer, Umkreis und Fokusring nehmen PIN_GRUEN', () => {
    expect(pinDarstellung('ausgewaehlt').hintergrund).toBe(PIN_GRUEN)
    expect(pinDarstellung('hervorgehoben').rand).toBe(PIN_GRUEN)
    expect(pinDarstellung('normal')).toMatchObject({ schrift: PIN_GRUEN, rand: PIN_GRUEN })
    expect(UMKREIS_KREIS).toMatchObject({ rand: PIN_GRUEN, flaeche: PIN_GRUEN })
    // Tailwind liest Klassen nur als ganzen Text: Der Fokusring trägt das Grün als Literal — hier hält es die Gleichheit fest.
    expect(PIN_FOKUS).toContain(`focus-visible:outline-[${PIN_GRUEN}]`)
  })

  /** Wie oft der Wert als Text im Quelltext steht (Kommentare mitgezählt, deshalb zählt die Wache nur Code-Zeilen). */
  const vorkommen = (quelltext: string, wert: string) =>
    quelltext.split('\n').filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z)).join('\n').split(wert).length - 1

  it('der Wert steht im Quelltext nur zweimal: als Konstante und als Literal im Fokusring', () => {
    const quelltext = readFileSync('src/lib/hoefe-anzeige.ts', 'utf8')
    expect(vorkommen(quelltext, PIN_GRUEN)).toBe(2)
    // Gegenprobe: Ein weiterer Pin-Wert mit dem Literal würde mitgezählt.
    expect(vorkommen(`${quelltext}\nconst x = { rand: '${PIN_GRUEN}' }`, PIN_GRUEN)).toBe(3)
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

/**
 * Die Trefferfläche einer Marke, wie die Karte sie zeichnet: mindestens 44 px
 * und rund wie das Bild — ein Kreis um den Pin (mit seiner größten Stufe),
 * eine Pille um den Gruppen-Pin. Als waagrechte Strecke mit Radius darum.
 */
function flaeche(m: KartenMarke, zoom: number) {
  const p = weltPixel(m.lat, m.lon, zoom)
  const d = pinDarstellung('ausgewaehlt').groesse
  const bild = m.art === 'pin' ? { breite: d, hoehe: d } : gruppenPinMasse(m.mitglieder.length)
  const masse = trefferMasse(bild.breite, bild.hoehe)
  return { x: p.x, y: p.y, halbeStrecke: (masse.breite - masse.hoehe) / 2, radius: masse.hoehe / 2 }
}

/** Überdecken sich zwei Trefferflächen? Berühren ist erlaubt, ein Tipp trifft dort genau eine. */
function ueberdecken(a: ReturnType<typeof flaeche>, b: ReturnType<typeof flaeche>): boolean {
  const luecke = Math.max(0, Math.abs(a.x - b.x) - a.halbeStrecke - b.halbeStrecke)
  return Math.hypot(luecke, a.y - b.y) < a.radius + b.radius - 1e-6
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

describe('trefferMasse — die Trefferfläche jeder Marke', () => {
  it('mindestens 44 × 44 px um den Pin, auch um den größten (34 px)', () => {
    expect(TREFFERFLAECHE).toBe(44)
    const d = pinDarstellung('ausgewaehlt').groesse
    expect(trefferMasse(d, d)).toEqual({ breite: 44, hoehe: 44 })
  })

  it('um den Gruppen-Pin so breit wie die Pille, aber 44 px hoch', () => {
    const pille = gruppenPinMasse(3)
    expect(trefferMasse(pille.breite, pille.hoehe)).toEqual({ breite: 58, hoehe: 44 })
  })
})

describe('gruppierePins — Pins, deren Trefferflächen sich überdecken, werden ein Gruppen-Pin', () => {
  const ZOOM = 12

  it('ein Hof allein ist ein Pin an seiner eigenen Stelle', () => {
    expect(gruppierePins([BASIS], ZOOM)).toEqual([{ art: 'pin', pin: BASIS, lat: BASIS.lat, lon: BASIS.lon }])
  })

  it('ein Hof allein bleibt auch bei maximaler Zoomstufe genau an seiner Stelle — kein Auffächer-Versatz', () => {
    const max = KARTEN_KACHELN.maxZoom
    expect(gruppierePins([BASIS], max)).toEqual([{ art: 'pin', pin: BASIS, lat: BASIS.lat, lon: BASIS.lon }])
    expect(gruppierePins([BASIS], max + 3)).toEqual([{ art: 'pin', pin: BASIS, lat: BASIS.lat, lon: BASIS.lon }])
  })

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

  it('die Grenze ist die Trefferfläche: ab 44 px Mittenabstand zwei Pins, darunter eine Gruppe', () => {
    expect(gruppierePins([BASIS, daneben(BASIS, 2, 44.2, 0, ZOOM)], ZOOM)).toHaveLength(2)
    expect(gruppierePins([BASIS, daneben(BASIS, 2, 43.8, 0, ZOOM)], ZOOM)).toHaveLength(1)
  })

  it('40 px: Die Bilder (34 px) berühren sich nicht, die Trefferflächen schon — eine Gruppe', () => {
    // Vorher zwei Pins: Ein Tipp an den Rand des einen konnte den Nachbarn wählen.
    expect(gruppierePins([BASIS, daneben(BASIS, 2, 40, 0, ZOOM)], ZOOM)).toHaveLength(1)
  })

  it('schräg daneben zählt der echte Abstand der runden Trefferflächen, nicht ein Kasten darum', () => {
    // 32 px waagrecht und senkrecht sind 45 px Luftlinie — zwei Kreise von 44 px berühren sich nicht.
    expect(gruppierePins([BASIS, daneben(BASIS, 2, 32, 32, ZOOM)], ZOOM)).toHaveLength(2)
    // Gegenprobe: 31/31 sind 43,8 px — die Kreise überdecken sich.
    expect(gruppierePins([BASIS, daneben(BASIS, 2, 31, 31, ZOOM)], ZOOM)).toHaveLength(1)
  })

  it('eine Gruppe ist breiter als ein Pin: Ein Nachbar, den sie überdeckt, kommt dazu', () => {
    // 1 und 2 liegen übereinander; 3 steht 48 px rechts von ihrer Mitte —
    // neben einem Pin wäre Platz, neben der breiteren Pille (58 px) nicht.
    const zwei = daneben(BASIS, 2, 0, 0, ZOOM)
    const drei = daneben(BASIS, 3, 48, 0, ZOOM)
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

describe('Seed-Daten: in keiner Zoomstufe überdecken sich die Trefferflächen von Pins oder Gruppen', () => {
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
    const zwei = daneben(BASIS, 2, 25, 0, 12)
    // 25 px bei 12 sind 50 px bei 13: Dort überdecken sich die Trefferflächen (44 px) nicht mehr.
    expect(gruppierePins([BASIS, zwei], 12)).toHaveLength(1)
    expect(zoomZumAufloesen([BASIS, zwei], 12)).toBe(13)
  })

  it('weiter, wenn eine Stufe nicht reicht', () => {
    // 5 px bei 12 sind 40 px bei 15 (noch eine Gruppe) und 80 px bei 16.
    const zwei = daneben(BASIS, 2, 5, 0, 12)
    expect(zoomZumAufloesen([BASIS, zwei], 12)).toBe(16)
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
    expect(zoomBisEinzeln([BASIS, zwei, fern], 'hof-1', 12)).toBe(16)
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

// ─── Nr. 120 (Register N22): Namen an den Pins, Hinweis ohne Kartenpunkt, Bildfläche ───

describe('Namen an den Pins', () => {
  it('ab Zoom 12 oder bei höchstens 12 Pins im Bild', () => {
    expect(zeigePinNamen(12, 40)).toBe(true)
    expect(zeigePinNamen(11, 12)).toBe(true)
    expect(zeigePinNamen(11, 13)).toBe(false)
    expect(zeigePinNamen(9.5, 0)).toBe(true)
  })

  it('höchstens 18 Zeichen, sonst gekürzt mit „…" — nach Zeichen, nicht nach Bytes', () => {
    expect(pinName('Sonnhof')).toBe('Sonnhof')
    expect(PIN_NAME_MAX).toBe(18)
    const lang = pinName('Biohof Müllerbauer am Waldrand')
    expect(Array.from(lang)).toHaveLength(18)
    expect(lang.endsWith('…')).toBe(true)
    expect(pinName('Ölmühle Großgrünau')).toBe('Ölmühle Großgrünau')
  })

  it('der Name für Screenreader trägt die Nummer der Liste', () => {
    expect(pinBeschriftung({ nummer: 1, name: 'Sonnhof' })).toBe('Sonnhof, Nummer 1')
    expect(pinBeschriftung({ nummer: 3 })).toBe('Nummer 3')
  })

  it('gruppierePins rechnet mit der Breite der Pille: Was ohne Namen zwei Pins sind, ist mit Namen eine Gruppe', () => {
    const zoom = 14
    // 60 px rechts daneben: zwei Scheiben (44 px) überdecken sich nicht, eine Pille mit Namen schon.
    const nachbar = daneben(BASIS, 2, 60, 0, zoom)
    expect(gruppierePins([BASIS, nachbar], zoom)).toHaveLength(2)
    const mitNamen = gruppierePins([{ ...BASIS, name: 'Sonnhof' }, { ...nachbar, name: 'Testhof B' }], zoom)
    expect(mitNamen).toHaveLength(1)
    expect(mitNamen[0].art).toBe('gruppe')
    // Links daneben reicht die Pille nicht hinüber: Die Fläche liegt rechts vom Punkt.
    const links = daneben(BASIS, 2, -60, 0, zoom)
    expect(gruppierePins([{ ...BASIS, name: 'Sonnhof' }, links], zoom)).toHaveLength(2)
  })

  it('die Pille ist breiter als die Trefferfläche und wächst mit dem Namen, höchstens bis 18 Zeichen', () => {
    const kurz = pinNamenMasse('Hof')
    const lang = pinNamenMasse('Sonnhof am Bach')
    expect(kurz.breite).toBeGreaterThan(TREFFERFLAECHE)
    expect(lang.breite).toBeGreaterThan(kurz.breite)
    expect(pinNamenMasse('X'.repeat(40)).breite).toBe(pinNamenMasse('X'.repeat(30)).breite)
    expect(kurz.ankerX).toBe(TREFFERFLAECHE / 2)
  })

  it('im Fächer (maximale Zoomstufe) stehen die Pins ohne Namen — die Pillen lägen sonst übereinander', () => {
    const max = KARTEN_KACHELN.maxZoom
    const marken = gruppierePins([{ ...BASIS, name: 'Sonnhof' }, { ...pin(2, BASIS.lat, BASIS.lon), name: 'Testhof B' }], max)
    expect(marken.map((m) => m.art)).toEqual(['pin', 'pin'])
    for (const m of marken) if (m.art === 'pin') expect(m.pin.name).toBeUndefined()
  })
})

describe('kartenpunktHinweis — der Satz AUF der Karte', () => {
  it('am Computer mit den Nummern der Liste, am Handy „du findest ihn in der Liste"', () => {
    expect(kartenpunktHinweis([4], true)).toBe('Ein Hof hat noch keinen Kartenpunkt – Nr. 4 steht nur in der Liste.')
    expect(kartenpunktHinweis([4, 6, 7], true)).toBe('3 Höfe haben noch keinen Kartenpunkt – Nr. 4, 6 und 7 stehen nur in der Liste.')
    expect(kartenpunktHinweis([4], false)).toBe('Ein Hof hat noch keinen Kartenpunkt – du findest ihn in der Liste.')
    expect(kartenpunktHinweis([1, 2, 3, 4, 5], true)).toBe('5 Höfe haben noch keinen Kartenpunkt – du findest sie in der Liste.')
    expect(kartenpunktHinweis([], true)).toBeNull()
  })
})

describe('hofIllustrationen — die Bildfläche ohne Foto', () => {
  it('die Illustrationen der ersten ein bis drei Kategorien, ohne Kategorie „Sonstiges"', () => {
    expect(hofIllustrationen(['EIER'])).toEqual(['/categories/eier.webp'])
    expect(hofIllustrationen(['EIER', 'HONIG', 'BROT', 'FLEISCH'])).toEqual(['/categories/eier.webp', '/categories/honig.webp', '/categories/brot.webp'])
    expect(hofIllustrationen([])).toEqual(['/categories/sonstiges.webp'])
  })
})
