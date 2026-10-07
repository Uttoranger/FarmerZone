/**
 * Mindestgebühr im Servicegebühr-Dialog des Admins (Nr. 32, Runde 1): Der
 * getippte Euro-Betrag wird über `mindestgebuehrCent` (src/lib/admin-hoefe.ts
 * → `euroEingabeZuCent`) zu ganzen Cent — nie `Math.round(Number(text) * 100)`.
 * Ein ungültiger Betrag wird im Dialog mit einem Satz abgefangen; Rohtext geht
 * nie an den Server (der Server las „1e2" sonst als 100 CENT).
 * Leer bleibt wie bisher 0 € (konservativ: so verhielt sich das Feld immer).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { MINDESTGEBUEHR_UNGUELTIG, mindestgebuehrCent } from '@/lib/admin-hoefe'

describe('mindestgebuehrCent', () => {
  it.each([
    ['0,50', 50],
    ['0.5', 50],
    ['1,5', 150],
    ['0,29', 29],
    ['', 0],
    ['   ', 0],
  ])('„%s" → %i Cent', (eingabe, cent) => {
    expect(mindestgebuehrCent(eingabe)).toBe(cent)
  })

  it.each([['1e2'], ['abc'], ['-1'], ['0,555'], ['1.000,00']])('„%s" → null', (eingabe) => {
    expect(mindestgebuehrCent(eingabe)).toBeNull()
  })

  it('der Fehlersatz ist deutsch und nennt ein Beispiel', () => {
    expect(MINDESTGEBUEHR_UNGUELTIG).toBe('Gib die Mindestgebühr als Betrag in Euro ein, zum Beispiel 0,50.')
  })
})

describe('Servicegebühr-Dialog — Quelltext', () => {
  const QUELLE = readFileSync(join(process.cwd(), 'src/components/admin/servicegebuehr-dialog.tsx'), 'utf8')

  it('wandelt über mindestgebuehrCent, nicht über Number', () => {
    expect(QUELLE).toMatch(/mindestgebuehrCent\(mindestEuro\)/)
    expect(QUELLE).not.toMatch(/Math\.round\(\s*Number\(/)
  })

  it('bei null: Satz im Dialog und KEIN Aufruf des Servers', () => {
    const block = /const mindest = mindestgebuehrCent\(mindestEuro\)([\s\S]*?)setServiceFeeAction\(/.exec(QUELLE)?.[1] ?? ''
    expect(block).toMatch(/if \(mindest === null\)/)
    expect(block).toMatch(/setFehler\(MINDESTGEBUEHR_UNGUELTIG\)/)
    expect(block).toMatch(/return/)
  })

  it('schickt nur die Cent-Zahl, nie den Rohtext', () => {
    expect(QUELLE).toMatch(/minCents: mindest,/)
    expect(QUELLE).not.toMatch(/minCents:[^,\n]*mindestEuro/)
  })

  it('Gegenprobe: der alte Weg wird erkannt', () => {
    const alt = 'const mindest = Math.round(Number(mindestEuro.replace(\',\', \'.\')) * 100)\nminCents: Number.isFinite(mindest) ? mindest : mindestEuro,'
    expect(alt).toMatch(/Math\.round\(\s*Number\(/)
    expect(alt).toMatch(/minCents:[^,\n]*mindestEuro/)
  })

  it('die alte Datei unter src/app/admin gibt es nicht mehr', () => {
    expect(() => readFileSync(join(process.cwd(), 'src/app/admin/servicegebuehr-einstellung.tsx'))).toThrow()
  })
})
