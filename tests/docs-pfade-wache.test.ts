/**
 * Wache für Pfade in den Regeltexten (Regelvorschlag 141 b aus Morgenbericht 21 §5, freigegeben 22.10.2026;
 * Register G4, Ergänzung). Ursache: Ein Regeltext, der auf `tests/gibt-es-nicht.test.ts` zeigt, schickt den
 * nächsten Agenten ins Leere — und niemand merkt es, bis er danach sucht.
 *
 * Beweist (Textdateien, kein Netz): Jeder Pfad in Backticks in `docs/ai/*.md` (außer dem erzeugten
 * `BAUSTEINE.md`) und in `CLAUDE.md`, der mit `tests/`, `src/`, `scripts/`, `prisma/`, `.claude/` oder
 * `.github/` beginnt (dazu die Wurzeldateien in `WURZEL_DATEIEN`), zeigt auf eine Datei oder einen Ordner im
 * Repository.
 *
 * Gelesen wird so:
 *  - Ein Fund ist ein Backtick-Text ohne Leerzeichen. Ein Befehl (`pnpm vitest run tests/x.test.ts`) ist keiner.
 *  - Vorher fällt weg: eine Zeilenangabe (`:123`, `:12–20`) und Satzzeichen am Ende; eine schließende Klammer
 *    nur, wenn im Pfad keine öffnende zu ihr gehört (`src/app/(hof)` bleibt ganz). Klammern wie `(hof)` und
 *    `[farmSlug]` sind Teil des Pfads.
 *  - Ein Pfad mit `<` oder `>` ist ein Platzhalter und wird nicht geprüft. Ein Pfad mit `{a,b}` wird
 *    aufgefächert, jeder Zweig geprüft. Ein Pfad mit `*` ist ein Muster und muss auf mindestens eine Datei
 *    oder einen Ordner passen (`*` = ein Name, `**` = beliebig tief).
 *  - Gezählt werden verschiedene Pfade je Datei (derselbe Pfad in zwei Dateien zählt zweimal); der Bericht zu
 *    Nr. 147 nennt die Zahlen.
 *
 * `BESTAND` hält Funde, die bleiben dürfen — mit Grund, nur schrumpfen. Neue Einträge nur mit Freigabe.
 *
 * Gegenprobe (im Speicher): ein erfundener Pfad schlägt an; ein echter mit Zeilenangabe, ein Pfad mit Klammern
 * und ein Muster mit Treffer nicht; ein Muster ohne Treffer, ein Zweig ohne Datei schlagen an; ein Platzhalter
 * wird nicht geprüft.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const WURZEL = process.cwd()

const ANFAENGE = ['tests/', 'src/', 'scripts/', 'prisma/', '.claude/', '.github/']
/** Dateien im Wurzelordner, die Regeltexte nennen. */
const WURZEL_DATEIEN = ['eslint.config.mjs', 'vitest.config.ts', 'vitest.integration.config.ts', 'next.config.ts', 'package.json']
/** Ordner, die kein Teil des Repositorys sind (Pakete, Build, Git). */
const UEBERSPRINGEN = new Set(['node_modules', '.git', '.next', '.vercel'])

/** Funde, die bleiben dürfen: `datei: pfad` → Grund. Nur schrumpfen. */
const BESTAND: Record<string, string> = {}

type Urteil = 'ok' | 'fehlt' | 'nicht-geprueft'

