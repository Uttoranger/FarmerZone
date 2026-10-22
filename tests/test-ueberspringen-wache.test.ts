/**
 * Wache gegen stillgelegte Tests (Inventur 16, Morgenbericht 20 §3; freigegeben 21.10.2026, Register G4,
 * Ergänzung). Die Regel steht in TESTING_GUIDELINES §6: Ein roter Test wird nie mit `.skip` stillgelegt.
 * Bisher prüfte sie nur ein Suchbefehl, der außer einem Kommentar nichts fand — und bei „0 Treffer“ gilt
 * (Regelvorschlag 110), dass das Suchmuster an einem Beispiel anschlagen muss.
 *
 * Beweist (Quelltext von `tests/` samt `tests/integration/`, TypeScript-Syntaxbaum, kein Netz):
 *  - Kein Aufruf und keine Benennung von `.skip`, `.only` oder `.todo` an `it`, `test`, `describe` oder `suite`
 *    (auch `it.each(…).skip`, `it.concurrent.skip`, `it['skip']`) und kein `xit`, `xtest`, `xdescribe`.
 *    `.only` schließt alle anderen Tests der Datei aus; ein vergessenes bliebe grün und prüfte fast nichts.
 *  - `.skipIf` und `.runIf` nur in einer Datei der Liste `BEDINGT_ERLAUBT`, jede mit Grund.
 *  - Kommentare und Zeichenketten zählen nicht (der Syntaxbaum kennt sie nicht als Code). tests/zeitgrenzen-wache
 *    nennt `describe.skip` in einem Kommentar, tests/wortliste.test.ts „Liste und `it.skip`“ als Muster einer
 *    Arbeitsliste: beides sind Kommentare und bleiben grün. Das Muster selbst ginge hier nicht durch — eine
 *    Arbeitsliste, die ihre Tests mit `it.skip` stilllegt, brauchte eine Freigabe und einen Eintrag in einer
 *    Liste dieser Wache (Bericht zu Nr. 140).
 *
 * Gegenprobe: Beispiel-Dateien mit jeder Schreibweise schlagen an; ein Kommentar, eine Zeichenkette, ein
 * fremdes Objekt mit `.skip` und ein gewöhnlicher Test schlagen nicht an.
 *
 * Zweiter Teil (Regelvorschlag „Sammelstand“ aus Morgenbericht 20 §6, freigegeben 21.10.2026): Ein verfälschter
 * Testwert ist immer sicher anders — Zeichen tauschen, nicht festsetzen. Ursache: Ein Test setzte die letzten
 * Zeichen eines Tokens auf einen festen Wert; bei einem zufälligen Token war er in 1 von 256 Läufen unverändert
 * gültig (abmelden.int, Lauf 20). Die Wache sucht in allen Dateien unter `tests/` einen Vorlage-Text (oder ein `+`),
 * in dem auf `x.slice(0, -n)` (n eine Zahl) direkt ein fester Text folgt. Erlaubt ist ein Ausdruck, der vom alten
 * Zeichen abhängt (`${t.slice(0, -1)}${t.endsWith('0') ? '1' : '0'}`), und das bloße Kürzen
 * (`Bearer ${TOKEN.slice(0, -1)}`). Nicht erfasst: ein Abschneiden um eine Länge statt einer Zahl
 * (`slice(0, -'alles'.length)` ersetzt ein bekanntes Ende, es verfälscht nichts).
 * Gegenprobe: `${t.slice(0, -2)}00` und `t.slice(0, -1) + 'X'` schlagen an, der tauschende Ausdruck, das Kürzen
 * und ein festes Ende nach `slice(1)` nicht.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const WURZEL = process.cwd()

/** Die Namen, an denen ein Test hängt. */
const TEST_NAMEN = new Set(['it', 'test', 'describe', 'suite'])
/** Legen einen Test still oder schließen die übrigen aus. */
const STILLLEGER = new Set(['skip', 'only', 'todo'])
/** Legen einen Test je nach Umgebung still. */
const BEDINGT = new Set(['skipIf', 'runIf'])
/** Die Namen aus Jest, die Vitest ebenfalls kennt. */
const ALTE_NAMEN = new Set(['xit', 'xtest', 'xdescribe'])

/** Dateien, in denen ein Test von der Umgebung abhängen darf — mit Grund. Neue Einträge nur mit Freigabe. */
const BEDINGT_ERLAUBT: Record<string, string> = {
  'tests/vercel-ignore.test.ts': 'Das Ausführungsrecht einer Skriptdatei gibt es unter Windows nicht; dort ist der Fall sinnlos, nicht rot.',
}

interface Fund {
  datei: string
  zeile: number
  art: 'stilllegung' | 'bedingt'
  text: string
}

