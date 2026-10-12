/**
 * Die Karte der Region auf der Startseite (Nr. 59) — reine Logik ohne React
 * und ohne Browser: Ausschnitt, Projektion, Marken, die Lage der Hofkarte und
 * die Beschriftungen (tests/regionskarte.test.ts). Gezeichnet wird als SVG auf
 * dem Server (RegionsKarte in src/components/startseite/startseite-kopf.tsx):
 * kein Kartendienst, keine Kacheln, kein Abruf zur Laufzeit. Die Geodaten
 * stehen in regionskarte-daten.ts (Natural Earth).
 *
 * Projektion wie die Webkarte (weltPixel aus hoefe-anzeige.ts, EPSG:3857):
 * Eine Zeichnung ist so breit wie ihr Ausschnitt in Weltpixeln bei EINER
 * festen Zoomstufe. Eine Einheit des SVG ist dann ein Weltpixel — und
 * gruppierePins (Nr. 52) rechnet in genau diesen Einheiten, ohne eigenen
 * Algorithmus daneben.
 */
import { gruppierePins, weltPixel, type PinPunkt } from '@/lib/hoefe-anzeige'
import { FLUESSE, STRASSEN, type Linienzug, type StrassenArt } from '@/lib/regionskarte-daten'

/** Der Ausschnitt in Grad (WGS 84): das Innviertel und das bayerische Ufer gegenüber. */
export const REGIONS_AUSSCHNITT = { west: 12.8, ost: 13.62, sued: 47.93, nord: 48.4 } as const

const { west, ost, sued, nord } = REGIONS_AUSSCHNITT

export type GeoPunkt = { lat: number; lon: number }
export type SvgPunkt = { x: number; y: number }

/** Eine gezeichnete Karte: Breite und Höhe in Einheiten des SVG und die Zoomstufe, bei der eine Einheit ein Weltpixel ist. */
export type KartenMass = { breite: number; hoehe: number; zoom: number }

/** Die Breite des Ausschnitts in Weltpixeln bei Zoomstufe 0. */
const BREITE_BEI_ZOOM_NULL = weltPixel(nord, ost, 0).x - weltPixel(nord, west, 0).x

/** Die Maße einer Zeichnung dieser Breite; die Höhe folgt aus der Projektion — nie gestaucht. */
export function berechneKartenMass(breite: number): KartenMass {
  const zoom = Math.log2(breite / BREITE_BEI_ZOOM_NULL)
  return { breite, hoehe: weltPixel(sued, west, zoom).y - weltPixel(nord, west, zoom).y, zoom }
}

/**
 * Die beiden Formen, je in ihrer Entwurfsgröße (eine Einheit ist ein Pixel
 * der Mockups): im Browser rechts neben dem Text, 520 px breit wie bisher,
 * am Handy unter der Suche, 358 px. Zwei Zeichnungen statt einer skalierten:
 * Schrift und Pins behalten so am Handy ihre Größe.
 */
export const REGIONSKARTE_MASSE = { web: berechneKartenMass(520), handy: berechneKartenMass(358) } as const

export type KartenForm = keyof typeof REGIONSKARTE_MASSE

/** Die Breite der Hofkarte als Anteil der Kartenbreite (Mockups: 230 von 540 px, 200 von 358 px). */
export const HOFKARTE_ANTEIL: Record<KartenForm, number> = { web: 0.44, handy: 0.56 }

/** Ein Punkt in Grad als Punkt der Zeichnung: die Nordwestecke des Ausschnitts ist (0, 0). */
export function projiziere(punkt: GeoPunkt, mass: KartenMass): SvgPunkt {
  const ecke = weltPixel(nord, west, mass.zoom)
  const p = weltPixel(punkt.lat, punkt.lon, mass.zoom)
  return { x: p.x - ecke.x, y: p.y - ecke.y }
}

export function liegtImAusschnitt(punkt: GeoPunkt): boolean {
  return punkt.lon >= west && punkt.lon <= ost && punkt.lat >= sued && punkt.lat <= nord
}

/** Auf eine Nachkommastelle — genauer zeichnet kein Bildschirm, und das HTML bleibt klein. */
export function rundeAufZehntel(n: number): number {
  return Math.round(n * 10) / 10
}

