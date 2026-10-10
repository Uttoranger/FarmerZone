/**
 * Reine Anzeige-Logik der Karten: die gemeinsame Auswahl-Grammatik der
 * Hofübersicht (EINE Quelle der Wahrheit für Desktop-Hervorhebung,
 * Karussell-Position und Pin-Stile), die Pin-Zustände, die
 * Karussell-Snap-Erkennung und seit Nr. 52 die Gruppen-Pins, die Kachelquelle
 * und der Merker für bewegte Ausschnitte — für beide Leaflet-Stellen
 * (Hofübersicht samt Umfeld, Standortkarte im Hof-Profil). Alles ohne DOM und
 * ohne Leaflet, prüfbar in tests/hoefe-anzeige.test.ts.
 */

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

/** Ein Hof auf der Karte: die Nummer ist die der Liste, sie bleibt immer. */
export type PinPunkt = { slug: string; nummer: number; lat: number; lon: number }

/**
 * Was die Karte zeichnet: ein Pin mit der Nummer der Liste oder ein
 * Gruppen-Pin für Höfe, die sich bei der aktuellen Zoomstufe überdecken
 * würden. Ein aufgefächerter Pin (maximale Zoomstufe) steht leicht neben
 * seinem Punkt — `lat`/`lon` sind immer die Stelle, an der die Marke steht.
 */
export type KartenMarke =
  | { art: 'pin'; pin: PinPunkt; lat: number; lon: number }
  | { art: 'gruppe'; schluessel: string; mitglieder: PinPunkt[]; lat: number; lon: number }

/** So viel Luft halten zwei Marken mindestens, sonst gelten sie als überdeckt. */
const MARKEN_LUFT = 2
/**
 * Ein Pin zählt immer mit seiner größten Stufe (ausgewählt, 34 px): Sonst
 * gruppierte die Karte bei jeder Auswahl neu, und Pins sprängen.
 */
const PIN_DURCHMESSER = pinDarstellung('ausgewaehlt').groesse

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

/** Radius, auf dem n Pins um ihre Mitte stehen, ohne sich zu berühren (Sehne = Pin + Luft). */
function faecherRadius(anzahl: number): number {
  // Ein halber Pixel mehr, damit Rundung aus „berührt sich gerade nicht" kein „überdeckt" macht.
  return (PIN_DURCHMESSER + MARKEN_LUFT) / (2 * Math.sin(Math.PI / anzahl)) + 0.5
}

type Haufen = { mitglieder: PinPunkt[]; x: number; y: number }
type Flaeche = { x: number; y: number; breite: number; hoehe: number; rund: boolean }

function flaecheVon(haufen: Haufen, aufgefaechert: boolean): Flaeche {
  const n = haufen.mitglieder.length
  if (n === 1) return { x: haufen.x, y: haufen.y, breite: PIN_DURCHMESSER, hoehe: PIN_DURCHMESSER, rund: true }
  if (aufgefaechert) {
    const kante = 2 * (faecherRadius(n) + PIN_DURCHMESSER / 2)
    return { x: haufen.x, y: haufen.y, breite: kante, hoehe: kante, rund: false }
  }
  const masse = gruppenPinMasse(n)
  return { x: haufen.x, y: haufen.y, ...masse, rund: false }
}

/** Zwei runde Pins: echter Abstand; sonst die Rechtecke (Pille, Fächer). */
function ueberdecken(a: Flaeche, b: Flaeche): boolean {
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y)
  if (a.rund && b.rund) return Math.hypot(dx, dy) < (a.breite + b.breite) / 2 + MARKEN_LUFT
  return dx < (a.breite + b.breite) / 2 + MARKEN_LUFT && dy < (a.hoehe + b.hoehe) / 2 + MARKEN_LUFT
}

/**
 * Pins, die sich bei dieser Zoomstufe überdecken, werden EIN Gruppen-Pin in
 * der Mitte seiner Höfe — so lange, bis sich keine zwei Marken mehr
 * überdecken (auch der breitere Gruppen-Pin nicht mit einem Nachbarn). Bei
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
  const punkt = new Map<string, { x: number; y: number }>()
  const haufen: Haufen[] = [...pins]
    .sort((a, b) => a.nummer - b.nummer)
    .map((pin) => {
      const p = weltPixel(pin.lat, pin.lon, z)
      punkt.set(pin.slug, p)
      return { mitglieder: [pin], x: p.x, y: p.y }
    })

  let zusammengelegt = true
  while (zusammengelegt) {
    zusammengelegt = false
    suche: for (let i = 0; i < haufen.length; i++) {
      for (let j = i + 1; j < haufen.length; j++) {
        if (!ueberdecken(flaecheVon(haufen[i], aufgefaechert), flaecheVon(haufen[j], aufgefaechert))) continue
        const mitglieder = [...haufen[i].mitglieder, ...haufen[j].mitglieder].sort((a, b) => a.nummer - b.nummer)
        const summe = mitglieder.reduce(
          (s, m) => {
            const p = punkt.get(m.slug) as { x: number; y: number }
            return { x: s.x + p.x, y: s.y + p.y }
          },
          { x: 0, y: 0 }
        )
        haufen[i] = { mitglieder, x: summe.x / mitglieder.length, y: summe.y / mitglieder.length }
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
          return { art: 'pin', pin, lat: stelle.lat, lon: stelle.lon }
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
