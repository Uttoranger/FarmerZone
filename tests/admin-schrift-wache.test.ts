/**
 * Admin-Schrift-Wache (Nr. 281; Regelvorschlag 10 aus Morgenbericht 32 B, freigegeben 7.11.2026;
 * docs/ai/DESIGN_SYSTEM.md „Admin nach der Abnahme Lauf 32“).
 *
 * Ursache: Die Messung der Abnahme fand im Admin immer wieder Schrift unter 12 px (Postfach, Startseite,
 * Geld) — jede Nummer behob die gemessenen Stellen, ungemessene Zustände (Dialoge, Leerzustände,
 * Diagramme) blieben. Die Messung sieht nur fotografierte Zustände; der Quelltext sieht alle.
 *
 * Beweist (Quelltext unter src/app/admin und src/components/admin, `.ts`/`.tsx`, Kommentare zählen
 * nicht): Keine Datei außer dem Bestand schreibt eine Schriftgröße unter 12 px — als beliebige
 * Tailwind-Größe (`text-[11px]`, `sm:text-[11.5px]`, `text-[0.6875rem]`, auch in SVG-Klassen), als
 * `fontSize` (Zahl, Zeichenkette oder eine Konstante derselben Datei, deren Wert unter 12 liegt) oder
 * als CSS `font-size`. rem und em zählen mit 16 px.
 *
 * Bestand: tests/bestandslisten/admin-schrift.ts nennt die Dateien von heute mit der Zahl der Stellen
 * und einem Grund. Die Liste darf nur schrumpfen — eine neue Datei oder mehr Stellen machen den Test
 * rot, eine Datei der Liste ohne Treffer ebenso (dann raus aus der Liste).
 *
 * Gegenprobe: Text-Attrappen — jede Schreibweise unter 12 px schlägt an, 12 px und mehr, `text-xs`
 * und Kommentare nicht. Keine Datei im Repository wird dafür verändert.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ADMIN_SCHRIFT_BESTAND } from './bestandslisten/admin-schrift'

const WURZEL = process.cwd()
const ORDNER = ['src/app/admin', 'src/components/admin']
const GRENZE_PX = 12

function* dateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* dateien(pfad)
    else if (/\.(ts|tsx)$/.test(name)) yield pfad
  }
}

const ohneKommentare = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

/** Pixel aus Zahl und Einheit; rem und em mit 16 px. */
function alsPx(zahl: string, einheit: string | undefined): number {
  const wert = Number.parseFloat(zahl)
  return einheit === 'rem' || einheit === 'em' ? wert * 16 : wert
}