function ohneHuelle(ausdruck: ts.Expression): ts.Expression {
  let k = ausdruck
  while (ts.isParenthesizedExpression(k) || ts.isAsExpression(k) || ts.isSatisfiesExpression(k) || ts.isNonNullExpression(k) || ts.isTypeAssertionExpression(k)) {
    k = k.expression
  }
  return k
}

/** Das erste Wort einer Aufrufkette: `it.each(x)(…)` → `it`, `describe.skip(…)` → `describe`. */
function kettenAnfang(ausdruck: ts.Expression): string | null {
  let k = ohneHuelle(ausdruck)
  for (;;) {
    if (ts.isIdentifier(k)) return k.text
    if (ts.isPropertyAccessExpression(k) || ts.isElementAccessExpression(k) || ts.isCallExpression(k)) k = ohneHuelle(k.expression)
    else return null
  }
}

/** Der Name hinter dem Punkt bzw. in den eckigen Klammern: `it.skip` → `skip`, `it['only']` → `only`. */
function zugriffsName(knoten: ts.Node): string | null {
  if (ts.isPropertyAccessExpression(knoten)) return knoten.name.text
  if (ts.isElementAccessExpression(knoten) && ts.isStringLiteralLike(knoten.argumentExpression)) return knoten.argumentExpression.text
  return null
}

/** Alle stillgelegten und bedingt laufenden Tests einer Datei. */
function findeStilllegungen(text: string, name: string): Fund[] {
  const datei = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, name.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const funde: Fund[] = []
  const merke = (knoten: ts.Node, art: Fund['art'], beschreibung: string): void => {
    funde.push({ datei: name, zeile: datei.getLineAndCharacterOfPosition(knoten.getStart()).line + 1, art, text: beschreibung })
  }
  const besuche = (k: ts.Node): void => {
    const zugriff = zugriffsName(k)
    if (zugriff !== null && (STILLLEGER.has(zugriff) || BEDINGT.has(zugriff)) && (ts.isPropertyAccessExpression(k) || ts.isElementAccessExpression(k))) {
      const anfang = kettenAnfang(k.expression)
      if (anfang !== null && TEST_NAMEN.has(anfang)) merke(k, STILLLEGER.has(zugriff) ? 'stilllegung' : 'bedingt', `${anfang}….${zugriff}`)
    }
    if (ts.isCallExpression(k)) {
      const ziel = ohneHuelle(k.expression)
      if (ts.isIdentifier(ziel) && ALTE_NAMEN.has(ziel.text)) merke(k, 'stilllegung', ziel.text)
    }
    ts.forEachChild(k, besuche)
  }
  besuche(datei)
  return funde
}

/** Alle Dateien unter `tests/` rekursiv, auch `tests/integration/`, `tests/fabrik/` und `tests/fixtures/`. */
function testdateien(ordner: string): string[] {
  const funde: string[] = []
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) funde.push(...testdateien(pfad))
    else if (/\.(ts|tsx|mts)$/.test(name)) funde.push(pfad)
  }
  return funde
}

/** Liest und parst jede Datei unter `tests/`, die ein Stichwort enthält (das spart das Parsen der meisten). */
function alleFunde(): { geprueft: number; funde: Fund[] } {
  const stichwoerter = ['skip', 'only', 'todo', 'runIf', 'xit', 'xtest', 'xdescribe']
  const dateien = testdateien(join(WURZEL, 'tests'))
  const funde = dateien.flatMap((pfad) => {
    const text = readFileSync(pfad, 'utf8')
    if (!stichwoerter.some((wort) => text.includes(wort))) return []
    return findeStilllegungen(text, relative(WURZEL, pfad).split(sep).join('/'))
  })
  return { geprueft: dateien.length, funde }
}

/** `x.slice(0, -n)` mit einer Zahl n: schneidet die letzten n Zeichen ab. */
function schneidetEndeAb(ausdruck: ts.Expression): boolean {
  const a = ohneHuelle(ausdruck)
  if (!ts.isCallExpression(a) || a.arguments.length !== 2) return false
  const ziel = ohneHuelle(a.expression)
  if (!ts.isPropertyAccessExpression(ziel) || ziel.name.text !== 'slice') return false
  const von = ohneHuelle(a.arguments[0])
  const bis = ohneHuelle(a.arguments[1])
  return ts.isNumericLiteral(von) && von.text === '0' && ts.isPrefixUnaryExpression(bis) && bis.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(bis.operand)
}

interface Festsetzung {
  datei: string
  zeile: number
  text: string
}

