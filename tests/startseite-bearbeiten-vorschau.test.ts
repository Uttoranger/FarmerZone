/**
 * Admin › Startseite: die Vorschau bleibt beim Bearbeiten eines Blocks
 * sichtbar (Register N16, Ergänzung 23.10.2026; Nr. 155).
 *
 * Ohne DOM (TESTING_GUIDELINES §1): die Regel als reine Funktion, die Seite
 * per renderToStaticMarkup (Actions, Router und Breite sind Attrappen, der
 * Entwurf ist fest gestellt), der Aufbau als Wache über den Syntaxbaum.
 *
 * Beweist:
 *  - vorschauHinweis: ein neuer, ungültiger Block steht „Noch nicht in der
 *    Vorschau“, mit dem Satz der Prüfung; ein Fehler der letzten Speicherung
 *    geht vor; ein gespeicherter offener Block braucht keinen Hinweis (er
 *    steht unabhängig vom Zeitraum da). Nach „Fertig“: später live → „ist an
 *    diesem Tag nicht zu sehen – live ab …“, heute live → nichts, kein Block →
 *    nichts.
 *  - Ab 1024 px mit offenem Block: Formular UND „So sieht’s die Kundin“ im
 *    HTML, und die Vorschau bekommt die Kennung des Blocks; ohne offenen Block
 *    die Liste und die Vorschau, kein Formular.
 *  - StartseiteVorschau steht für ab 1024 px genau einmal, in keinem Zweig,
 *    der vom offenen Block abhängt, ohne `key` — der heutige Aufbau
 *    (`blockOffen ? <BlockFormular/> : breit && vorschau`) schlägt an.
 */
import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const stand = vi.hoisted(() => ({
  block: null as null | Record<string, unknown>,
  fehler: null as string | null,
  vorschauProps: [] as Record<string, unknown>[],
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {}, push() {}, replace() {} }) }))
vi.mock('next/image', () => ({ default: (p: { src: string; alt: string }) => createElement('img', { src: p.src, alt: p.alt }) }))
vi.mock('@/server/actions/startseite', () => ({
  loescheStartseitenBlock: vi.fn(),
  speichereEntwurf: vi.fn(),
  uebernehmeFassungAlsEntwurf: vi.fn(),
  veroeffentlicheStartseite: vi.fn(),
  zieheFassungZurueck: vi.fn(),
  erzeugeStartseitenVorschau: vi.fn(),
}))
// Ab 1024 px: Auf dem Server gilt sonst immer „schmal“.
vi.mock('@/lib/use-mindestbreite', () => ({ useMindestbreite: () => true, useSchmalerAls: () => false }))
// Die echte Vorschau rendert — der Test merkt sich nur, was sie bekommt.
vi.mock('@/components/admin/startseite-vorschau', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@/components/admin/startseite-vorschau')>()
  return {
    ...echt,
    StartseiteVorschau: (p: Parameters<typeof echt.StartseiteVorschau>[0]) => {
      stand.vorschauProps.push(p as Record<string, unknown>)
      return createElement(echt.StartseiteVorschau, p)
    },
  }
})
// Der Entwurf, wie ihn der Hook gerade hielte: mit oder ohne offenen Block.
vi.mock('@/components/admin/startseite-entwurf', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@/components/admin/startseite-entwurf')>()
  return {
    ...echt,
    useStartseitenEntwurf: ({ start }: { start: readonly unknown[] }) => ({
      zeilen: [...start],
      block: stand.block,
      stand: stand.fehler ? { art: 'fehler', text: stand.fehler } : { art: 'ruhe' },
      speicherungen: 0,
      aenderungen: [],
      aendereZeilen: vi.fn(),
      aendereBlock: vi.fn(),
      oeffneBlock: vi.fn(),
      setzeZurueck: vi.fn(),
      blockGeloescht: vi.fn(),
      speichereSofort: vi.fn(async () => true),
    }),
  }
})

