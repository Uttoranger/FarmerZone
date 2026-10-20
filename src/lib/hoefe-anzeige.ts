/**
 * Reine Anzeige-Logik der Karten: die gemeinsame Auswahl-Grammatik der
 * Hofübersicht (EINE Quelle der Wahrheit für Desktop-Hervorhebung,
 * Karussell-Position und Pin-Stile), die Pin-Zustände, die
 * Karussell-Snap-Erkennung und seit Nr. 52 die Gruppen-Pins, die Kachelquelle
 * und der Merker für bewegte Ausschnitte — für beide Leaflet-Stellen
 * (Hofübersicht samt Umfeld, Standortkarte im Hof-Profil). Alles ohne DOM und
 * ohne Leaflet, prüfbar in tests/hoefe-anzeige.test.ts. Seit Nr. 120 auch die
 * Bildfläche einer Hofkarte ohne Foto, die Namen an den Pins und der Hinweis
 * auf Höfe ohne Kartenpunkt (Register N22).
 */
import { SONSTIGES_BILD_PFAD, kategorieBildPfad, type ProductCategoryValue } from '@/lib/taxonomie'

// ─── Bildfläche ohne Foto (Register N22) ────────────────────────────────────

/** Höchstens so viele Illustrationen trägt die Bildfläche einer Hofkarte. */
export const BILDFLAECHE_HOECHSTENS = 3

/**
 * Die Illustrationen der Bildfläche: die der ersten ein bis drei Kategorien
 * des Hofs — dieselbe Quelle wie Produktseite und Teilen-Bild
 * (kategorieBildPfad). Ohne Kategorie die Illustration „Sonstiges", damit nie
 * eine leere Fläche steht.
 */
export function hofIllustrationen(kategorien: readonly ProductCategoryValue[]): string[] {
  const pfade = kategorien
    .slice(0, BILDFLAECHE_HOECHSTENS)
    .map((k) => kategorieBildPfad(k))
    .filter((pfad): pfad is string => pfad !== null)
  return pfade.length > 0 ? pfade : [SONSTIGES_BILD_PFAD]
}

// ─── Kachelquelle und Texte ─────────────────────────────────────────────────

/**
 * Kacheln und Attribution beider Karten an EINER Stelle. Die Quelle bleibt
 * OSM direkt (Register O6, offen: OSM, basemap.at oder ein Anbieter mit
 * Schlüssel — ein Wechsel ändert die Datenschutzerklärung). Die Attribution
 * mit Link ist Pflicht der OSM-Lizenz und bleibt immer sichtbar; Leaflets
 * eigener Präfix (Flagge und „Leaflet") fällt weg (setPrefix(false) an beiden
 * Karten). Der Link ist unterstrichen: Leaflets Blau hebt sich vom Text daneben
 * nur mit 2,6:1 ab — ohne Unterstreichung erkennt man ihn nur an der Farbe
 * (Axe „link-in-text-block").
 */
export const KARTEN_KACHELN = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  maxZoom: 19,
  attribution:
    '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" style="text-decoration:underline">OpenStreetMap</a>-Mitwirkende',
} as const

/** Der Platzhalter beider Karten, solange die Kartenbibliothek nachlädt. */
export const KARTE_LAEDT = 'Karte lädt …'

// ─── Auswahl-Grammatik ──────────────────────────────────────────────────────

export type AuswahlLage = {
  /** Der gewählte Hof (Pin-Tipp, Karussell-Mitte) — steuert alles Sichtbare. */
  ausgewaehlt: string | null
  /** Flüchtige Zeiger-Hervorhebung (Desktop) — ändert die Auswahl NIE. */
  hervorgehoben: string | null
}

export const LEERE_LAGE: AuswahlLage = { ausgewaehlt: null, hervorgehoben: null }

/** Pin- oder Karussell-Wahl: setzt die Auswahl, lässt den Zeiger in Ruhe. */
export function nachPinTipp(lage: AuswahlLage, slug: string): AuswahlLage {
  return { ...lage, ausgewaehlt: slug }
}

