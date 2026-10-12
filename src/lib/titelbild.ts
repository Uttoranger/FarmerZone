/**
 * Titelbild im Hochformat (Register N6, Nachtlauf Nr. 72; in der Freigabe „B2“).
 *
 * Ein Foto vom Handy steht oft hochkant (3000 × 4000). Auf die Breite der
 * Hofseite gezogen und auf 300 px Höhe beschnitten, bliebe am Computer ein
 * schmaler, unscharfer Streifen. Darum zeigt die Hofseite ein Hochformat ab
 * 768 px ganz, vor einer weichen, abgedunkelten Kopie desselben Fotos
 * (components/hofseite/titelbild.tsx); am Handy bleibt der Beschnitt mit
 * Fokuspunkt.
 *
 * Die Maße kennt nur der Browser, und erst beim Laden des Bilds — gespeichert
 * werden sie nicht (keine Migration). Bis dahin gilt „beschnitt“ wie vor N6:
 * Querformat springt nie, Hochformat wechselt einmal nach dem Laden.
 * Vormerkung Lauf 12: Maße beim Hochladen speichern, dann entfällt der Wechsel.
 */

/** Breite und Höhe eines Bilds in Pixeln. */
export type TitelbildMasse = { breite: number; hoehe: number }

/**
 * `beschnitt`: Das Foto füllt die Fläche, der Rand fällt weg (so war es immer).
 * `ganz`: Das ganze Foto steht in voller Höhe, die Fläche füllt eine unscharfe Kopie.
 */
export type TitelbildDarstellung = 'beschnitt' | 'ganz'

/** Nur was höher als breit ist, wird ganz gezeigt — unbekannte Maße, Querformat und Quadrat bleiben beim Beschnitt. */
export function titelbildDarstellung(masse: TitelbildMasse | null): TitelbildDarstellung {
  return masse !== null && masse.hoehe > masse.breite ? 'ganz' : 'beschnitt'
}

/**
 * Die Maße eines geladenen Bilds (`naturalWidth`, `naturalHeight`). Der
 * Browser meldet 0, wenn er keine kennt (kaputtes Bild) — das gilt als unbekannt.
 */
export function leseBildmasse(bild: { naturalWidth: number; naturalHeight: number }): TitelbildMasse | null {
  if (bild.naturalWidth <= 0 || bild.naturalHeight <= 0) return null
  return { breite: bild.naturalWidth, hoehe: bild.naturalHeight }
}

const HOCHFORMAT_HINWEIS = 'Hochformat – am Computer zeigen wir es ganz, mit weichem Rand. Ein Querformat wirkt dort größer.'

/**
 * Der ruhige Satz unter der Vorschau in Mein Hof — nur bei Hochformat. Kein
 * Blocker und keine Pflicht: Der Hof darf sein Foto behalten.
 */
export function titelbildHinweis(masse: TitelbildMasse | null): string | null {
  return titelbildDarstellung(masse) === 'ganz' ? HOCHFORMAT_HINWEIS : null
}
