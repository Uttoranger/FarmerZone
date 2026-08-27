/**
 * Reine Anzeige-Logik der Hofübersicht: die gemeinsame Auswahl-Grammatik
 * (EINE Quelle der Wahrheit für Desktop-Hervorhebung, Karussell-Position und
 * Pin-Stile), die Pin-Zustände und die Karussell-Snap-Erkennung — alles ohne
 * DOM und ohne Leaflet, prüfbar in tests/hoefe-anzeige.test.ts.
 */

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