import { StartseiteGestalten } from '@/components/admin/startseite-gestalten'
import { neueBlockWerte, type BlockWerte } from '@/components/admin/startseite-entwurf'
import { ADMIN_STARTSEITE_TEXT as T, STANDARD_REIHENFOLGE } from '@/lib/startseite-gestalten'
import { ENTWURF_TEXT, terminText, vorschauHinweis } from '@/lib/startseite-fassung'
import { STARTSEITE_SAETZE } from '@/schemas/startseite'
import type { AdminStartseite, AdminStartseitenZeile } from '@/server/queries/startseite'

/** Donnerstag, 15. Oktober 2026, 20:30 in Wien. */
const JETZT = new Date('2026-10-15T18:30:00.000Z')
const NAECHSTE_WOCHE = '2026-10-22T07:00:00.000Z'

// ─── Die Regel ──────────────────────────────────────────────────────────────

describe('vorschauHinweis', () => {
  const titelFehlt = 'Bitte gib einen Titel ein.'

  it('ein neuer, ungültiger Block: „Noch nicht in der Vorschau“ mit dem Satz der Prüfung', () => {
    const text = vorschauHinweis({ offen: { neu: true, pruefung: titelFehlt, fehler: null }, geschlossen: null, tag: JETZT })
    expect(text).toBe(ENTWURF_TEXT.nochNichtInVorschau(titelFehlt))
    expect(text).toBe(`Noch nicht in der Vorschau: ${titelFehlt}`)
  })

  it('der Fehler der letzten Speicherung geht vor — derselbe Satz wie im Formular, auch bei einem gespeicherten Block', () => {
    expect(vorschauHinweis({ offen: { neu: false, pruefung: titelFehlt, fehler: 'Wir konnten nicht speichern.' }, geschlossen: null, tag: JETZT })).toBe(
      'Noch nicht in der Vorschau: Wir konnten nicht speichern.'
    )
  })

  it('ein gespeicherter offener Block ohne Fehler steht da, egal wann er live ist — kein Hinweis', () => {
    // Gegenprobe zur ersten Zeile: derselbe Prüfsatz, aber nicht neu und ohne Fehler der Speicherung.
    expect(vorschauHinweis({ offen: { neu: false, pruefung: titelFehlt, fehler: null }, geschlossen: null, tag: JETZT })).toBeNull()
    expect(vorschauHinweis({ offen: { neu: true, pruefung: null, fehler: null }, geschlossen: null, tag: JETZT })).toBeNull()
  })

  it('nach „Fertig“: ein Block, der erst später live ist, „ist an diesem Tag nicht zu sehen – live ab …“', () => {
    const geschlossen = { titel: 'Kürbiszeit', liveAb: NAECHSTE_WOCHE, liveBis: null }
    const text = vorschauHinweis({ offen: null, geschlossen, tag: JETZT })
    expect(text).toBe(`„Kürbiszeit“ ist an diesem Tag nicht zu sehen – live ab ${terminText(new Date(NAECHSTE_WOCHE))}.`)
    expect(text).toMatch(/live ab Do,\s22\.\sOkt,\s09:00\.$/)
    // am Tag des Beginns ist er zu sehen
    expect(vorschauHinweis({ offen: null, geschlossen, tag: new Date(NAECHSTE_WOCHE) })).toBeNull()
  })

  it('nach „Fertig“: ein Block, der heute live ist, braucht keinen Hinweis; kein Block, kein Tag → nichts', () => {
    expect(vorschauHinweis({ offen: null, geschlossen: { titel: 'Kürbiszeit', liveAb: '2026-10-01T00:00:00.000Z', liveBis: null }, tag: JETZT })).toBeNull()
    expect(vorschauHinweis({ offen: null, geschlossen: null, tag: JETZT })).toBeNull()
    expect(vorschauHinweis({ offen: null, geschlossen: { titel: 'Kürbiszeit', liveAb: NAECHSTE_WOCHE, liveBis: null }, tag: null })).toBeNull()
  })

  it('nach „Fertig“: ein Block, der am Tag schon vorbei ist, sagt das statt „live ab“', () => {
    const vorbei = { titel: 'Spargel', liveAb: '2026-05-01T00:00:00.000Z', liveBis: '2026-06-01T00:00:00.000Z' }
    expect(vorschauHinweis({ offen: null, geschlossen: vorbei, tag: JETZT })).toBe(
      `„Spargel“ ist an diesem Tag nicht zu sehen – live bis ${terminText(new Date(vorbei.liveBis))}.`
    )
  })

  it('ein offener Block geht vor dem eben geschlossenen', () => {
    const geschlossen = { titel: 'Kürbiszeit', liveAb: NAECHSTE_WOCHE, liveBis: null }
    expect(vorschauHinweis({ offen: { neu: false, pruefung: null, fehler: null }, geschlossen, tag: JETZT })).toBeNull()
  })
})

