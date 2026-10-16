/**
 * Gründungs-Konstanten-Wache (Register K2: Plätze und Ende der Gründungsphase sind Einstellungen).
 *
 * Ursache: `MAX_GRUENDUNGSHOEFE` (12 Plätze) und `GRUENDUNG_BIS_STANDARD` (31.12.2027) sind nur die
 * STANDARDWERTE der Zeile `PlattformEinstellung` (Admin › Einstellungen › Gründungshöfe). Wer sie
 * direkt liest, zeigt oder rechnet mit einer Zahl, die der Admin längst geändert haben kann — Seite
 * und Sperre sagen dann Verschiedenes. Die Aufrufer sollen die gespeicherten Werte nehmen.
 *
 * Beweist (Quelltext von `src/`, TypeScript-Syntaxbaum, kein Netz): Die Namen `MAX_GRUENDUNGSHOEFE`,
 * `GRUENDUNG_BIS_STANDARD`, `GRUENDUNG_BIS_STANDARD_TAG` und `GRUENDUNG_BIS_STANDARD_TEXT` kommen als
 * Bezeichner nur in `src/lib/gruendungshof.ts` (Heimat) und `src/lib/plattform-einstellung.ts` (Standard
 * der Einstellung) vor — und sonst nur in AUSNAHMEN, je Datei und Name mit Grund. Kommentare zählen nicht.
 * Eine Ausnahme, die keinen Fund mehr deckt, fällt als veraltet auf (dann raus aus der Liste); die
 * Liste darf nur schrumpfen. Muster: `tests/leerzustaende-wache.test.ts`.
 *
 * Gegenprobe: Text-Attrappen — der Name als Wert, als Import und in einer Rechnung schlägt an, in einem
 * Kommentar, in einer Zeichenkette und als Teil eines längeren Namens nicht.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const WURZEL = process.cwd()

const KONSTANTEN = new Set(['MAX_GRUENDUNGSHOEFE', 'GRUENDUNG_BIS_STANDARD', 'GRUENDUNG_BIS_STANDARD_TAG', 'GRUENDUNG_BIS_STANDARD_TEXT'])
const HEIMAT = ['src/lib/gruendungshof.ts', 'src/lib/plattform-einstellung.ts']

type Ausnahme = { datei: string; namen: string[]; grund: string }

const AUSNAHMEN: Ausnahme[] = [
  {
    datei: 'src/components/admin/gruendung-bis-dialog.tsx',
    namen: ['GRUENDUNG_BIS_STANDARD_TAG'],
    grund: 'Ein leeres Feld heißt Standard: Der Dialog vergleicht mit der Konstante statt mit der gespeicherten Einstellung (Nacharbeit: alle Aufrufer gemeinsam umstellen)',
  },
  {
    datei: 'src/components/admin/hof-aktion-dialog.tsx',
    namen: ['GRUENDUNG_BIS_STANDARD', 'MAX_GRUENDUNGSHOEFE'],
    grund: 'Der Freischalte-Dialog nennt Plätze und Ende aus der Konstante statt aus der gespeicherten Einstellung (Nacharbeit: alle Aufrufer gemeinsam umstellen)',
  },
  {
    datei: 'src/server/queries/postfach.ts',
    namen: ['MAX_GRUENDUNGSHOEFE'],
    grund: 'Der Platz der wartenden Höfe wird mit der Konstante gerechnet, wie Admin › Höfe es noch tut (Nacharbeit: beide gemeinsam auf die Einstellung umstellen)',
  },
  {
    datei: 'src/app/admin/postfach/eingang-reiter.tsx',
    namen: ['MAX_GRUENDUNGSHOEFE'],
    grund: 'Zeile und Sperre der Hof-Aufgabe rechnen mit der Konstante, wie Admin › Höfe es noch tut (Nacharbeit: beide gemeinsam auf die Einstellung umstellen)',
  },
]

function* quelldateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* quelldateien(pfad)
    else if (/\.(ts|tsx)$/.test(name)) yield pfad
  }
}

/** Die Namen der Gründungs-Konstanten, die ein Quelltext als Bezeichner schreibt (nicht in Kommentaren oder Zeichenketten). */
function konstantenIn(quelltext: string, pfad = 'schnipsel.ts'): string[] {
  const datei = ts.createSourceFile(pfad, quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const gefunden = new Set<string>()
  const besuche = (knoten: ts.Node): void => {
    if (ts.isIdentifier(knoten) && KONSTANTEN.has(knoten.text)) gefunden.add(knoten.text)
    ts.forEachChild(knoten, besuche)
  }
  besuche(datei)
  return [...gefunden].sort()
}

const funde = new Map<string, string[]>()
for (const pfad of quelldateien(join(WURZEL, 'src'))) {
  const name = relative(WURZEL, pfad).split(sep).join('/')
  const namen = konstantenIn(readFileSync(pfad, 'utf8'), name)
  if (namen.length > 0) funde.set(name, namen)
}

describe('Gründungs-Konstanten-Wache — die Standardwerte bleiben Standardwerte', () => {
  it('nur die Heimat und die Ausnahmen lesen MAX_GRUENDUNGSHOEFE und GRUENDUNG_BIS_STANDARD*', () => {
    const verstoesse = [...funde]
      .filter(([datei]) => !HEIMAT.includes(datei))
      .flatMap(([datei, namen]) =>
        namen.filter((n) => !AUSNAHMEN.some((a) => a.datei === datei && a.namen.includes(n))).map((n) => `${datei}: ${n}`)
      )
    expect(verstoesse, 'Die gespeicherte Einstellung nehmen (Plätze und Ende der Gründungsphase), nicht den Standardwert').toEqual([])
  })

  it('die Heimat enthält die Konstanten tatsächlich — sonst bewiese die Wache nichts', () => {
    expect(funde.get('src/lib/gruendungshof.ts')).toEqual([...KONSTANTEN].sort())
    expect(funde.get('src/lib/plattform-einstellung.ts')).toEqual(expect.arrayContaining(['MAX_GRUENDUNGSHOEFE', 'GRUENDUNG_BIS_STANDARD_TAG']))
  })

  it('hat keine veraltete Ausnahme: Jeder Name deckt einen Fund in seiner Datei', () => {
    const veraltet = AUSNAHMEN.flatMap((a) => a.namen.filter((n) => !(funde.get(a.datei) ?? []).includes(n)).map((n) => `${a.datei}: ${n}`))
    expect(veraltet).toEqual([])
  })

  it('nennt zu jeder Ausnahme einen Grund in ganzen Worten und keine Datei der Heimat', () => {
    for (const a of AUSNAHMEN) {
      expect(a.grund.split(' ').length, a.datei).toBeGreaterThanOrEqual(8)
      expect(HEIMAT, a.datei).not.toContain(a.datei)
    }
  })
})

describe('Gründungs-Konstanten-Wache — Gegenprobe: die Suche schlägt an', () => {
  it('findet die Namen als Wert, als Import und in einer Rechnung', () => {
    expect(konstantenIn("import { MAX_GRUENDUNGSHOEFE } from '@/lib/gruendungshof'\nexport const a = 1")).toEqual(['MAX_GRUENDUNGSHOEFE'])
    expect(konstantenIn('export const frei = vergeben < MAX_GRUENDUNGSHOEFE')).toEqual(['MAX_GRUENDUNGSHOEFE'])
    expect(konstantenIn('export const bis = hof.gruendungBis ?? GRUENDUNG_BIS_STANDARD')).toEqual(['GRUENDUNG_BIS_STANDARD'])
    expect(konstantenIn('const t = `Bis ${GRUENDUNG_BIS_STANDARD_TEXT}` + GRUENDUNG_BIS_STANDARD_TAG')).toEqual(['GRUENDUNG_BIS_STANDARD_TAG', 'GRUENDUNG_BIS_STANDARD_TEXT'])
  })

  it('lässt Kommentare, Zeichenketten und längere Namen stehen', () => {
    for (const text of [
      '// MAX_GRUENDUNGSHOEFE ist nur der Standard\nexport const a = 1',
      '/* GRUENDUNG_BIS_STANDARD */ export const b = 2',
      "export const c = 'MAX_GRUENDUNGSHOEFE'",
      'export const d = MAX_GRUENDUNGSHOEFE_NEU + MEHR_GRUENDUNG_BIS_STANDARD',
    ]) {
      expect(konstantenIn(text), text).toEqual([])
    }
  })
})
