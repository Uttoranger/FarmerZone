/**
 * Die Action, die den Branch staging nachzieht (Register Z3, Nachtlauf
 * Nr. 43) — statisch geprüft, ohne GitHub (.github/workflows/staging-nachziehen.yml).
 *
 * Beweist:
 *  - Auslöser ist nur ein Push auf main, nie ein PR-Ereignis (schon gar
 *    nicht die _target-Variante mit Base-Rechten).
 *  - Schreibrecht gibt es nur im Job; oben steht `permissions: {}`.
 *  - Kein Überschreiben: kein --force, kein +Refspec, kein Löschen; vor dem
 *    Push prüft `git merge-base --is-ancestor`, sonst endet der Job rot.
 *  - Keine Secrets außer dem eingebauten Token, kein Ausdruck ${{ … }}.
 *
 * Gegenproben: Die Prüfung schlägt an jeder Stelle an, an der eine veränderte
 * Fassung der Datei die Regel bricht.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const DATEI = join(process.cwd(), '.github/workflows/staging-nachziehen.yml')
const TEXT = readFileSync(DATEI, 'utf8')

/** Die Zeilen ohne Kommentare — ein Kommentar darf von einer Regel erzählen, ohne sie zu brechen. */
function zeilenOhneKommentar(text: string): string[] {
  return text.split('\n').map((z) => (/^\s*#/.test(z) ? '' : z.replace(/\s+#.*$/, '')))
}

/** Alle Verstöße gegen die Regeln aus freigabe.md §12 (Nr. 43). Leer = in Ordnung. */
function pruefeWorkflow(text: string): string[] {
  const befunde: string[] = []
  const zeilen = zeilenOhneKommentar(text)
  const code = zeilen.join('\n')

  if (/pull_request_target/.test(text)) befunde.push('pull_request_target')
  if (!/^on:\n {2}push:\n {4}branches: \[main\]\n/m.test(code)) befunde.push('Auslöser nicht nur push auf main')
  if (/^\s*(pull_request|workflow_run|workflow_dispatch|schedule|repository_dispatch|issue_comment):/m.test(code)) {
    befunde.push('weiterer Auslöser')
  }

  if (!/^permissions: \{\}$/m.test(code)) befunde.push('oben nicht permissions: {}')
  const schreibrechte = zeilen.filter((z) => /contents:\s*write/.test(z))
  if (schreibrechte.length !== 1 || !/^ {6}contents: write$/.test(schreibrechte[0] ?? '')) {
    befunde.push('contents: write nicht genau einmal im Job')
  }
  if (/:\s*write/.test(code.replace(/^ {6}contents: write$/m, ''))) befunde.push('weiteres Schreibrecht')

  const pushZeilen = zeilen.filter((z) => /\bgit push\b/.test(z))
  if (pushZeilen.length === 0) befunde.push('kein git push')
  for (const z of pushZeilen) {
    if (/--force|--force-with-lease|(^|\s)-f(\s|$)|--mirror|--all|--delete|--prune|(^|\s)\+|\s:refs\//.test(z)) {
      befunde.push(`überschreibender Push: ${z.trim()}`)
    }
  }
  const pruefung = code.indexOf('git merge-base --is-ancestor')
  if (pruefung === -1 || pruefung > code.indexOf('git push')) befunde.push('keine Fast-Forward-Prüfung vor dem Push')
  if (!/exit 1/.test(code)) befunde.push('kein roter Ausgang')

  if (/secrets\./.test(code)) befunde.push('Secret benutzt')
  // Keine Ausdrücke überhaupt: Die Action braucht keine, und ein ${{ … }} in
  // einem run:-Block setzte Fremdtext (Commit-Nachricht, Branch-Name) in die Shell.
  if (/\$\{\{/.test(code)) befunde.push('Ausdruck im Workflow')
  if (!/uses: actions\/checkout@v4\b/.test(code)) befunde.push('checkout nicht wie die anderen Workflows gepinnt')
  return befunde
}

describe('staging-nachziehen.yml', () => {
  it('hält alle Regeln ein', () => {
    expect(pruefeWorkflow(TEXT)).toEqual([])
  })

  it('setzt staging genau auf main — Ziel ist der Branch staging, Quelle main', () => {
    expect(TEXT).toMatch(/git push origin [^\n]*main:refs\/heads\/staging/)
    expect(TEXT).toMatch(/fetch-depth: 0/)
  })

  it('legt staging nicht selbst an — fehlt der Branch, endet der Job rot mit Hinweis', () => {
    expect(TEXT).toMatch(/refs\/remotes\/origin\/staging/)
    expect(TEXT).toMatch(/docs\/betrieb\/testumgebung\.md/)
  })
})

describe('Gegenproben: die Prüfung schlägt an', () => {
  const ersetze = (alt: string | RegExp, neu: string): string => {
    const veraendert = TEXT.replace(alt, neu)
    expect(veraendert, `Muster nicht gefunden: ${String(alt)}`).not.toBe(TEXT)
    return veraendert
  }

  it('bei einem PR-Auslöser mit Base-Rechten', () => {
    expect(pruefeWorkflow(ersetze(/^ {2}push:$/m, '  pull_request_target:'))).toContain('pull_request_target')
  })

  it('bei einem zusätzlichen Auslöser', () => {
    expect(pruefeWorkflow(ersetze(/^on:\n/m, 'on:\n  workflow_dispatch:\n'))).toContain('weiterer Auslöser')
  })

  it('bei Schreibrecht oben statt im Job', () => {
    const befunde = pruefeWorkflow(ersetze(/^permissions: \{\}$/m, 'permissions:\n  contents: write'))
    expect(befunde).toContain('oben nicht permissions: {}')
    expect(befunde).toContain('contents: write nicht genau einmal im Job')
  })

  it('bei einem Force-Push in jeder Schreibweise', () => {
    for (const art of ['--force ', '-f ', '--force-with-lease ']) {
      const befunde = pruefeWorkflow(ersetze(/git push origin /, `git push ${art}origin `))
      expect(befunde.some((b) => b.startsWith('überschreibender Push')), art).toBe(true)
    }
    const plus = pruefeWorkflow(ersetze(/git push origin (\S+)/, 'git push origin +$1'))
    expect(plus.some((b) => b.startsWith('überschreibender Push'))).toBe(true)
  })

  it('ohne Fast-Forward-Prüfung', () => {
    expect(pruefeWorkflow(ersetze(/git merge-base --is-ancestor/g, 'true'))).toContain('keine Fast-Forward-Prüfung vor dem Push')
  })

  it('bei einem Secret oder einem Ausdruck', () => {
    expect(pruefeWorkflow(`${TEXT}\n        env:\n          X: \${{ secrets.ETWAS }}\n`)).toContain('Secret benutzt')
    expect(pruefeWorkflow(`${TEXT}\n      - run: |\n          echo "\${{ github.event.head_commit.message }}"\n`)).toContain('Ausdruck im Workflow')
  })

  it('ein Kommentar über die Regeln ist kein Verstoß', () => {
    expect(pruefeWorkflow(`# kein --force, kein workflow_dispatch:\n${TEXT}`)).toEqual([])
  })
})
