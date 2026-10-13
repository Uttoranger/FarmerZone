/**
 * Titelbild der Hofseite am Computer (Register N6, Nachtlauf Nr. 72; Register
 * N13, Nr. 89).
 *
 * Die Fläche ist am Computer 300 bis 420 px hoch und höchstens 1 920 px breit
 * — ein Streifen. Ein Foto vom Handy steht oft hochkant (3000 × 4000) oder
 * fast quadratisch (4:3); auf die Breite gezogen und beschnitten bliebe davon
 * ein schmaler, unscharfer Ausschnitt aus der Mitte. Darum zeigt die Hofseite
 * ein solches Foto ab 768 px ganz, vor einer weichen, abgedunkelten Kopie
 * desselben Fotos (components/hofseite/titelbild.tsx); nur ein Querformat ab
 * 3:2 füllt die Fläche mit Fokuspunkt. Am Handy bleibt immer der Beschnitt.
 *
 * Die Maße kennt nur der Browser, und erst beim Laden des Bilds — gespeichert
 * werden sie nicht (keine Migration). Bis dahin gilt „beschnitt“: Querformat
 * springt nie, alles andere wechselt einmal nach dem Laden, und die Kopie
 * blendet dabei weich ein. Offen: Maße beim Hochladen speichern, dann entfällt
 * der Wechsel (Register N13).
 */

/** Breite und Höhe eines Bilds in Pixeln. */
export type TitelbildMasse = { breite: number; hoehe: number }

/**
 * `beschnitt`: Das Foto füllt die Fläche, der Rand fällt weg (so war es immer).
 * `ganz`: Das ganze Foto steht in voller Höhe, die Fläche füllt eine unscharfe Kopie.
 */
export type TitelbildDarstellung = 'beschnitt' | 'ganz'

/**
 * Unter diesem Seitenverhältnis (Breite ÷ Höhe) steht das Foto ganz: Quadrat,
 * Hochformat und 4:3. Ab 1,5 — das ist 3:2 selbst — füllt es die Fläche mit
 * Fokuspunkt, wie vor N6. Die Grenze ist eine Entscheidung der Projektleitung
 * (Register N13), keine Rechnung.
 */
export const TITELBILD_GANZ_UNTER = 1.5

/**
 * Breiter als 1 920 px wird die Fläche nicht aufgezogen: Foto und Kopie rechnen
 * mit dieser Breite, der Rest links und rechts ist die unscharfe Kopie
 * (Register N13). Als Klasse `max-w-[1920px]` steht dieselbe Zahl in
 * titelbild.tsx — Tailwind liest nur ganze Klassen —, `tests/titelbild.test.ts`
 * prüft, dass beide übereinstimmen.
 */
export const TITELBILD_BREITE_MAX = 1920

/**
 * Wie breit das Bild im Rahmen steht, für `next/image`: bis 1 920 px die Breite
 * des Fensters, darüber höchstens 1 920 px. Das scharfe Foto und die Kopie
 * geben dasselbe an — der Browser lädt dieselbe Datei nur einmal.
 */
export const TITELBILD_SIZES = `(min-width: ${TITELBILD_BREITE_MAX}px) ${TITELBILD_BREITE_MAX}px, 100vw`

/** Alles, was weniger als 1,5-mal so breit wie hoch ist, steht ganz — unbekannte Maße und Querformat ab 3:2 bleiben beim Beschnitt. */
export function titelbildDarstellung(masse: TitelbildMasse | null): TitelbildDarstellung {
  return masse !== null && masse.breite / masse.hoehe < TITELBILD_GANZ_UNTER ? 'ganz' : 'beschnitt'
}

/**
 * Die Maße eines geladenen Bilds (`naturalWidth`, `naturalHeight`). Der
 * Browser meldet 0, wenn er keine kennt (kaputtes Bild) — das gilt als unbekannt.
 */
export function leseBildmasse(bild: { naturalWidth: number; naturalHeight: number }): TitelbildMasse | null {
  if (bild.naturalWidth <= 0 || bild.naturalHeight <= 0) return null
  return { breite: bild.naturalWidth, hoehe: bild.naturalHeight }
}

const GANZ_HINWEIS = 'Quadrat oder Hochformat – am Computer zeigen wir es ganz, mit weichem Rand. Ein Querformat wirkt dort größer.'

/**
 * Der ruhige Satz unter der Vorschau in Mein Hof — nur, wenn die Hofseite das
 * Foto ganz zeigt. Kein Blocker und keine Pflicht: Der Hof darf sein Foto behalten.
 */
export function titelbildHinweis(masse: TitelbildMasse | null): string | null {
  return titelbildDarstellung(masse) === 'ganz' ? GANZ_HINWEIS : null
}
