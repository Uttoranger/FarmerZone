/**
 * Wache (Nr. 264): `letzterFreierTag` (src/lib/plattformgebuehr.ts) ist NUR Anzeige — der letzte Tag ohne Bargebühr
 * als Text für Sätze „bis <Tag>“ (Register N48). Ob eine Bargebühr anfällt, wann eingezogen, abgerechnet oder eine
 * Mail verschickt wird, entscheidet allein `einzugAbFuer`/`einzugFuer` mit dem Einzugsbeginn selbst; ein Satz-Tag
 * daneben verschöbe die Grenze um einen Tag. Darum steht die Hilfe
 *  - nie in src/app/api/**, src/server/actions/**, src/server/plattformgebuehr-abrechnung.ts, src/server/mail-arten/**
 *    (dort entstehen Bestellung, Snapshot, Abrechnung, Einzug und Versand),
 *  - erlaubt nur in src/lib/** (Anzeige-Sätze; Definition in src/lib/plattformgebuehr.ts), src/emails/** (nur für
 *    den Text eines Satzes, nie für einen Zeitpunkt des Versands) und src/server/queries/** (reine Lader für die
 *    Anzeige, etwa `letzterFreierTagText` in `ladeBarzahlung`).
 * Alles übrige unter src/ (Seiten, Komponenten, andere Server-Dateien) bekommt den Tag fertig als Text aus einem
 * Lader und ruft die Hilfe nicht selbst — so bleibt die Liste der Stellen kurz und prüfbar.
 *
 * Geprüft wird der Syntaxbaum jeder Datei unter src/: kein Bezeichner und keine Zeichenkette `letzterFreierTag` —
 * weder als benannter Import noch über einen Namensraum (`pg.letzterFreierTag`) noch aus einem dynamischen Import
 * entpackt. Ein Kommentar und längere Namen (`letzterFreierTagText`) zählen nicht.
 * Nicht erkannt: eine eigene Hülle in src/lib/**, die den Text weiterreicht — sie gibt ebenfalls nur Text zurück.
 *
 * Gegenprobe: benannter Import, Namensraum-Zugriff, dynamischer Import und Zugriff mit Klammern schlagen an; ein
 * Kommentar und `letzterFreierTagText` nicht. Jede der vier gesperrten Stellen gilt als gesperrt, die drei erlaubten
 * als erlaubt; die Definition wird gefunden.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const WURZEL = process.cwd()
const NAME = 'letzterFreierTag'

/** Wo die Anzeige-Hilfe stehen darf (Präfixe relativ zur Wurzel, mit `/`). */
const ERLAUBT = ['src/lib/', 'src/emails/', 'src/server/queries/'] as const
/** Die Stellen, die der Auftrag ausdrücklich sperrt — sie müssen unter Aufsicht stehen. */
const GESPERRT = ['src/app/api/', 'src/server/actions/', 'src/server/plattformgebuehr-abrechnung.ts', 'src/server/mail-arten/'] as const

function* quelldateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* quelldateien(pfad)
    else if (/\.(ts|tsx)$/.test(name)) yield pfad
  }
}

function erlaubt(name: string): boolean {
  return ERLAUBT.some((praefix) => name.startsWith(praefix))
}

/** Jede Stelle, an der `letzterFreierTag` als Bezeichner oder Zeichenkette steht: Zeilennummern. Leer = nicht benutzt. */
function findeAnzeigeHilfe(quelltext: string): number[] {
  // Schneller Vorfilter: Ohne den Namen im Text kann er auch im Syntaxbaum nicht stehen.
  if (!quelltext.includes(NAME)) return []
  const datei = ts.createSourceFile('schnipsel.tsx', quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const zeilen: number[] = []
  function besuche(knoten: ts.Node): void {
    const text = ts.isIdentifier(knoten) ? knoten.text : ts.isStringLiteralLike(knoten) ? knoten.text : null
    if (text === NAME) zeilen.push(datei.getLineAndCharacterOfPosition(knoten.getStart()).line + 1)
    ts.forEachChild(knoten, besuche)
  }
  besuche(datei)
  return zeilen
}

describe('letzterFreierTag bleibt Anzeige (Nr. 264)', () => {
  // Liest ganz src/ (Vorfilter auf den Namen, geparst werden nur Treffer) — unter Last reichen 5 s nicht sicher.
  it('kein Gebrauch außerhalb von src/lib, src/emails und src/server/queries', () => {
    const dateien = [...quelldateien(join(WURZEL, 'src'))].map((pfad) => relative(WURZEL, pfad).split(sep).join('/'))
    const verstoesse = dateien
      .filter((name) => !erlaubt(name))
      .flatMap((name) => findeAnzeigeHilfe(readFileSync(join(WURZEL, name), 'utf8')).map((zeile) => `${name}:${zeile}`))
    expect(verstoesse).toEqual([])
    // Die Suche hat wirklich gelesen: jede gesperrte Stelle ist dabei und steht nicht unter „erlaubt“.
    for (const gesperrt of GESPERRT) {
      expect(dateien.some((name) => name.startsWith(gesperrt)), gesperrt).toBe(true)
      expect(erlaubt(gesperrt), gesperrt).toBe(false)
    }
  }, 30_000)

  it('Gegenprobe: die Definition steht in src/lib/plattformgebuehr.ts und wird dort gefunden', () => {
    const pfad = join(WURZEL, 'src/lib/plattformgebuehr.ts')
    expect(existsSync(pfad)).toBe(true)
    expect(findeAnzeigeHilfe(readFileSync(pfad, 'utf8')).length).toBeGreaterThan(0)
  })

  it('Gegenprobe: die erlaubten Stellen gelten als erlaubt', () => {
    expect(erlaubt('src/lib/hof-einstellungen.ts')).toBe(true)
    expect(erlaubt('src/emails/plattformgebuehr-ankuendigung.tsx')).toBe(true)
    expect(erlaubt('src/server/queries/plattformgebuehr.ts')).toBe(true)
    // Andere Server-Dateien und Komponenten nicht.
    expect(erlaubt('src/server/warenkorb.ts')).toBe(false)
    expect(erlaubt('src/components/hof-einstellungen/barzahlung.tsx')).toBe(false)
  })

  it.each([
    ['benannter Import', `import { letzterFreierTag } from '@/lib/plattformgebuehr'`],
    ['Namensraum-Zugriff', `import * as pg from '@/lib/plattformgebuehr'\nconst x = pg.letzterFreierTag(ab)`],
    ['dynamischer Import', `const { letzterFreierTag: tag } = await import('@/lib/plattformgebuehr')`],
    ['Zugriff mit Klammern', `const x = pg['letzterFreierTag'](ab)`],
  ])('Gegenprobe: %s schlägt an', (_name, schnipsel) => {
    expect(findeAnzeigeHilfe(schnipsel).length).toBeGreaterThan(0)
  })

  it('Gegenprobe: Kommentar und der Feldname letzterFreierTagText schlagen nicht an', () => {
    expect(findeAnzeigeHilfe(`// letzterFreierTag nie hier\nconst t = daten.letzterFreierTagText`)).toEqual([])
  })
})
