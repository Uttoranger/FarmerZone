/**
 * Wache (Nr. 174): Felder haben 16 px.
 *
 * Ursache: iOS Safari zoomt die Seite, sobald ein Feld unter 16 px den Fokus
 * bekommt – der Hof tippt dann in einer verschobenen, vergrößerten Seite
 * weiter. Im Hofbereich standen Felder mit `text-sm` (14 px) und
 * `text-[15px]`; die Bausteine unter src/components/ui haben `text-base`.
 *
 * Geprüft wird der Syntaxbaum jeder .tsx unter src/components und src/app:
 * ein `input`, `textarea`, `select` (und `Input`, `Textarea`, `DezimalFeld`)
 * mit einer Klasse `text-sm`, `text-xs` oder `text-[…px]` unter 16 px ohne
 * Breakpoint-Vorsatz. `md:text-sm` ist erlaubt: ab 768 px gibt es keinen Zoom.
 * Klassen, die in einer Konstante stehen (`const EINGABE = …`), sieht die
 * Wache nicht – die Konstanten haben `text-base` (EINGABE in familien-teile).
 *
 * AUSNAHMEN mit Grund und BESTAND (nur streichen, nie ergänzen).
 * Gegenprobe: Text-Attrappen schlagen an bzw. nicht an.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const FELDER = new Set(['input', 'textarea', 'select', 'Input', 'Textarea', 'DezimalFeld'])
const ZU_KLEIN = /(?<![\w:[-])text-(?:sm|xs|\[(?:[0-9]|1[0-5])(?:\.\d+)?px\])(?![\w-])/

/** Mit Grund erlaubt: „Datei:Zeile-frei" – eine Zeile je Feld. */
const AUSNAHMEN: Record<string, string> = {
  'src/components/shells/kunde-shell.tsx': 'Suchfeld der Kopfzeile, nur ab 768 px sichtbar (hidden md:block) – dort zoomt kein Browser',
}

/** Felder unter 16 px, die es vor Nr. 174 gab und die nicht zu den Dateien von 174 gehören. */
const BESTAND = ['src/components/startseite/startseite-kopf.tsx: input']

function* quelldateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* quelldateien(pfad)
    else if (/\.tsx$/.test(name)) yield pfad
  }
}

/** Die zu kleinen Felder einer Quelle – je Fund „Tag". */
function zuKleineFelder(quelltext: string): string[] {
  const datei = ts.createSourceFile('schnipsel.tsx', quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const funde: string[] = []
  function besuche(knoten: ts.Node): void {
    if (ts.isJsxSelfClosingElement(knoten) || ts.isJsxOpeningElement(knoten)) {
      const tag = knoten.tagName.getText()
      if (FELDER.has(tag)) {
        for (const a of knoten.attributes.properties) {
          if (ts.isJsxAttribute(a) && a.name.getText() === 'className' && a.initializer && ZU_KLEIN.test(a.initializer.getText())) funde.push(tag)
        }
      }
    }
    ts.forEachChild(knoten, besuche)
  }
  besuche(datei)
  return funde
}

describe('Gegenprobe', () => {
  it('ein Feld mit text-sm, text-xs oder text-[15px] schlägt an', () => {
    expect(zuKleineFelder('const a = <input className="h-11 text-sm" />')).toEqual(['input'])
    expect(zuKleineFelder('const a = <textarea className={cn(\'px-3 text-[15px]\', X)} />')).toEqual(['textarea'])
    expect(zuKleineFelder('const a = <select className="text-xs" />')).toEqual(['select'])
    expect(zuKleineFelder('const a = <Input className="text-[13.5px]" />')).toEqual(['Input'])
  })

  it('text-base, md:text-sm, ein Knopf mit text-sm und text-[16px] schlagen nicht an', () => {
    expect(zuKleineFelder('const a = <input className="text-base md:text-sm" />')).toEqual([])
    expect(zuKleineFelder('const a = <button className="text-sm" />')).toEqual([])
    expect(zuKleineFelder('const a = <input className="text-[16px]" />')).toEqual([])
    expect(zuKleineFelder('const a = <input className="text-foreground" />')).toEqual([])
  })
})

describe('Felder unter src/components und src/app', () => {
  it('kein neues Feld unter 16 px – und jeder Bestand und jede Ausnahme gibt es noch', { timeout: 30_000 }, () => {
    const funde: string[] = []
    const ausnahmenGesehen = new Set<string>()
    for (const wurzel of ['src/components', 'src/app']) {
      for (const pfad of quelldateien(join(process.cwd(), wurzel))) {
        const name = relative(process.cwd(), pfad).split(sep).join('/')
        const gefunden = zuKleineFelder(readFileSync(pfad, 'utf8'))
        if (gefunden.length === 0) continue
        if (name in AUSNAHMEN) {
          ausnahmenGesehen.add(name)
          continue
        }
        funde.push(...gefunden.map((tag) => `${name}: ${tag}`))
      }
    }
    expect(funde.sort()).toEqual([...BESTAND].sort())
    // Eine Ausnahme, die nichts mehr deckt, gehört gestrichen.
    expect([...ausnahmenGesehen].sort()).toEqual(Object.keys(AUSNAHMEN).sort())
  })
})
