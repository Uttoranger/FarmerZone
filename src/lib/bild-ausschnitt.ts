import type { BildAusschnitt, BildFilter } from '@/schemas/bild-ausschnitt'

/*
 * Ein Stil für jedes Foto mit Ausschnitt (Register N13/N17, Nachtlauf Nr. 97):
 * Fokus, Zoom und Filter werden nur als CSS gezeigt — keine zweite Bilddatei,
 * keine Verarbeitung am Server. Dieselbe Rechnung gilt in jedem Rahmen, darum
 * reicht EIN Ausschnitt für Computer und Handy (Rechnung bei `bildLage`).
 *
 * Teilen-Bild, Warenkorb, Kasse, E-Mails und der Screenshot unter „Problem
 * melden“ zeigen das Rohfoto (Register N17) — sie rufen diese Datei nicht auf.
 */

/**
 * Die sechs Filter als CSS (Mockup system-h1-titelbild-filter, wörtlich).
 * Kein hue-rotate: Er dreht alle Farben, aus grünen Wiesen würden blaue und
 * aus roten Tomaten violette — ein Lebensmittel soll aussehen, wie es ist.
 */
export const BILD_FILTER: Record<BildFilter, string> = {
  NATUERLICH: '',
  KLAR: 'contrast(1.08) brightness(1.03) saturate(1.05)',
  WARM: 'sepia(0.22) saturate(1.2)',
  KRAEFTIG: 'contrast(1.12) saturate(1.35)',
  SANFT: 'contrast(0.9) brightness(1.07) saturate(0.85)',
  SCHWARZWEISS: 'grayscale(1) contrast(1.1)',
}

/** Der Name unter der Filterkachel (Wortliste: „Filter“ = eine der sechs Vorgaben). */
export const BILD_FILTER_NAME: Record<BildFilter, string> = {
  NATUERLICH: 'Natürlich',
  KLAR: 'Klar',
  WARM: 'Warm',
  KRAEFTIG: 'Kräftig',
  SANFT: 'Sanft',
  SCHWARZWEISS: 'Schwarzweiß',
}

/** „Zurücksetzen“: Mitte, 100 %, Natürlich — so stand jedes Foto vor dem Baustein. */
export const AUSSCHNITT_STANDARD: BildAusschnitt = { fokusX: 50, fokusY: 50, zoom: 100, filter: 'NATUERLICH' }

export const ZOOM_MIN = 100
export const ZOOM_MAX = 250

/** Pfeiltasten verschieben um 2 %, mit Umschalt um 10 % (WCAG 2.1.1). */
export const TASTEN_SCHRITT = 2
export const TASTEN_SCHRITT_GROSS = 10

/** Die Texte des Bild-Bausteins (components/shared/bild-ausschnitt.tsx), eine Quelle. */
export const BILD_AUSSCHNITT_TEXT = {
  ziehen: 'Ziehen',
  zoom: 'Zoom',
  filter: 'Filter',
  amComputer: 'Am Computer',
  fuellen: 'Ausschnitt füllen',
  ganz: 'Ganz zeigen',
  speichern: 'Speichern',
  speichert: 'Speichert …',
  abbrechen: 'Abbrechen',
  zuruecksetzen: 'Zurücksetzen',
  /** Für den Screenreader am Rahmen: was man dort tun kann. */
  rahmenHilfe: 'Foto ziehen oder mit den Pfeiltasten verschieben, mit Umschalt in großen Schritten.',
  nichtAngemeldet: 'Bitte melde dich neu an.',
  hofFehlt: 'Wir haben deinen Hof nicht gefunden. Lade die Seite neu.',
  ungueltig: 'Den Ausschnitt konnten wir nicht speichern. Lade die Seite neu und versuch es noch einmal.',
} as const

/** Der Stil eines Fotos mit `object-fit: cover` — als React-Style an `next/image`. */
export type BildStil = {
  objectPosition?: string
  transform?: string
  transformOrigin?: string
  filter?: string
}