// ─── Die Seite ──────────────────────────────────────────────────────────────

const ZEILEN: AdminStartseitenZeile[] = STANDARD_REIHENFOLGE.map((art) => ({ id: `z-${art.toLowerCase()}`, art, sichtbar: true, block: null }))
const DATEN: AdminStartseite = { zeilen: ZEILEN, hoefe: [], live: null, geplant: [], frueher: [] }

function seite(block: BlockWerte | null, fehler: string | null = null): string {
  stand.block = block
  stand.fehler = fehler
  stand.vorschauProps = []
  return renderToStaticMarkup(createElement(StartseiteGestalten, { daten: DATEN, jetzt: JETZT.toISOString() }))
}

const GESPEICHERT: BlockWerte = { ...neueBlockWerte('SAISONKARTE', JETZT), zeilenId: 'z-block', id: 'block-7', titel: 'Kürbiszeit' }

describe('Admin › Startseite ab 1024 px', () => {
  it('mit offenem Block: Formular links UND „So sieht’s die Kundin“ — die Vorschau bekommt die Kennung des Blocks', () => {
    const html = seite(GESPEICHERT)
    expect(html).toContain(T.blockBearbeiten)
    expect(html).toContain(`>${T.fertig}<`)
    expect(html).toContain(T.kundin)
    expect(html).toContain('id="kundin-titel"')
    // Die Liste steht an Stelle des Formulars nur unter 1024 px (lg:hidden).
    expect(html).toMatch(/class="[^"]*lg:hidden[^"]*"><section aria-labelledby="abschnitte-titel"/)
    expect(stand.vorschauProps.filter((p) => p.quelle === undefined)).toHaveLength(1)
    // Von der Prop an den Aufruf von erzeugeStartseitenVorschau ({ blockEntwurfId: 'block-7' }): der Fall
    // „bei offenem Block geht blockEntwurfId an die Action“ in tests/startseite-vorschau-neuladen.test.ts
    // führt den Effekt im Prüfstand aus (renderToStaticMarkup führt keine Effekte aus).
    expect(stand.vorschauProps[0]).toMatchObject({ blockEntwurfId: 'block-7' })
    expect(html).not.toContain('Noch nicht in der Vorschau')
    // Die Live-Region steht leer schon da (sonst sagt ein Screenreader den ersten Hinweis nicht an).
    expect(html).toMatch(/<p role="status" class="[^"]*text-status-offen[^"]*-mt-3"><\/p>/)
  })

  it('Gegenprobe ohne offenen Block: Liste und Vorschau, kein Formular, keine Kennung', () => {
    const html = seite(null)
    expect(html).not.toContain(T.blockBearbeiten)
    expect(html).not.toContain(T.blockNeu)
    expect(html).toContain(T.kundin)
    expect(html).toMatch(/<div class="flex w-full shrink-0 flex-col gap-3 lg:w-\[480px\]"><section aria-labelledby="abschnitte-titel"/)
    expect(stand.vorschauProps[0]).toMatchObject({ blockEntwurfId: null })
  })

  it('ein neuer Block ohne Titel: unter der Vorschau „Noch nicht in der Vorschau“ mit dem Satz der Prüfung', () => {
    const html = seite({ ...neueBlockWerte('SAISONKARTE', JETZT) })
    expect(html).toContain(T.blockNeu)
    expect(html).toContain(T.kundin)
    expect(html).toContain(ENTWURF_TEXT.nochNichtInVorschau(STARTSEITE_SAETZE.titel))
    // Der Satz steht IN der Live-Region, die auch ohne Hinweis da wäre — ohne den Ausgleich -mt-3.
    expect(html).toMatch(/<p role="status" class="[^"]*text-status-offen"><svg[^]*?Noch nicht in der Vorschau/)
  })

  it('ein gespeicherter Block mit Fehler der Speicherung: derselbe Satz unter der Vorschau wie im Formular', () => {
    const html = seite(GESPEICHERT, 'Der Link muss mit / beginnen.')
    expect(html).toContain(ENTWURF_TEXT.nochNichtInVorschau('Der Link muss mit / beginnen.'))
  })
})

