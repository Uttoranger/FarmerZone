/**
 * Wache: Teilen ohne Browser-Speicher (Register T1, Nr. 25).
 *
 * Ursache: Bis Nr. 25 merkte sich die Hofseite das Kürzel `?k=` im
 * sessionStorage, damit der Checkout `Order.teilenKanal` setzen konnte. Auch
 * das ist ein Speichern auf dem Gerät der Kundin (§ 165 Abs. 3 TKG) — T1
 * nimmt es heraus: gezählt werden nur Besuche über die aktuelle Adresse,
 * Bestellungen bekommen keinen Kanal.
 *
 * Beweist:
 *  - Kein Teilen-Code (jede Datei unter src/, deren Pfad „teilen" enthält)
 *    greift auf sessionStorage, localStorage, indexedDB, document.cookie,
 *    cookieStore, `cookies()` aus next/headers oder einen Set-Cookie-Kopf zu.
 *    Kommentare zählen nicht (Syntaxbaum statt Textsuche).
 *  - Der Checkout (Formular, Schema, Route) kennt kein `teilenKanal` mehr und
 *    bindet keinen Teilen-Zähler ein.
 *  - Gegenprobe: Die Suche schlägt bei jedem Zugriff an — an Schnipseln und
 *    an echtem Code (der Warenkorb im Checkout liegt erlaubt im localStorage).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'

const WURZEL = process.cwd()

function* quelldateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* quelldateien(pfad)
    else if (/\.(ts|tsx)$/.test(name)) yield pfad
  }
}

function baum(quelltext: string, pfad: string): ts.SourceFile {
  const art = pfad.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  return ts.createSourceFile(pfad, quelltext, ts.ScriptTarget.Latest, true, art)
}

function besucheAlle(datei: ts.SourceFile, besuch: (knoten: ts.Node) => void): void {
  const geh = (knoten: ts.Node): void => {
    besuch(knoten)
    ts.forEachChild(knoten, geh)
  }
  geh(datei)
}

const SPEICHER_NAMEN = new Set(['sessionStorage', 'localStorage', 'indexedDB', 'cookieStore'])

/** Jeder Zugriff auf Browser-Speicher oder Cookies — Kommentare zählen nicht. */
function findeBrowserSpeicher(quelltext: string, pfad = 'schnipsel.tsx'): string[] {
  const funde: string[] = []
  besucheAlle(baum(quelltext, pfad), (knoten) => {
    if (ts.isIdentifier(knoten) && SPEICHER_NAMEN.has(knoten.text)) funde.push(knoten.text)
    if (ts.isPropertyAccessExpression(knoten) && knoten.name.text === 'cookie') funde.push('document.cookie')
    if (ts.isStringLiteralLike(knoten) && /set-cookie/i.test(knoten.text)) funde.push('Set-Cookie')
    if (
      ts.isImportDeclaration(knoten) &&
      ts.isStringLiteral(knoten.moduleSpecifier) &&
      knoten.moduleSpecifier.text === 'next/headers' &&
      /\bcookies\b/.test(knoten.importClause?.getText() ?? '')
    ) {
      funde.push('cookies()')
    }
  })
  return funde
}

/** Bezüge auf die alte Bestell-Zuordnung: das Feld `teilenKanal` und die Teilen-Module. */
function findeBestellZuordnung(quelltext: string, pfad = 'schnipsel.tsx'): string[] {
  const funde: string[] = []
  besucheAlle(baum(quelltext, pfad), (knoten) => {
    if (ts.isIdentifier(knoten) && knoten.text === 'teilenKanal') funde.push('teilenKanal')
    if (ts.isImportDeclaration(knoten) && ts.isStringLiteral(knoten.moduleSpecifier)) {
      const modul = knoten.moduleSpecifier.text
      if (/^@\/(lib|server|schemas)\/teilen/.test(modul)) funde.push(modul)
    }
  })
  return funde
}

const TEILEN_DATEIEN = [...quelldateien(join(WURZEL, 'src'))]
  .map((pfad) => relative(WURZEL, pfad))
  .filter((pfad) => /teilen/i.test(pfad))

const CHECKOUT_DATEIEN = [
  'src/components/checkout/checkout-form.tsx',
  'src/schemas/checkout.ts',
  'src/app/api/checkout/route.ts',
]

function lies(pfad: string): string {
  return readFileSync(join(WURZEL, pfad), 'utf8')
}

describe('Teilen ohne Browser-Speicher (T1)', () => {
  it('die Suche umfasst den Teilen-Code (Gegenprobe gegen eine leere Liste)', () => {
    expect(TEILEN_DATEIEN).toEqual(
      expect.arrayContaining([
        'src/components/hofseite/teilen-besuch.tsx',
        'src/lib/teilen-besuch.ts',
        'src/lib/teilen-kanal.ts',
        'src/components/teilen/teilen-fenster.tsx',
        'src/app/api/teilen/besuch/route.ts',
        'src/server/teilen-zaehlung.ts',
        'src/schemas/teilen.ts',
      ])
    )
  })

  it.each(TEILEN_DATEIEN)('%s nutzt keinen Browser-Speicher und kein Cookie', (pfad) => {
    expect(findeBrowserSpeicher(lies(pfad), pfad)).toEqual([])
  })

  it('die alte Herkunft im sessionStorage ist gelöscht', () => {
    expect(TEILEN_DATEIEN).not.toContain('src/lib/teilen-herkunft.ts')
    expect(TEILEN_DATEIEN).not.toContain('src/components/hofseite/teilen-herkunft.tsx')
  })

  it.each(CHECKOUT_DATEIEN)('%s kennt kein teilenKanal und keinen Teilen-Zähler', (pfad) => {
    expect(findeBestellZuordnung(lies(pfad), pfad)).toEqual([])
  })
})

describe('Gegenprobe: die Suchen schlagen an', () => {
  it.each([
    ['sessionStorage', "window.sessionStorage.setItem('k', 'wa')"],
    ['localStorage', "localStorage.getItem('k')"],
    ['indexedDB', "indexedDB.open('teilen')"],
    ['cookieStore', "cookieStore.set('k', 'wa')"],
    ['document.cookie', "document.cookie = 'k=wa'"],
    ['Set-Cookie', "new Response(null, { headers: { 'Set-Cookie': 'k=wa' } })"],
    ['cookies()', "import { cookies } from 'next/headers'"],
  ])('%s wird gefunden', (erwartet, schnipsel) => {
    expect(findeBrowserSpeicher(schnipsel)).toContain(erwartet)
  })

  it('ein Kommentar ist kein Zugriff', () => {
    expect(findeBrowserSpeicher('// früher lag das Kürzel im sessionStorage\nexport const x = 1')).toEqual([])
  })

  it('an echtem Code: der Warenkorb des Checkouts liegt im localStorage', () => {
    const pfad = 'src/components/checkout/checkout-form.tsx'
    expect(findeBrowserSpeicher(lies(pfad), pfad)).toContain('localStorage')
  })

  it('die alte Bestell-Zuordnung würde gefunden', () => {
    expect(findeBestellZuordnung("import { leseTeilenHerkunft } from '@/lib/teilen-herkunft'")).toEqual(['@/lib/teilen-herkunft'])
    expect(findeBestellZuordnung('const body = { teilenKanal: kanal }')).toEqual(['teilenKanal'])
    expect(findeBestellZuordnung("import { zaehleBestellungNachDerAntwort } from '@/server/teilen-zaehlung'")).toEqual([
      '@/server/teilen-zaehlung',
    ])
  })
})
