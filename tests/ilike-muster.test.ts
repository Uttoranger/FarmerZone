/**
 * genauesIlikeMuster (src/lib/ilike-muster.ts): Prisma übersetzt `equals` mit
 * `mode: 'insensitive'` in ein ILIKE ohne Maskierung. Das Muster muss genau
 * den Text treffen — „_" und „%" sind danach keine Platzhalter mehr, ein
 * Backslash keine Maskierung. Dass Postgres das Muster so liest, beweist
 * tests/integration/anmeldecode.int.test.ts gegen eine echte Datenbank.
 */
import { describe, expect, it } from 'vitest'
import { genauesIlikeMuster } from '@/lib/ilike-muster'

describe('genauesIlikeMuster', () => {
  it('maskiert „_" und „%" — sie wären sonst Platzhalter', () => {
    expect(genauesIlikeMuster('max_hof@example.com')).toBe('max\\_hof@example.com')
    expect(genauesIlikeMuster('a%b@example.com')).toBe('a\\%b@example.com')
    expect(genauesIlikeMuster('__%%')).toBe('\\_\\_\\%\\%')
  })

  it('verdoppelt einen Backslash, bevor er „_" oder „%" maskieren könnte', () => {
    expect(genauesIlikeMuster('a\\b')).toBe('a\\\\b')
    // „\_" im Text heißt: Backslash UND Unterstrich, beide wörtlich.
    expect(genauesIlikeMuster('a\\_b')).toBe('a\\\\\\_b')
  })

  it('Gegenprobe: eine gewöhnliche Adresse bleibt unverändert', () => {
    expect(genauesIlikeMuster('kundin-01@example.com')).toBe('kundin-01@example.com')
    expect(genauesIlikeMuster('')).toBe('')
  })
})