/** Tipp ins Kartenleere: hebt die Auswahl auf. */
export function nachLeerTipp(lage: AuswahlLage): AuswahlLage {
  return { ...lage, ausgewaehlt: null }
}

/** Zeiger betritt (slug) oder verlässt (null) einen Listeneintrag. */
export function nachZeiger(lage: AuswahlLage, slug: string | null): AuswahlLage {
  return { ...lage, hervorgehoben: slug }
}

// ─── Pin-Zustände ───────────────────────────────────────────────────────────

export type PinZustand = 'normal' | 'hervorgehoben' | 'ausgewaehlt'

/** Auswahl schlägt Zeiger: Ein gewählter Pin bleibt gewählt, auch wenn der
 *  Zeiger gerade über seinem Eintrag steht. */
export function pinZustand(slug: string, lage: AuswahlLage): PinZustand {
  if (lage.ausgewaehlt === slug) return 'ausgewaehlt'
  if (lage.hervorgehoben === slug) return 'hervorgehoben'
  return 'normal'
}

export type PinDarstellung = {
  groesse: number
  hintergrund: string
  schrift: string
  rand: string
}

/**
 * Die drei Pin-Stufen — Haus-Stil, kein Orange: ausgewählt = größer und
 * GEFÜLLT im Hof-Grün, hervorgehoben = Zwischenstufe auf der Sandfläche,
 * normal = weiße Scheibe mit grüner Nummer. Die Nummer bleibt in jeder
 * Stufe lesbar (dunkel auf hell bzw. weiß auf Hof-Grün).
 *
 * Diese Werte folgen BEWUSST nicht dem Dark Mode: Die Pins sitzen auf den
 * hellen Kartenkacheln, nicht auf der Seite (siehe hoefe-karte.tsx). Ein
 * dunkler Pin auf heller Karte wäre schlechter lesbar, nicht besser.
 */
export function pinDarstellung(zustand: PinZustand): PinDarstellung {
  if (zustand === 'ausgewaehlt') {
    return { groesse: 34, hintergrund: '#2D5F3F', schrift: '#FFFFFF', rand: '#FFFFFF' }
  }
  if (zustand === 'hervorgehoben') {
    return { groesse: 31, hintergrund: '#E8F0E2', schrift: '#1F4630', rand: '#2D5F3F' }
  }
  return { groesse: 28, hintergrund: '#FFFFFF', schrift: '#2D5F3F', rand: '#2D5F3F' }
}

/**
 * Der EIGENE Hof auf der Umfeld-Karte — deutlich anders als jeder fremde Pin:
 * ein Quadrat statt einer Scheibe, Erdbraun statt Hof-Grün, „Du" statt einer
 * Nummer. Wer ihn sieht, verwechselt ihn nicht mit einem Nachbarn. Wie die
 * übrigen Pins bewusst ohne Dark Mode (er sitzt auf den hellen Kacheln).
 */
export const EIGENER_PIN = {
  groesse: 34,
  eckenRadius: 8,
  hintergrund: '#7A4A1E',
  schrift: '#FFFFFF',
  rand: '#FFFFFF',
  beschriftung: 'Du',
} as const

/** Der Umkreis um den eigenen Hof: gestrichelt im Hof-Grün, kaum Fläche. */
export const UMKREIS_KREIS = { rand: '#2D5F3F', flaeche: '#2D5F3F', flaechenDeckung: 0.06 } as const

// ─── Karussell-Snap ─────────────────────────────────────────────────────────

/**
 * Welche Karte ist (nach dem Snappen) zentriert? `schritt` ist die Breite
 * einer Karte samt Spaltabstand; die Ränder werden auf den ersten bzw.
 * letzten Eintrag geklemmt.
 */
export function zentrierterIndex(scrollLinks: number, schritt: number, anzahl: number): number {
  if (anzahl <= 0 || schritt <= 0) return 0
  return Math.min(anzahl - 1, Math.max(0, Math.round(scrollLinks / schritt)))
}

