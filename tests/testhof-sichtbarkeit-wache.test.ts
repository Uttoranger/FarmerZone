/**
 * Wache (Register N21, Nr. 119): zwei Stufen der Sichtbarkeit.
 * OEFFENTLICH_SICHTBAR allein gilt nur für das, was ein Link direkt öffnet —
 * Hofseite, Produktseite, Teilen-Bild, Plakat, Teilen-Zählung. Jede Liste,
 * Karte, Zählung und Auswahl fragt IN_LISTEN_SICHTBAR, sonst stünde ein Testhof
 * auf /hoefe, der Startseite, in Region oder in der Sitemap.
 *
 * Geprüft am Syntaxbaum von TypeScript (Kommentare zählen nicht): jede Stelle
 * unter src/, an der der Name OEFFENTLICH_SICHTBAR als Wert vorkommt, samt
 * Funktion bzw. Konstante drumherum. Die Liste vergleicht gegen das
 * Dateisystem — eine neue Stelle steht mit Datei und Zeile in der Meldung.
 * Dazu: Die Listen-Abfragen der Freigabe nennen IN_LISTEN_SICHTBAR.
 * Gegenprobe: eine Attrappe mit einer neuen Liste schlägt an.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { describe, it, expect } from 'vitest'
import { IN_LISTEN_SICHTBAR, OEFFENTLICH_SICHTBAR } from '@/server/queries/farm'

const WURZEL = process.cwd()

/** Wege über einen direkten Link — nur hier darf OEFFENTLICH_SICHTBAR allein stehen. */
const DIREKTER_LINK: Record<string, string> = {
  'src/server/queries/farm.ts:getPublicFarm': 'Hofseite',
  'src/server/queries/farm.ts:IN_LISTEN_SICHTBAR': 'die zweite Stufe baut auf der ersten auf',
  'src/server/queries/seo.ts:hofIstOeffentlich': 'SEO und 404 der Hofseite',
  'src/server/queries/seo.ts:produktIstOeffentlich': 'SEO und 404 der Produktseite',
  'src/server/queries/teilen-bild.ts:ladeTeilenBildQuelle': 'Teilen-Bild',
  'src/server/queries/teilen-bild.ts:getPlakatDaten': 'Plakat',
  'src/server/teilen-zaehlung.ts:zaehleBesuchFuerSlug': 'Teilen-Zählung (Besuch über einen geteilten Link)',
  'src/app/api/status-image/[id]/route.tsx:GET': 'Beitragsbild über einen direkten Link (Nr. 178); einen Testhof sieht nur sein eigenes Konto',
}

/** Die Listen, Karten, Zählungen und Auswahlen der Freigabe (Nr. 119, Punkt 2) — jede nennt IN_LISTEN_SICHTBAR. */
const LISTEN = [
  'src/server/queries/farm.ts:getOeffentlicheHoefe',
  'src/server/queries/startseite.ts:hofSlugs',
  'src/server/queries/startseite.ts:ladeStartseiteAdmin',
  'src/server/actions/startseite.ts:speichereEntwurf',
  'src/server/queries/umfeld.ts:getUmfeld',
  'src/server/queries/futter-kaufen.ts:getFutterKaufen',
  'src/server/queries/seo.ts:SITEMAP_HOF',
]

type Stelle = { ort: string; zeile: number }

/** Der Name der Funktion oder Konstante, in der ein Knoten steht (die äußerste benannte). */
function umgebung(knoten: ts.Node): string {
  let name = '(Modul)'
  for (let k: ts.Node | undefined = knoten.parent; k; k = k.parent) {
    if ((ts.isFunctionDeclaration(k) || ts.isMethodDeclaration(k)) && k.name && ts.isIdentifier(k.name)) name = k.name.text
    else if (ts.isVariableDeclaration(k) && ts.isIdentifier(k.name)) name = k.name.text
  }
  return name
}