// ─── Der Aufbau als Wache ───────────────────────────────────────────────────

const OFFEN = /\bblockOffen\b|\bentwurf\.block\b/

/** Die Bedingungen über einem Knoten bis zur Funktion: Bedingung von `?:`, linke Seite von `&&`/`||`, `if`. */
function bedingungen(knoten: ts.Node, datei: ts.SourceFile): string[] {
  const funde: string[] = []
  for (let k: ts.Node = knoten; k.parent && !ts.isFunctionLike(k); k = k.parent) {
    const p = k.parent
    if (ts.isConditionalExpression(p) && k !== p.condition) funde.push(p.condition.getText(datei))
    if (ts.isBinaryExpression(p) && k === p.right && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken].includes(p.operatorToken.kind)) {
      funde.push(p.left.getText(datei))
    }
    if (ts.isIfStatement(p) && k !== p.expression) funde.push(p.expression.getText(datei))
  }
  return funde
}

/** Trägt ein JSX-Element über dem Knoten (bis zur Funktion) ein `key`? */
function keyDarueber(knoten: ts.Node, datei: ts.SourceFile): boolean {
  for (let k: ts.Node | undefined = knoten; k && !ts.isFunctionLike(k); k = k.parent) {
    const oeffnend = ts.isJsxElement(k) ? k.openingElement : ts.isJsxSelfClosingElement(k) ? k : null
    if (oeffnend?.attributes.properties.some((a) => ts.isJsxAttribute(a) && a.name.getText(datei) === 'key')) return true
  }
  return false
}

/**
 * Wo die Vorschau des Entwurfs (StartseiteVorschau ohne feste `quelle`) in der Seite steht — direkt oder
 * über eine Konstante (`const vorschau = <StartseiteVorschau …/>`): je Stelle die Bedingungen darüber und ob
 * ein `key` darüber hängt.
 */
