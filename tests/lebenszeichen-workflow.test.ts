/**
 * Der Workflow des Lebenszeichens (Register N18, Nr. 113) — statisch geprüft,
 * ohne GitHub (.github/workflows/lebenszeichen.yml).
 *
 * Beweist:
 *  - Auslöser nur Zeitplan (`17 7 * * *`, UTC) und Handstart — kein PR-Ereignis.
 *  - `permissions: {}`, kein Checkout, keine Action von außen (`uses:`).
 *  - Ein Schritt: `curl -fsS --max-time 20` mit dem Bearer-Token aus der
 *    Umgebung gegen die Produktionsadresse; das Secret steht nur unter `env:`,
 *    nie als Ausdruck in der `run:`-Zeile.
 * Die Adresse kommt aus PRODUKTION_HOST (Register M1): Ein Domainwechsel zieht
 * diese Prüfung mit, die YAML-Datei muss dann nachziehen.
 *
 * Gegenproben: Jede Regel schlägt an einer veränderten Fassung an.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PRODUKTION_HOST } from '@/lib/umgebung'

const TEXT = readFileSync(join(process.cwd(), '.github/workflows/lebenszeichen.yml'), 'utf8')
const ADRESSE = `https://${PRODUKTION_HOST}/api/lebenszeichen`

/** Die Zeilen ohne Kommentare — ein Kommentar darf von einer Regel erzählen, ohne sie zu brechen. */
function ohneKommentare(text: string): string {
  return text
    .split('\n')
    .map((z) => (/^\s*#/.test(z) ? '' : z.replace(/\s+#.*$/, '')))
    .join('\n')
}

/** Alle Verstöße gegen die Regeln aus der Freigabe (Nr. 113). Leer = in Ordnung. */
function pruefeWorkflow(text: string): string[] {
  const code = ohneKommentare(text)
  const befunde: string[] = []
  if (!/^on:\n {2}schedule:\n {4}- cron: '17 7 \* \* \*'\n {2}workflow_dispatch:\n/m.test(code)) befunde.push('Auslöser nicht Zeitplan 17 7 und Handstart')
  if (/pull_request|push:|workflow_run|repository_dispatch|issue_comment/.test(code)) befunde.push('weiterer Auslöser')
  if (!/^permissions: \{\}$/m.test(code) || /^[ \t]+permissions:/m.test(code)) befunde.push('nicht permissions: {}')
  if (/uses:/.test(code)) befunde.push('Action von außen (Checkout o. ä.)')
  const run = code.split('\n').filter((z) => /^\s*(- )?run:/.test(z))
  if (run.length !== 1) befunde.push('nicht genau ein run-Schritt')
  else {
    const zeile = run[0]
    if (!zeile.includes(`curl -fsS --max-time 20 -H "Authorization: Bearer $TOKEN" ${ADRESSE}`)) befunde.push('Aufruf nicht wie verlangt')
    if (/\$\{\{/.test(zeile)) befunde.push('Ausdruck in der run-Zeile')
  }
  const ausdruecke = code.match(/\$\{\{[^}]*\}\}/g) ?? []
  if (ausdruecke.length !== 1 || !/^\s+TOKEN: \$\{\{ secrets\.LEBENSZEICHEN_TOKEN \}\}$/m.test(code)) befunde.push('Secret nicht genau einmal unter env: TOKEN')
  return befunde
}

describe('lebenszeichen.yml', () => {
  it('hält alle Regeln ein', () => {
    expect(pruefeWorkflow(TEXT)).toEqual([])
  })
})

describe('lebenszeichen.yml — Gegenproben', () => {
  it('ein PR-Auslöser schlägt an', () => {
    expect(pruefeWorkflow(TEXT.replace('  workflow_dispatch:\n', '  workflow_dispatch:\n  pull_request:\n'))).toContain('weiterer Auslöser')
  })

  it('Rechte im Job oder ohne leeres permissions schlagen an', () => {
    expect(pruefeWorkflow(TEXT.replace('permissions: {}', 'permissions:\n  contents: read'))).toContain('nicht permissions: {}')
    expect(pruefeWorkflow(TEXT.replace('    runs-on: ubuntu-latest', '    runs-on: ubuntu-latest\n    permissions:\n      contents: read'))).toContain('nicht permissions: {}')
  })

  it('ein Checkout schlägt an', () => {
    expect(pruefeWorkflow(TEXT.replace('    steps:\n', '    steps:\n      - uses: actions/checkout@v4\n'))).toContain('Action von außen (Checkout o. ä.)')
  })

  it('das Secret direkt in der run-Zeile schlägt an', () => {
    expect(pruefeWorkflow(TEXT.replace('Bearer $TOKEN', 'Bearer ${{ secrets.LEBENSZEICHEN_TOKEN }}'))).toContain('Ausdruck in der run-Zeile')
  })

  it('ohne -f (ein 503 ließe den Workflow grün) oder mit anderer Adresse schlägt an', () => {
    expect(pruefeWorkflow(TEXT.replace('curl -fsS', 'curl -sS'))).toContain('Aufruf nicht wie verlangt')
    expect(pruefeWorkflow(TEXT.replace(ADRESSE, 'https://example.org/api/lebenszeichen'))).toContain('Aufruf nicht wie verlangt')
  })
})
