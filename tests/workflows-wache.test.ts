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
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

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
