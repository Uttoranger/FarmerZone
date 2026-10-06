/**
 * genauesIlikeMuster (src/lib/ilike-muster.ts): Prisma übersetzt `equals` mit
 * `mode: 'insensitive'` in ein ILIKE ohne Maskierung. Das Muster muss genau
 * den Text treffen — „_" und „%" sind danach keine Platzhalter mehr, ein
 * Backslash keine Maskierung. Dass Postgres das Muster so liest, beweisen
 * tests/integration/anmeldecode.int.test.ts und
 * tests/integration/bestellungen-finden.int.test.ts gegen eine echte Datenbank.
 *
 * Einzige Stelle für diese Tests: Die Anmeldung (Nr. 08) und „Bestellungen
 * finden" (Nr. 14) nutzen dieselbe Funktion.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { genauesIlikeMuster } from '@/lib/ilike-muster'

describe('genauesIlikeMuster', () => {
  it('maskiert „_" und „%" — sie wären sonst Platzhalter', () => {
    expect(genauesIlikeMuster('max_hof@example.com')).toBe('max\\_hof@example.com')
    // „Bestellungen finden": a_b@ darf die Bestellungen von axb@ nicht treffen.
    expect(genauesIlikeMuster('a_b@example.com')).toBe('a\\_b@example.com')
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

/** Alle .ts/.tsx-Dateien unter einem Ordner, rekursiv. */
function quelldateien(ordner: string): string[] {
  return readdirSync(ordner, { withFileTypes: true }).flatMap((eintrag) => {
    const pfad = join(ordner, eintrag.name)
    if (eintrag.isDirectory()) return quelldateien(pfad)
    return /\.tsx?$/.test(eintrag.name) ? [pfad] : []
  })
}

describe('eine Quelle', () => {
  it('genauesIlikeMuster steht nur in src/lib/ilike-muster.ts — zwei Kopien laufen sonst auseinander', () => {
    const src = join(__dirname, '..', 'src')
    const fundorte = quelldateien(src)
      .filter((datei) => /function\s+genauesIlikeMuster\b|genauesIlikeMuster\s*=/.test(readFileSync(datei, 'utf8')))
      .map((datei) => datei.slice(src.length + 1).replaceAll('\\', '/'))
    expect(fundorte).toEqual(['lib/ilike-muster.ts'])
  })
})
