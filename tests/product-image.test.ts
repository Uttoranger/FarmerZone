/**
 * Tests für das Kategorie-Fallback-Bild-Mapping (src/lib/product-image.ts).
 *
 * Beweist: category → /categories/{slug}.webp, null/fehlende Kategorie → null,
 * fehlende Asset-Datei → null (die WebP-Assets folgen als eigener Commit).
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { categoryImagePath } from '@/lib/product-image'

describe('categoryImagePath', () => {
  it('mappt Kategorien auf /categories/{slug}.webp, wenn die Datei existiert', () => {
    const exists = () => true
    expect(categoryImagePath('MILCH', exists)).toBe('/categories/milch.webp')
    expect(categoryImagePath('EIER', exists)).toBe('/categories/eier.webp')
    expect(categoryImagePath('GEMUESE', exists)).toBe('/categories/gemuese.webp')
    expect(categoryImagePath('BRENNHOLZ', exists)).toBe('/categories/brennholz.webp')
    expect(categoryImagePath('SONSTIGES', exists)).toBe('/categories/sonstiges.webp')
  })

  it('gibt null zurück, wenn die Asset-Datei fehlt', () => {
    expect(categoryImagePath('MILCH', () => false)).toBeNull()
  })

  it('gibt null zurück ohne Kategorie', () => {
    expect(categoryImagePath(null)).toBeNull()
    expect(categoryImagePath(undefined)).toBeNull()
  })

  it('prüft gegen das echte Dateisystem: vorhandene Assets liefern den Pfad, fehlende null', () => {
    // Seit dem Illustrationen-Commit existieren die 5 Kern-Assets …
    expect(categoryImagePath('MILCH')).toBe('/categories/milch.webp')
    // … die übrigen liefert der Betreiber nach und muss sie NUR ablegen —
    // deshalb entscheidet hier das Dateisystem, nicht eine feste Erwartung
    // (eine harte `null`-Erwartung bräche in dem Moment, in dem gemuese.webp
    // ankommt). Der Rückfall selbst steht oben mit `() => false` unter Test.
    const gemuese = fs.existsSync(path.join(process.cwd(), 'public', 'categories', 'gemuese.webp'))
    expect(categoryImagePath('GEMUESE')).toBe(gemuese ? '/categories/gemuese.webp' : null)
  })

  it('fragt die Existenz mit dem relativen public-Pfad ab', () => {
    const seen: string[] = []
    categoryImagePath('HONIG', (p) => {
      seen.push(p)
      return false
    })
    expect(seen).toEqual(['categories/honig.webp'])
  })
})
