/**
 * Wache: Einzeilige `run:`-Werte in .github/workflows/ bleiben gültiges YAML (Nachtrag zu Nr. 113).
 *
 * Ursache: `lebenszeichen.yml` hatte `run: curl … -H "Authorization: Bearer $TOKEN" …` als ungeschützten
 * Wert. In einem ungeschützten YAML-Wert beginnt „: “ ein neues Schlüssel-Wert-Paar — der Parser bricht ab
 * („mapping values are not allowed here“), GitHub verwirft die ganze Datei: kein Name, kein „Run workflow“,
 * kein Zeitplan, bei jedem Push ein roter Lauf. „ #“ beginnt dort einen Kommentar und schneidet den Befehl
 * still ab. Beides fällt in keinem Test der App auf, nur bei GitHub.
 *
 * Beweist (jede .yml/.yaml in .github/workflows/, Zeile für Zeile; der Zeilenteil liest ohne YAML-Paket, der Parser steht im zweiten Teil):
 *  - Eine Zeile `run: <wert>` (auch `- run:`), deren Wert nicht mit ', ", | oder > beginnt, enthält weder
 *    „: “ (bzw. einen Doppelpunkt am Zeilenende) noch „ #“. Ein Befund nennt Datei und Zeile.
 *  - Gegenprobe: die alte Zeile aus lebenszeichen.yml schlägt an, ebenso „ #“ und die Form `- run:`;
 *    der Wert in einfachen Anführungszeichen (die echte Zeile der Datei), ein `run: |`-Block und ein Befehl
 *    ohne Doppelpunkt nicht.
 * Seit Nr. 127 liest ein echter YAML-Parser (`tests/yaml-lader.ts`, das Entwicklungspaket `yaml` seit Nr. 135) jede Datei vollständig: ungültiges YAML,
 * auch dort, wo die Zeilenprüfung nichts sieht (Folgezeilen, Kurzformen), macht den Test rot.
 * Grenze der Zeilenprüfung: Geprüft wird nur die Zeile mit `run:` und Wert — so schreiben wir Workflows. Ein Wert erst in der
 * nächsten Zeile, Folgezeilen eines mehrzeiligen ungeschützten Werts und die Kurzform `- { run: … }` sieht
 * die Wache nicht (heute in keinem Workflow); dafür bräuchte es einen YAML-Parser.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PRODUKTION_HOST } from '@/lib/umgebung'
import { leseYaml } from './yaml-lader'

const ORDNER = '.github/workflows'

/** Eine `run:`-Zeile mit Wert auf derselben Zeile; Kommentarzeilen beginnen mit # und fallen heraus. */
const RUN_ZEILE = /^\s*(?:-\s+)?run:[ \t]+(.*)$/