// ─── Projektion der Webkarte ────────────────────────────────────────────────

/** Kachelkante in Pixeln: Zoomstufe z misst die Welt in 256 · 2^z Pixeln. */
const KACHEL_PX = 256
/** Wie Leaflet (SphericalMercator): Breiten darüber hätten keinen endlichen Punkt. */
const MAX_BREITE = 85.0511287798

/**
 * Der Punkt in Weltpixeln bei Zoomstufe `zoom` — dieselbe Projektion wie
 * Leaflet (EPSG:3857). Abstände in diesen Pixeln sind Abstände auf dem
 * Bildschirm; darum lässt sich ohne Karte entscheiden, ob sich Pins
 * überdecken.
 */
export function weltPixel(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const welt = KACHEL_PX * 2 ** zoom
  const breite = Math.max(-MAX_BREITE, Math.min(MAX_BREITE, lat))
  const sinus = Math.sin((breite * Math.PI) / 180)
  return {
    x: ((lon + 180) / 360) * welt,
    y: (0.5 - Math.log((1 + sinus) / (1 - sinus)) / (4 * Math.PI)) * welt,
  }
}

/** Die Umkehrung von weltPixel. */
export function ausWeltPixel(x: number, y: number, zoom: number): { lat: number; lon: number } {
  const welt = KACHEL_PX * 2 ** zoom
  const n = Math.PI - (2 * Math.PI * y) / welt
  return { lat: (Math.atan(Math.sinh(n)) * 180) / Math.PI, lon: (x / welt) * 360 - 180 }
}

// ─── Überlappende Pins (Gruppen-Pins) ───────────────────────────────────────

/**
 * Ein Hof auf der Karte: die Nummer ist die der Liste, sie bleibt immer. Der
 * Name (Register N22) ist optional — nur /hoefe gibt ihn mit, und nur, wenn die
 * Karte ihn zeigt (zeigePinNamen); Startseite, Region und Umfeld zeichnen
 * weiter nur Nummern.
 */
export type PinPunkt = { slug: string; nummer: number; lat: number; lon: number; name?: string }

// ─── Namen an den Pins (Register N22) ───────────────────────────────────────

/** So viele Zeichen trägt die Pille höchstens, sonst gekürzt mit „…". */
export const PIN_NAME_MAX = 18
/** Namen ab dieser Zoomstufe — oder bei höchstens PINS_MIT_NAMEN Pins im Bild. */
export const NAMEN_AB_ZOOM = 12
export const PINS_MIT_NAMEN = 12

/** Zeigt die Karte die Namen? Ab Zoom 12 oder bei höchstens 12 Pins im sichtbaren Ausschnitt. */
export function zeigePinNamen(zoom: number, pinsImBild: number): boolean {
  return zoom >= NAMEN_AB_ZOOM || pinsImBild <= PINS_MIT_NAMEN
}

/** Der Name in der Pille: höchstens 18 Zeichen, sonst 17 und „…" (nach Zeichen, nicht nach Bytes). */
export function pinName(name: string): string {
  const zeichen = Array.from(name.trim())
  return zeichen.length <= PIN_NAME_MAX ? zeichen.join('') : `${zeichen.slice(0, PIN_NAME_MAX - 1).join('').trimEnd()}…`
}

/** Geschätzte Breite eines Zeichens der Pille (12 px, fett) — ohne Browser, darum reichlich. */
const PILLE_ZEICHEN_PX = 7.2
/** Innenabstand der Pille: links mehr, weil sie 6 px unter der Scheibe beginnt. */
const PILLE_POLSTER_PX = 18
/** So weit schiebt sich die Pille unter die Scheibe des Pins. */
const PILLE_UNTER_PIN_PX = 6
export const PILLE_HOEHE = 24

/**
 * Die Maße eines Pins mit Namen: links die Scheibe mitten in ihrer
 * Trefferfläche (44 px), rechts daran die Pille mit dem Namen. `ankerX` ist
 * die Mitte der Scheibe — dort sitzt der Punkt des Hofs. Gerechnet mit der
 * größten Stufe (ausgewählt), damit die Gruppierung bei einer Auswahl nicht
 * springt.
 */