/** Alle Stellen, an denen auf ein abgeschnittenes Ende ein fester Text folgt. */
function findeFestgesetzteEnden(text: string, name: string): Festsetzung[] {
  const datei = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, name.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const funde: Festsetzung[] = []
  const merke = (knoten: ts.Node): void => {
    funde.push({ datei: name, zeile: datei.getLineAndCharacterOfPosition(knoten.getStart()).line + 1, text: knoten.getText(datei).replace(/\s+/g, ' ').slice(0, 80) })
  }
  const besuche = (k: ts.Node): void => {
    if (ts.isTemplateExpression(k)) {
      k.templateSpans.forEach((stelle, i) => {
        if (!schneidetEndeAb(stelle.expression)) return
        // Fest ist, was direkt dahinter steht: Text zwischen den Klammern oder eine Zeichenkette als nächster Ausdruck.
        const naechster = k.templateSpans[i + 1]?.expression
        const festerText = stelle.literal.text !== '' || (naechster !== undefined && ts.isStringLiteralLike(ohneHuelle(naechster)))
        if (festerText) merke(k)
      })
    }
    if (ts.isBinaryExpression(k) && k.operatorToken.kind === ts.SyntaxKind.PlusToken && schneidetEndeAb(k.left) && ts.isStringLiteralLike(ohneHuelle(k.right))) merke(k)
    ts.forEachChild(k, besuche)
  }
  besuche(datei)
  return funde
}

describe('Tests überspringen — keine stillgelegten Tests unter tests/', () => {
  it('kein .skip, .only, .todo, xit oder xdescribe; skipIf und runIf nur in der Liste mit Grund', () => {
    // Liest und parst jede Datei unter tests/ (TESTING_GUIDELINES §4: Zeitgrenze 30_000 an genau diesem it).
    const { geprueft, funde } = alleFunde()

    // Nicht blind: Die Wache sah die Unit-Tests, die Integrationsschicht und sich selbst.
    expect(geprueft).toBeGreaterThan(400)
    expect(funde.map((f) => f.datei)).not.toContain('tests/test-ueberspringen-wache.test.ts')

    const still = funde.filter((f) => f.art === 'stilllegung')
    expect(still.map((f) => `${f.datei}:${f.zeile} ${f.text}`)).toEqual([])

    const bedingt = funde.filter((f) => f.art === 'bedingt' && !(f.datei in BEDINGT_ERLAUBT))
    expect(bedingt.map((f) => `${f.datei}:${f.zeile} ${f.text} (nur mit Eintrag und Grund in BEDINGT_ERLAUBT)`)).toEqual([])
  }, 30_000)

  it('jeder Eintrag der Liste steht noch in seiner Datei', () => {
    // Ein Eintrag ohne Fund wäre ein stehengebliebener Freibrief für die nächste `skipIf`-Zeile.
    for (const datei of Object.keys(BEDINGT_ERLAUBT)) {
      const funde = findeStilllegungen(readFileSync(join(WURZEL, datei), 'utf8'), datei)
      expect(funde.filter((f) => f.art === 'bedingt').length, datei).toBeGreaterThan(0)
    }
  })
})

describe('Tests überspringen — Gegenprobe: die Erkennung schlägt an', () => {
  const finde = (code: string): Array<[Fund['art'], string]> => findeStilllegungen(code, 'tests/beispiel.test.ts').map((f) => [f.art, f.text])

  it('schlägt an bei jeder Schreibweise von skip, only und todo', () => {
    expect(finde("it.only('läuft allein', () => {})")).toEqual([['stilllegung', 'it….only']])
    expect(finde("it.skip('ruht', () => {})")).toEqual([['stilllegung', 'it….skip']])
    expect(finde("test.todo('später')")).toEqual([['stilllegung', 'test….todo']])
    expect(finde("describe.skip('Gruppe', () => {})")).toEqual([['stilllegung', 'describe….skip']])
    expect(finde("describe.only('Gruppe', () => {})")).toEqual([['stilllegung', 'describe….only']])
    expect(finde("suite.todo('Gruppe')")).toEqual([['stilllegung', 'suite….todo']])
  })

  it('schlägt an bei verketteten und eckig geschriebenen Formen', () => {
    expect(finde("it.concurrent.skip('ruht', async () => {})")).toHaveLength(1)
    expect(finde("it.skip.each([1, 2])('ruht %s', () => {})")).toHaveLength(1)
    expect(finde("it.each([1, 2]).only('läuft allein %s', () => {})")).toHaveLength(1)
    expect(finde("it['only']('läuft allein', () => {})")).toHaveLength(1)
    expect(finde("const ruhend = it.skip\nruhend('x', () => {})")).toHaveLength(1)
  })

  it('schlägt an bei den Jest-Namen', () => {
    expect(finde("xit('ruht', () => {})")).toEqual([['stilllegung', 'xit']])
    expect(finde("xtest('ruht', () => {})")).toEqual([['stilllegung', 'xtest']])
    expect(finde("xdescribe('ruht', () => {})")).toEqual([['stilllegung', 'xdescribe']])
  })

  it('meldet skipIf und runIf als bedingt, damit die Liste entscheidet', () => {
    expect(finde("it.skipIf(process.platform === 'win32')('ist ausführbar', () => {})")).toEqual([['bedingt', 'it….skipIf']])
    expect(finde("describe.runIf(process.env.CI)('nur in der CI', () => {})")).toEqual([['bedingt', 'describe….runIf']])
  })

  it('schlägt nicht an bei Kommentaren, Zeichenketten und fremden Objekten', () => {
    expect(finde("// describe.skip('x', () => {}) und it.only('y')\nit('läuft', () => {})")).toEqual([])
    expect(finde("/* Muster: Liste und `it.skip`, bis sie leer ist */\nit('läuft', () => {})")).toEqual([])
    expect(finde("/** `xit(` ist verboten */\nit('läuft', () => {})")).toEqual([])
    expect(finde("const hinweis = \"it.only('x')\"\nit('läuft', () => { expect(hinweis).toBeTruthy() })")).toEqual([])
    expect(finde('const text = `describe.skip(`\nit(\'läuft\', () => { expect(text).toBeTruthy() })')).toEqual([])
    expect(finde("const liste = new Set()\nit('läuft', () => { expect(liste.skip).toBeUndefined(); expect(zeile.only).toBe(1) })")).toEqual([])
    expect(finde("function pruefe(ctx: { skip: () => void }) { ctx.skip() }\nit('läuft', () => {})")).toEqual([])
  })
})