/** Ein Linienzug als Pfad für `<path d=…>`. */
export function zeichnePfad(linie: Linienzug, mass: KartenMass): string {
  return linie
    .map(([lon, lat], i) => {
      const p = projiziere({ lat, lon }, mass)
      return `${i === 0 ? 'M' : 'L'}${rundeAufZehntel(p.x)} ${rundeAufZehntel(p.y)}`
    })
    .join(' ')
}

// ─── Beschriftungen ─────────────────────────────────────────────────────────

export type Beschriftung = { text: string; x: number; y: number; winkel: number }

/** So weit steht eine Beschriftung mindestens vom Rand der Zeichnung weg — sonst schnitte der Rand sie ab. */
const BESCHRIFTUNG_RAND = 20
/** So viel Luft hält eine Beschriftung zu einer schon gesetzten (Mittelpunkte, Einheiten). */
const BESCHRIFTUNG_LUFT = 40
/** Wo entlang eines Stücks ein Name stehen darf, in dieser Reihenfolge: zuerst die Mitte. */
const BESCHRIFTUNG_STELLEN = [0.5, 0.35, 0.65, 0.2, 0.8] as const

function messeLaenge(punkte: readonly SvgPunkt[]): number {
  let summe = 0
  for (let i = 1; i < punkte.length; i++) summe += Math.hypot(punkte[i].x - punkte[i - 1].x, punkte[i].y - punkte[i - 1].y)
  return summe
}

/** Der Punkt nach `strecke` Einheiten entlang des Linienzugs samt der Richtung seines Abschnitts. */
function findePunktBei(punkte: readonly SvgPunkt[], strecke: number): SvgPunkt & { dx: number; dy: number } {
  let rest = strecke
  for (let i = 1; i < punkte.length; i++) {
    const [a, b] = [punkte[i - 1], punkte[i]]
    const laenge = Math.hypot(b.x - a.x, b.y - a.y)
    if (rest <= laenge || i === punkte.length - 1) {
      const t = laenge === 0 ? 0 : Math.min(1, rest / laenge)
      return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y), dx: b.x - a.x, dy: b.y - a.y }
    }
    rest -= laenge
  }
  return { ...punkte[0], dx: 1, dy: 0 }
}

export type BeschriftungsWahl = {
  /** Senkrechter Abstand über dem Strich, damit die Schrift nicht auf ihm steht. */
  abstand?: number
  /** Mindestabstand zum Rand der Zeichnung. */
  rand?: number
  /** Schon gesetzte Beschriftungen — ihnen bleibt der Name fern. */
  besetzt?: readonly SvgPunkt[]
}

/**
 * Wo ein Name an seiner Linie steht: auf dem längsten Stück, zuerst in seiner
 * Mitte, sonst ein Stück daneben — nur dort, wo er weit genug vom Rand und
 * von schon gesetzten Namen bleibt. Findet sich keine Stelle, steht er nicht
 * da: lieber keine Beschriftung als eine abgeschnittene oder verdeckte. Der
 * Winkel folgt der Linie und bleibt lesbar, nie kopfüber.
 */
export function beschrifteLinie(
  text: string,
  linien: readonly Linienzug[],
  mass: KartenMass,
  { abstand = 0, rand = BESCHRIFTUNG_RAND, besetzt = [] }: BeschriftungsWahl = {}
): Beschriftung | null {
  const stuecke = linien
    .map((linie) => linie.map(([lon, lat]) => projiziere({ lat, lon }, mass)))
    .map((punkte) => ({ punkte, laenge: messeLaenge(punkte) }))
    .sort((a, b) => b.laenge - a.laenge)

  for (const { punkte, laenge } of stuecke) {
    for (const stelle of BESCHRIFTUNG_STELLEN) {
      const p = findePunktBei(punkte, laenge * stelle)
      if (Math.min(p.x, mass.breite - p.x, p.y, mass.hoehe - p.y) < rand) continue
      if (besetzt.some((b) => Math.hypot(b.x - p.x, b.y - p.y) < BESCHRIFTUNG_LUFT)) continue
      let winkel = (Math.atan2(p.dy, p.dx) * 180) / Math.PI
      if (winkel > 90) winkel -= 180
      if (winkel <= -90) winkel += 180
      const bogen = (winkel * Math.PI) / 180
      // „Oben" der gedrehten Schrift: (sin, −cos) — bei waagrechter Linie gerade nach oben.
      return { text, x: p.x + Math.sin(bogen) * abstand, y: p.y - Math.cos(bogen) * abstand, winkel }
    }
  }
  return null
}

