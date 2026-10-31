/**
 * Wache: `del(` aus '@vercel/blob' steht nur in den benannten Wegen
 * (Regelvorschlag 108, Lauf 16; freigegeben für Nr. 118, Lauf 17).
 *
 * Regel (ARCHITECTURE „Upload", Register N17/N18): Ein Blob wird erst gelöscht, wenn keine Zeile mehr auf ihn
 * zeigt — nie im Upload, nie vor dem Speichern. Ursache (Nr. 108): `/api/upload/verarbeiten` löschte das
 * ERSETZTE Bild, bevor Produkt oder Hof gespeichert war; scheiterte das Speichern, zeigte die Seite ein
 * gelöschtes Bild. Seither löscht dieser Weg nur noch das Original des Uploads. Ersetzte Logos, Titelbilder
 * und Produktbilder löschen seit Nr. 206 (Audit A8) die speichernden Actions — NACH dem Schreiben, seit
 * Nr. 213 über den einen Helfer src/server/bild-loeschen.ts.
 *
 * Beweist (TypeScript-Syntaxbaum über jede .ts/.tsx unter src/):
 *  - Jeder Aufruf von `del` aus '@vercel/blob' — benannt importiert (auch umbenannt), als Namespace
 *    (`blob.del(…)`) oder per dynamischem Import — steht in einer Datei von WEGE, höchstens so oft wie dort
 *    angegeben, mit Grund. Ein neuer Weg fällt mit dem Namen seiner Datei auf.
 *  - Jeder benannte Weg gibt es noch und ruft `del` so oft auf wie angegeben (sonst: Liste anpassen).
 *  - Gegenprobe: Die Suche findet alle Schreibweisen im Schnipsel und ignoriert ein `del` aus anderer Quelle.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'

const WURZEL = process.cwd()

/** Die Wege, die Blobs löschen — mit Anzahl der Aufrufe und dem Grund, warum keine Zeile mehr auf den Blob zeigt. */
const WEGE: Record<string, { aufrufe: number; grund: string }> = {
  'src/server/actions/farm-photos.ts': {
    aufrufe: 1,
    grund: 'deleteFarmPhotoAction löscht erst die Zeile FarmPhoto (Besitz geprüft), dann den Blob dieses Fotos — danach zeigt nichts mehr auf ihn.',
  },
  'src/server/bild-loeschen.ts': {
    aufrufe: 1,
    grund: 'entferneAltesBild (Nr. 206, Audit A8; seit Nr. 213 einmal hier statt je einer Kopie in appearance.ts und products.ts): das ersetzte Logo, Titel- oder Produktbild bzw. das Bild eines gelöschten (nicht archivierten) Produkts erst nach dem erfolgreichen Schreiben, nur im Ordner dieses Hofs aus dem eigenen Speicher und nur, wenn keine Zeile mehr auf die Datei zeigt (Hof, Produkt, Galerie, Beitrag, Meldung, Startseite).',
  },
  'src/lib/konto-schliessen.ts': {
    aufrufe: 1,
    grund: 'Stufe 2 von „Konto schließen“ (N36, Nr. 190, nur mit ENDGUELTIG_FREIGEGEBEN): erst sind in einer Transaktion alle Zeilen weg, die auf die Bilder des Hofs zeigen (Fotos, Logo, Titelbild, Produktbilder, Meldungen), dann leert sie die Ordner des Hofs.',
  },
  'src/app/api/cron/briefkasten/route.ts': {
    aufrufe: 1,
    grund: 'Der Wochenlauf löscht die Screenshots der Meldungen, die er im selben Lauf löscht; auf einen Screenshot zeigt nur seine Meldung.',
  },
  'src/app/api/upload/verarbeiten/route.ts': {
    aufrufe: 2,
    grund: 'Löscht nur das Original des Uploads (url), das nur diese Route kennt und keine Zeile trägt — nie das ersetzte Bild (Nr. 108).',
  },
}

function* quelldateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* quelldateien(pfad)
    else if (/\.(ts|tsx)$/.test(name)) yield pfad
  }
}