/** Befunde „<datei>:<zeile> …“ für den Text einer Workflow-Datei. Leer = in Ordnung. */
function pruefeRunZeilen(datei: string, text: string): string[] {
  const befunde: string[] = []
  text.split(/\r?\n/).forEach((zeile, i) => {
    const wert = RUN_ZEILE.exec(zeile)?.[1]
    // Geschützte Werte (Anführungszeichen, Block mit | oder >) dürfen Doppelpunkt und # tragen.
    if (wert === undefined || /^['"|>]/.test(wert)) return
    if (/:(?:[ \t]|$)/.test(wert)) befunde.push(`${datei}:${i + 1} – „: “ in einem ungeschützten run-Wert (in einfache Anführungszeichen setzen oder run: |)`)
    if (/[ \t]#/.test(wert)) befunde.push(`${datei}:${i + 1} – „ #“ in einem ungeschützten run-Wert (YAML schneidet dort ab)`)
  })
  return befunde
}

const DATEIEN = readdirSync(join(process.cwd(), ORDNER))
  .filter((name) => /\.ya?ml$/.test(name))
  .sort()

describe('Workflows – einzeilige run-Werte sind gültiges YAML', () => {
  it('findet die Workflow-Dateien (die Wache läuft nicht ins Leere)', () => {
    expect(DATEIEN).toContain('lebenszeichen.yml')
    expect(DATEIEN).toContain('ci.yml')
  })

  it('keine run-Zeile trägt „: “ oder „ #“ ungeschützt', () => {
    const befunde = DATEIEN.flatMap((name) =>
      pruefeRunZeilen(`${ORDNER}/${name}`, readFileSync(join(process.cwd(), ORDNER, name), 'utf8')),
    )
    expect(befunde).toEqual([])
  })
})

describe('Workflows – Gegenproben', () => {
  // Die Domain kommt aus PRODUKTION_HOST (Register M1), der Befehl ist derselbe wie in lebenszeichen.yml.
  const BEFEHL = `curl -fsS --max-time 20 -H "Authorization: Bearer $TOKEN" https://${PRODUKTION_HOST}/api/lebenszeichen`
  const ALT = `        run: ${BEFEHL}`
  const NEU = `        run: '${BEFEHL}'`

  it('die Gegenprobe hängt an der echten Zeile von lebenszeichen.yml', () => {
    const text = readFileSync(join(process.cwd(), ORDNER, 'lebenszeichen.yml'), 'utf8')
    expect(text.split(/\r?\n/)).toContain(NEU)
  })

  it('die alte Zeile aus lebenszeichen.yml schlägt an, mit Datei und Zeile', () => {
    const text = ['    steps:', '      - name: Abläufe gelaufen?', ALT].join('\n')
    expect(pruefeRunZeilen('x.yml', text)).toEqual([
      'x.yml:3 – „: “ in einem ungeschützten run-Wert (in einfache Anführungszeichen setzen oder run: |)',
    ])
  })

  it('„ #“, ein Doppelpunkt am Zeilenende und die Form „- run:“ schlagen an', () => {
    expect(pruefeRunZeilen('x.yml', '        run: pnpm test # alle Tests')).toHaveLength(1)
    expect(pruefeRunZeilen('x.yml', '        run: echo fertig:')).toHaveLength(1)
    expect(pruefeRunZeilen('x.yml', '      - run: echo "Status: ok"')).toHaveLength(1)
  })

  it('der Wert in Anführungszeichen, ein run-Block und ein Befehl ohne Doppelpunkt schlagen nicht an', () => {
    expect(pruefeRunZeilen('x.yml', NEU)).toEqual([])
    expect(pruefeRunZeilen('x.yml', `        run: "echo 'Status: ok'"`)).toEqual([])
    expect(pruefeRunZeilen('x.yml', ['        run: |', '          echo "Status: ok" # Kommentar im Block', '          pnpm test'].join('\n'))).toEqual([])
    expect(pruefeRunZeilen('x.yml', '        run: >-')).toEqual([])
    expect(pruefeRunZeilen('x.yml', '        run: pnpm install --frozen-lockfile')).toEqual([])
  })

  it('Kommentare, die von run: erzählen, schlagen nicht an', () => {
    expect(pruefeRunZeilen('x.yml', '# Das Secret steht nur unter env:, nie direkt in der run:-Zeile.')).toEqual([])
  })
})

describe('Workflows – jede Datei ist gültiges YAML (Parser, Nr. 127)', () => {
  it('der Parser liest jede Datei in .github/workflows/ ohne Fehler und findet einen Namen und Jobs', () => {
    for (const name of DATEIEN) {
      const text = readFileSync(join(process.cwd(), ORDNER, name), 'utf8')
      const dokument = leseYaml(text) as { name?: unknown; jobs?: unknown } | null
      expect(dokument, name).not.toBeNull()
      expect(typeof dokument?.name, `${name}: name`).toBe('string')
      expect(Object.keys((dokument?.jobs ?? {}) as object).length, `${name}: jobs`).toBeGreaterThan(0)
    }
  })

  it('Gegenprobe: die alte Zeile aus lebenszeichen.yml (ungeschützter Doppelpunkt) bricht den Parser', () => {
    const BEFEHL = `curl -fsS --max-time 20 -H "Authorization: Bearer $TOKEN" https://${PRODUKTION_HOST}/api/lebenszeichen`
    const alt = ['name: Attrappe', 'jobs:', '  a:', '    runs-on: ubuntu-latest', '    steps:', `      - run: ${BEFEHL}`].join('\n')
    // Der Parser nennt die Zeile des Fehlers (Zeile 6 = die run-Zeile).
    expect(() => leseYaml(alt)).toThrow(/\(6:\d+\)/)
    // Derselbe Befehl in einfachen Anführungszeichen ist gültig.
    expect(() => leseYaml(alt.replace(`run: ${BEFEHL}`, `run: '${BEFEHL}'`))).not.toThrow()
  })

  it('Gegenprobe: „ #“ im ungeschützten Wert schneidet still ab — der Parser liest nur den Anfang', () => {
    const dokument = leseYaml('run: pnpm test # alle Tests') as { run: string }
    expect(dokument.run).toBe('pnpm test')
  })

  it('YAML 1.2: „on:“ bleibt der Text „on“, kein Wahrheitswert (Nr. 135)', () => {
    // GitHub liest YAML 1.2, und die Wachen suchen den Schlüssel „on“. In YAML 1.1 würde er zu `true`.
    const dokument = leseYaml(readFileSync(join(process.cwd(), ORDNER, 'ci.yml'), 'utf8')) as Record<string, unknown>
    expect(Object.keys(dokument)).toContain('on')
    expect(Object.keys(dokument)).not.toContain('true')
    expect(leseYaml('on: push')).toEqual({ on: 'push' })
    expect(leseYaml('wert: on')).toEqual({ wert: 'on' })
  })
})
