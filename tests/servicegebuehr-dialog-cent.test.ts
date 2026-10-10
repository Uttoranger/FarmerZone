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
import { MINDESTGEBUEHR_UNGUELTIG, mindestgebuehrCent, prozentsatzEingabe } from '@/lib/admin-hoefe'
import { PROZENT_UNGUELTIG, servicegebuehrEinstellungSchema } from '@/schemas/servicegebuehr'

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

/*
 * Prozentsatz (Nr. 35): Das Schema nimmt ihn nur noch als Zahl (ohne
 * z.coerce). Der Dialog wandelt den getippten Text über die Ziffern in
 * Hundertstel-Prozent und schickt die Zahl; Unlesbares fängt er mit einem Satz ab.
 */
describe('prozentsatzEingabe', () => {
  it.each([
    ['5', 5],
    ['4,9', 4.9],
    ['4.9', 4.9],
    ['0', 0],
    ['0,01', 0.01],
    ['100', 100],
    [' 7,25 ', 7.25],
  ])('„%s" → %d', (eingabe, prozent) => {
    expect(prozentsatzEingabe(eingabe)).toBe(prozent)
  })

  it.each([[''], ['  '], ['abc'], ['1e1'], ['-1'], ['4,999'], ['100,01'], ['101'], ['1.000']])('„%s" → null', (eingabe) => {
    expect(prozentsatzEingabe(eingabe)).toBeNull()
  })

  it('jedes Ergebnis besteht das Schema des Servers (zwei Nachkommastellen, 0–100)', () => {
    for (let h = 0; h <= 10_000; h++) {
      const text = `${Math.floor(h / 100)},${String(h % 100).padStart(2, '0')}`
      const prozent = prozentsatzEingabe(text)
      expect(prozent).toBe(h / 100)
      const ergebnis = servicegebuehrEinstellungSchema.safeParse({ percent: prozent, minCents: 0, activeFrom: null })
      if (!ergebnis.success) throw new Error(`${text} abgelehnt`)
    }
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

  it('schickt den Prozentsatz als Zahl, nie als Text; bei null ein Satz und kein Aufruf', () => {
    expect(QUELLE).toMatch(/const prozentsatz = prozentsatzEingabe\(prozent\)/)
    const block = /const prozentsatz = prozentsatzEingabe\(prozent\)([\s\S]*?)setServiceFeeAction\(/.exec(QUELLE)?.[1] ?? ''
    expect(block).toMatch(/if \(prozentsatz === null\)/)
    expect(block).toMatch(/setFehler\(PROZENT_UNGUELTIG\)/)
    expect(QUELLE).toMatch(/percent: prozentsatz,/)
    expect(QUELLE).not.toMatch(/percent:[^,\n]*prozent\.replace/)
  })

  it('Gegenprobe: der alte Prozent-Weg wird erkannt', () => {
    expect("percent: prozent.replace(',', '.'),").toMatch(/percent:[^,\n]*prozent\.replace/)
  })

  it('der Satz für den Prozentsatz kommt aus dem Schema', () => {
    expect(PROZENT_UNGUELTIG).toMatch(/Prozentsatz/)
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