const BLOB = '@vercel/blob'

/** Ist der Knoten `import('@vercel/blob')` bzw. `require('@vercel/blob')` (auch mit `await` davor)? */
function holtBlob(knoten: ts.Expression | undefined): boolean {
  let k = knoten
  while (k && (ts.isAwaitExpression(k) || ts.isParenthesizedExpression(k))) k = k.expression
  if (!k || !ts.isCallExpression(k) || k.arguments.length !== 1) return false
  const ziel = k.arguments[0]
  const ruft = k.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(k.expression) && k.expression.text === 'require')
  return ruft && ts.isStringLiteralLike(ziel) && ziel.text === BLOB
}

/** Wie oft ruft dieser Quelltext `del` aus '@vercel/blob' auf — „Datei:Zeile“ je Aufruf. */
function findeBlobLoeschen(quelltext: string, pfad = 'schnipsel.ts'): string[] {
  const art = pfad.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const datei = ts.createSourceFile(pfad, quelltext, ts.ScriptTarget.Latest, true, art)
  const einzeln = new Set<string>() // lokale Namen von `del`
  const namensraeume = new Set<string>() // lokale Namen des ganzen Moduls

  const sammle = (knoten: ts.Node): void => {
    if (ts.isImportDeclaration(knoten) && ts.isStringLiteral(knoten.moduleSpecifier) && knoten.moduleSpecifier.text === BLOB) {
      const bindung = knoten.importClause?.namedBindings
      if (knoten.importClause?.name) namensraeume.add(knoten.importClause.name.text)
      if (bindung && ts.isNamespaceImport(bindung)) namensraeume.add(bindung.name.text)
      if (bindung && ts.isNamedImports(bindung)) {
        for (const e of bindung.elements) if ((e.propertyName ?? e.name).text === 'del') einzeln.add(e.name.text)
      }
    }
    if (ts.isVariableDeclaration(knoten) && holtBlob(knoten.initializer)) {
      if (ts.isIdentifier(knoten.name)) namensraeume.add(knoten.name.text)
      if (ts.isObjectBindingPattern(knoten.name)) {
        for (const e of knoten.name.elements) {
          const eigenschaft = e.propertyName ?? e.name
          if (ts.isIdentifier(eigenschaft) && eigenschaft.text === 'del' && ts.isIdentifier(e.name)) einzeln.add(e.name.text)
        }
      }
    }
    ts.forEachChild(knoten, sammle)
  }
  sammle(datei)

  const funde: string[] = []
  const besuche = (knoten: ts.Node): void => {
    if (ts.isCallExpression(knoten)) {
      const ziel = knoten.expression
      const direkt = ts.isIdentifier(ziel) && einzeln.has(ziel.text)
      const ueberModul = ts.isPropertyAccessExpression(ziel) && ziel.name.text === 'del' && ts.isIdentifier(ziel.expression) && namensraeume.has(ziel.expression.text)
      // `(await import('@vercel/blob')).del(…)` ohne Zwischenvariable
      const ueberImport = ts.isPropertyAccessExpression(ziel) && ziel.name.text === 'del' && holtBlob(ziel.expression)
      if (direkt || ueberModul || ueberImport) funde.push(`${pfad}:${datei.getLineAndCharacterOfPosition(knoten.getStart(datei)).line + 1}`)
    }
    ts.forEachChild(knoten, besuche)
  }
  besuche(datei)
  return funde
}

/** Steht der Name als Bezeichner im Code (Kommentare und Zeichenketten zählen nicht)? */
function nenntImCode(name: string, quelltext: string): boolean {
  const datei = ts.createSourceFile('schnipsel.ts', quelltext, ts.ScriptTarget.Latest, true)
  let gefunden = false
  const besuche = (knoten: ts.Node): void => {
    if (ts.isIdentifier(knoten) && knoten.text === name) gefunden = true
    if (!gefunden) ts.forEachChild(knoten, besuche)
  }
  besuche(datei)
  return gefunden
}