const TAILWIND = /(?<![A-Za-z0-9_-])text-\[(?:length:)?(\d*\.?\d+)(px|rem|em)\]/g
const FONT_SIZE_WERT = /fontSize\s*(?:=|:)\s*\{?\s*['"`]?(\d*\.?\d+)(px|rem|em)?/g
const FONT_SIZE_NAME = /fontSize\s*=\s*\{\s*([A-Za-z_$][\w$]*)\s*\}/g
const CSS = /font-size\s*:\s*(\d*\.?\d+)(px|rem|em)/g

/** Die Stellen unter 12 px eines Quelltexts, in der Reihenfolge der Suche. */
function kleineSchrift(quelltext: string): string[] {
  const text = ohneKommentare(quelltext)
  const funde: string[] = []
  for (const muster of [TAILWIND, FONT_SIZE_WERT, CSS]) {
    for (const t of text.matchAll(muster)) if (alsPx(t[1]!, t[2]) < GRENZE_PX) funde.push(t[0])
  }
  // fontSize={schrift}: der Wert steht in einer Konstante derselben Datei (`const schrift = schmal ? 10 : 12`).
  for (const t of text.matchAll(FONT_SIZE_NAME)) {
    const name = t[1]!
    const zeile = new RegExp(`(?:const|let)\\s+${name.replace(/\$/g, '\\$')}\\s*=\\s*([^\\n;]+)`).exec(text)
    if (!zeile) continue
    const zahlen = [...zeile[1]!.matchAll(/(?<![\w.])(\d*\.?\d+)(?![\w.])/g)].map((z) => Number.parseFloat(z[1]!))
    if (zahlen.some((z) => z > 0 && z < GRENZE_PX)) funde.push(`${t[0]} (${zeile[0].trim()})`)
  }
  return funde
}

const treffer = new Map<string, string[]>()
for (const ordner of ORDNER) {
  for (const pfad of dateien(join(WURZEL, ordner))) {
    const funde = kleineSchrift(readFileSync(pfad, 'utf8'))
    if (funde.length > 0) treffer.set(relative(WURZEL, pfad).split(sep).join('/'), funde)
  }
}

describe('Admin-Schrift-Wache — nie unter 12 px', () => {
  it('keine Datei außer dem Bestand schreibt eine Schrift unter 12 px, keine mehr Stellen als im Bestand', () => {
    const zuViel = [...treffer]
      .filter(([datei, funde]) => funde.length > (ADMIN_SCHRIFT_BESTAND[datei]?.stellen ?? 0))
      .map(([datei, funde]) => `${datei} (${funde.length} statt ${ADMIN_SCHRIFT_BESTAND[datei]?.stellen ?? 0}): ${funde.join(' · ')}`)
    expect(zuViel, 'Schrift unter 12 px im Admin: text-xs (12 px) oder größer nehmen, nicht den Bestand erhöhen').toEqual([])
  })

  it('jede Datei im Bestand hat noch genau so viele Treffer — sonst Zahl senken oder Eintrag streichen', () => {
    const veraltet = Object.entries(ADMIN_SCHRIFT_BESTAND)
      .filter(([datei, a]) => (treffer.get(datei)?.length ?? 0) < a.stellen)
      .map(([datei, a]) => `${datei}: ${treffer.get(datei)?.length ?? 0} statt ${a.stellen}`)
    expect(veraltet).toEqual([])
  })

  it('jeder Eintrag im Bestand trägt einen Grund in ganzen Worten', () => {
    for (const [datei, a] of Object.entries(ADMIN_SCHRIFT_BESTAND)) {
      expect(a.stellen, datei).toBeGreaterThan(0)
      expect(a.grund.split(' ').length, datei).toBeGreaterThanOrEqual(6)
    }
  })
})

describe('Admin-Schrift-Wache — Gegenprobe: die Suche schlägt an', () => {
  it('findet jede Schreibweise unter 12 px', () => {
    for (const text of [
      '<p className="text-[11px] text-muted-foreground">',
      '<span className="sm:text-[11.5px]">',
      '<span className="text-[10px]/4">',
      '<span className="text-[0.6875rem]">',
      '<span className="text-[length:11px]">',
      '<text className="fill-muted-foreground text-[11px]">',
      '<text fontSize={10.5}>',
      '<text fontSize="11">',
      '<text fontSize="11px">',
      'const stil = { fontSize: 11 }',
      '<style>p{font-size:11px}</style>',
      'const schrift = schmal ? 10 : 12\n<text fontSize={schrift}>',
    ]) {
      expect(kleineSchrift(text), text).toHaveLength(1)
    }
  })

  it('lässt 12 px und mehr, text-xs, Kommentare und fremde Konstanten stehen', () => {
    for (const text of [
      '<p className="text-xs text-[12px] text-[12.5px] sm:text-[13.5px]">',
      '<span className="text-[0.75rem] text-[1rem]">',
      '<text fontSize={12}>',
      'const schrift = schmal ? 12 : 14\n<text fontSize={schrift}>',
      '<text fontSize={groesse}>',
      '// früher text-[11px]\nconst x = 1',
      '/* fontSize={10} */ const y = 2',
      '<div className="w-[11px] h-[10px] tracking-[0.1em]">',
    ]) {
      expect(kleineSchrift(text), text).toEqual([])
    }
  })
})