/** Backtick-Texte ohne Leerzeichen, die wie ein Pfad des Repositorys beginnen — bereinigt (Zeile, Satzzeichen). */
function pfadeAusText(text: string): string[] {
  const funde = new Set<string>()
  for (const treffer of text.matchAll(/`([^`\n\s]+)`/g)) {
    let pfad = treffer[1]
    for (;;) {
      const vorher = pfad
      pfad = pfad.replace(/:\d+(?:[–-]\d+)?(?:ff)?$/, '')
      pfad = pfad.replace(/[.,;:!?]+$/, '')
      const zu = (pfad.match(/\)/g) ?? []).length
      const auf = (pfad.match(/\(/g) ?? []).length
      if (pfad.endsWith(')') && zu > auf) pfad = pfad.slice(0, -1)
      if (pfad === vorher) break
    }
    const beginnt = ANFAENGE.some((a) => pfad.startsWith(a)) || WURZEL_DATEIEN.includes(pfad)
    if (beginnt) funde.add(pfad)
  }
  return [...funde]
}

/** `a/{b,c}/d` → `a/b/d`, `a/c/d` (auch verschachtelt). */
function faechereAuf(pfad: string): string[] {
  const m = pfad.match(/\{([^{}]*)\}/)
  if (!m || m.index === undefined) return [pfad]
  return m[1].split(',').flatMap((zweig) => faechereAuf(pfad.slice(0, m.index) + zweig + pfad.slice((m.index ?? 0) + m[0].length)))
}

function musterZuRegex(muster: string): RegExp {
  const teile = muster.split('**').map((t) => t.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*'))
  return new RegExp(`^${teile.join('.*')}/?$`)
}

/** Alle Dateien und Ordner des Repositorys (relativ, mit `/`), ohne Pakete und Build. */
function alleEintraege(): string[] {
  const liste: string[] = []
  const gehe = (ordner: string): void => {
    for (const name of readdirSync(ordner)) {
      if (UEBERSPRINGEN.has(name)) continue
      const pfad = join(ordner, name)
      const rel = relative(WURZEL, pfad).split(sep).join('/')
      liste.push(rel)
      if (statSync(pfad).isDirectory()) gehe(pfad)
    }
  }
  gehe(WURZEL)
  return liste
}

/** Urteil über einen bereinigten Pfad; `eintraege` ist die Liste für Muster, `existiert` für feste Pfade. */
function urteile(pfad: string, eintraege: string[], existiert: (p: string) => boolean): Urteil {
  if (/[<>]/.test(pfad)) return 'nicht-geprueft'
  for (const zweig of faechereAuf(pfad)) {
    if (zweig.includes('*')) {
      const regex = musterZuRegex(zweig)
      if (!eintraege.some((e) => regex.test(e))) return 'fehlt'
    } else if (!existiert(zweig)) return 'fehlt'
  }
  return 'ok'
}

function regeltexte(): string[] {
  const ordner = join(WURZEL, 'docs/ai')
  const md = readdirSync(ordner)
    .filter((n) => n.endsWith('.md') && n !== 'BAUSTEINE.md')
    .map((n) => `docs/ai/${n}`)
  return [...md.sort(), 'CLAUDE.md']
}

describe('Pfade in den Regeltexten zeigen auf Dateien, die es gibt', () => {
  it('jeder Pfad und jedes Muster in docs/ai/*.md und CLAUDE.md trifft eine Datei oder einen Ordner', () => {
    // Läuft über das ganze Repository (TESTING_GUIDELINES §4: Zeitgrenze 30_000 an genau diesem it).
    const eintraege = alleEintraege()
    const menge = new Set(eintraege)
    const existiert = (p: string): boolean => menge.has(p.replace(/\/$/, '')) || existsSync(join(WURZEL, p))
    let pfade = 0
    let muster = 0
    const fehlend: string[] = []
    for (const datei of regeltexte()) {
      for (const pfad of pfadeAusText(readFileSync(join(WURZEL, datei), 'utf8'))) {
        if (!/[<>]/.test(pfad)) {
          pfade += 1
          if (/[*{]/.test(pfad)) muster += 1
        }
        if (urteile(pfad, eintraege, existiert) === 'fehlt' && !(`${datei}: ${pfad}` in BESTAND)) fehlend.push(`${datei}: ${pfad}`)
      }
    }
    // Nicht blind: Die Wache sah viele Pfade und einige Muster.
    expect(pfade).toBeGreaterThan(400)
    expect(muster).toBeGreaterThan(5)
    expect(fehlend).toEqual([])
  }, 30_000)

  it('jeder Eintrag des Bestands steht noch in seiner Datei und zeigt weiter ins Leere', () => {
    const eintraege = alleEintraege()
    const existiert = (p: string): boolean => existsSync(join(WURZEL, p))
    for (const schluessel of Object.keys(BESTAND)) {
      const [datei, pfad] = schluessel.split(': ')
      expect(pfadeAusText(readFileSync(join(WURZEL, datei), 'utf8')), schluessel).toContain(pfad)
      expect(urteile(pfad, eintraege, existiert), schluessel).toBe('fehlt')
    }
  }, 30_000)
})

describe('Pfade in den Regeltexten — Gegenprobe: die Erkennung schlägt an', () => {
  const eintraege = ['tests/a.test.ts', 'src/app/(hof)/products/page.tsx', 'src/app/(hof)/products', 'src/app', 'src', 'tests']
  const existiert = (p: string): boolean => eintraege.includes(p)
  const urteil = (text: string): Urteil[] => pfadeAusText(text).map((p) => urteile(p, eintraege, existiert))

  it('ein erfundener Pfad fehlt', () => {
    expect(urteil('Siehe `tests/gibt-es-nicht.test.ts`.')).toEqual(['fehlt'])
  })

  it('ein echter Pfad mit Zeilenangabe, Satzzeichen und Klammern ist in Ordnung', () => {
    expect(urteil('`src/app/(hof)/products/page.tsx:52`')).toEqual(['ok'])
    expect(urteil('`src/app/(hof)/products/page.tsx:52–60`')).toEqual(['ok'])
    expect(urteil('(siehe `tests/a.test.ts`), dann `tests/a.test.ts.`')).toEqual(['ok'])
    expect(pfadeAusText('(`src/app/(hof)`)')).toEqual(['src/app/(hof)'])
    expect(pfadeAusText('`src/app/(hof)`.')).toEqual(['src/app/(hof)'])
    // Zeilenangabe hinter dem Satzzeichen, auch mit „ff“.
    expect(urteil('`tests/a.test.ts:12.`')).toEqual(['ok'])
    expect(pfadeAusText('`src/app/(hof)/products/page.tsx:345ff.`')).toEqual(['src/app/(hof)/products/page.tsx'])
  })

  it('ein Muster braucht einen Treffer, ein aufgefächerter Zweig auch', () => {
    expect(urteil('`tests/*.test.ts`')).toEqual(['ok'])
    expect(urteil('`src/**/page.tsx`')).toEqual(['ok'])
    expect(urteil('`tests/*.gibts-nicht.ts`')).toEqual(['fehlt'])
    expect(urteil('`tests/{a,b}.test.ts`')).toEqual(['fehlt'])
    expect(urteil('`tests/{a,a}.test.ts`')).toEqual(['ok'])
  })

  it('ein Platzhalter wird nicht geprüft, ein Befehl und ein fremder Anfang auch nicht', () => {
    expect(urteil('`tests/<datei>.test.ts`')).toEqual(['nicht-geprueft'])
    expect(pfadeAusText('`pnpm vitest run tests/gibt-es-nicht.test.ts`')).toEqual([])
    expect(pfadeAusText('`docs/gibt-es-nicht.md`')).toEqual([])
    expect(pfadeAusText('`package.json`')).toEqual(['package.json'])
  })
})
