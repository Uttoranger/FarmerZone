/**
 * Wache: Was `next.config.ts` erreicht, importiert nur relativ (Regelvorschlag 125, Morgenbericht 19 §5,
 * freigegeben 21.10.2026; Register G4, Ergänzung).
 *
 * Ursache: Next lädt `next.config.ts` beim Build, bevor die App und ihr Alias `@/` → `src/` bekannt sind. Ein
 * `@/`-Import in `src/lib/csp.ts` oder in einer Datei, die sie ihrerseits einbindet, löst dort nicht auf; der Build
 * bricht erst auf Vercel, und die Vorschau zeigt den Fehler, nicht der Test der Datei selbst (Nr. 125, Kommentar
 * bei `KARTEN_HOST` in `src/lib/csp.ts`).
 *
 * Beweist (Quelltext, TypeScript-Syntaxbaum, kein Netz): Ausgehend von `next.config.ts` folgt die Suche jedem
 * relativen Import (`./…`, `../…`; aufgelöst als Datei, mit `.ts`, mit `.tsx`, als `/index.ts`, als `/index.tsx`)
 * rekursiv und findet in keiner dieser Dateien einen Import mit `@/`. Gezählt wird jede Schreibweise, die beim Laden
 * auflöst: `import … from`, `import '…'`, `export … from`, `import x = require('…')`, `require('…')` und `import('…')`.
 * Auch `import type` zählt, obwohl der Build es verwirft: Die Regel soll ohne Ausnahme gelten, und ein Typ-Import
 * würde beim nächsten Umbau zum Wert-Import. Pakete (`zod`, `@sentry/nextjs`) sind keine Treffer und werden nicht
 * verfolgt. Ein relativer Import, der sich nicht auflösen lässt, ist ebenfalls ein Fund (die Kette wäre sonst
 * stumm abgeschnitten).
 *
 * Gegenprobe: In einem temporären Verzeichnis (kein Fixture im Repo) schlägt die Suche an einem `@/`-Import an,
 * der erst im dritten Glied der Kette steht — über `.ts`, `/index.ts` und `.tsx`, über `export … from`,
 * `require`, `import()` und `import type`; sie schlägt nicht an bei Paketen, Kommentaren, Zeichenketten und
 * einem Kreis (a → b → a); ein nicht auflösbarer Import wird gemeldet. Dazu muss die Kette im echten Repo
 * `src/lib/csp.ts` erreichen, sonst bewiese ein leerer Fund nichts.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import ts from 'typescript'
import { afterAll, describe, expect, it } from 'vitest'

/** Endungen, die gelesen und weiterverfolgt werden; alles andere (Bilder, JSON) ist ein Blatt. */
const CODE_ENDUNGEN = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']

/** Reihenfolge der Auflösung eines relativen Imports ohne Endung. */
const AUFLOESUNG = ['', '.ts', '.tsx', '/index.ts', '/index.tsx']

interface Fund {
  /** Datei, in der der Import steht (relativ zur Wurzel, mit „/“). */
  datei: string
  zeile: number
  spezifizierer: string
  grund: 'alias' | 'nicht-aufloesbar'
}

interface Suche {
  funde: Fund[]
  /** Alle erreichten Dateien (relativ zur Wurzel, mit „/“), die Konfiguration selbst eingeschlossen. */
  erreicht: string[]
}

/** Alle Modul-Bezeichner einer Datei samt Zeile — ohne Kommentare und Zeichenketten, die nur so aussehen. */
function leseImporte(text: string, name: string): Array<{ spezifizierer: string; zeile: number }> {
  const datei = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, name.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const importe: Array<{ spezifizierer: string; zeile: number }> = []
  const merke = (ausdruck: ts.Expression | undefined): void => {
    if (ausdruck && ts.isStringLiteralLike(ausdruck)) {
      importe.push({ spezifizierer: ausdruck.text, zeile: datei.getLineAndCharacterOfPosition(ausdruck.getStart()).line + 1 })
    }
  }
  const besuche = (knoten: ts.Node): void => {
    if (ts.isImportDeclaration(knoten) || ts.isExportDeclaration(knoten)) merke(knoten.moduleSpecifier)
    else if (ts.isImportEqualsDeclaration(knoten) && ts.isExternalModuleReference(knoten.moduleReference)) {
      merke(knoten.moduleReference.expression)
    } else if (ts.isCallExpression(knoten) && knoten.arguments.length > 0) {
      const ziel = knoten.expression
      const istRequire = ts.isIdentifier(ziel) && ziel.text === 'require'
      if (istRequire || ziel.kind === ts.SyntaxKind.ImportKeyword) merke(knoten.arguments[0])
    }
    ts.forEachChild(knoten, besuche)
  }
  besuche(datei)
  return importe
}

