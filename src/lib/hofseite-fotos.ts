/**
 * Die Fotos der Hofseite am Handy (Register N5, Änderung Nr. 107; Mockups
 * mobil-k2-hofseite-fotos-mosaik, mobil-k2-hofseite-bildansicht,
 * system-k2-hofseite-fotos-varianten): welche Form die Übersicht unter lg
 * hat, wie viele Fotos der Deckel „+n" verspricht, wann ein Wischen blättert
 * und was Zähler und Knöpfe sagen. Rein und ohne Browser prüfbar
 * (tests/hofseite-fotos.test.ts); gezeichnet wird in
 * components/hofseite/hofseite-fotos.tsx und bildansicht.tsx.
 */

/** Die Formen unter lg: nichts, ein Foto in voller Breite, zwei Hälften, ein großes und zwei kleine. */
export type FotoFormArt = 'leer' | 'eins' | 'zwei' | 'mosaik'

export type FotoForm = {
  form: FotoFormArt
  /** So viele Fotos stehen nicht in der Übersicht — der Deckel „+n" auf der dritten Kachel; 0 = kein Deckel. */
  weitere: number
}

/** Das Mosaik zeigt drei Kacheln; was darüber hinausgeht, verspricht der Deckel. */
export const MOSAIK_KACHELN = 3

/**
 * EINE Regel für die Form (N5): 1 Foto volle Breite, 2 Fotos zwei Hälften,
 * ab 3 ein großes und zwei kleine; den Deckel gibt es erst ab 4 — bei genau
 * drei Fotos ist nichts verborgen. Kein seitliches Scrollen in keiner Form.
 */
export function fotoForm(anzahl: number): FotoForm {
  if (anzahl <= 0) return { form: 'leer', weitere: 0 }
  if (anzahl === 1) return { form: 'eins', weitere: 0 }
  if (anzahl === 2) return { form: 'zwei', weitere: 0 }
  return { form: 'mosaik', weitere: Math.max(0, anzahl - MOSAIK_KACHELN) }
}

/** Ab so vielen Pixeln waagrecht zählt eine Bewegung auf dem Foto als Wischen. */
export const WISCH_SCHWELLE_PX = 40

/** Wohin ein Wischen blättert: nach links gewischt kommt das nächste Foto. */
export type WischRichtung = 'vor' | 'zurueck' | null

/**
 * Ob eine Bewegung von `dx`/`dy` Pixeln (Ende minus Anfang) blättert. Unter
 * der Schwelle ist es ein Tipp; ist sie mindestens so senkrecht wie waagrecht,
 * gewinnt das Scrollen — sonst blätterte schon ein schräger Daumen.
 */
export function wischRichtung(dx: number, dy: number): WischRichtung {
  if (Math.abs(dx) < WISCH_SCHWELLE_PX) return null
  if (Math.abs(dy) >= Math.abs(dx)) return null
  return dx < 0 ? 'vor' : 'zurueck'
}

/** Der Zähler der Bildansicht: „3 / 8" — `index` zählt ab 0. */
export function zaehlerText(index: number, anzahl: number): string {
  return `${index + 1} / ${anzahl}`
}

/** Alle Wörter rund um die Fotos — EINE Quelle für Übersicht und Bildansicht. */
export const HOFSEITE_FOTOS_TEXT = {
  ueberschrift: 'Fotos',
  /** Wofür die Bildansicht steht, für Screenreader. */
  bildansicht: 'Fotos vom Hof',
  schliessen: 'Schließen',
  vorheriges: 'Vorheriges Foto',
  naechstes: 'Nächstes Foto',
  /** Die Leiste unten in der Bildansicht, für Screenreader. */
  leiste: 'Alle Fotos',
} as const

/** Der Knopf einer Kachel: „Foto 1 von 8 öffnen". */
export function fotoOeffnenLabel(index: number, anzahl: number): string {
  return `Foto ${index + 1} von ${anzahl} öffnen`
}

/** Der Knopf der Kachel mit Deckel: „Alle 8 Fotos ansehen". */
export function alleFotosLabel(anzahl: number): string {
  return `Alle ${anzahl} Fotos ansehen`
}

/** Die Liste der Kacheln, für Screenreader: „Fotos von Hof Test, 8 insgesamt". */
export function fotoListeLabel(hofName: string, anzahl: number): string {
  return `Fotos von ${hofName}, ${anzahl} insgesamt`
}

/** Ein Foto in der Leiste der Bildansicht: „Foto 3 von 8". */
export function fotoSprungLabel(index: number, anzahl: number): string {
  return `Foto ${index + 1} von ${anzahl}`
}

/** Der Deckel auf der dritten Kachel: groß „+5", klein „alle 8 Fotos". */
export function deckelText(weitere: number, anzahl: number): { plus: string; alle: string } {
  return { plus: `+${weitere}`, alle: `alle ${anzahl} Fotos` }
}

/**
 * Die leise Zeile unter dem Mosaik — erst ab zwei Fotos, mit einem gibt es
 * nichts zu blättern. Zwei Fassungen, weil „wischen" nur am Handy stimmt: Mit
 * der Maus blättern die Pfeile der Bildansicht (nur bei `pointer-fine`, siehe
 * bildansicht.tsx). Welche zu sehen ist, entscheidet die Komponente per CSS.
 */
export function fotosHinweis(anzahl: number): { touch: string; maus: string } | null {
  if (anzahl < 2) return null
  return {
    touch: `Tippen öffnet die Bildansicht – wischen blättert durch alle ${anzahl}.`,
    maus: `Tippen öffnet die Bildansicht – Pfeile blättern durch alle ${anzahl}.`,
  }
}