/**
 * Fokus, Zoom und (ohne `{ filter: false }`) Filter als Inline-Stil für ein
 * Foto mit `object-cover`. `null` heißt „kein Ausschnitt“ und ergibt `{}` —
 * das Foto steht wie vorher.
 *
 * Gezoomt wird um den Fokuspunkt (`transform-origin`): So bleibt der Bildpunkt
 * unter dem Fokus an derselben Stelle des Rahmens, in jeder Rahmengröße.
 */
export function bildStil(ausschnitt: BildAusschnitt | null, optionen: { filter?: boolean } = {}): BildStil {
  if (ausschnitt === null) return {}
  const punkt = `${ausschnitt.fokusX}% ${ausschnitt.fokusY}%`
  const stil: BildStil = { objectPosition: punkt, transform: `scale(${ausschnitt.zoom / 100})`, transformOrigin: punkt }
  const filter = BILD_FILTER[ausschnitt.filter]
  if (optionen.filter !== false && filter !== '') stil.filter = filter
  return stil
}

/** Nur der Filter, ohne Fokus und Zoom — für ein Foto, das ganz steht (`object-contain`). */
export function nurFilterStil(ausschnitt: BildAusschnitt | null): BildStil {
  const filter = ausschnitt === null ? '' : BILD_FILTER[ausschnitt.filter]
  return filter === '' ? {} : { filter }
}

/**
 * Ein Filter VOR dem des Ausschnitts in EINER `filter`-Angabe — etwa
 * `blur(28px)` der unscharfen Titelbild-Kopie. Zwei Angaben überschrieben sich
 * (eine Klasse `blur-[28px]` neben einem Inline-Filter wäre wirkungslos).
 */
export function filterMit(vorweg: string, ausschnitt: BildAusschnitt | null): string {
  const filter = ausschnitt === null ? '' : BILD_FILTER[ausschnitt.filter]
  return filter === '' ? vorweg : `${vorweg} ${filter}`
}

/** Breite und Höhe — eines Rahmens oder eines Bilds, in Pixeln oder im Verhältnis. */
export type Masse = { breite: number; hoehe: number }

/** Wo das Foto im Rahmen liegt: links und oben relativ zur linken oberen Ecke des Rahmens. */
export type BildLage = { links: number; oben: number; breite: number; hoehe: number }

/**
 * Wo das Foto bei `object-fit: cover`, `object-position: fx fy` und
 * `transform: scale(z)` um `transform-origin: fx fy` liegt.
 *
 * `cover` stellt das Foto auf s0 = max(fw/iw, fh/ih) und legt es bei
 * (fw − iw·s0)·fx ab; der Zoom um den Punkt (fw·fx, fh·fy) macht daraus
 *   dw = iw·s0·z,  left = (fw − dw)·fx,  top = (fh − dh)·fy.
 * Der Bildpunkt (fx, fy) — fx der Breite, fy der Höhe des Fotos — liegt damit
 * bei left + fx·dw = fx·fw, also immer an derselben relativen Stelle des
 * Rahmens. Darum reicht EIN Ausschnitt für jede Rahmengröße.
 *
 * Gibt man Rahmen und Bild als Verhältnis (etwa 3,6 : 1), kommen die Werte im
 * selben Maß heraus — so legt der Baustein die blasse Fortsetzung in Prozent.
 */
export function bildLage(rahmen: Masse, bild: Masse, ausschnitt: Pick<BildAusschnitt, 'fokusX' | 'fokusY' | 'zoom'>): BildLage {
  const s0 = Math.max(rahmen.breite / bild.breite, rahmen.hoehe / bild.hoehe)
  const z = ausschnitt.zoom / 100
  const breite = bild.breite * s0 * z
  const hoehe = bild.hoehe * s0 * z
  return {
    links: (rahmen.breite - breite) * (ausschnitt.fokusX / 100),
    oben: (rahmen.hoehe - hoehe) * (ausschnitt.fokusY / 100),
    breite,
    hoehe,
  }
}

const aufProzent = (wert: number): number => Math.min(100, Math.max(0, Math.round(wert)))

