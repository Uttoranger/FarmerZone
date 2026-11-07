/**
 * Wache (Nr. 244): `anzeigeGesamtCents` (src/lib/servicegebuehr.ts) ist NUR Anzeige — das „Gesamt“ ohne entfallene
 * Gebühr für Bestätigung und Bestellseite. Gezahlt, kassiert, erstattet und abgerechnet wird weiter aus dem Snapshot
 * (`bestellSummen`, `barZuKassierenCents`). Darum steht die Funktion nie in `src/server/**`, `src/app/api/**` oder
 * `src/lib/plattformgebuehr*.ts`: dort entstehen Buchung, Erstattung, Stripe-Betrag und Abrechnung.
 *
 * Geprüft wird der Syntaxbaum jeder Datei dort: kein Bezeichner und keine Zeichenkette `anzeigeGesamtCents` —
 * weder als benannter Import noch als Zugriff über einen Namensraum-Import (`sg.anzeigeGesamtCents`) noch aus
 * einem dynamischen Import entpackt. Ein Kommentar zählt nicht.
 * Nicht erkannt: eine eigene Hilfe in einem anderen Ordner, die die Funktion umwickelt und dann von dort gerufen wird —
 * die bekannte Hülle `zahlzeileFuer` (src/lib/zahlzeile.ts, Nr. 253) steht darum mit unter Aufsicht.
 *
 * Gegenprobe: benannter Import, Namensraum-Zugriff, dynamischer Import und Zugriff mit Klammern schlagen an; ein
 * Kommentar und ein längerer Name nicht.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const WURZEL = process.cwd()
const ORDNER = ['src/server', 'src/app/api']
const NAME = 'anzeigeGesamtCents'
/** Hüllen um `anzeigeGesamtCents`, die dieselbe Grenze haben (nur Anzeige). */
const NAMEN: ReadonlySet<string> = new Set([NAME, 'zahlzeileFuer'])

function* quelldateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* quelldateien(pfad)
    else if (/\.(ts|tsx)$/.test(name)) yield pfad
  }
}

/** Die Dateien unter Aufsicht: beide Ordner rekursiv und jede src/lib/plattformgebuehr*.ts. */
function beobachteteDateien(): string[] {
  const lib = join(WURZEL, 'src/lib')
  const plattform = readdirSync(lib)
    .filter((name) => /^plattformgebuehr.*\.ts$/.test(name))
    .map((name) => join(lib, name))
  return [...ORDNER.flatMap((ordner) => [...quelldateien(join(WURZEL, ordner))]), ...plattform]
}

/** Jede Stelle, an der `anzeigeGesamtCents` als Bezeichner oder Zeichenkette steht: Zeilennummern. Leer = in Ordnung. */
function findeAnzeigeGesamt(quelltext: string): number[] {
  // Schneller Vorfilter: Ohne den Namen im Text kann er auch im Syntaxbaum nicht stehen.
  if (![...NAMEN].some((n) => quelltext.includes(n))) return []
  const datei = ts.createSourceFile('schnipsel.tsx', quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const zeilen: number[] = []
  function besuche(knoten: ts.Node): void {
    const text = ts.isIdentifier(knoten) ? knoten.text : ts.isStringLiteralLike(knoten) ? knoten.text : null
    if (text !== null && NAMEN.has(text)) zeilen.push(datei.getLineAndCharacterOfPosition(knoten.getStart()).line + 1)
    ts.forEachChild(knoten, besuche)
  }
  besuche(datei)
  return zeilen
}

describe('anzeigeGesamtCents bleibt Anzeige (Nr. 244)', () => {
  it('kein Gebrauch in src/server, src/app/api und src/lib/plattformgebuehr*.ts', () => {
    const dateien = beobachteteDateien()
    const verstoesse = dateien.flatMap((pfad) => {
      const name = relative(WURZEL, pfad).split(sep).join('/')
      return findeAnzeigeGesamt(readFileSync(pfad, 'utf8')).map((zeile) => `${name}:${zeile}`)
    })
    expect(verstoesse).toEqual([])
    // Die Suche hat wirklich gelesen: beide Ordner und die Gebühr-Datei sind dabei.
    expect(dateien.some((p) => p.includes(`${sep}src${sep}server${sep}`))).toBe(true)
    expect(dateien.some((p) => p.includes(`${sep}src${sep}app${sep}api${sep}`))).toBe(true)
    expect(dateien.some((p) => p.endsWith(`plattformgebuehr.ts`))).toBe(true)
  })

  it('Gegenprobe: die Funktion steht in servicegebuehr.ts und wird dort gefunden', () => {
    const pfad = join(WURZEL, 'src/lib/servicegebuehr.ts')
    expect(existsSync(pfad)).toBe(true)
    expect(findeAnzeigeGesamt(readFileSync(pfad, 'utf8')).length).toBeGreaterThan(0)
  })

  it.each([
    ['benannter Import', `import { anzeigeGesamtCents } from '@/lib/servicegebuehr'`],
    ['Namensraum-Zugriff', `import * as sg from '@/lib/servicegebuehr'\nconst x = sg.anzeigeGesamtCents(b)`],
    ['dynamischer Import', `const { anzeigeGesamtCents: g } = await import('@/lib/servicegebuehr')`],
    ['Zugriff mit Klammern', `const x = sg['anzeigeGesamtCents'](b)`],
    ['Hülle zahlzeileFuer', `import { zahlzeileFuer } from '@/lib/zahlzeile'`],
  ])('Gegenprobe: %s schlägt an', (_name, schnipsel) => {
    expect(findeAnzeigeGesamt(schnipsel).length).toBeGreaterThan(0)
  })

  it('Gegenprobe: Kommentar und längerer Name schlagen nicht an', () => {
    expect(findeAnzeigeGesamt(`// anzeigeGesamtCents nie hier\nconst anzeigeGesamtCentsAlt = 1`)).toEqual([])
  })
})
