/**
 * Wache (Register N29, Nr. 175): Ein Client-Bauteil des Hofbereichs ruft eine
 * Server-Action nur über `speichernOhneWurf`/`aktionOhneWurf`
 * (src/components/mein-hof/abschnitt-speichern.ts) oder in einem `try` auf.
 *
 * Warum: Eine Server-Action ist im Browser ein fetch. Ohne Netz wirft sie, und
 * ein Wurf ohne catch landet auf der Fehlerseite — die Eingabe ist weg, und die
 * Seite sagt „Das liegt an uns". Über den Helfer kommt stattdessen der Netzsatz
 * an das Formular bzw. an die Aktion, die Eingabe bleibt stehen.
 *
 * Geprüft wird der Syntaxbaum jeder Datei unter src/components/(settings|
 * produkte|products|mein-hof|hof-bestellungen): Aufrufe der Namen, die die
 * Datei aus `@/server/actions/…` importiert (ohne `import type`). Geschützt ist
 * ein Aufruf im Block eines `try` oder in den Argumenten von
 * `speichernOhneWurf(…)`/`aktionOhneWurf(…)`. Eine Aktion, die nur als Wert
 * weitergegeben wird, ist kein Aufruf — sie zählt dort, wo sie aufgerufen wird.
 *
 * Bestand (BESTAND): Stellen, die es vor Nr. 175 gab — die Liste schrumpft nur.
 * Nr. 174 hat die Abholzeiten (pickup-slots-client.tsx) und das Profil (profile-form.tsx) umgestellt und aus dem Bestand gestrichen.
 *
 * Gegenprobe: Text-Attrappen — ein nackter Aufruf, einer in `startTransition`
 * und einer im `catch` schlagen an; im `try`, im Helfer, als Wert und mit
 * `import type` nicht.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const WURZEL = process.cwd()
const ORDNER = ['settings', 'produkte', 'products', 'mein-hof', 'hof-bestellungen'].map((o) => `src/components/${o}`)
const HELFER = new Set(['speichernOhneWurf', 'aktionOhneWurf'])

/** Der Helfer selbst: Seine Aufrufe schützt, wer ihn benutzt (speichereAuftritt/speichereProfil laufen in speichernOhneWurf). */
const AUSGENOMMEN = new Set(['src/components/mein-hof/abschnitt-speichern.ts'])

/** Ungeschützte Aufrufe vor Nr. 175 — „Datei: Aktion" je Aufruf. Nur streichen, nie ergänzen. */
const BESTAND = [
  'src/components/mein-hof/bild-bausteine.tsx: addFarmPhotoAction',
  'src/components/mein-hof/bild-bausteine.tsx: deleteFarmPhotoAction',
  'src/components/mein-hof/bild-bausteine.tsx: moveFarmPhotoAction',
  'src/components/mein-hof/bild-bausteine.tsx: speichereBildAusschnittAction',
  'src/components/mein-hof/bild-bausteine.tsx: speichereBildAusschnittAction',
  'src/components/mein-hof/bild-bausteine.tsx: speichereBildAusschnittAction',
  'src/components/mein-hof/bild-bausteine.tsx: updateFarmBannerAction',
  'src/components/mein-hof/bild-bausteine.tsx: updateFarmLogoAction',
  'src/components/mein-hof/bild-bausteine.tsx: updateFarmLogoAction',
  'src/components/mein-hof/bild-bausteine.tsx: updateFarmPhotoCaptionAction',
]

function* quelldateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* quelldateien(pfad)
    else if (/\.(ts|tsx)$/.test(name)) yield pfad
  }
}