/**
 * Die Regionsnamen des Mockups — Beschriftung, keine Geodaten: BAYERN links
 * der Grenzflüsse (Salzach, dann Inn), INNVIERTEL rechts davon. Die Lage ist
 * ein Anteil der Zeichnung, damit beide Formen sie teilen; BAYERN steht rechts
 * neben dem Zähler oben links. Dass beide auf der richtigen Seite der Flüsse
 * stehen, prüft tests/regionskarte.test.ts an den Daten.
 */
export const REGIONS_NAMEN = [
  { text: 'BAYERN', x: 0.58, y: 0.09, anker: 'start' },
  { text: 'INNVIERTEL', x: 0.95, y: 0.72, anker: 'end' },
] as const

/** So weit steht ein Flussname über seinem Strich (halbe Strichbreite und etwas Luft). */
const FLUSSNAME_ABSTAND = 6
/**
 * Ein Straßenschild ist breiter als ein Flussname und hält mehr Rand: unten
 * rechts liegt im Browser der Knopf „Karte öffnen" über der Karte.
 */
const SCHILD_RAND = 32

export type GezeichnetesLand = {
  fluesse: { name: string; pfade: string[]; beschriftung: Beschriftung | null }[]
  strassen: { art: StrassenArt; pfade: string[] }[]
  /** Die Straßennummern als Schilder auf der Straße, je Nummer höchstens eines. */
  schilder: Beschriftung[]
}

/**
 * Das Land einer Zeichnung: Flüsse, Straßen und ihre Namen. Die Namen halten
 * Abstand zu den Marken der Höfe (`marken`, sie lägen sonst darüber), zu den
 * Regionsnamen und zueinander — die Flüsse zuerst, dann die Schilder.
 */
export function zeichneLand(mass: KartenMass, marken: readonly SvgPunkt[] = []): GezeichnetesLand {
  const besetzt: SvgPunkt[] = [...marken, ...REGIONS_NAMEN.map((n) => ({ x: n.x * mass.breite, y: n.y * mass.hoehe }))]
  const setze = (b: Beschriftung | null): Beschriftung | null => {
    if (b) besetzt.push(b)
    return b
  }
  const fluesse = FLUESSE.map((f) => ({
    name: f.name,
    pfade: f.linien.map((l) => zeichnePfad(l, mass)),
    beschriftung: setze(beschrifteLinie(f.name, f.linien, mass, { abstand: FLUSSNAME_ABSTAND, besetzt })),
  }))
  const nummern = [...new Set(STRASSEN.flatMap((s) => (s.beschriftung ? [s.beschriftung] : [])))]
  const schilder = nummern.flatMap((nummer) => {
    const linien = STRASSEN.filter((s) => s.beschriftung === nummer).flatMap((s) => s.linien)
    const schild = setze(beschrifteLinie(nummer, linien, mass, { rand: SCHILD_RAND, besetzt }))
    return schild ? [{ ...schild, winkel: 0 }] : []
  })
  return {
    fluesse,
    strassen: STRASSEN.map((s) => ({ art: s.art, pfade: s.linien.map((l) => zeichnePfad(l, mass)) })),
    schilder,
  }
}

// ─── Marken ─────────────────────────────────────────────────────────────────

/** Was die Zeichnung für einen Hof oder eine Gruppe von Höfen zeigt; `anzahl` ist 1 beim einzelnen Pin. */
export type GezeichneteMarke = {
  art: 'pin' | 'gruppe'
  schluessel: string
  x: number
  y: number
  anzahl: number
  /** Der hervorgehobene Hof steckt in dieser Marke — sein Pin oder seine Gruppe. */
  hervorgehoben: boolean
}

/**
 * Die Marken der Höfe: gruppiert mit gruppierePins (Nr. 52) bei der festen
 * Zoomstufe der Zeichnung — Höfe, deren Pins sich überdecken würden, werden
 * ein Gruppen-Pin mit Zahl. Die Karte ist nur EIN Link; die Gruppe sagt, wie
 * viele Höfe dort liegen, aufgelöst wird sie in der Kartenansicht.
 */
