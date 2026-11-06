/**
 * Startfokus-Wache (Nr. 246; Regelvorschlag aus Morgenbericht 31, als entschieden übernommen in freigabe.md §36).
 *
 * Ursache: Eine Rückfrage mit orangem Hauptknopf für etwas, das sich nicht einfach zurücknehmen lässt (löschen,
 * stornieren, pausieren, stilllegen), öffnete mit dem Fokus auf dem Titel oder dem ersten Knopf. Ein Enter zu viel
 * löste dann die Aktion aus. Der Startfokus gehört auf „Abbrechen“ (DESIGN_SYSTEM „Dialoge und Blätter“).
 *
 * Beweist (Syntaxbaum von TypeScript über `src/`, `.tsx`): Jedes `<DialogMitte>` und `<SheetBlatt>`, in dessen Inhalt
 * (Texte, Zeichenketten, Titel) eines dieser Wörter steht, setzt `initialFocus` auf etwas mit „abbrechen“ im Namen —
 * direkt (`initialFocus={abbrechenRef}`) oder über eine Funktion derselben Datei, die es sucht
 * (`const startfokus = () => abbrechenIn(…)`). Ausnahmen nur aus der Bestandsliste
 * (tests/bestandslisten/startfokus.ts); sie schrumpft nur — ein Eintrag, der inzwischen besteht, fällt als veraltet auf.
 *
 * Gegenprobe: Schnipsel — ohne `initialFocus`, mit Fokus auf dem Titel und mit einem Wort nur außerhalb des Dialogs.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { STARTFOKUS_BESTAND } from './bestandslisten/startfokus'

const WURZEL = process.cwd()
const DIALOGE = new Set(['DialogMitte', 'SheetBlatt'])
/** Aktionen, die der Mensch nicht mit einem Tipp zurücknimmt — der Hauptknopf ist dort orange. */
const GEFAHR_WORT = /lösch|storn|pausier|stilleg/i
const ABBRECHEN = /abbrechen/i

function* dateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* dateien(pfad)
    else if (name.endsWith('.tsx')) yield pfad
  }
}

/** Die Rückfragen einer Quelle, die eine Gefahr-Aktion tragen und den Startfokus nicht auf „Abbrechen“ setzen (Zeilen). */
function startfokusFehler(quelle: string, datei = 'x.tsx'): number[] {
  const sf = ts.createSourceFile(datei, quelle, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const deklarationen = new Map<string, string>()
  const fehler: number[] = []
  const merke = (k: ts.Node): void => {
    if (ts.isVariableDeclaration(k) && ts.isIdentifier(k.name) && k.initializer) deklarationen.set(k.name.text, k.initializer.getText(sf))
    if (ts.isFunctionDeclaration(k) && k.name && k.body) deklarationen.set(k.name.text, k.body.getText(sf))
    ts.forEachChild(k, merke)
  }
  merke(sf)
  const zielAbbrechen = (ausdruck: ts.Expression): boolean => {
    if (ABBRECHEN.test(ausdruck.getText(sf))) return true
    return ts.isIdentifier(ausdruck) && ABBRECHEN.test(deklarationen.get(ausdruck.text) ?? '')
  }
  const besuche = (k: ts.Node): void => {
    if (ts.isJsxElement(k) && DIALOGE.has(k.openingElement.tagName.getText(sf))) {
      const texte: string[] = []
      const sammle = (t: ts.Node): void => {
        if (ts.isJsxText(t) || ts.isStringLiteral(t) || ts.isNoSubstitutionTemplateLiteral(t)) texte.push(t.text)
        ts.forEachChild(t, sammle)
      }
      sammle(k)
      if (GEFAHR_WORT.test(texte.join(' '))) {
        const attribut = k.openingElement.attributes.properties.find(
          (a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && a.name.getText(sf) === 'initialFocus'
        )
        const ausdruck = attribut?.initializer && ts.isJsxExpression(attribut.initializer) ? attribut.initializer.expression : undefined
        if (!ausdruck || !zielAbbrechen(ausdruck)) fehler.push(sf.getLineAndCharacterOfPosition(k.getStart(sf)).line + 1)
      }
    }
    ts.forEachChild(k, besuche)
  }
  besuche(sf)
  return fehler
}

const funde = new Map<string, number>()
for (const pfad of dateien(join(WURZEL, 'src'))) {
  const quelle = readFileSync(pfad, 'utf8')
  if (!/<(DialogMitte|SheetBlatt)\b/.test(quelle)) continue
  const fehler = startfokusFehler(quelle, pfad)
  if (fehler.length > 0) funde.set(relative(WURZEL, pfad).split(sep).join('/'), fehler.length)
}

describe('Startfokus auf „Abbrechen“ bei Rückfragen mit orangem Hauptknopf', () => {
  it('keine neue Rückfrage (löschen, stornieren, pausieren, stilllegen) ohne Startfokus auf „Abbrechen“', () => {
    const neu = [...funde.keys()].filter((datei) => !(datei in STARTFOKUS_BESTAND))
    expect(neu, 'initialFocus auf „Abbrechen“ setzen (DESIGN_SYSTEM „Dialoge und Blätter“)').toEqual([])
  })

  it('in Dateien der Bestandsliste wird es nicht mehr', () => {
    const mehr = [...funde].filter(([datei, anzahl]) => datei in STARTFOKUS_BESTAND && anzahl > STARTFOKUS_BESTAND[datei].anzahl)
    expect(mehr.map(([datei, anzahl]) => `${datei}: ${anzahl} statt höchstens ${STARTFOKUS_BESTAND[datei].anzahl}`)).toEqual([])
  })

  it('die Bestandsliste schrumpft nur — eine Datei ohne Fund muss heraus', () => {
    const veraltet = Object.keys(STARTFOKUS_BESTAND).filter((datei) => !funde.has(datei))
    expect(veraltet, 'Diese Dateien aus tests/bestandslisten/startfokus.ts streichen').toEqual([])
  })

  it('Gegenprobe: ohne initialFocus und mit Fokus auf dem Titel schlägt es an, „Abbrechen“ und harmlose Dialoge nicht', () => {
    expect(startfokusFehler('const a = <DialogMitte titel="Konto löschen?"><button>Löschen</button></DialogMitte>')).toEqual([1])
    expect(startfokusFehler('const a = <SheetBlatt initialFocus={titel}><h2>Bestellungen pausieren?</h2></SheetBlatt>')).toEqual([1])
    expect(startfokusFehler("const a = <SheetBlatt initialFocus={abbrechenRef}>{'Stornieren'}</SheetBlatt>")).toEqual([])
    expect(startfokusFehler('const f = () => abbrechenIn(p.current)\nconst a = <DialogMitte titel="Hof stilllegen?" initialFocus={f}>x</DialogMitte>')).toEqual([])
    expect(startfokusFehler('const a = <><p>Löschen</p><DialogMitte titel="Fertig">x</DialogMitte></>')).toEqual([])
    expect(funde.size + Object.keys(STARTFOKUS_BESTAND).length).toBeGreaterThan(0)
  })

  it('Gegenprobe im echten Baum: die Konto-Rückfrage findet das Wort und besteht über abbrechenRef', () => {
    const quelle = readFileSync(join(WURZEL, 'src/app/account/profile/profile-client.tsx'), 'utf8')
    expect(quelle).toMatch(/<DialogMitte[\s\S]*Konto wirklich löschen/)
    expect(startfokusFehler(quelle.replace(/initialFocus=\{abbrechenRef\}/g, ''))).toHaveLength(2)
    expect(startfokusFehler(quelle)).toEqual([])
  })
})