/** Die Namen der ungeschützt aufgerufenen Server-Actions, je Aufruf einmal. */
function ungeschuetzteAktionsAufrufe(quelltext: string): string[] {
  const datei = ts.createSourceFile('schnipsel.tsx', quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const aktionen = new Set<string>()
  for (const anweisung of datei.statements) {
    if (!ts.isImportDeclaration(anweisung) || !ts.isStringLiteral(anweisung.moduleSpecifier)) continue
    if (!anweisung.moduleSpecifier.text.startsWith('@/server/actions/')) continue
    if (anweisung.importClause?.isTypeOnly) continue
    const benannt = anweisung.importClause?.namedBindings
    if (benannt && ts.isNamedImports(benannt)) {
      for (const element of benannt.elements) if (!element.isTypeOnly) aktionen.add(element.name.text)
    }
  }

  function geschuetzt(aufruf: ts.Node): boolean {
    let kind: ts.Node = aufruf
    for (let eltern = aufruf.parent; eltern; kind = eltern, eltern = eltern.parent) {
      if (ts.isTryStatement(eltern) && eltern.tryBlock === kind) return true
      if (ts.isCallExpression(eltern) && ts.isIdentifier(eltern.expression) && HELFER.has(eltern.expression.text) && kind !== eltern.expression) return true
    }
    return false
  }

  const funde: string[] = []
  function besuche(knoten: ts.Node): void {
    if (ts.isCallExpression(knoten) && ts.isIdentifier(knoten.expression) && aktionen.has(knoten.expression.text) && !geschuetzt(knoten)) {
      funde.push(knoten.expression.text)
    }
    ts.forEachChild(knoten, besuche)
  }
  besuche(datei)
  return funde
}

describe('Hofbereich: Server-Actions ohne Wurf (Register N29)', () => {
  it('kein neuer ungeschützter Aufruf — und jeder im Bestand gibt es noch', { timeout: 30_000 }, () => {
    const funde: string[] = []
    for (const ordner of ORDNER) {
      for (const pfad of quelldateien(join(WURZEL, ordner))) {
        const name = relative(WURZEL, pfad).split(sep).join('/')
        if (AUSGENOMMEN.has(name)) continue
        const text = readFileSync(pfad, 'utf8')
        if (!text.includes('@/server/actions/')) continue
        funde.push(...ungeschuetzteAktionsAufrufe(text).map((aktion) => `${name}: ${aktion}`))
      }
    }
    // Gleich, nicht „enthalten in": Ein umgestellter Aufruf muss aus dem Bestand gestrichen werden.
    expect(funde.sort()).toEqual([...BESTAND].sort())
  })

  it('die umgestellten Aufrufe (Pause, Im-Shop-Schalter, Bestellung, Storno, Artikel fehlt, Abholzeiten, Profil, Beitrag) laufen über den Helfer', () => {
    for (const datei of [
      'src/components/settings/pause-client.tsx',
      'src/components/mein-hof/pausieren-blatt.tsx',
      'src/components/products/im-shop-schalter.tsx',
      'src/components/hof-bestellungen/bestell-detail.tsx',
      'src/components/hof-bestellungen/storno-dialog.tsx',
      'src/components/hof-bestellungen/artikel-fehlt-dialog.tsx',
      'src/components/settings/pickup-slots-client.tsx',
      'src/components/settings/profile-form.tsx',
      'src/app/(hof)/status/new/status-new-client.tsx',
    ]) {
      expect(readFileSync(join(WURZEL, datei), 'utf8'), datei).toContain('aktionOhneWurf(() =>')
    }
  })

  it('Gegenprobe: schlägt an bei nacktem Aufruf, in startTransition und im catch — nicht im try, im Helfer, als Wert oder bei import type', () => {
    const kopf = "import { setPause, cancelOrder as storno } from '@/server/actions/farm'\nimport type { Typ } from '@/server/actions/orders'\n"
    const treffer = [
      'async function a() { await setPause(true, "") }',
      'function b() { startTransition(async () => { const r = await storno("id") }) }',
      'async function c() { try { x() } catch { await setPause(false, "") } }',
    ].join('\n')
    expect(ungeschuetzteAktionsAufrufe(kopf + treffer)).toEqual(['setPause', 'storno', 'setPause'])

    const keine = [
      'async function d() { try { await setPause(true, "") } catch {} }',
      'async function e() { await aktionOhneWurf(() => setPause(true, "")) }',
      'async function f() { await speichernOhneWurf(async () => storno("id")) }',
      'const g = { aktion: setPause }',
      'function h() { Typ("kein Aufruf einer Aktion") }',
      '// setPause(true, "") im Kommentar',
    ].join('\n')
    expect(ungeschuetzteAktionsAufrufe(kopf + keine)).toEqual([])
  })
})
