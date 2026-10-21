/**
 * Wache: `pnpm lint` nutzt den ESLint-Cache mit Inhaltsvergleich; die CI prüft immer ohne Cache
 * (Tempo der Werkzeuge, 21.10.2026).
 *
 * Ursache: Ohne Cache prüfte jeder Aufruf von `pnpm lint` alle Dateien neu – vor jedem Commit, im Stop-Hook
 * und in jeder Runde eines Nachtlaufs (Messwerte in DEVELOPMENT.md, „Tempo der Werkzeuge“).
 *
 * Beweist:
 *  - Das Skript `lint` in package.json ruft ESLint mit `--cache`, `--cache-strategy content` und dem Ordner
 *    `node_modules/.cache/eslint/` auf. `content` statt des Standards `metadata`: Worktrees und Checkouts setzen
 *    die Änderungszeit der Dateien neu, mit `metadata` prüfte ESLint dann wieder alles.
 *  - Kein Workflow in .github/workflows/ stellt einen Cache unter node_modules wieder her (keine Aktion
 *    `actions/cache…` mit einem Pfad in node_modules): Die CI prüft immer frisch. `setup-node` mit `cache: pnpm`
 *    speichert nur den Paketspeicher von pnpm, nicht node_modules, und bleibt erlaubt.
 *  - Gegenprobe: Ein Lint-Skript ohne Cache, mit `metadata` oder mit anderem Ordner schlägt an, ebenso ein
 *    Workflow-Schritt mit `actions/cache` oder `actions/cache/restore` auf node_modules/.cache, auch als
 *    mehrzeiliger Pfad.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { leseYaml } from './yaml-lader'

const CACHE_ORDNER = 'node_modules/.cache/eslint/'
const WORKFLOWS = '.github/workflows'

/** Befunde zum Lint-Skript. Leer = ESLint mit Cache, Inhaltsvergleich und dem Ordner in node_modules. */
function pruefeLintSkript(skript: string): string[] {
  const teile = skript.trim().split(/\s+/)
  const wertNach = (schalter: string): string | undefined => {
    const i = teile.indexOf(schalter)
    return i === -1 ? undefined : teile[i + 1]
  }
  const befunde: string[] = []
  if (teile[0] !== 'eslint') befunde.push(`lint ruft nicht ESLint auf: „${skript}“`)
  if (!teile.includes('--cache')) befunde.push('lint ohne --cache')
  if (wertNach('--cache-strategy') !== 'content') befunde.push('lint ohne --cache-strategy content')
  if (wertNach('--cache-location') !== CACHE_ORDNER) befunde.push(`lint ohne --cache-location ${CACHE_ORDNER}`)
  return befunde
}

type Schritt = { uses?: unknown; with?: { path?: unknown } }

/** Alle Schritte einer Workflow-Datei mit ihrem Job. */
function schritteVon(text: string): { job: string; schritt: Schritt }[] {
  const workflow = leseYaml(text) as { jobs?: Record<string, { steps?: Schritt[] }> } | null
  return Object.entries(workflow?.jobs ?? {}).flatMap(([job, inhalt]) =>
    (inhalt.steps ?? []).map((schritt) => ({ job, schritt })),
  )
}

/** Befunde „<datei> – <job> …“ für jeden Schritt, der einen Cache unter node_modules wiederherstellt. */
function pruefeWorkflowCache(datei: string, text: string): string[] {
  return schritteVon(text).flatMap(({ job, schritt }) => {
    if (typeof schritt.uses !== 'string' || !schritt.uses.startsWith('actions/cache')) return []
    const pfade = String(schritt.with?.path ?? '').split(/\r?\n/)
    return pfade.some((pfad) => pfad.includes('node_modules'))
      ? [`${datei} – Job ${job}: ${schritt.uses} stellt einen Cache unter node_modules wieder her`]
      : []
  })
}

const PAKET = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
  scripts: Record<string, string>
}
const WORKFLOW_DATEIEN = readdirSync(join(process.cwd(), WORKFLOWS))
  .filter((name) => /\.ya?ml$/.test(name))
  .sort()

describe('Lint-Cache – lokal mit Inhaltsvergleich, in der CI nie wiederhergestellt', () => {
  it('das Skript lint nutzt den Cache mit content-Strategie in node_modules/.cache/eslint/', () => {
    expect(pruefeLintSkript(PAKET.scripts.lint)).toEqual([])
  })

  it('kein Workflow stellt einen Cache unter node_modules wieder her', () => {
    expect(WORKFLOW_DATEIEN).toContain('ci.yml')
    // Die Wache läuft nicht ins Leere: In ci.yml liest sie die Schritte, darunter setup-node.
    const ci = schritteVon(readFileSync(join(process.cwd(), WORKFLOWS, 'ci.yml'), 'utf8'))
    expect(ci.some(({ schritt }) => String(schritt.uses).startsWith('actions/setup-node'))).toBe(true)
    const befunde = WORKFLOW_DATEIEN.flatMap((name) =>
      pruefeWorkflowCache(`${WORKFLOWS}/${name}`, readFileSync(join(process.cwd(), WORKFLOWS, name), 'utf8')),
    )
    expect(befunde).toEqual([])
  })

  it('Gegenprobe: ein Lint-Skript ohne Cache, mit metadata oder mit anderem Ordner schlägt an', () => {
    expect(pruefeLintSkript('eslint')).toHaveLength(3)
    expect(pruefeLintSkript(`eslint --cache --cache-strategy metadata --cache-location ${CACHE_ORDNER}`)).toEqual([
      'lint ohne --cache-strategy content',
    ])
    expect(pruefeLintSkript('eslint --cache --cache-strategy content --cache-location .eslintcache')).toEqual([
      `lint ohne --cache-location ${CACHE_ORDNER}`,
    ])
  })

  it('Gegenprobe: actions/cache auf node_modules/.cache schlägt an, setup-node mit cache: pnpm nicht', () => {
    const text = [
      'jobs:',
      '  pruefen:',
      '    steps:',
      '      - uses: actions/setup-node@v4',
      '        with:',
      '          cache: pnpm',
      '      - uses: actions/cache@v4',
      '        with:',
      '          path: node_modules/.cache',
      '          key: lint',
      '      - uses: actions/cache/restore@v4',
      '        with:',
      '          path: |',
      '            ~/.npm',
      '            node_modules/.cache/eslint/',
      '          key: lint',
    ].join('\n')
    expect(pruefeWorkflowCache('probe.yml', text)).toEqual([
      'probe.yml – Job pruefen: actions/cache@v4 stellt einen Cache unter node_modules wieder her',
      'probe.yml – Job pruefen: actions/cache/restore@v4 stellt einen Cache unter node_modules wieder her',
    ])
  })
})
