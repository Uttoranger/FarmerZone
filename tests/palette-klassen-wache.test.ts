/**
 * Palette-Klassen-Wache (CODING_STANDARDS §7: keine Farbe hart in eine Komponente; CLAUDE.md §2).
 *
 * Ursache: Tailwind-Palette-Klassen (`bg-slate-700`, `text-amber-800`, `hover:bg-green-800`) kennen keine
 * Themes: Jede braucht ihre eigene `dark:`-Kopie, und kein Test sieht, ob sie fehlt. ESLint prüft nur
 * Hex, `rgb(`, `oklch(` — die Palette-Klassen gingen durch. Die Tokens (`bg-card`, `text-foreground`,
 * `text-notice-ink`, `bg-zustand-tun-grund` …) folgen dem Thema von selbst.
 *
 * Beweist (Quelltext von `src/`, Dateiarbeit, kein Netz): Keine Datei unter `src/` (`.ts`, `.tsx`, `.css`)
 * schreibt eine Palette-Klasse — Farbname aus der Tailwind-Palette plus Stufe 50–950 hinter einem
 * Farb-Präfix (`bg-`, `text-`, `border-`, `ring-`, `from-`, `fill-` …), auch mit Variante davor
 * (`dark:`, `hover:`) und Deckkraft dahinter (`/40`). Kommentare zählen nicht. `white`, `black` und
 * die Namen der Tokens sind keine Palette-Klassen.
 *
 * Bestand: `BESTAND` nennt die Dateien von heute, je mit Grund. Die Liste darf nur schrumpfen — eine neue
 * Datei mit Palette-Klasse macht den Test rot, eine Datei der Liste ohne Treffer fällt als veraltet auf
 * (dann raus aus der Liste). Eine Datei zieht um, indem sie auf Tokens umstellt; die Liste ist keine
 * Erlaubnis für neue Stellen in diesen Dateien, nur eine Schuld, die abgetragen wird.
 *
 * Gegenprobe: Text-Attrappen — jede Schreibweise schlägt an, Tokens, `white` und Wörter, die nur so
 * aussehen (`bg-greenhouse-100`), nicht. Keine Datei im Repository wird dafür verändert.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const WURZEL = process.cwd()

const FARBEN = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
const PRAEFIXE = 'bg|text|border|border-[trblxy]|ring|ring-offset|from|via|to|fill|stroke|divide|outline|decoration|shadow|accent|caret|placeholder'
const PALETTE_KLASSE = new RegExp(`(?<![A-Za-z0-9_-])(?:${PRAEFIXE})-(?:${FARBEN})-(?:50|100|200|300|400|500|600|700|800|900|950)(?![A-Za-z0-9-])`, 'g')

type Ausnahme = { datei: string; grund: string }

const BESTAND: Ausnahme[] = [
  { datei: 'src/components/shared/umgebungs-banner.tsx', grund: 'Das Absperrband der Testumgebung: feste Warnfarben, in beiden Modi gleich gewollt (Kontrast im Kommentar der Datei)' },
  { datei: 'src/components/shared/zeichen-zaehler.tsx', grund: 'Bestand: Hinweis über der Grenze in Bernstein mit eigener dark-Kopie, zieht mit den Formularen auf Tokens um' },
  { datei: 'src/components/orders/print-button.tsx', grund: 'Bestand: Druckknopf der alten Bestellansicht, zieht mit dem Umbau der Druckseiten auf Tokens um' },
  { datei: 'src/components/farmer/archived-farm-banner.tsx', grund: 'Bestand: Hinweiskasten für stillgelegte Höfe in Bernstein mit dark-Kopien, zieht mit dem Hofbereich auf die Hinweis-Tokens um' },
  { datei: 'src/components/farmer/pending-approval-banner.tsx', grund: 'Bestand: Hinweiskasten für Höfe vor der Freischaltung in Himmelblau mit dark-Kopien, zieht auf die Hinweis-Tokens um' },
  { datei: 'src/components/farmer/farmer-nav.tsx', grund: 'Bestand: Abmelden-Zeile der alten Hofleiste in Rot, zieht mit der Leiste auf destructive um' },
  { datei: 'src/components/products/product-dialog.tsx', grund: 'Bestand: Hinweise und Symbole im Produktdialog in Bernstein und Grün, ziehen auf die Hinweis-Tokens und die Marke um' },
  { datei: 'src/components/farm/product-grid.tsx', grund: 'Bestand: Kühl- und Tiefkühl-Symbole auf dem Produktfoto in Blau, Fotos folgen dem Modus nicht (Abschnitt „Was dem Modus NICHT folgt“)' },
  { datei: 'src/app/(farmer)/orders/[orderId]/print/page.tsx', grund: 'Bestand: Druckseite der Bestellung, Papier ist weiß und hat kein dunkles Thema, zieht mit den Druckseiten um' },
  { datei: 'src/app/(farmer)/orders/today/print/page.tsx', grund: 'Bestand: Druckseite der Packliste, Papier ist weiß und hat kein dunkles Thema, zieht mit den Druckseiten um' },
]

function* dateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* dateien(pfad)
    else if (/\.(ts|tsx|css)$/.test(name)) yield pfad
  }
}

const ohneKommentare = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

/** Die Palette-Klassen eines Texts, in der Reihenfolge ihres Auftretens. */
function paletteKlassen(text: string): string[] {
  return [...ohneKommentare(text).matchAll(PALETTE_KLASSE)].map((t) => t[0])
}