/** Jede Stelle, an der `name` als Wert vorkommt — ohne Import, ohne die eigene Deklaration, ohne Kommentare. */
function stellenVon(quelltext: string, datei: string, name: string): Stelle[] {
  const quelle = ts.createSourceFile(datei, quelltext, ts.ScriptTarget.Latest, true, datei.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const funde: Stelle[] = []
  const besuche = (k: ts.Node): void => {
    if (ts.isIdentifier(k) && k.text === name) {
      const eltern = k.parent
      const istImport = ts.isImportSpecifier(eltern) || ts.isImportClause(eltern) || ts.isExportSpecifier(eltern)
      const istDeklaration = ts.isVariableDeclaration(eltern) && eltern.name === k
      if (!istImport && !istDeklaration) {
        funde.push({ ort: `${datei}:${umgebung(k)}`, zeile: quelle.getLineAndCharacterOfPosition(k.getStart(quelle)).line + 1 })
      }
    }
    ts.forEachChild(k, besuche)
  }
  besuche(quelle)
  return funde
}

function dateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) return dateien(pfad)
    return /\.tsx?$/.test(name) ? [pfad] : []
  })
}

function alleStellen(name: string): Stelle[] {
  return dateien(join(WURZEL, 'src')).flatMap((pfad) => {
    const datei = relative(WURZEL, pfad).split('\\').join('/')
    const text = readFileSync(pfad, 'utf8')
    return text.includes(name) ? stellenVon(text, datei, name) : []
  })
}

describe('Wache: Listen fragen IN_LISTEN_SICHTBAR, nur direkte Links OEFFENTLICH_SICHTBAR', () => {
  it('OEFFENTLICH_SICHTBAR steht nur in den Wegen über einen direkten Link — eine neue Stelle steht mit Datei und Zeile da', () => {
    const fremd = alleStellen('OEFFENTLICH_SICHTBAR')
      .filter((s) => !(s.ort in DIREKTER_LINK))
      .map((s) => `${s.ort} (Zeile ${s.zeile})`)
    expect(fremd).toEqual([])
  }, 30_000) // liest jede Datei unter src/ und parst die mit dem Namen

  it('jeder genannte direkte Weg gibt es noch — eine verwaiste Ausnahme fällt auf', () => {
    const orte = new Set(alleStellen('OEFFENTLICH_SICHTBAR').map((s) => s.ort))
    expect(Object.keys(DIREKTER_LINK).filter((ort) => !orte.has(ort))).toEqual([])
  }, 30_000)

  it('jede Liste, Karte, Zählung und Auswahl der Freigabe nennt IN_LISTEN_SICHTBAR', () => {
    const orte = new Set(alleStellen('IN_LISTEN_SICHTBAR').map((s) => s.ort))
    expect(LISTEN.filter((ort) => !orte.has(ort))).toEqual([])
  }, 30_000)

  it('die zweite Stufe ist die erste plus „kein Testhof“ — nicht mehr, nicht weniger', () => {
    expect(IN_LISTEN_SICHTBAR).toEqual({ ...OEFFENTLICH_SICHTBAR, istTesthof: false })
  })

  it('Gegenprobe: eine neue Liste mit OEFFENTLICH_SICHTBAR schlägt mit Funktion und Zeile an, ein Kommentar und ein Import nicht', () => {
    const attrappe = [
      "import { OEFFENTLICH_SICHTBAR } from './farm'",
      '// OEFFENTLICH_SICHTBAR im Kommentar zählt nicht',
      'export async function neueListe() {',
      '  return prisma.farm.findMany({ where: { ...OEFFENTLICH_SICHTBAR } })',
      '}',
      'const KARTE = { where: OEFFENTLICH_SICHTBAR }',
    ].join('\n')
    expect(stellenVon(attrappe, 'src/x.ts', 'OEFFENTLICH_SICHTBAR')).toEqual([
      { ort: 'src/x.ts:neueListe', zeile: 4 },
      { ort: 'src/x.ts:KARTE', zeile: 6 },
    ])
    // Auch in einer Pfeilfunktion hinter cache(...) zählt die Konstante, der sie gehört.
    expect(stellenVon('export const lade = cache(async () => prisma.farm.findFirst({ where: OEFFENTLICH_SICHTBAR }))', 'src/y.ts', 'OEFFENTLICH_SICHTBAR')).toEqual([
      { ort: 'src/y.ts:lade', zeile: 1 },
    ])
  })
})