export function pinNamenMasse(name: string): { breite: number; hoehe: number; ankerX: number; pille: number } {
  const ankerX = TREFFERFLAECHE / 2
  const pille = Math.ceil(Array.from(pinName(name)).length * PILLE_ZEICHEN_PX) + PILLE_POLSTER_PX
  const breite = Math.max(TREFFERFLAECHE, ankerX + PIN_DURCHMESSER / 2 - PILLE_UNTER_PIN_PX + pille)
  return { breite, hoehe: TREFFERFLAECHE, ankerX, pille }
}

/** Der Name eines Pins für Screenreader: „Sonnhof, Nummer 1" bzw. „Nummer 3" ohne Namen. */
export function pinBeschriftung(pin: Pick<PinPunkt, 'nummer' | 'name'>): string {
  return pin.name ? `${pin.name}, Nummer ${pin.nummer}` : `Nummer ${pin.nummer}`
}

/**
 * Der Fokusring eines Pins (Tab): ein Ring innerhalb der Trefferfläche, im
 * Hof-Grün der Pins — er sitzt auf den hellen Kacheln und folgt dem Modus
 * nicht (wie die Pins selbst, siehe pinDarstellung).
 */
export const PIN_FOKUS =
  'outline-none focus-visible:outline-3 focus-visible:outline-solid focus-visible:-outline-offset-[6px] focus-visible:outline-[#2D5F3F]'

/**
 * Der Hinweis AUF der Karte, wenn gefilterte Höfe keinen Kartenpunkt haben
 * (Register N22): am Computer mit ihren Nummern der Liste (daneben steht sie),
 * am Handy „du findest ihn in der Liste" — dort liegt die Liste hinter der
 * Karte. Ab fünf Nummern ohne Aufzählung.
 */
export function kartenpunktHinweis(nummern: readonly number[], mitNummern: boolean): string | null {
  const anzahl = nummern.length
  if (anzahl === 0) return null
  if (!mitNummern || anzahl > 4) {
    if (anzahl === 1) return 'Ein Hof hat noch keinen Kartenpunkt – du findest ihn in der Liste.'
    return `${anzahl} Höfe haben noch keinen Kartenpunkt – du findest sie in der Liste.`
  }
  if (anzahl === 1) return `Ein Hof hat noch keinen Kartenpunkt – Nr. ${nummern[0]} steht nur in der Liste.`
  const liste = `${nummern.slice(0, -1).join(', ')} und ${nummern[anzahl - 1]}`
  return `${anzahl} Höfe haben noch keinen Kartenpunkt – Nr. ${liste} stehen nur in der Liste.`
}

/**
 * Was die Karte zeichnet: ein Pin mit der Nummer der Liste oder ein
 * Gruppen-Pin für Höfe, deren Trefferflächen sich bei der aktuellen
 * Zoomstufe überdecken würden. Ein aufgefächerter Pin (maximale Zoomstufe) steht leicht neben
 * seinem Punkt — `lat`/`lon` sind immer die Stelle, an der die Marke steht.
 */
export type KartenMarke =
  | { art: 'pin'; pin: PinPunkt; lat: number; lon: number }
  | { art: 'gruppe'; schluessel: string; mitglieder: PinPunkt[]; lat: number; lon: number }

/**
 * Die Trefferfläche jeder Marke: mindestens 44 px (DESIGN_SYSTEM,
 * „Qualität"), unsichtbar um die kleinere Scheibe bzw. Pille gelegt — so
 * bleibt das Bild, wie es ist, und der Finger trifft trotzdem. Sie ist rund
 * wie das Bild: ein Kreis um den Pin, eine Pille um den Gruppen-Pin
 * (border-radius an der Marke, der Browser nimmt Tipps nur innerhalb der
 * Rundung an).
 *
 * DIESELBE Zahl entscheidet über Gruppen (Nachbesserung Runde 1): Überdecken
 * sich zwei Trefferflächen, könnte ein Tipp an ihrem Rand den Nachbarn
 * wählen — dann zeichnet die Karte EINE Marke. Vorher galt erst eine
 * Überdeckung der Bilder (36 px), die Flächen überlappten bei 36–43 px.
 */