describe('del( aus @vercel/blob nur in den benannten Wegen (Regelvorschlag 108)', () => {
  it('Gegenprobe: findet jede Schreibweise — und kein del aus anderer Quelle', () => {
    expect(findeBlobLoeschen("import { del } from '@vercel/blob'\nawait del(url)")).toHaveLength(1)
    expect(findeBlobLoeschen("import { put, del as loesche } from '@vercel/blob'\nawait loesche(url)")).toHaveLength(1)
    expect(findeBlobLoeschen("import * as blob from '@vercel/blob'\nawait blob.del(url)")).toHaveLength(1)
    expect(findeBlobLoeschen("const { del } = await import('@vercel/blob')\nawait del(url)")).toHaveLength(1)
    expect(findeBlobLoeschen("export {}\nawait (await import('@vercel/blob')).del(url)")).toHaveLength(1)
    expect(findeBlobLoeschen("import { del } from '@vercel/blob'\nawait del(a)\nawait del(b)")).toEqual(['schnipsel.ts:2', 'schnipsel.ts:3'])
    // kein Fund: put allein, ein del aus anderer Quelle, ein Name ohne Import
    expect(findeBlobLoeschen("import { put } from '@vercel/blob'\nawait put(a, b)")).toEqual([])
    expect(findeBlobLoeschen("import { del } from './eigener-speicher'\nawait del(url)")).toEqual([])
    expect(findeBlobLoeschen('await del(url)')).toEqual([])
    expect(findeBlobLoeschen("import * as blob from '@vercel/blob'\nawait blob.put(a, b)\nmap.del(x)")).toEqual([])
  })

  it('jeder Aufruf steht in einem benannten Weg — ein neuer fällt mit dem Namen seiner Datei auf', () => {
    const je_datei = new Map<string, number>()
    for (const pfad of quelldateien(join(WURZEL, 'src'))) {
      const anzahl = findeBlobLoeschen(readFileSync(pfad, 'utf8'), relative(WURZEL, pfad)).length
      if (anzahl > 0) je_datei.set(relative(WURZEL, pfad).split(sep).join('/'), anzahl)
    }
    const neu = [...je_datei.keys()].filter((datei) => !(datei in WEGE))
    expect(
      neu,
      `Neuer Weg, der Blobs löscht: ${neu.join(', ')}. Ein Blob wird erst gelöscht, wenn keine Zeile mehr auf ihn zeigt — ` +
        'nie im Upload, nie vor dem Speichern. Entweder den Weg ändern oder mit Grund in WEGE eintragen.'
    ).toEqual([])
    const zuViele = [...je_datei].filter(([datei, anzahl]) => datei in WEGE && anzahl > WEGE[datei].aufrufe).map(([datei]) => datei)
    expect(zuViele, `Mehr Aufrufe von del als in WEGE angegeben: ${zuViele.join(', ')}`).toEqual([])
  }, 30_000)

  it('jeder benannte Weg ruft del noch genau so oft auf — sonst ist die Liste veraltet', () => {
    for (const [datei, { aufrufe, grund }] of Object.entries(WEGE)) {
      expect(grund.length, datei).toBeGreaterThan(30)
      expect(findeBlobLoeschen(readFileSync(join(WURZEL, datei), 'utf8'), datei), datei).toHaveLength(aufrufe)
    }
  })

  it('der Upload-Weg löscht nie das ersetzte Bild: kein altUrl im Code der Route', () => {
    // Ein mitgeschicktes altUrl wird nicht gelesen (Nr. 108) — nur in Kommentaren darf das Wort stehen.
    const route = readFileSync(join(WURZEL, 'src/app/api/upload/verarbeiten/route.ts'), 'utf8')
    expect(nenntImCode('altUrl', route)).toBe(false)
    // Gegenprobe: Im Code schlägt die Suche an, im Kommentar nicht.
    expect(nenntImCode('altUrl', 'const x = body.altUrl')).toBe(true)
    expect(nenntImCode('altUrl', 'const { altUrl } = body')).toBe(true)
    expect(nenntImCode('altUrl', '// altUrl wird nicht gelesen\n/* altUrl */ const x = 1')).toBe(false)
  })
})
