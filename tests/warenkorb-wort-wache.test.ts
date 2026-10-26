/**
 * Wache (Register N8, Ergänzung 26.10.2026, Nr. 195): „In den Korb“ steht nur an
 * Knöpfen, sonst überall „Warenkorb“.
 *
 * Ursache: Neben „Warenkorb“ standen „Korb“, „im Korb“ und „deinem Korb“ in
 * Toasts, Fehlersätzen, Hinweisen und Zähler-Namen. Wer den Hof liest, hält sie
 * für verschiedene Dinge. Die Wache sucht in jeder Zeichenkette, jedem
 * Vorlagentext und jedem JSX-Text unter src/ das Wort „Korb“ (groß, mit
 * Wortgrenzen) — Kommentare, Bezeichner, Schlüssel wie `kasse-korb` und
 * Server-Logs zählen nicht. Was bleibt, steht in BESTAND: der Name oder die
 * Aufschrift eines Knopfes, je Text mit Grund; die Liste schrumpft nur — ein
 * Eintrag, hinter dem kein Text mehr steht, fällt auf. Der Rechtstext der AGB
 * ist als ganze Datei ausgenommen (wörtlich aus docs/recht/agb.md).
 *
 * Gegenprobe: Die Suche schlägt am Wort im String an, nicht im Kommentar und nicht
 * in „Warenkorb“.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const WURZEL = process.cwd()
const KORB = /(?<![\p{L}\p{N}-])Korb(?![\p{L}\p{N}])/u

type Fund = { datei: string; text: string }

function* quelldateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* quelldateien(pfad)
    else if (/\.(ts|tsx)$/.test(name)) yield pfad
  }
}

function imLog(knoten: ts.Node): boolean {
  for (let k: ts.Node | undefined = knoten.parent; k; k = k.parent) {
    if (ts.isCallExpression(k) && ts.isPropertyAccessExpression(k.expression) && k.expression.expression.getText() === 'console') return true
  }
  return false
}

function findeKorb(quelltext: string, datei = 'schnipsel.tsx'): Fund[] {
  const quelle = ts.createSourceFile(datei, quelltext, ts.ScriptTarget.Latest, true, datei.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const funde: Fund[] = []
  const besuche = (knoten: ts.Node): void => {
    let roh: string | null = null
    if (ts.isStringLiteral(knoten) || ts.isNoSubstitutionTemplateLiteral(knoten)) roh = knoten.text
    else if (ts.isTemplateHead(knoten) || ts.isTemplateMiddle(knoten) || ts.isTemplateTail(knoten)) roh = knoten.text
    else if (ts.isJsxText(knoten)) roh = knoten.text
    if (roh !== null && !imLog(knoten)) {
      const text = roh.replace(/\s+/g, ' ').trim()
      if (KORB.test(text)) funde.push({ datei, text })
    }
    ts.forEachChild(knoten, besuche)
  }
  besuche(quelle)
  return funde
}

/** Wörtlicher Rechtstext, den kein Lauf umschreibt (Register O4). */
const AUSNAHME_DATEIEN = ['src/lib/rechtstexte/agb.ts']

/** Name oder Aufschrift eines Knopfes — dort heißt es „In den Korb“. Nur streichen, nie ergänzen. */
const BESTAND: { datei: string; text: RegExp; grund: string }[] = [
  { datei: 'src/components/hofseite/produkt-karte.tsx', text: /^in den Korb legen$/, grund: 'Name des Plus-Knopfs der Produktkarte (aria-label)' },
  { datei: 'src/components/hofseite/produkt-karte.tsx', text: /^In den Korb$/, grund: 'Aufschrift des Knopfs der Produktkarte' },
  { datei: 'src/components/produktdetail/produktdetail-kunde.tsx', text: /^In den Korb ·$/, grund: 'Aufschrift des Kaufknopfs der Produktseite, mit Betrag' },
  { datei: 'src/components/produktdetail/produktdetail-teile.tsx', text: /^in den Korb legen$/, grund: 'Name des Plus-Knopfs bei „Gleich mit abholen“ (aria-label)' },
  { datei: 'src/components/produktdetail/produktdetail-teile.tsx', text: /^Im Korb$/, grund: 'Aufschrift desselben Knopfs, wenn alles im Warenkorb liegt' },
  { datei: 'src/components/produktdetail/produktdetail-teile.tsx', text: /^In den Korb$/, grund: 'Aufschrift desselben Knopfs' },
  { datei: 'src/lib/hofseite-kunde.ts', text: /^in den Korb$/, grund: 'Name des Plus-Knopfs in „Aktuell vom Hof“ (aria-label, Vorlage mit dem Produktnamen)' },
]

function alleFunde(): Fund[] {
  const funde: Fund[] = []
  for (const pfad of quelldateien(join(WURZEL, 'src'))) {
    const datei = relative(WURZEL, pfad).split(sep).join('/')
    if (AUSNAHME_DATEIEN.includes(datei)) continue
    funde.push(...findeKorb(readFileSync(pfad, 'utf8'), datei))
  }
  return funde
}

describe('Wortliste: „Warenkorb“, nur am Knopf „In den Korb“', () => {
  it('kein Text mit „Korb“ außer dem Bestand der Knöpfe', () => {
    const uebrig = alleFunde().filter((f) => !BESTAND.some((b) => b.datei === f.datei && b.text.test(f.text)))
    expect(uebrig).toEqual([])
  }, 30_000)

  it('jeder Eintrag des Bestands deckt noch einen Text (die Liste schrumpft nur)', () => {
    const funde = alleFunde()
    const tot = BESTAND.filter((b) => !funde.some((f) => f.datei === b.datei && b.text.test(f.text))).map((b) => `${b.datei}: ${b.text}`)
    expect(tot).toEqual([])
  }, 30_000)

  it('Gegenprobe: das Wort im String schlägt an, in Kommentar, Warenkorb, Schlüssel und Log nicht', () => {
    expect(findeKorb("const t = 'Das liegt im Korb'")).toHaveLength(1)
    expect(findeKorb('const t = `${a} ist im Korb`')).toHaveLength(1)
    expect(findeKorb('const j = <p>Dein Korb ist leer</p>')).toHaveLength(1)
    expect(findeKorb("// im Korb\nconst t = 'Warenkorb'")).toEqual([])
    expect(findeKorb("const id = 'kasse-korb'")).toEqual([])
    expect(findeKorb("console.warn('Korb leer')")).toEqual([])
  })
})