export const TREFFERFLAECHE = 44

/** Die Trefferfläche zu einem Bild: mindestens 44 × 44 px, sonst so groß wie das Bild. */
export function trefferMasse(breite: number, hoehe: number): { breite: number; hoehe: number } {
  return { breite: Math.max(breite, TREFFERFLAECHE), hoehe: Math.max(hoehe, TREFFERFLAECHE) }
}

/**
 * Ein Pin zählt immer mit seiner größten Stufe (ausgewählt, 34 px): Sonst
 * gruppierte die Karte bei jeder Auswahl neu, und Pins sprängen. Seine
 * Trefferfläche ist ohnehin größer (44 px).
 */
const PIN_DURCHMESSER = pinDarstellung('ausgewaehlt').groesse
const PIN_FLAECHE = trefferMasse(PIN_DURCHMESSER, PIN_DURCHMESSER)

/** Breite und Höhe des Gruppen-Pins (eine Pille mit „3 Höfe"). */
export function gruppenPinMasse(anzahl: number): { breite: number; hoehe: number } {
  return { breite: anzahl < 10 ? 58 : anzahl < 100 ? 66 : 74, hoehe: 30 }
}

/** Die Beschriftung des Gruppen-Pins — sichtbar und für Screenreader dieselbe. */
export function gruppenBeschriftung(anzahl: number): string {
  return anzahl === 1 ? '1 Hof' : `${anzahl} Höfe`
}

/** Der Zustand eines Gruppen-Pins: der stärkste seiner Höfe (Auswahl vor Zeiger). */
export function gruppenZustand(mitglieder: readonly { slug: string }[], lage: AuswahlLage): PinZustand {
  if (mitglieder.some((m) => m.slug === lage.ausgewaehlt)) return 'ausgewaehlt'
  if (mitglieder.some((m) => m.slug === lage.hervorgehoben)) return 'hervorgehoben'
  return 'normal'
}

/** Radius, auf dem n Pins um ihre Mitte stehen, ohne dass sich ihre Trefferflächen überdecken (Sehne = Trefferfläche). */
function faecherRadius(anzahl: number): number {
  // Ein halber Pixel mehr, damit Rundung aus „berührt sich gerade nicht" kein „überdeckt" macht.
  return PIN_FLAECHE.breite / (2 * Math.sin(Math.PI / anzahl)) + 0.5
}

/** Die Pixel aller Höfe eines Haufens als Summe — die Mitte ist Summe durch Anzahl. */
type Haufen = { mitglieder: PinPunkt[]; summe: { x: number; y: number }; x: number; y: number }

/**
 * Eine Trefferfläche als „Stadion": eine waagrechte Strecke mit dem Radius
 * drumherum. Ein Kreis (Pin) hat die Strecke 0, eine Pille die Breite minus
 * die Höhe — genau die Form, die die Marke auf der Karte hat.
 */
type Flaeche = { x: number; y: number; halbeStrecke: number; radius: number }

function stadion(x: number, y: number, masse: { breite: number; hoehe: number }): Flaeche {
  const radius = masse.hoehe / 2
  return { x, y, radius, halbeStrecke: Math.max(0, masse.breite / 2 - radius) }
}