describe('Verfälschte Testwerte — tauschen, nicht festsetzen', () => {
  it('kein fester Text hinter .slice(0, -n) in einer Testdatei', () => {
    // Liest und parst jede Datei unter tests/ (TESTING_GUIDELINES §4: Zeitgrenze 30_000 an genau diesem it).
    const dateien = testdateien(join(WURZEL, 'tests'))
    const funde = dateien.flatMap((pfad) => {
      const text = readFileSync(pfad, 'utf8')
      if (!text.includes('.slice(')) return []
      return findeFestgesetzteEnden(text, relative(WURZEL, pfad).split(sep).join('/'))
    })
    // Nicht blind: Die Gegenproben dieser Datei stehen in Zeichenketten und zählen nicht.
    expect(funde.map((f) => f.datei)).not.toContain('tests/test-ueberspringen-wache.test.ts')
    expect(funde.map((f) => `${f.datei}:${f.zeile} ${f.text}`)).toEqual([])
  }, 30_000)
})

describe('Verfälschte Testwerte — Gegenprobe: die Erkennung schlägt an', () => {
  const finde = (code: string): number => findeFestgesetzteEnden(code, 'tests/beispiel.test.ts').length

  it('schlägt an, wenn auf das abgeschnittene Ende ein fester Text folgt', () => {
    expect(finde('const f = `${t.slice(0, -2)}00`')).toBe(1)
    expect(finde('const f = `${token.slice(0, -1)}X`')).toBe(1)
    expect(finde('const f = `Bearer ${TOKEN.slice(0, -1)}X`')).toBe(1)
    expect(finde('const f = `${echt.slice(0, -4)}AAAA`')).toBe(1)
    expect(finde("const f = `${t.slice(0, -1)}${'0'}`")).toBe(1)
    expect(finde("const f = t.slice(0, -1) + 'X'")).toBe(1)
    expect(finde('const f = `${t.slice(0, -1)}-${t.slice(0, -2)}`')).toBe(1)
  })

  it('schlägt nicht an bei einem Ausdruck, der vom alten Zeichen abhängt, beim Kürzen und bei anderen Schnitten', () => {
    expect(finde("const f = `${t.slice(0, -1)}${t.endsWith('0') ? '1' : '0'}`")).toBe(0)
    expect(finde("const f = t.slice(0, -1) + (t.at(-1) === 'a' ? 'b' : 'a')")).toBe(0)
    expect(finde("const f = `${t.slice(0, -2)}${t.at(-2) === 'A' ? 'B' : 'A'}${t.slice(-1)}`")).toBe(0)
    expect(finde('const k = `Bearer ${TOKEN.slice(0, -1)}`')).toBe(0)
    expect(finde('const k = TOKEN.slice(0, -1)')).toBe(0)
    expect(finde("const g = `${roh.slice(0, -'alles'.length)}live`")).toBe(0)
    expect(finde('const a = `${t.slice(2)}00`')).toBe(0)
    expect(finde('const a = `${t.slice(1, -1)}00`')).toBe(0)
    expect(finde('const a = `${liste.slice(0, n)}00`')).toBe(0)
  })
})