const treffer = new Map<string, string[]>()
for (const pfad of dateien(join(WURZEL, 'src'))) {
  const klassen = paletteKlassen(readFileSync(pfad, 'utf8'))
  if (klassen.length > 0) treffer.set(relative(WURZEL, pfad).split(sep).join('/'), klassen)
}

describe('Palette-Klassen-Wache — Tokens statt Palette', () => {
  it('keine Datei außer dem Bestand schreibt eine Palette-Klasse', () => {
    const neu = [...treffer].filter(([datei]) => !BESTAND.some((a) => a.datei === datei)).map(([datei, klassen]) => `${datei}: ${[...new Set(klassen)].join(' ')}`)
    expect(neu, 'Neue Palette-Klasse: ein Token aus docs/ai/DESIGN_SYSTEM.md („Farbtokens“) nehmen, nicht die Datei in BESTAND eintragen').toEqual([])
  })

  it('jede Datei im Bestand hat noch einen Treffer — sonst veraltet, raus aus der Liste', () => {
    const veraltet = BESTAND.filter((a) => !treffer.has(a.datei)).map((a) => a.datei)
    expect(veraltet).toEqual([])
  })

  it('der Bestand nennt jede Datei einmal und zu jeder einen Grund in ganzen Worten', () => {
    expect(new Set(BESTAND.map((a) => a.datei)).size).toBe(BESTAND.length)
    for (const a of BESTAND) expect(a.grund.split(' ').length, a.datei).toBeGreaterThanOrEqual(6)
  })
})

describe('Palette-Klassen-Wache — Gegenprobe: die Suche schlägt an', () => {
  it('findet die Palette in jeder Schreibweise — mit Variante, Deckkraft und Richtung', () => {
    for (const [text, klasse] of [
      ['<div className="bg-slate-700">', 'bg-slate-700'],
      ['<p className="text-amber-800 dark:text-amber-200">', 'text-amber-800'],
      ["clsx('rounded', 'hover:bg-green-800')", 'bg-green-800'],
      ['<tr className="border-t-slate-300">', 'border-t-slate-300'],
      ['<tr className="border-b-2 border-gray-200">', 'border-gray-200'],
      ['className="bg-red-500/15 text-red-300"', 'bg-red-500'],
      ['className="from-sky-50 to-blue-950"', 'from-sky-50'],
      ['className="ring-offset-zinc-100"', 'ring-offset-zinc-100'],
      ['const k = `fill-rose-600 ${x}`', 'fill-rose-600'],
      ['@apply bg-stone-900;', 'bg-stone-900'],
    ] as const) {
      expect(paletteKlassen(text), text).toContain(klasse)
    }
    expect(paletteKlassen('className="text-amber-800 dark:text-amber-200"')).toEqual(['text-amber-800', 'text-amber-200'])
  })

  it('lässt Tokens, white und black, Wörter mit ähnlichem Anfang und Kommentare stehen', () => {
    for (const text of [
      '<div className="bg-card text-foreground border-border ring-ring">',
      '<p className="text-notice-ink bg-notice border-notice-line">',
      '<Marke className="bg-zustand-tun-grund text-zustand-tun">',
      '<div className="bg-white text-black">',
      '<div className="bg-greenhouse-100 text-redwood-500 border-skyline-200">',
      '<div className="bg-green text-red-foreground">',
      '<div className="bg-amber-1000 text-amber-85">',
      '// Beispiel: bg-amber-50 dark:bg-amber-950/40 gehört nicht mehr in neuen Code\nconst x = 1',
      '/* text-slate-700 */ const y = 2',
      'const hinweis = "Farbe: slate-700"',
    ]) {
      expect(paletteKlassen(text), text).toEqual([])
    }
  })
})