function flaecheVon(haufen: Haufen, aufgefaechert: boolean): Flaeche {
  const n = haufen.mitglieder.length
  if (n === 1) {
    // Mit Namen zählt die ganze Pille (Register N22): Die Fläche reicht vom
    // linken Rand der Scheibe bis zum Ende des Namens, ihre Mitte liegt rechts vom Punkt.
    const name = haufen.mitglieder[0].name
    if (!name) return stadion(haufen.x, haufen.y, PIN_FLAECHE)
    const masse = pinNamenMasse(name)
    return stadion(haufen.x + masse.breite / 2 - masse.ankerX, haufen.y, masse)
  }
  // Aufgefächert: der Kreis, in dem die Trefferflächen aller Höfe des Fächers liegen.
  if (aufgefaechert) return { x: haufen.x, y: haufen.y, halbeStrecke: 0, radius: faecherRadius(n) + PIN_FLAECHE.hoehe / 2 }
  const bild = gruppenPinMasse(n)
  return stadion(haufen.x, haufen.y, trefferMasse(bild.breite, bild.hoehe))
}

/** Überdecken sich zwei Trefferflächen? Abstand der beiden Strecken gegen die Summe der Radien. */
function ueberdecken(a: Flaeche, b: Flaeche): boolean {
  const luecke = Math.max(0, Math.abs(a.x - b.x) - a.halbeStrecke - b.halbeStrecke)
  return Math.hypot(luecke, a.y - b.y) < a.radius + b.radius
}

/**
 * Pins, deren Trefferflächen sich bei dieser Zoomstufe überdecken, werden
 * EIN Gruppen-Pin in der Mitte seiner Höfe — so lange, bis sich keine zwei
 * Marken mehr überdecken (auch der breitere Gruppen-Pin nicht mit einem
 * Nachbarn). Bei
 * maximaler Zoomstufe gibt es keine Gruppe mehr: Hineinzoomen ginge nicht
 * weiter, also stehen die Höfe leicht aufgefächert im Kreis um ihre Mitte.
 *
 * Kein Paket (Regel 4): ein einfaches Zusammenlegen, solange sich etwas
 * überdeckt — bei der Größe der Plattform (Dutzende Höfe) schnell genug.
 * Ergebnis und Reihenfolge hängen nur an den Nummern, nie an der Reihenfolge
 * der Eingabe.
 */
export function gruppierePins(pins: readonly PinPunkt[], zoom: number, maxZoom: number = KARTEN_KACHELN.maxZoom): KartenMarke[] {
  const z = Math.min(zoom, maxZoom)
  const aufgefaechert = zoom >= maxZoom
  const haufen: Haufen[] = [...pins]
    .sort((a, b) => a.nummer - b.nummer)
    .map((pin) => {
      const p = weltPixel(pin.lat, pin.lon, z)
      return { mitglieder: [pin], summe: p, x: p.x, y: p.y }
    })

  let zusammengelegt = true
  while (zusammengelegt) {
    zusammengelegt = false
    suche: for (let i = 0; i < haufen.length; i++) {
      for (let j = i + 1; j < haufen.length; j++) {
        const a = haufen[i]
        const b = haufen[j]
        if (!ueberdecken(flaecheVon(a, aufgefaechert), flaecheVon(b, aufgefaechert))) continue
        // Die Mitte aus den Summen beider Haufen — jeder Hof zählt einmal, kein Nachschlagen.
        const mitglieder = [...a.mitglieder, ...b.mitglieder].sort((p, q) => p.nummer - q.nummer)
        const summe = { x: a.summe.x + b.summe.x, y: a.summe.y + b.summe.y }
        haufen[i] = { mitglieder, summe, x: summe.x / mitglieder.length, y: summe.y / mitglieder.length }
        haufen.splice(j, 1)
        zusammengelegt = true
        break suche
      }
    }
  }

  return haufen
    .sort((a, b) => a.mitglieder[0].nummer - b.mitglieder[0].nummer)
    .flatMap((h): KartenMarke[] => {
      if (h.mitglieder.length === 1) {
        const [pin] = h.mitglieder
        return [{ art: 'pin', pin, lat: pin.lat, lon: pin.lon }]
      }
      if (aufgefaechert) {
        const radius = faecherRadius(h.mitglieder.length)
        return h.mitglieder.map((pin, i) => {
          const winkel = -Math.PI / 2 + (2 * Math.PI * i) / h.mitglieder.length
          const stelle = ausWeltPixel(h.x + radius * Math.cos(winkel), h.y + radius * Math.sin(winkel), z)
          // Im Fächer ohne Namen: Die Pillen lägen sonst übereinander — der Kreis rechnet nur mit den Scheiben.
          return { art: 'pin', pin: { slug: pin.slug, nummer: pin.nummer, lat: pin.lat, lon: pin.lon }, lat: stelle.lat, lon: stelle.lon }
        })
      }
      const mitte = ausWeltPixel(h.x, h.y, z)
      return [{ art: 'gruppe', schluessel: h.mitglieder.map((m) => m.slug).join(','), mitglieder: h.mitglieder, lat: mitte.lat, lon: mitte.lon }]
    })
}