function istDatei(pfad: string): boolean {
  try {
    return statSync(pfad).isFile()
  } catch {
    return false
  }
}

/** Die Datei, auf die ein relativer Import zeigt, in der Reihenfolge von `AUFLOESUNG`; sonst null. */
function loeseAuf(von: string, spezifizierer: string): string | null {
  const basis = join(dirname(von), spezifizierer)
  for (const zusatz of AUFLOESUNG) {
    if (istDatei(basis + zusatz)) return basis + zusatz
  }
  return null
}

/** Folgt den relativen Importen ab `start` und sammelt jeden `@/`-Import und jeden nicht auflösbaren Import. */
function sucheAliasImporte(wurzel: string, start: string): Suche {
  const anzeige = (pfad: string): string => relative(wurzel, pfad).split(sep).join('/')
  const besucht = new Set<string>()
  const funde: Fund[] = []
  const offen = [join(wurzel, start)]
  while (offen.length > 0) {
    const pfad = offen.pop() as string
    if (besucht.has(pfad)) continue
    besucht.add(pfad)
    if (!CODE_ENDUNGEN.some((endung) => pfad.endsWith(endung))) continue
    for (const { spezifizierer, zeile } of leseImporte(readFileSync(pfad, 'utf8'), pfad)) {
      if (spezifizierer.startsWith('@/')) {
        funde.push({ datei: anzeige(pfad), zeile, spezifizierer, grund: 'alias' })
      } else if (spezifizierer.startsWith('./') || spezifizierer.startsWith('../')) {
        const ziel = loeseAuf(pfad, spezifizierer)
        if (ziel === null) funde.push({ datei: anzeige(pfad), zeile, spezifizierer, grund: 'nicht-aufloesbar' })
        else offen.push(ziel)
      }
    }
  }
  return { funde, erreicht: [...besucht].map(anzeige).sort() }
}

function beschreibe(fund: Fund): string {
  const was = fund.grund === 'alias' ? 'importiert über „@/“' : 'importiert etwas, das sich nicht auflösen lässt'
  return `${fund.datei}:${fund.zeile} ${was}: ${fund.spezifizierer}`
}

describe('next.config.ts — was beim Build erreichbar ist, importiert nur relativ', () => {
  it('keine Datei in der Kette ab next.config.ts importiert über „@/“', () => {
    const suche = sucheAliasImporte(process.cwd(), 'next.config.ts')

    // Nicht blind: Die Kette erreicht die Datei mit der Content-Security-Policy.
    expect(suche.erreicht).toContain('next.config.ts')
    expect(suche.erreicht).toContain('src/lib/csp.ts')

    expect(suche.funde.map(beschreibe)).toEqual([])
  })
})

