/**
 * Workflow-Wache (CLAUDE.md §2: nur `pull_request`, nie `pull_request_target`).
 *
 * Ursache: `pull_request_target` läuft mit den Rechten und Geheimnissen des Basis-Branchs, auch für
 * Änderungen aus fremden Forks — in einem öffentlichen Repository öffnet das jedem die Tür. Bisher
 * prüfte nur `tests/staging-workflow.test.ts` EINE Datei; jeder neue Workflow blieb ungeprüft.
 *
 * Beweist (Dateiarbeit, kein Netz): Keine Datei unter `.github/workflows/` (`*.yml`, `*.yaml`) nennt
 * `pull_request_target` — als Auslöser in jeder Schreibweise (Schlüssel, Liste, Textform) oder sonstwo
 * im Code. Eine Kommentarzeile darf von der Regel erzählen. Dass die Wache etwas liest, sichert der
 * Fund der bekannten Datei `ci.yml`.
 *
 * Gegenprobe: Text-Attrappen mit dem verbotenen Auslöser in jeder Schreibweise schlagen an, die erlaubte
 * Form (`pull_request`) und ein Kommentar nicht — keine Datei im Repository wird dafür verändert.
 *
 * Nr. 127 (Register G3): Die Auslöser von `ci.yml` stehen genau so da — Push nur auf main, Pull Requests
 * auf main, `integration/**`, `docs/**` und `nacht/**` (damit gestapelte PRs die CI bekommen) —, die
 * Gruppe bricht nur Läufe eines PRs ab, nie auf main, und beide Jobs haben eine Zeitgrenze. Gelesen mit einem
 * echten YAML-Parser (`tests/yaml-lader.ts`); die Gegenprobe wandelt den echten Text ab.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { leseYaml } from './yaml-lader'

const ORDNER = join(process.cwd(), '.github/workflows')
const VERBOTEN = /pull_request_target/

/** Die Zeilen ohne Kommentare — ein Kommentar darf von der Regel erzählen, ohne sie zu brechen. */
function ohneKommentare(text: string): string {
  return text
    .split('\n')
    .map((zeile) => (/^\s*#/.test(zeile) ? '' : zeile.replace(/\s+#.*$/, '')))
    .join('\n')
}

/** Verstöße eines Workflow-Texts gegen die Regel. Leer = in Ordnung. */
function pruefeWorkflow(text: string): string[] {
  return VERBOTEN.test(ohneKommentare(text)) ? ['pull_request_target'] : []
}

const workflows = readdirSync(ORDNER)
  .filter((name) => /\.ya?ml$/.test(name))
  .map((name) => ({ name, text: readFileSync(join(ORDNER, name), 'utf8') }))

describe('Workflow-Wache — nie pull_request_target', () => {
  it('liest die Workflows des Repositories (nicht leer, ci.yml dabei)', () => {
    expect(workflows.map((w) => w.name)).toContain('ci.yml')
  })

  for (const { name, text } of workflows) {
    it(`${name} löst nie über pull_request_target aus`, () => {
      expect(pruefeWorkflow(text)).toEqual([])
    })
  }
})

describe('Workflow-Wache — Gegenprobe: die Prüfung schlägt an', () => {
  const als = (ausloeser: string): string => `name: Attrappe\non:\n${ausloeser}\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ok\n`

  it('findet den verbotenen Auslöser als Schlüssel, in einer Liste, in der Kurzform und neben dem erlaubten', () => {
    for (const text of [
      als('  pull_request_target:\n    branches: [main]'),
      als('  push:\n    branches: [main]\n  pull_request_target:'),
      'on: pull_request_target\njobs: {}\n',
      'on: [push, pull_request_target]\njobs: {}\n',
      'on:\n  pull_request_target: # Rechte des Basis-Branchs\n    types: [opened]\n',
      'on: { pull_request_target: { types: [opened] } }\n',
      'on: pull_request\njobs:\n  a:\n    steps:\n      - run: echo pull_request_target\n',
    ]) {
      expect(pruefeWorkflow(text), text).toEqual(['pull_request_target'])
    }
  })

  it('lässt die erlaubte Form und Kommentare über die Regel stehen', () => {
    for (const text of [
      als('  pull_request:\n    branches: [main]'),
      als('  push:\n    branches: [main]\n  pull_request:'),
      '# nie pull_request_target: Das liefe mit den Rechten des Basis-Branchs\non: pull_request\njobs: {}\n',
      'on: pull_request # nicht pull_request_target\njobs: {}\n',
      '',
    ]) {
      expect(pruefeWorkflow(text), text).toEqual([])
    }
  })
})

// ─── Nr. 127: Auslöser, Gruppe und Zeitgrenzen von ci.yml (Register G3) ─────────────────────────────

const PULL_REQUEST_BASEN = ['main', 'integration/**', 'docs/**', 'nacht/**']
const CI_GRUPPE = 'ci-${{ github.event.pull_request.number || github.sha }}'
const CI_ABBRUCH = "${{ github.event_name == 'pull_request' }}"
/**
 * Die Schranke für `timeout-minutes` je Job, nicht der Sollwert: 30. Die Werte in ci.yml (20 und 15) sind rund das
 * Dreifache des längsten Laufs der letzten 25 (ci 6,1 Minuten, integration 4,5). Darüber ist die Zeitgrenze kein Schutz
 * mehr vor einem hängenden Lauf (GitHub-Vorgabe: 360 Minuten) — wer sie über 30 hebt, stößt hier an und klärt zuerst,
 * warum der Lauf so lange braucht.
 */
const MAX_TIMEOUT_MINUTEN = 30

const alsObjekt = (wert: unknown): Record<string, unknown> | null =>
  typeof wert === 'object' && wert !== null && !Array.isArray(wert) ? (wert as Record<string, unknown>) : null

/** Verstöße von ci.yml gegen die Regel für Auslöser, Gruppe und Zeitgrenzen. Leer = in Ordnung. */
function pruefeCi(text: string): string[] {
  let dokument: Record<string, unknown> | null
  try {
    dokument = alsObjekt(leseYaml(text))
  } catch (fehler) {
    return [`ungültiges YAML: ${(fehler instanceof Error ? fehler.message : String(fehler)).split('\n')[0]}`]
  }
  if (!dokument) return ['kein YAML-Objekt']
  const befunde: string[] = []

  const ausloeser = alsObjekt(dokument.on)
  if (!ausloeser) return ['on: fehlt oder ist kein Objekt (Kurzform ohne Branches)']
  if (JSON.stringify(Object.keys(ausloeser).sort()) !== JSON.stringify(['pull_request', 'push'])) {
    befunde.push(`Auslöser sind ${Object.keys(ausloeser).sort().join(', ')} statt pull_request, push`)
  }
  if (JSON.stringify(alsObjekt(ausloeser.push)?.branches) !== JSON.stringify(['main'])) befunde.push('push.branches ist nicht genau [main]')
  if (JSON.stringify(alsObjekt(ausloeser.pull_request)?.branches) !== JSON.stringify(PULL_REQUEST_BASEN)) {
    befunde.push(`pull_request.branches ist nicht genau ${JSON.stringify(PULL_REQUEST_BASEN)}`)
  }

  const gruppe = alsObjekt(dokument.concurrency)
  if (gruppe?.group !== CI_GRUPPE) befunde.push('concurrency.group ist nicht die Nummer des PRs (Rückfall: der Commit)')
  if (gruppe?.['cancel-in-progress'] !== CI_ABBRUCH) befunde.push('concurrency.cancel-in-progress bricht nicht nur PR-Läufe ab')

  const jobs = alsObjekt(dokument.jobs) ?? {}
  if (Object.keys(jobs).length === 0) befunde.push('keine Jobs')
  for (const [name, job] of Object.entries(jobs)) {
    const minuten = alsObjekt(job)?.['timeout-minutes']
    if (typeof minuten !== 'number' || !Number.isInteger(minuten) || minuten < 1 || minuten > MAX_TIMEOUT_MINUTEN) {
      befunde.push(`Job ${name}: timeout-minutes fehlt oder liegt nicht zwischen 1 und ${MAX_TIMEOUT_MINUTEN}`)
    }
  }
  return befunde
}

describe('Workflow-Wache — Auslöser, Gruppe und Zeitgrenzen von ci.yml (G3, Nr. 127)', () => {
  const ci = workflows.find((w) => w.name === 'ci.yml')?.text ?? ''

  it('ci.yml ist gültiges YAML mit genau diesen Auslösern, dieser Gruppe und Zeitgrenzen an beiden Jobs', () => {
    expect(pruefeCi(ci)).toEqual([])
    const jobs = alsObjekt(alsObjekt(leseYaml(ci))?.jobs)
    expect(Object.keys(jobs ?? {})).toEqual(['ci', 'integration'])
  })

  describe('Gegenprobe: jede Abwandlung des echten Textes schlägt an', () => {
    const abwandlungen: Record<string, (t: string) => string> = {
      'nacht/** fehlt': (t) => t.replace(", 'nacht/**'", ''),
      'integration/** fehlt': (t) => t.replace(", 'integration/**'", ''),
      'docs/** fehlt': (t) => t.replace(", 'docs/**'", ''),
      'Push auch auf andere Branches': (t) => t.replace('push:\n    branches: [main]', "push:\n    branches: [main, 'nacht/**']"),
      'pull_request_target statt pull_request': (t) => t.replace('  pull_request:\n', '  pull_request_target:\n'),
      'ein dritter Auslöser': (t) => t.replace('on:\n  push:', 'on:\n  schedule:\n    - cron: "0 3 * * *"\n  push:'),
      'immer abbrechen, auch auf main': (t) => t.replace(CI_ABBRUCH, 'true'),
      'Gruppe ohne Rückfall auf den Commit': (t) => t.replace('github.event.pull_request.number || github.sha', 'github.event.pull_request.number'),
      'Zeitgrenze des Jobs ci fehlt': (t) => t.replace('    timeout-minutes: 20\n', ''),
      'Zeitgrenze des Jobs integration fehlt': (t) => t.replace('    timeout-minutes: 15\n', ''),
      'Zeitgrenze von 6 Stunden': (t) => t.replace('timeout-minutes: 20', 'timeout-minutes: 360'),
      'ungeschützter Doppelpunkt in der Gruppe': (t) => t.replace('group: "ci-', 'group: ci: "'),
    }
    for (const [name, abwandeln] of Object.entries(abwandlungen)) {
      it(name, () => {
        const abgewandelt = abwandeln(ci)
        expect(abgewandelt).not.toBe(ci)
        expect(pruefeCi(abgewandelt).length).toBeGreaterThan(0)
      })
    }

    it('der Parser nennt bei ungültigem YAML Zeile und Grund', () => {
      const befunde = pruefeCi('on:\n  push: x: y\n')
      expect(befunde).toHaveLength(1)
      expect(befunde[0]).toMatch(/ungültiges YAML/)
    })
  })
})

// ─── Nr. 285: Sicherheitsmeldungen wöchentlich, Lint blockierend, Node aus .nvmrc ───────────────────────

const NVMRC = '.nvmrc'
const ENGINES_NODE = '>=22.12.0 <25'

type Schritt = { name?: unknown; uses?: unknown; run?: unknown; with?: Record<string, unknown>; 'continue-on-error'?: unknown }

/** Die Schritte je Job eines Workflow-Dokuments. */
function schritteJeJob(dokument: Record<string, unknown> | null): [string, Schritt[]][] {
  return Object.entries(alsObjekt(dokument?.jobs) ?? {}).map(([name, job]) => {
    const schritte = alsObjekt(job)?.steps
    return [name, Array.isArray(schritte) ? (schritte as Schritt[]) : []]
  })
}

/**
 * Verstöße von audit.yml (Abgleich gegen Sicherheitsmeldungen) gegen seine Regel. Leer = in Ordnung.
 * Nur Zeitplan und Handstart — nie ein PR-Auslöser, sonst machte eine neue Meldung jeden PR rot —, nur Leserechte,
 * kein Secret; Node aus .nvmrc, der Lauf ist `pnpm pruefen:audit`.
 */
function pruefeAudit(text: string): string[] {
  let dokument: Record<string, unknown> | null
  try {
    dokument = alsObjekt(leseYaml(text))
  } catch (fehler) {
    return [`ungültiges YAML: ${(fehler instanceof Error ? fehler.message : String(fehler)).split('\n')[0]}`]
  }
  const befunde: string[] = []
  const ausloeser = alsObjekt(dokument?.on)
  const schluessel = Object.keys(ausloeser ?? {}).sort()
  if (JSON.stringify(schluessel) !== JSON.stringify(['schedule', 'workflow_dispatch'])) {
    befunde.push(`Auslöser sind ${schluessel.join(', ') || String(dokument?.on)} statt schedule, workflow_dispatch`)
  }
  if (alsObjekt(dokument?.permissions)?.contents !== 'read') befunde.push('permissions.contents ist nicht read')
  if (/secrets\./.test(ohneKommentare(text))) befunde.push('nennt ein Secret (secrets.)')
  const schritte = schritteJeJob(dokument).flatMap(([, liste]) => liste)
  if (!schritte.some((s) => s.run === 'pnpm pruefen:audit')) befunde.push('kein Schritt ruft pnpm pruefen:audit')
  return befunde
}

/** Verstöße eines Workflows gegen „Node aus .nvmrc“: jeder setup-node-Schritt liest die Datei, keiner nennt eine Fassung. */
function pruefeNodeAusNvmrc(dokument: Record<string, unknown> | null): string[] {
  return schritteJeJob(dokument).flatMap(([job, schritte]) => {
    const setup = schritte.filter((s) => typeof s.uses === 'string' && s.uses.startsWith('actions/setup-node'))
    if (setup.length === 0) return [`Job ${job}: kein setup-node`]
    return setup.flatMap((s) => [
      ...(s.with?.['node-version-file'] !== NVMRC ? [`Job ${job}: setup-node liest nicht ${NVMRC}`] : []),
      ...(s.with?.['node-version'] !== undefined ? [`Job ${job}: setup-node nennt node-version`] : []),
    ])
  })
}

/** Verstöße von ci.yml gegen „Lint blockiert“: Den Schritt „Lint“ gibt es, ohne continue-on-error. */
function pruefeLintBlockiert(dokument: Record<string, unknown> | null): string[] {
  const lint = schritteJeJob(dokument).flatMap(([, schritte]) => schritte.filter((s) => s.name === 'Lint'))
  if (lint.length === 0) return ['kein Schritt „Lint“']
  return lint.some((s) => s['continue-on-error'] !== undefined) ? ['Schritt „Lint“ hat continue-on-error'] : []
}

/** Verstöße des Inhalts von .nvmrc: eine ganze Hauptfassung im erlaubten Bereich 22 ≤ n < 25 (von Hand verglichen). */
function pruefeNvmrc(inhalt: string): string[] {
  const text = inhalt.trim()
  if (!/^\d+$/.test(text)) return [`„${text}“ ist keine ganze Hauptfassung`]
  const fassung = Number.parseInt(text, 10)
  return fassung >= 22 && fassung < 25 ? [] : [`${fassung} liegt nicht in ${ENGINES_NODE}`]
}

describe('Workflow-Wache — Sicherheitsmeldungen, blockierender Lint, Node aus .nvmrc (Nr. 285)', () => {
  const audit = workflows.find((w) => w.name === 'audit.yml')?.text ?? ''
  const ci = workflows.find((w) => w.name === 'ci.yml')?.text ?? ''

  it('audit.yml läuft nur nach Zeitplan und von Hand, mit Leserechten, ohne Secret, mit pnpm pruefen:audit', () => {
    expect(workflows.map((w) => w.name)).toContain('audit.yml')
    expect(pruefeAudit(audit)).toEqual([])
    expect(pruefeNodeAusNvmrc(alsObjekt(leseYaml(audit)))).toEqual([])
  })

  it('ci.yml: der Schritt „Lint“ blockiert, beide Jobs lesen .nvmrc', () => {
    const dokument = alsObjekt(leseYaml(ci))
    expect(pruefeLintBlockiert(dokument)).toEqual([])
    expect(pruefeNodeAusNvmrc(dokument)).toEqual([])
    expect(schritteJeJob(dokument).map(([job]) => job)).toEqual(['ci', 'integration'])
  })

  it('package.json erlaubt genau >=22.12.0 <25, .nvmrc nennt eine Hauptfassung darin', () => {
    const paket = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as { engines?: { node?: unknown } }
    expect(paket.engines?.node).toBe(ENGINES_NODE)
    expect(pruefeNvmrc(readFileSync(join(process.cwd(), NVMRC), 'utf8'))).toEqual([])
  })

  describe('Gegenprobe: jede Abweichung schlägt an', () => {
    const attrappe = [
      'name: Attrappe',
      'on:',
      '  schedule:',
      "    - cron: '17 5 * * 1'",
      '  workflow_dispatch:',
      'permissions:',
      '  contents: read',
      'jobs:',
      '  pruefen:',
      '    runs-on: ubuntu-latest',
      '    steps:',
      '      - uses: actions/setup-node@v4',
      '        with:',
      '          node-version-file: .nvmrc',
      '      - run: pnpm pruefen:audit',
      '',
    ].join('\n')

    it('die Attrappe selbst ist in Ordnung', () => {
      expect(pruefeAudit(attrappe)).toEqual([])
      expect(pruefeNodeAusNvmrc(alsObjekt(leseYaml(attrappe)))).toEqual([])
    })

    const abwandlungen: Record<string, (t: string) => string> = {
      'ein PR-Auslöser dazu': (t) => t.replace('  workflow_dispatch:\n', '  workflow_dispatch:\n  pull_request:\n'),
      'Push statt Handstart': (t) => t.replace('  workflow_dispatch:\n', '  push:\n'),
      'Schreibrechte': (t) => t.replace('contents: read', 'contents: write'),
      'keine Rechte-Angabe': (t) => t.replace('permissions:\n  contents: read\n', ''),
      'ein Secret im Schritt': (t) => t.replace('      - run: pnpm pruefen:audit', '      - run: pnpm pruefen:audit\n        env:\n          T: ${{ secrets.TOKEN }}'),
      'ein anderer Befehl': (t) => t.replace('pnpm pruefen:audit', 'pnpm audit --fix'),
    }
    for (const [name, abwandeln] of Object.entries(abwandlungen)) {
      it(`audit: ${name}`, () => {
        const abgewandelt = abwandeln(attrappe)
        expect(abgewandelt).not.toBe(attrappe)
        expect(pruefeAudit(abgewandelt).length).toBeGreaterThan(0)
      })
    }

    it('Node: feste Fassung statt .nvmrc, in der Attrappe und im echten ci.yml', () => {
      expect(pruefeNodeAusNvmrc(alsObjekt(leseYaml(attrappe.replace('node-version-file: .nvmrc', 'node-version: 22'))))).toEqual([
        'Job pruefen: setup-node liest nicht .nvmrc',
        'Job pruefen: setup-node nennt node-version',
      ])
      const zweiterJob = ci.lastIndexOf('node-version-file: .nvmrc')
      expect(zweiterJob).toBeGreaterThan(ci.indexOf('node-version-file: .nvmrc'))
      const abgewandelt = `${ci.slice(0, zweiterJob)}node-version: 22${ci.slice(zweiterJob + 'node-version-file: .nvmrc'.length)}`
      expect(pruefeNodeAusNvmrc(alsObjekt(leseYaml(abgewandelt)))).toEqual([
        'Job integration: setup-node liest nicht .nvmrc',
        'Job integration: setup-node nennt node-version',
      ])
    })

    it('Lint: continue-on-error am echten Schritt und ein fehlender Schritt', () => {
      const mitAusnahme = ci.replace('      - name: Lint\n', '      - name: Lint\n        continue-on-error: true\n')
      expect(mitAusnahme).not.toBe(ci)
      expect(pruefeLintBlockiert(alsObjekt(leseYaml(mitAusnahme)))).toEqual(['Schritt „Lint“ hat continue-on-error'])
      expect(pruefeLintBlockiert(alsObjekt(leseYaml(ci.replace('      - name: Lint\n', '      - name: Prüfen\n'))))).toEqual(['kein Schritt „Lint“'])
    })

    it('.nvmrc: nur eine ganze Hauptfassung von 22 bis 24', () => {
      expect(pruefeNvmrc('24\n')).toEqual([])
      expect(pruefeNvmrc('22')).toEqual([])
      expect(pruefeNvmrc('24.1')).toHaveLength(1)
      expect(pruefeNvmrc('lts/*')).toHaveLength(1)
      expect(pruefeNvmrc('v24')).toHaveLength(1)
      expect(pruefeNvmrc('21')).toEqual([`21 liegt nicht in ${ENGINES_NODE}`])
      expect(pruefeNvmrc('25')).toEqual([`25 liegt nicht in ${ENGINES_NODE}`])
    })
  })
})