/**
 * Ein Tipp auf den Gruppen-Pin zoomt hinein — genau bis zur ersten
 * Zoomstufe, auf der seine Höfe nicht mehr EINE Marke sind. Liegen sie am
 * selben Punkt, ist das die maximale Zoomstufe (dort aufgefächert).
 */
export function zoomZumAufloesen(mitglieder: readonly PinPunkt[], zoom: number, maxZoom: number = KARTEN_KACHELN.maxZoom): number {
  for (let z = Math.max(0, Math.floor(zoom) + 1); z < maxZoom; z++) {
    if (gruppierePins(mitglieder, z, maxZoom).length > 1) return z
  }
  return maxZoom
}

/**
 * Die erste Zoomstufe ab `abZoom`, auf der ein Hof als eigener Pin steht —
 * wer einen Hof aus Liste oder Karussell anfährt, soll seinen Pin sehen,
 * nicht eine Gruppe.
 */
export function zoomBisEinzeln(pins: readonly PinPunkt[], slug: string, abZoom: number, maxZoom: number = KARTEN_KACHELN.maxZoom): number {
  for (let z = Math.max(0, Math.ceil(abZoom)); z < maxZoom; z++) {
    const inGruppe = gruppierePins(pins, z, maxZoom).some((m) => m.art === 'gruppe' && m.mitglieder.some((p) => p.slug === slug))
    if (!inGruppe) return z
  }
  return maxZoom
}

// ─── Bewegter Ausschnitt ────────────────────────────────────────────────────

export type AusschnittMerker = {
  /** Führt eigene Bewegungen der Karte aus (Übersicht, Größenwechsel, Sprung) — sie zählen nicht als Bewegung der Nutzerin. */
  still<T>(tun: () => T): T
  /** Aus Leaflets movestart/zoomstart: zählt nur außerhalb von still(). */
  bewegungBeginnt(): void
  /** Die Übersicht ist eingepasst: Ab jetzt darf ein Größenwechsel sie wieder einpassen. */
  uebersichtGezeigt(): void
  readonly nutzerinHatBewegt: boolean
  readonly istStill: boolean
}

/**
 * Merkt sich, ob die Nutzerin den Ausschnitt selbst verändert hat — verschoben,
 * gezoomt, einen Hof angefahren oder einen Gruppen-Pin aufgezoomt. Solange
 * nicht, passt die Karte nach einem Größenwechsel (auch beim Drehen) die
 * Übersicht neu ein; danach lässt sie den Ausschnitt, wie die Nutzerin ihn
 * gewählt hat. Ein Zähler statt eines Schalters, weil sich eigene Bewegungen
 * verschachteln (Übersicht innerhalb eines Größenwechsels).
 */
export function erstelleAusschnittMerker(): AusschnittMerker {
  let tiefe = 0
  let bewegt = false
  return {
    still<T>(tun: () => T): T {
      tiefe += 1
      try {
        return tun()
      } finally {
        tiefe -= 1
      }
    },
    bewegungBeginnt() {
      if (tiefe === 0) bewegt = true
    },
    uebersichtGezeigt() {
      bewegt = false
    },
    get nutzerinHatBewegt() {
      return bewegt
    },
    get istStill() {
      return tiefe > 0
    },
  }
}