describe('next.config.ts — Gegenprobe: die Suche schlägt an', () => {
  const wurzeln: string[] = []
  afterAll(() => {
    for (const wurzel of wurzeln) rmSync(wurzel, { recursive: true, force: true })
  })

  /** Legt Dateien in ein frisches temporäres Verzeichnis (Pfad → Inhalt) und gibt es zurück. */
  function baue(dateien: Record<string, string>): string {
    const wurzel = mkdtempSync(join(tmpdir(), 'next-config-wache-'))
    wurzeln.push(wurzel)
    for (const [pfad, inhalt] of Object.entries(dateien)) {
      mkdirSync(dirname(join(wurzel, pfad)), { recursive: true })
      writeFileSync(join(wurzel, pfad), inhalt)
    }
    return wurzel
  }

  const KONFIGURATION = "import { a } from './src/lib/a'\nexport default { a }\n"

  it('findet einen „@/“-Import im dritten Glied der Kette (über .ts und /index.ts)', () => {
    const wurzel = baue({
      'next.config.ts': KONFIGURATION,
      'src/lib/a.ts': "import { b } from './b'\nexport const a = b\n",
      'src/lib/b/index.ts': "import { c } from '@/lib/c'\nexport const b = c\n",
      'src/lib/c.ts': 'export const c = 1\n',
    })

    const suche = sucheAliasImporte(wurzel, 'next.config.ts')

    expect(suche.funde.map(beschreibe)).toEqual(['src/lib/b/index.ts:1 importiert über „@/“: @/lib/c'])
    expect(suche.erreicht).toEqual(['next.config.ts', 'src/lib/a.ts', 'src/lib/b/index.ts'])
  })

  it('findet ihn in jeder Schreibweise: export … from, require, import(), import type, import ohne Namen — und in einer .tsx', () => {
    const wurzel = baue({
      'next.config.ts': KONFIGURATION,
      'src/lib/a.ts': [
        "export * from './d'",
        "import './e'",
        "import f = require('./f')",
        "const g = require('./g')",
        "const h = () => import('./h')",
        'export { f, g, h }',
        '',
      ].join('\n'),
      'src/lib/d.tsx': "export * from '@/lib/x1'\n",
      'src/lib/e.ts': "import type { T } from '@/lib/x2'\nexport type U = T\n",
      'src/lib/f.ts': "export { y } from '@/lib/x3'\n",
      'src/lib/g.ts': "module.exports = require('@/lib/x4')\n",
      'src/lib/h.ts': "export const h = import('@/lib/x5')\n",
    })

    const spezifizierer = sucheAliasImporte(wurzel, 'next.config.ts').funde.map((fund) => fund.spezifizierer)

    expect(spezifizierer.sort()).toEqual(['@/lib/x1', '@/lib/x2', '@/lib/x3', '@/lib/x4', '@/lib/x5'])
  })

  it('meldet einen relativen Import, der sich nicht auflösen lässt, statt die Kette still abzuschneiden', () => {
    const wurzel = baue({
      'next.config.ts': KONFIGURATION,
      'src/lib/a.ts': "import { fehlt } from './gibt-es-nicht'\nexport const a = fehlt\n",
    })

    const funde = sucheAliasImporte(wurzel, 'next.config.ts').funde

    expect(funde).toEqual([{ datei: 'src/lib/a.ts', zeile: 1, spezifizierer: './gibt-es-nicht', grund: 'nicht-aufloesbar' }])
  })

  it('schlägt nicht an bei Paketen, Kommentaren, Zeichenketten, Dateien außerhalb der Kette und einem Kreis', () => {
    const wurzel = baue({
      'next.config.ts': KONFIGURATION,
      'src/lib/a.ts': [
        "import { z } from 'zod'",
        "import { withSentryConfig } from '@sentry/nextjs'",
        "import { b } from './b'",
        "// import { nein } from '@/lib/kommentar'",
        "const text = \"import x from '@/lib/zeichenkette'\"",
        'export const a = [z, withSentryConfig, b, text]',
        '',
      ].join('\n'),
      'src/lib/b.ts': "import { a } from './a'\nexport const b = a\n",
      // Nicht von next.config.ts aus erreichbar: darf @/ benutzen, so wie fast alles in src/.
      'src/lib/andere.ts': "import { x } from '@/lib/x'\nexport const andere = x\n",
    })

    const suche = sucheAliasImporte(wurzel, 'next.config.ts')

    expect(suche.funde).toEqual([])
    expect(suche.erreicht).toEqual(['next.config.ts', 'src/lib/a.ts', 'src/lib/b.ts'])
    expect(existsSync(join(wurzel, 'src/lib/andere.ts'))).toBe(true)
  })
})