/**
 * Der Fokus nach einem Zug um (dx, dy) Pixel, gerechnet vom Fokus beim
 * Aufsetzen — so springt nichts beim Loslassen, und der Rahmen am Handy
 * (~100 px hoch) folgt dem Finger genauso wie der große. Das Foto folgt dem
 * Finger: left' = left + dx, also fx' = fx + dx / (fw − dw). Eine Achse, in
 * der das Foto den Rahmen genau füllt (fw − dw ≥ 0), bleibt stehen.
 * Gerundet wird bei jedem Schritt auf ganze Prozent — das Gespeicherte ist
 * genau das Gezeigte.
 */
export function ausschnittNachZiehen(
  start: Pick<BildAusschnitt, 'fokusX' | 'fokusY' | 'zoom'>,
  zug: { dx: number; dy: number },
  rahmen: Masse,
  bild: Masse
): { fokusX: number; fokusY: number } {
  const lage = bildLage(rahmen, bild, start)
  const spielX = rahmen.breite - lage.breite
  const spielY = rahmen.hoehe - lage.hoehe
  return {
    fokusX: spielX < 0 ? aufProzent(start.fokusX + (100 * zug.dx) / spielX) : start.fokusX,
    fokusY: spielY < 0 ? aufProzent(start.fokusY + (100 * zug.dy) / spielY) : start.fokusY,
  }
}

// Wie beim Ziehen folgt das Foto der Taste: → schiebt es nach rechts, zeigt also mehr vom linken Rand.
// Eine Map, kein Objekt: Eine Taste namens „toString“ fände sonst die Methode des Prototyps.
const TASTEN_RICHTUNG: ReadonlyMap<string, { x: number; y: number }> = new Map([
  ['ArrowRight', { x: -1, y: 0 }],
  ['ArrowLeft', { x: 1, y: 0 }],
  ['ArrowDown', { x: 0, y: -1 }],
  ['ArrowUp', { x: 0, y: 1 }],
])

/** Unterhalb dieses Anteils der Rahmenkante gilt eine Achse als ohne Spiel. */
const SPIEL_TOLERANZ = 1e-6

/**
 * Der Fokus nach einer Pfeiltaste auf dem Rahmen; `null` für jede andere Taste.
 *
 * Wie beim Ziehen bewegt sich nur eine Achse mit Spiel — auf der das Foto über
 * den Rahmen hinausragt (Nacharbeit 97, Nr. 108). Sonst änderte etwa → bei
 * einem Quadrat im Rahmen 3,6 : 1 (Zoom 100 %) einen unsichtbaren Wert, der
 * erst nach dem Zoomen wirkte. Rahmen und Bild dürfen Verhältnisse sein (wie
 * bei `bildLage`); ohne Maße (das Foto lädt noch) bleibt der Fokus stehen.
 */
export function ausschnittNachTaste(
  wert: Pick<BildAusschnitt, 'fokusX' | 'fokusY' | 'zoom'>,
  taste: string,
  umschalt: boolean,
  rahmen: Masse,
  bild: Masse | null
): { fokusX: number; fokusY: number } | null {
  const richtung = TASTEN_RICHTUNG.get(taste)
  if (!richtung) return null
  const schritt = umschalt ? TASTEN_SCHRITT_GROSS : TASTEN_SCHRITT
  const lage = bild ? bildLage(rahmen, bild, wert) : null
  // Ein Hauch Toleranz: Füllt das Foto den Rahmen genau, ergibt die Rechnung mit Kommazahlen mal −0,0000001.
  const spielX = lage !== null && rahmen.breite - lage.breite < -SPIEL_TOLERANZ * rahmen.breite
  const spielY = lage !== null && rahmen.hoehe - lage.hoehe < -SPIEL_TOLERANZ * rahmen.hoehe
  return {
    fokusX: spielX ? aufProzent(wert.fokusX + richtung.x * schritt) : wert.fokusX,
    fokusY: spielY ? aufProzent(wert.fokusY + richtung.y * schritt) : wert.fokusY,
  }
}