export function zeichneMarken(pins: readonly PinPunkt[], mass: KartenMass, hervorgehoben: string | null): GezeichneteMarke[] {
  return gruppierePins(pins, mass.zoom).map((marke) => {
    const mitglieder = marke.art === 'pin' ? [marke.pin] : marke.mitglieder
    const { x, y } = projiziere(marke, mass)
    return {
      art: marke.art,
      schluessel: marke.art === 'pin' ? marke.pin.slug : marke.schluessel,
      x,
      y,
      anzahl: mitglieder.length,
      hervorgehoben: mitglieder.some((p) => p.slug === hervorgehoben),
    }
  })
}

// ─── Hofkarte ───────────────────────────────────────────────────────────────

export type HofkartenLage = {
  /** Abstand vom linken Rand, Prozent der Kartenbreite. */
  links: number
  /** Unter dem Pin hängt die Karte an ihrer Oberkante (`oben`), über ihm steht sie auf ihrer Unterkante (`unten`); Prozent der Kartenhöhe. */
  senkrecht: { kante: 'oben' | 'unten'; abstand: number }
  /** Die Verbindungslinie in Einheiten der Zeichnung: vom Pin bis knapp hinter die Kante der Karte. */
  linie: { x1: number; y1: number; x2: number; y2: number }
}

/** Innenrand, den die Hofkarte zur Kante der Zeichnung hält (Prozent). */
const HOFKARTE_RAND = 3
/** So weit steht die Kante der Hofkarte senkrecht vom Pin weg (Prozent der Höhe). */
const HOFKARTE_ABSTAND = 7
/** Darüber steht der Zähler oben links — eine Hofkarte unter einem hohen Pin beginnt erst hier (Prozent der Höhe). */
const ZAEHLER_ZONE = 18
/** So weit läuft die Linie seitlich, bevor sie unter der Karte endet (Prozent der Breite). */
const LINIE_SEITLICH = 9
/** Die Linie endet so weit hinter der Kante (Prozent der Höhe) — die Karte deckt ihr Ende zu. */
const LINIE_UNTER_KARTE = 2

const klemme = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n))

/**
 * Wo die Hofkarte neben ihrem Pin steht: zur Mitte hin — rechts vom Pin, wenn
 * er links der Mitte liegt, sonst links; darunter, wenn er oben liegt, sonst
 * darüber. Waagrecht bleibt sie immer ganz in der Zeichnung. Alles in Prozent:
 * Die Karte (HTML) und die Zeichnung (SVG) teilen dasselbe Seitenverhältnis,
 * deshalb treffen sich Linie und Karte bei jeder Breite. `anteil` ist die
 * Breite der Hofkarte als Anteil der Kartenbreite (HOFKARTE_ANTEIL).
 */
export function platziereHofkarte(pin: SvgPunkt, mass: KartenMass, anteil: number): HofkartenLage {
  const px = (pin.x / mass.breite) * 100
  const py = (pin.y / mass.hoehe) * 100
  const breite = anteil * 100
  const nachRechts = px <= 50
  const links = klemme(nachRechts ? px + 4 : px - 4 - breite, HOFKARTE_RAND, 100 - HOFKARTE_RAND - breite)
  const nachUnten = py <= 50
  const kante = nachUnten ? Math.max(py + HOFKARTE_ABSTAND, ZAEHLER_ZONE) : py - HOFKARTE_ABSTAND
  // Das Ende liegt waagrecht sicher unter der Karte, nie neben ihr.
  const endeX = klemme(nachRechts ? px + LINIE_SEITLICH : px - LINIE_SEITLICH, links + 6, links + breite - 6)
  const endeY = nachUnten ? kante + LINIE_UNTER_KARTE : kante - LINIE_UNTER_KARTE
  return {
    links,
    senkrecht: nachUnten ? { kante: 'oben', abstand: kante } : { kante: 'unten', abstand: 100 - kante },
    linie: { x1: pin.x, y1: pin.y, x2: (endeX / 100) * mass.breite, y2: (endeY / 100) * mass.hoehe },
  }
}