function stellenDerVorschau(quelltext: string): { bedingungen: string[]; key: boolean }[] {
  const datei = ts.createSourceFile('seite.tsx', quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const elemente: ts.JsxSelfClosingElement[] = []
  const besuche = (k: ts.Node): void => {
    if (
      ts.isJsxSelfClosingElement(k) &&
      k.tagName.getText(datei) === 'StartseiteVorschau' &&
      !k.attributes.properties.some((a) => ts.isJsxAttribute(a) && a.name.getText(datei) === 'quelle')
    ) {
      elemente.push(k)
    }
    ts.forEachChild(k, besuche)
  }
  besuche(datei)
  const stellen: { bedingungen: string[]; key: boolean }[] = []
  for (const element of elemente) {
    const eigenerKey = element.attributes.properties.some((a) => ts.isJsxAttribute(a) && a.name.getText(datei) === 'key')
    const deklaration = element.parent && ts.isParenthesizedExpression(element.parent) ? element.parent.parent : element.parent
    if (deklaration && ts.isVariableDeclaration(deklaration) && ts.isIdentifier(deklaration.name)) {
      const name = deklaration.name.text
      const nutzungen = (k: ts.Node): void => {
        if (ts.isIdentifier(k) && k.text === name && k !== deklaration.name && !ts.isPropertyAccessExpression(k.parent)) {
          stellen.push({ bedingungen: bedingungen(k, datei), key: eigenerKey || keyDarueber(k, datei) })
        }
        ts.forEachChild(k, nutzungen)
      }
      nutzungen(datei)
    } else {
      stellen.push({ bedingungen: bedingungen(element, datei), key: eigenerKey || keyDarueber(element, datei) })
    }
  }
  return stellen
}

/** Die Stellen, die ab 1024 px gelten: unter `breit`, nicht unter `!breit`. */
function abBreit(stellen: { bedingungen: string[]; key: boolean }[]): { bedingungen: string[]; key: boolean }[] {
  return stellen.filter((s) => s.bedingungen.some((b) => /\bbreit\b/.test(b)) && !s.bedingungen.some((b) => /!breit\b/.test(b)))
}

function pruefeAufbau(quelltext: string): string[] {
  const breit = abBreit(stellenDerVorschau(quelltext))
  const fehler: string[] = []
  if (breit.length !== 1) fehler.push(`ab 1024 px ${breit.length}-mal statt genau einmal`)
  for (const s of breit) {
    if (s.bedingungen.some((b) => OFFEN.test(b))) fehler.push(`in einem Zweig des offenen Blocks: ${s.bedingungen.join(' / ')}`)
    if (s.key) fehler.push('mit key')
  }
  return fehler
}

describe('Wache: die Vorschau steht ab 1024 px an genau einer Stelle (Nr. 155)', () => {
  it('Gegenprobe: der Aufbau vor Nr. 155 — das Formular ersetzt die Vorschau — schlägt an', () => {
    const vorher = [
      'export function S() {',
      '  const vorschau = (<StartseiteVorschau blockEntwurfId={entwurf.block?.id ?? null} />)',
      '  return (<div>',
      '    <div>{blockOffen ? (<><BlockFormular /><Bibliothek /></>) : (breit && vorschau)}</div>',
      '    {!breit && <VorschauFenster>{vorschauOffen && vorschau}</VorschauFenster>}',
      '  </div>)',
      '}',
    ].join('\n')
    expect(pruefeAufbau(vorher)).toEqual(['in einem Zweig des offenen Blocks: breit / blockOffen'])
  })

  it('Gegenprobe: ein key, der mit dem Block wechselt, und eine zweite Stelle schlagen an', () => {
    const mitKey = 'export function S() { const vorschau = <StartseiteVorschau />; return <div>{breit && <div key={blockOffen ? "a" : "b"}>{vorschau}</div>}</div> }'
    expect(pruefeAufbau(mitKey)).toEqual(['mit key'])
    const doppelt = 'export function S() { return <div>{breit && <StartseiteVorschau />}{breit && entwurf.block && <StartseiteVorschau />}</div> }'
    expect(pruefeAufbau(doppelt)).toEqual(['ab 1024 px 2-mal statt genau einmal', 'in einem Zweig des offenen Blocks: breit && entwurf.block'])
  })

  it('in startseite-gestalten.tsx steht sie genau einmal, außerhalb jedes Zweigs des offenen Blocks, ohne key', () => {
    const quelle = readFileSync(join(process.cwd(), 'src/components/admin/startseite-gestalten.tsx'), 'utf8')
    expect(pruefeAufbau(quelle)).toEqual([])
    // Die Fassungen im Zeitplan (feste `quelle`) zählen nicht mit; die Vorschau am Handy steht unter `!breit`.
    expect(stellenDerVorschau(quelle).length).toBe(2)
  })
})
